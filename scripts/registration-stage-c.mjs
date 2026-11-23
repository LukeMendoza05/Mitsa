// Inactive Stage C operator. --check never opens a socket, database or worker.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,rmdirSync} from 'node:fs';
import {fork} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {stageCScope,stageCLimits} from './lib/stage-c-scope.mjs';
import {readJson,sha256} from './lib/preservation-private-evidence.mjs';
import {superviseTransportChild,disconnectCompletedTransportChild} from './lib/registration-transport-lifecycle.mjs';
const reviewPath='config/registration-stage-c-review.json';let emergency;
try{
 assert.equal(process.argv.length,4);const [mode,selection]=process.argv.slice(2);assert(['--check','--run','--child'].includes(mode)&&['A','B'].includes(selection));
 const reviewBytes=readFileSync(reviewPath),review=JSON.parse(reviewBytes);assert.equal(review.project,'mjtejwafxriwntweussc');assert.equal(review.marker,'fireworks-foundation-proof-01a12e38');assert.deepEqual(review.limits,stageCLimits);
 for(const f of [...review.sources,...review.historicalEvidence])assert.equal(sha256(readFileSync(f.path)),f.sha256);
 const fixtureBytes=readFileSync(review.privateFixtures.path);assert.equal(sha256(fixtureBytes),review.privateFixtures.sha256);
 const root=`.secrets/registration-stage-c/${selection}-v1`,approvalPath=root+'/approval.json';
 if(mode==='--check'){console.log(JSON.stringify({status:'LOCAL_SOURCE_CHECK_PASSED_NOT_EXECUTED',selection,approvalPresent:existsSync(approvalPath),attemptPresent:existsSync(root+'/attempt.json'),hostedRequests:0,emails:0,accounts:0}));}
 else{
  const authorization=readJson(approvalPath),securityEvidence=selection==='B'?readJson(root+'/strict-evidence.json'):undefined;
  if(selection==='B'){
   const credential=readJson('.secrets/registration-stage-c/management-ref.json');assert.equal(sha256(readFileSync(credential.manifest)),authorization.managementManifestSha256);
   const provider=readJson(root+'/provider-config.json');assert.equal(authorization.providerConfigSha256,sha256(JSON.stringify(provider)));assert.equal(provider.project,review.project);assert.equal(provider.humanReadOnlyConfirmed,true);
   assert.deepEqual(provider.settings,{emailConfirmation:true,otpDigits:6,otpExpirySeconds:3600,globalCaptchaEnabled:false,beforeUserCreated:'private.mitsa_before_user_created',beforeUserCreatedEnabled:true,sendEmail:'private.mitsa_isolated_send_email',sendEmailEnabled:true,serviceEnabled:false});
  }
  const scope=stageCScope({root:root+'/ledger',selection,reviewBytes,fixtureBytes,authorization,securityEvidence});
  if(mode==='--child'){
   assert(process.send);const launch=await new Promise(resolve=>process.once('message',resolve));assert.deepEqual(launch,{selection});const attempt=readJson(root+'/attempt.json');assert.equal(attempt.parentPid,process.ppid);assert.equal(attempt.childPid,process.pid);assert.equal(attempt.reviewSha256,sha256(reviewBytes));
   const controller=new AbortController();emergency=()=>{process.exitCode=1;controller.abort();};process.once('disconnect',emergency);
   const {runStageC}=await import('./lib/stage-c-runtime.mjs');await runStageC({selection,root,reviewBytes,fixtureBytes,authorization,securityEvidence,signal:controller.signal,emit:value=>process.send?.(value)});
  }else{
   assert(!existsSync(root+'/attempt.json'));assert(Date.parse(authorization.notAfter)-Date.now()>=scope.limits.runtimeSeconds*1000+5000,'Insufficient authority remaining');
   const globalLock='.secrets/registration-stage-c/active.lock';mkdirSync(globalLock);
   let child,absent=false;
   try{
    scope.reserve(['workerLaunches']);const startedAt=performance.now(),claimedAt=new Date().toISOString();
    writeFileSync(root+'/attempt.json',JSON.stringify({reviewSha256:sha256(reviewBytes),parentPid:process.pid,claimedAt,workerLaunches:1,reservedMinutes:scope.limits.workerMinutes}),{flag:'wx',mode:0o600,flush:true});
    child=fork(fileURLToPath(import.meta.url),['--child',selection],{windowsHide:true,silent:true,execArgv:['--conditions=react-server']});const attempt=readJson(root+'/attempt.json');attempt.childPid=child.pid;writeFileSync(root+'/attempt.json',JSON.stringify(attempt),{mode:0o600,flush:true});
    child.on('message',m=>{if(m?.operatorUrl==='http://127.0.0.1:3301'&&m.selection===selection)console.log(JSON.stringify({status:'OPERATOR_STEP_REQUIRED',url:m.operatorUrl,selection,privateValuesPrinted:false}));});
    const supervision=superviseTransportChild(child,{claimedAt,notAfter:authorization.notAfter,startedAt,maximumMs:(scope.limits.runtimeSeconds-30)*1000});child.send({selection},()=>{});const terminal=await supervision;
    const runtimeSeconds=(performance.now()-startedAt)/1000;writeFileSync(root+'/terminal.json',JSON.stringify({...terminal,pid:child.pid,runtimeSeconds}),{flag:'wx',mode:0o600,flush:true});
    try{process.kill(child.pid,0);}catch(e){if(e.code==='ESRCH')absent=true;}assert(absent&&terminal.observedExit&&terminal.streamsClosed&&!terminal.streamError&&!terminal.expired&&terminal.code===0&&terminal.signal===null&&runtimeSeconds<scope.limits.runtimeSeconds);
    const body=readJson(root+'/body-result.json');assert.equal(body.status,'BODY_PASSED_PENDING_NATURAL_EXIT');
    const result={...body,status:selection==='A'?'PASSED_DIAGNOSTIC_ONLY_NOT_OTP':'PASSED_REAL_OTP_TEST',runtimeSeconds,naturalChildExit:true,childAbsent:true,reviewSha256:sha256(reviewBytes)};
    writeFileSync(`artifacts/registration-stage-c-${selection}-hosted-result.json`,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:result.status,selection,privateValuesPrinted:false}));
   }finally{if(absent)rmdirSync(globalLock);}
  }
 }
}catch{console.error(JSON.stringify({status:'STAGE_C_STOPPED_NO_AUTOMATIC_RETRY',privateValuesPrinted:false}));process.exitCode=1;}
finally{if(emergency)disconnectCompletedTransportChild(process,emergency);}
