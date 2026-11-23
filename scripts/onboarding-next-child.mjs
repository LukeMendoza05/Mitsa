// INACTIVE child entry. Requires a new approved D/E package, strict evidence,
// exact parent process, source hashes, private nonce and an unused owned launch.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {onboardingExecutionScope} from './lib/onboarding-execution-scope.mjs';
import {onboardingNextEnvironment} from './lib/onboarding-next-process.mjs';
import {startOnboardingNext} from './lib/onboarding-next-runtime.mjs';
import {disconnectCompletedTransportChild} from './lib/registration-transport-lifecycle.mjs';
import {onboardingFixtureTransport} from './lib/onboarding-fixture-transport.mjs';
import {onboardingPublicEvidence} from './lib/onboarding-public-evidence.mjs';
import {nextChildPrivateChannel} from './lib/onboarding-next-private-channel.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex'),read=path=>JSON.parse(readFileSync(path));
let runtime,scope,startTimer,absoluteWatchdog,disconnectWatchdog,nonce,closing,privateChannel,fixtureTransport,cleanupConfirmed=false;
const abort=new AbortController();
const killFailure=()=>{process.exitCode=1;process.kill(process.pid,'SIGKILL');};
const close=()=>closing??=(async()=>{
 try{if(runtime)await runtime.stop();cleanupConfirmed=true;}catch{process.exitCode=1;}
 finally{
  fixtureTransport?.stop();privateChannel?.close();
  clearTimeout(startTimer);
  if(cleanupConfirmed){clearTimeout(absoluteWatchdog);clearTimeout(disconnectWatchdog);}
  const done=()=>disconnectCompletedTransportChild(process,emergency);
  if(process.connected)process.send({kind:cleanupConfirmed?'next-stopped':'next-failed'},done);else done();
 }
})();
const emergency=()=>{process.exitCode=1;abort.abort();disconnectWatchdog??=setTimeout(killFailure,10000);if(runtime)void close();};
try{
 assert(process.argv.length===3&&process.argv[2]==='--child'&&process.send&&process.connected,'Owned child required');
 const root=resolve(process.env.MITSA_ONBOARDING_NEXT_ROOT??'');assert.equal(root,resolve('.secrets/registration-onboarding/DE-v1'));
 const reviewPath='config/registration-onboarding-review.json',reviewBytes=readFileSync(reviewPath),review=JSON.parse(reviewBytes);
 assert(review.hostedRunnerReady===true&&review.integratedOfflineAcceptance?.status==='PASSED','Integrated acceptance is not complete');
 for(const f of review.runtimeBuildFiles??[])assert(hash(readFileSync(f.path))===f.sha256,'Compiled Next runtime changed');assert(review.runtimeBuildFiles?.length>0,'Compiled runtime review missing');
 const authorization=read(root+'/approval.json'),strictEvidence=read(root+'/strict-evidence.json'),strictTrace=read(root+'/strict-trace.json');
 const fixtureBytes=readFileSync(review.privateFixtures.path);
 scope=onboardingExecutionScope({root,reviewBytes,fixtureBytes,authorization,strictEvidence,strictTrace});
 assert(existsSync('.next/BUILD_ID'));assert.equal(hash(readFileSync('.next/BUILD_ID')),review.nextBuildIdSha256,'Next build changed');
 const safe=onboardingNextEnvironment(process.env,process.env);for(const [name,value] of Object.entries(safe))assert.equal(process.env[name],value,'Next environment changed');
 process.once('disconnect',emergency);
 const initial=await new Promise((resolve,reject)=>{startTimer=setTimeout(()=>reject(Error('Owned launch handshake missing')),10000);process.once('message',resolve);});clearTimeout(startTimer);
 const attempt=read(root+'/next-attempt.json');assert(initial?.kind==='start-next'&&/^[a-f0-9]{64}$/.test(initial.nonce));
 assert.equal(attempt.parentPid,process.ppid);assert.equal(attempt.childPid,process.pid);assert.equal(attempt.nonceSha256,hash(initial.nonce));assert.equal(attempt.entrySha256,hash(readFileSync(fileURLToPath(import.meta.url))));assert.equal(attempt.reviewSha256,hash(reviewBytes));nonce=initial.nonce;
 const remaining=scope.executionClock.startedAt+(scope.limits.runtimeSeconds-30)*1000-Date.now();assert(remaining>0);absoluteWatchdog=setTimeout(killFailure,remaining);
 process.on('message',message=>{if(message?.kind==='stop-next'&&message.nonce===nonce){if(runtime)void close();else abort.abort();}});
 const failed=()=>{process.exitCode=1;abort.abort();if(runtime)void close();};
 assert(review.fixtureTransportVersion==='bound-provider-v1','Credential-bound execution review required');
 assert.equal(review.publicEvidenceKey.path,'.secrets/auth-mail/public.asc');assert.equal(hash(readFileSync(review.publicEvidenceKey.path)),review.publicEvidenceKey.sha256);
 assert.equal(resolve(review.privateRecoveryPasswords.path),resolve(root+'/recovery-passwords.json'));const recoveryBytes=readFileSync(review.privateRecoveryPasswords.path);assert.equal(hash(recoveryBytes),review.privateRecoveryPasswords.sha256);
 privateChannel=nextChildPrivateChannel({ipc:process,nonce,onFailure:failed,handle:async input=>{assert(fixtureTransport&&input&&['e-a','e-b'].includes(input.label));await fixtureTransport.registerProviderMessage(input.label,input.message);return true;}});
 const writer=await onboardingPublicEvidence({root:root+'/next-evidence',armoredPublicKey:readFileSync(review.publicEvidenceKey.path,'utf8'),onManifest:m=>privateChannel.request(m)}),sequences=new Map();
 const publishPrivate=observation=>{const sequence=(sequences.get(observation.label)??0)+1;sequences.set(observation.label,sequence);return writer({...observation,sequence,sourceSequence:observation.sequence});};
 fixtureTransport=onboardingFixtureTransport({scope,publicKey:process.env.SUPABASE_PUBLISHABLE_KEY,fetcher:globalThis.fetch.bind(globalThis),signal:abort.signal,now:()=>Date.now(),notices:review.noticeIds,recoveryPasswords:JSON.parse(recoveryBytes),
  assertExecutionReady:async()=>{scope.active();assert(process.connected&&!abort.signal.aborted);},persistPrivate:publishPrivate,
  assertNewIdentity:async(label,userId)=>{await publishPrivate({kind:'fixture-identity-candidate',label,userId});return true;},
  assertPersistentAdmission:label=>publishPrivate({kind:'persistent-admission-check',label})});
 const next=(await import('next')).default;
 runtime=await startOnboardingNext({assertOwnedLaunch:async()=>{scope.active();assert(process.connected&&!abort.signal.aborted);},scope,bindings:initial.bindings,
  createApplication:options=>next({...options,dev:false,dir:process.cwd()}),fetcher:globalThis.fetch.bind(globalThis),fixtureTransportFactory:(label,signal)=>fixtureTransport.forFixture(label,signal),signal:abort.signal,onFailure:failed});
 assert(process.connected&&!abort.signal.aborted);process.send({kind:'next-ready',origin:runtime.origin});
}catch(error){
 process.exitCode=1;abort.abort();clearTimeout(startTimer);
 fixtureTransport?.stop();privateChannel?.close();
 cleanupConfirmed=runtime?false:error?.cleanupConfirmed===true||!scope;
 if(process.connected)process.send({kind:'next-failed'});
 if(runtime)await close();else{
  if(!cleanupConfirmed)disconnectWatchdog??=setTimeout(killFailure,10000);
  if(cleanupConfirmed){clearTimeout(absoluteWatchdog);clearTimeout(disconnectWatchdog);}
  if(process.send)disconnectCompletedTransportChild(process,emergency);
  console.error(JSON.stringify({status:'ONBOARDING_NEXT_START_DENIED_NO_RETRY',privateValuesPrinted:false}));
 }
}
