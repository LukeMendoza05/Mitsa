// INACTIVE operator entry. --check is local only. --run requires a new exact
// D/E human authorization AND verified Strict Option A. Never grants either.
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,mkdirSync,rmdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {checkOnboardingReview,loadOnboardingAuthority,onboardingRoot as root} from './lib/onboarding-authority.mjs';
import {sha256,readJson} from './lib/preservation-private-evidence.mjs';
import {superviseTransportChild,disconnectCompletedTransportChild} from './lib/registration-transport-lifecycle.mjs';
import {recordOnboardingReceipt} from './lib/onboarding-receipts.mjs';
import {awaitControllerResultAck,controllerParentAcknowledgement} from './lib/onboarding-controller-channel.mjs';
let emergency;
try{
 const args=process.argv.slice(2),mode=args[0];assert(['--check','--run','--child','--receipt'].includes(mode));assert(args.length===(mode==='--receipt'?3:1));
 if(mode==='--check'){
  const c=checkOnboardingReview();console.log(JSON.stringify({status:'SOURCE_CHECK_ONLY_NOT_AUTHORIZED',sources:c.review.sources.length,approvalPresent:existsSync(root+'/approval.json'),hostedRequests:0}));
 }else{
  const d=await loadOnboardingAuthority();
  if(mode==='--receipt'){console.log(JSON.stringify(recordOnboardingReceipt({root,scope:d.scope,label:args[1],action:args[2]})));}
  else if(mode==='--child'){
   assert(process.send&&process.connected);let timer;
   const launch=await new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(Error('Controller launch handshake missing')),10000);process.once('message',resolve);}).finally(()=>clearTimeout(timer));
   const attempt=readJson(root+'/worker-attempt.json');assert(launch?.kind==='start-onboarding'&&/^[a-f0-9]{64}$/.test(launch.nonce)&&attempt.parentPid===process.ppid&&attempt.childPid===process.pid&&attempt.nonceSha256===sha256(launch.nonce)&&attempt.reviewSha256===d.scope.reviewSha256);
   const abort=new AbortController();emergency=()=>{process.exitCode=1;abort.abort();};process.once('disconnect',emergency);
   const [{assembleOnboardingRuntime},{default:pg},{default:nodemailer},{chromium},{readProtectedGmailCredentials}]=await Promise.all([import('./lib/onboarding-hosted-runtime.mjs'),import('pg'),import('nodemailer'),import('@playwright/test'),import('./lib/gmail-credentials.mjs')]);
   const credentials=readProtectedGmailCredentials(),bindings=['e-a','e-b'].map(label=>({label,authorization:randomBytes(32).toString('hex')}));
   const runtime=assembleOnboardingRuntime({...d,evidenceMode:'HOSTED',ownedLaunchNonce:launch.nonce,bindings,credentials,signal:abort.signal,fetcher:globalThis.fetch.bind(globalThis),browserType:chromium,
    createClient:()=>new pg.Client(d.databaseConfig),makeSmtpTransport:()=>nodemailer.createTransport({host:'smtp.gmail.com',port:465,secure:true,pool:false,auth:{user:credentials.sender,pass:credentials.appPassword},tls:{servername:'smtp.gmail.com',rejectUnauthorized:true,minVersion:'TLSv1.2'},logger:false,debug:false,transactionLog:false,connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000}),
    emit:m=>process.send?.({kind:'receipt-needed',label:m.label,action:m.action})});
   const result=await runtime.run();assert(result.status==='BODY_PASSED_PENDING_NATURAL_EXIT');
   await awaitControllerResultAck({ipc:process,nonce:launch.nonce});
  }else{
   assert(!existsSync(root+'/worker-attempt.json')&&!existsSync(root+'/controller-attempt.json'),'Owned attempt already consumed');assert(Date.parse(d.notAfter)-Date.now()>d.scope.limits.runtimeSeconds*1000+5000,'Insufficient approved execution window');
   const lock='.secrets/registration-onboarding/active.lock';mkdirSync(lock);let child,absent=false,acknowledged=false;
   try{
    d.scope.reserve('workerLaunches');const nonce=randomBytes(32).toString('hex'),claimedAt=new Date().toISOString(),startedAt=performance.now(),attempt={claimedAt,parentPid:process.pid,childPid:null,nonceSha256:sha256(nonce),reviewSha256:d.scope.reviewSha256};
    writeFileSync(root+'/worker-attempt.json',JSON.stringify(attempt),{flag:'wx',mode:0o600,flush:true});
    child=fork(fileURLToPath(import.meta.url),['--child'],{windowsHide:true,silent:true,execArgv:['--conditions=react-server']});attempt.childPid=child.pid;writeFileSync(root+'/worker-attempt.json',JSON.stringify(attempt),{mode:0o600,flush:true});
    child.on('message',m=>{if(m?.kind==='receipt-needed'&&['e-a','e-b'].includes(m.label)&&['signup','recovery'].includes(m.action))console.log(JSON.stringify({status:'HUMAN_INBOX_CONFIRMATION_REQUIRED',label:m.label,action:m.action}));});
    const ack=controllerParentAcknowledgement({ipc:child,nonce,onFailure:()=>{if(child.connected)child.disconnect();},assertBody:()=>{const b=readJson(root+'/controller-body-result.json');assert(b.status==='BODY_PASSED_PENDING_NATURAL_EXIT'&&b.evidenceMode==='HOSTED');assert(readJson(root+'/controller-attempt.json').reviewSha256===d.scope.reviewSha256);assert.deepEqual(b.counts,d.scope.counts());}});
    const terminalPromise=superviseTransportChild(child,{claimedAt,notAfter:d.notAfter,startedAt,maximumMs:(d.scope.limits.runtimeSeconds-15)*1000});child.send({kind:'start-onboarding',nonce},()=>{});const terminal=await terminalPromise;
    acknowledged=ack.accepted();ack.close();try{process.kill(child.pid,0);}catch(e){if(e.code==='ESRCH')absent=true;}
    const seconds=(performance.now()-startedAt)/1000;writeFileSync(root+'/worker-terminal.json',JSON.stringify({...terminal,seconds,acknowledged,childAbsent:absent}),{flag:'wx',mode:0o600,flush:true});assert(acknowledged&&absent&&terminal.observedExit&&terminal.code===0&&terminal.signal===null&&!terminal.expired&&terminal.streamsClosed&&!terminal.streamError&&seconds<d.scope.limits.runtimeSeconds,'Natural controller exit unconfirmed');
    const body=readJson(root+'/controller-body-result.json');assert(body.status==='BODY_PASSED_PENDING_NATURAL_EXIT');const result={...body,status:'PASSED_HOSTED_SYNTHETIC_ONBOARDING_NOT_PUBLIC_RELEASE',naturalChildExit:true,childAbsent:true,parentAcknowledged:true,reviewSha256:d.scope.reviewSha256,seconds};writeFileSync(root+'/result.json',JSON.stringify(result),{flag:'wx',mode:0o600,flush:true});console.log(JSON.stringify({status:result.status,privateValuesPrinted:false}));
   }finally{if(absent)rmdirSync(lock);}
  }
 }
}catch{process.exitCode=1;console.error(JSON.stringify({status:'ONBOARDING_STOPPED_NO_AUTOMATIC_RETRY',privateValuesPrinted:false}));}
finally{if(emergency)disconnectCompletedTransportChild(process,emergency);}
