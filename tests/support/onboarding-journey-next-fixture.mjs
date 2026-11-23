// OFFLINE only: real built Next + real fixture fence + encrypted ACK protocol.
// Low-level provider HTTP is redirected to one owned loopback fake server.
import assert from 'node:assert/strict';
import net from 'node:net';
import {syncBuiltinESMExports} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {onboardingExecutionScope} from '../../scripts/lib/onboarding-execution-scope.mjs';
import {startOnboardingNext} from '../../scripts/lib/onboarding-next-runtime.mjs';
import {onboardingFixtureTransport} from '../../scripts/lib/onboarding-fixture-transport.mjs';
import {onboardingPublicEvidence} from '../../scripts/lib/onboarding-public-evidence.mjs';
import {nextChildPrivateChannel} from '../../scripts/lib/onboarding-next-private-channel.mjs';
import {disconnectCompletedTransportChild} from '../../scripts/lib/registration-transport-lifecycle.mjs';
const connect=net.Socket.prototype.connect;let outsideAttempts=0;
net.Socket.prototype.connect=function(...args){let o=args[0];if(Array.isArray(o))o=o[0];const host=typeof o==='object'&&o!==null?o.host??o.hostname:typeof o==='number'?args[1]:null,pipe=typeof o==='object'&&typeof o.path==='string'||typeof o==='string'&&(/^(?:\\\\\.\\pipe\\|\/)/.test(o));if(!pipe&&!['127.0.0.1','localhost','::1'].includes(String(host))){outsideAttempts++;throw Error('OFFLINE outside socket blocked');}return connect.apply(this,args);};syncBuiltinESMExports();
const hash=v=>createHash('sha256').update(v).digest('hex');let app,channel,fence,nonce,timer,closing;const abort=new AbortController();
const emergency=()=>{process.exitCode=1;abort.abort();void close();};
const close=()=>closing??=(async()=>{try{await app?.stop();fence?.stop();channel?.close();assert(outsideAttempts===0);}catch{process.exitCode=1;}finally{clearTimeout(timer);if(process.connected)process.send({kind:'next-stopped'},()=>disconnectCompletedTransportChild(process,emergency));else disconnectCompletedTransportChild(process,emergency);}})();
try{
 const root=process.env.MITSA_ONBOARDING_NEXT_ROOT;assert(root&&root.includes('mitsa-journey-OFFLINE-'));const config=JSON.parse(readFileSync(root+'/offline-authority.json')),scope=onboardingExecutionScope({...config,root,reviewBytes:Buffer.from(config.reviewBytes),fixtureBytes:Buffer.from(config.fixtureBytes)}),review=JSON.parse(config.reviewBytes);
 process.once('disconnect',emergency);const initial=await new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(Error('OFFLINE owned handshake missing')),10000);process.once('message',resolve);});clearTimeout(timer);
 const owned=JSON.parse(readFileSync(root+'/next-attempt.json'));assert(initial.kind==='start-next'&&owned.parentPid===process.ppid&&owned.childPid===process.pid&&owned.nonceSha256===hash(initial.nonce));nonce=initial.nonce;
 const network=JSON.parse(readFileSync(root+'/offline-network.json'));assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(network.origin));const nativeFetch=globalThis.fetch.bind(globalThis),fetcher=async(input,init={})=>{const request=input instanceof Request?input:null;return nativeFetch(network.origin,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:request?.url??String(input),method:init.method??request?.method??'GET',headers:Object.fromEntries(new Headers(init.headers??request?.headers)),body:init.body?String(init.body):request?.body?await request.text():undefined}),signal:init.signal??abort.signal});};
 const fail=category=>{writeFileSync(root+'/offline-next-failure-'+Date.now()+'.json',JSON.stringify({category:typeof category==='string'?category:'private-channel',outsideAttempts}),{flag:'wx'});process.exitCode=1;abort.abort();void close();};
 channel=nextChildPrivateChannel({ipc:process,nonce,onFailure:fail,handle:async v=>{await fence.registerProviderMessage(v.label,v.message);return true;}});
 const writer=await onboardingPublicEvidence({root:root+'/next-evidence',armoredPublicKey:readFileSync(root+'/public.asc','utf8'),onManifest:m=>channel.request(m)}),sequences=new Map();
 const publish=v=>{const sequence=(sequences.get(v.label)??0)+1;sequences.set(v.label,sequence);return writer({...v,sourceSequence:v.sequence,sequence});};
 fence=onboardingFixtureTransport({scope,publicKey:process.env.SUPABASE_PUBLISHABLE_KEY,fetcher,signal:abort.signal,now:Date.now,notices:review.noticeIds,recoveryPasswords:JSON.parse(readFileSync(root+'/recovery-passwords.json')),persistPrivate:publish,assertExecutionReady:async()=>{scope.active();assert(process.connected&&!abort.signal.aborted);},assertNewIdentity:async(label,userId)=>{await publish({kind:'fixture-identity-candidate',label,userId});return true;},assertPersistentAdmission:label=>publish({kind:'persistent-admission-check',label})});
 const next=(await import('next')).default;app=await startOnboardingNext({scope,assertOwnedLaunch:async()=>scope.active(),bindings:initial.bindings,fetcher,fixtureTransportFactory:(label,signal)=>fence.forFixture(label,signal),createApplication:options=>next({...options,dev:false,dir:process.cwd()}),signal:abort.signal,onFailure:fail});
 process.on('message',m=>{if(m?.kind==='stop-next'&&m.nonce===nonce){void close();}});process.send({kind:'next-ready',origin:app.origin});
}catch{process.exitCode=1;if(process.connected)process.send({kind:'next-failed'});await close();}
