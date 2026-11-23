// Inactive D connection-only operator. --check is entirely local.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {fork,execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {parse} from 'dotenv';
import pg from 'pg';
import nodemailer from 'nodemailer';
import {readKey,readPrivateKey,createMessage,readMessage,encrypt,decrypt} from 'openpgp';
import {assertTestTarget} from './test-target.mjs';
import {testDatabaseConfig} from './postgres-config.mjs';
import {gmailCredentialFilePresent,readProtectedGmailCredentials} from './lib/gmail-credentials.mjs';
import {registrationMailTestScope} from './lib/registration-mail-test-scope.mjs';
import {PersistentMailWorker} from './lib/persistent-mail-worker.ts';
import {assertTransportProbeApproval,transportProbeLimits,probeQueryKind,transportProbe,assertTransportBudget,nextTransportBudget,transportDeadline,transportSupervisorDelay,claimTransportAttempt,assertProbeChildStopped,protectedTransportCredentials,protectedSecretMetadata} from './lib/registration-transport-probe.mjs';
import {assertC1IdentityPostflight} from './lib/c1-identity-preflight.mjs';
import {collect} from '../.tools/stage-c3-collect.mjs';
import {catalog} from '../.tools/c3ba-catalog.mjs';
const reviewPath='config/registration-transport-probe-review.json',root='.secrets/registration-completion/transport-probe',approvalPath=`${root}/approval.json`,artifact='artifacts/registration-transport-probe-result.json';
const json=p=>JSON.parse(readFileSync(p)),sha=v=>createHash('sha256').update(v).digest('hex');
const persist=(p,v,exclusive=false)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n',{mode:0o600,flush:true,flag:exclusive?'wx':'w'});
const safe=(status,extra={})=>console.log(JSON.stringify({status,...extra,privateValuesPrinted:false}));
function localReview(){
 const bytes=readFileSync(reviewPath),review=JSON.parse(String(bytes));
 assert.equal(review.scope,'D-transport-only-rollback-v1');assert.equal(review.status,'PREPARED_NOT_APPROVED_NOT_EXECUTED');assert.equal(review.project,'mjtejwafxriwntweussc');assert.deepEqual(review.limits,transportProbeLimits);
 assert.equal(review.marker,'fireworks-foundation-proof-01a12e38');
 for(const f of review.sources)assert.equal(sha(readFileSync(f.path)),f.sha256,'source drift');
 const commonBytes=readFileSync('config/registration-completion-review.json'),common=JSON.parse(String(commonBytes));
 assert.equal(sha(commonBytes),review.commonReviewSha256);for(const f of common.sources)assert.equal(sha(readFileSync(f.path)),f.sha256);
 const fixtures=readFileSync(common.privateFixtures.path);assert.equal(sha(fixtures),common.privateFixtures.sha256);
 assert.equal(common.reviewId,review.generation);assert.equal(sha(readFileSync(review.preservationCheckpoint)),review.preservationCheckpointSha256);
 assert.equal(sha(readFileSync(review.preservationManifest)),review.preservationManifestSha256);
 assert(json(review.preservationCheckpoint).passed);return {review,bytes,commonBytes,fixtures};
}
let db,transport,stage='local-review',report,counts,phase='preflight',baseline,rollbackConfirmed=false,metadataCalls=0,failedDatabaseOperation;
const onParentDisconnect=()=>{transport?.close();process.exit(1);};
const budgetPath=`${root}/budget.json`;
function reserve(kind){
 const next=nextTransportBudget(counts,kind);persist(budgetPath,next);counts=next;
}
function cliSecrets(){
 assert(metadataCalls<transportProbeLimits.secretMetadataRequests);metadataCalls++;persist(`${root}/management-budget.json`,{secretMetadataRequests:metadataCalls});
 return protectedSecretMetadata(()=>execFileSync(process.execPath,['node_modules/supabase/dist/supabase.js','secrets','list','--project-ref','mjtejwafxriwntweussc','--output','json'],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe'],timeout:30000}));
}
async function connect(options){
 const path=`${root}/connections-budget.json`,previous=existsSync(path)?json(path).databaseConnections:0;
 assert(Number.isSafeInteger(previous)&&previous>=0&&previous<transportProbeLimits.databaseConnections,'database connection budget exhausted');
 persist(path,{databaseConnections:previous+1});db=new pg.Client(options);db.on('error',()=>{});await db.connect();
}
async function readSnapshot(path){
 const m=json(path),cipher=readFileSync(m.snapshot);assert.equal(sha(cipher),m.cipherSha256);
 const key=await readPrivateKey({armoredKey:readFileSync('.secrets/auth-mail/private.asc','utf8')});
 const raw=String((await decrypt({message:await readMessage({binaryMessage:cipher}),decryptionKeys:key})).data);assert.equal(sha(raw),m.payloadSha256);return JSON.parse(raw);
}
async function saveSnapshot(payload){
 const path=`${root}/preservation-${randomUUID()}`,text=JSON.stringify(payload),key=await readKey({armoredKey:readFileSync('.secrets/auth-mail/public.asc','utf8')});
 const bytes=await encrypt({message:await createMessage({text}),encryptionKeys:key,format:'binary'});writeFileSync(path+'.pgp',bytes,{mode:0o600,flag:'wx',flush:true});
 persist(path+'.json',{snapshot:path+'.pgp',cipherSha256:sha(bytes),payloadSha256:sha(text)},true);assert.deepEqual(await readSnapshot(path+'.json'),payload);return path+'.json';
}
const approvedDeliverySql=readFileSync('supabase/security-proposals/persistent-registration-delivery-controls.sql.txt','utf8');
const deliverySql=()=>approvedDeliverySql;
const reader={query:async(sql,args)=>{const kind=probeQueryKind(sql,{phase,deliverySql:deliverySql()});reserve(kind);try{return await db.query(sql,args);}catch(error){failedDatabaseOperation??={phase,kind,sqlSha256:sha(sql),category:error.name,code:error.code};throw error;}}};
async function observe(target){
 await reader.query('begin isolation level repeatable read read only');
 try{
  const c1=await catalog(reader,json('config/stage-c1-identity-boundary-baseline.json'));
  assertC1IdentityPostflight(c1,json('config/stage-c1-identity-boundary-baseline.json'),json('artifacts/stage-c1-identity-boundary-manifest.json'));
  const payload=await collect(reader,target);await reader.query('commit');return {payload,c1};
 }catch(error){try{await reader.query('rollback');}catch{}throw error;}
}
async function child({review,bytes,commonBytes,fixtures}){
 assert(process.send,'probe must be supervised');
 process.once('disconnect',onParentDisconnect);
 const approval=json(approvalPath);assertTransportProbeApproval(approval,{reviewSha256:sha(bytes)});
 const attempt=json(`${root}/attempt.json`),started=json(`${root}/child-started.json`);
 assert.equal(attempt.parentPid,process.ppid);assert.equal(started.pid,process.pid);assert.equal(started.reviewSha256,sha(bytes));assert.equal(attempt.reviewSha256,sha(bytes));assert(Date.now()<started.deadlineAt,'probe deadline expired');
 assert(!existsSync(budgetPath),'existing attempt requires reconciliation');
 counts={databaseRequests:0,readQueries:0,writeQueries:0,transactionQueries:0};persist(budgetPath,counts,true);
 const common=JSON.parse(String(commonBytes));
 // This shares the existing aggregate launch/minutes/verification ledger; the
 // connection-only allocation is not an additional allowance on top of D.
 const mailScope=registrationMailTestScope({root:'.secrets/registration-completion/mail-test-ledger',reviewBytes:commonBytes,fixtureBytes:fixtures,authorization:{approved:true,project:review.project,reviewId:review.generation,reviewSha256:sha(commonBytes),sections:['D'],notBefore:approval.notBefore,notAfter:approval.notAfter}});
 const lease=mailScope.reserveWorker(5);
 stage='isolated-target-and-local-gates';
 const op=parse(readFileSync('.secrets/operator.env')),approved=json('config/test-target.json'),local=parse(readFileSync('.env.local')),environmentHash=sha(readFileSync('.env.local'));
 const target=assertTestTarget({projectRef:op.TEST_PROJECT_REF,url:op.TEST_SUPABASE_URL,databaseUrl:op.TEST_DATABASE_URL},approved);
 assert.equal(target.projectRef,review.project);assert.equal(target.databaseMarker,review.marker);
 assert(!local.MITSA_REGISTRATION_ENGINE||local.MITSA_REGISTRATION_ENGINE==='legacy');assert.equal(local.MITSA_REGISTRATION_SERVICE_ENABLED,'false');
 const secrets=cliSecrets(),c3=json('artifacts/stage-c3a-execution.json'),journal=json(c3.privateJournal);assert.deepEqual(secrets,journal.baselineSecrets);
 assert.equal(secrets.find(r=>r.name==='MITSA_REGISTRATION_SERVICE_ENABLED')?.digest,sha('false'));
 const databaseOptions={...testDatabaseConfig(op.TEST_DATABASE_URL,approved),statement_timeout:15000,lock_timeout:2000,idle_in_transaction_session_timeout:30000};
 stage='database-preflight';await connect(databaseOptions);
 const before=await observe(target);baseline=before;
 assert.deepEqual(before.payload,await readSnapshot(review.preservationManifest));
 assert.equal(before.payload.rows['private.auth_mail_dispatch'].length,0);
 const manifest=await saveSnapshot(before.payload);persist(`${root}/preflight.json`,{checkedAt:new Date().toISOString(),manifest,c1:before.c1,environmentHash,secrets},true);
 stage='immediate-local-source-recheck';localReview();
 stage='protected-sender-load';const credentials=protectedTransportCredentials({present:gmailCredentialFilePresent,read:readProtectedGmailCredentials});assert(Date.now()<started.deadlineAt,'probe deadline expired');
 phase='probe';stage='uncommitted-transport-probe';
 const result=await transportProbe({db:reader,WorkerClass:PersistentMailWorker,generation:review.generation,senderHash:sha(credentials.sender.trim().toLowerCase()),deliverySql:deliverySql(),expectedControl:before.payload.rows['private.registration_control'][0],onRollback:()=>{rollbackConfirmed=true;},verifyTransport:async()=>{
  assert(Date.now()<started.deadlineAt,'probe deadline expired');
  mailScope.reserveVerification(lease);
  transport=nodemailer.createTransport({host:'smtp.gmail.com',port:465,secure:true,auth:{user:credentials.sender,pass:credentials.appPassword},tls:{minVersion:'TLSv1.2',rejectUnauthorized:true},logger:false,debug:false,pool:false,connectionTimeout:8000,greetingTimeout:8000,socketTimeout:8000});
  try{return await transport.verify();}catch{return false;}finally{transport.close();transport=undefined;}
 }});
 rollbackConfirmed=result.rolledBack;
 // Reconnect before the final read: proof of committed state, not the probe's
 // own snapshot. No worker is acquired on this second connection.
 await db.end();await connect(databaseOptions);
 phase='postflight';stage='postflight-preservation';const after=await observe(target);
 assert.deepEqual(after.payload,before.payload);assert.deepEqual(JSON.parse(JSON.stringify(after.c1)),JSON.parse(JSON.stringify(before.c1)));
 const postManifest=await saveSnapshot(after.payload);assert.equal(sha(readFileSync('.env.local')),environmentHash);assert.deepEqual(cliSecrets(),secrets);
 persist(`${root}/postflight.json`,{checkedAt:new Date().toISOString(),manifest:postManifest},true);
 report={status:'PASSED_ROLLBACK_ONLY_TRANSPORT_PROBE',passed:true,scope:review.scope,project:review.project,...result,counts,secretMetadataRequests:metadataCalls,authRequests:0,edgeRequests:0,accountsCreated:0,emailsSent:0,allPreserved:true,generalRegistrationEnabled:false,deliveryCommitted:false,strictOptionA:'BLOCKED_SU-519045',privateValuesPrinted:false};
}
async function reconcile({review,bytes}){
 assertTransportProbeApproval(json(approvalPath),{reviewSha256:sha(bytes)});
 assert(existsSync(`${root}/attempt.json`),'no attempted probe to reconcile');
 const pre=json(`${root}/preflight.json`);counts=json(budgetPath);
 assertTransportBudget(counts);
 assertProbeChildStopped(json(`${root}/child-started.json`),existsSync(`${root}/child-terminal.json`)?json(`${root}/child-terminal.json`):null,{reviewSha256:sha(bytes),isRunning:pid=>{try{process.kill(pid,0);return true;}catch(error){if(error.code==='ESRCH')return false;throw Error('Probe child status unavailable');}}});
 persist(`${root}/reconciliation-attempt.json`,{claimedAt:new Date().toISOString(),reviewSha256:sha(bytes)},true);
 phase='postflight';stage='read-only-reconciliation';
 const op=parse(readFileSync('.secrets/operator.env')),approved=json('config/test-target.json');
 const target=assertTestTarget({projectRef:op.TEST_PROJECT_REF,url:op.TEST_SUPABASE_URL,databaseUrl:op.TEST_DATABASE_URL},approved);assert.equal(target.projectRef,review.project);
 await connect({...testDatabaseConfig(op.TEST_DATABASE_URL,approved),statement_timeout:15000});
 const state=await observe(target);assert.deepEqual(state.payload,await readSnapshot(pre.manifest));assert.deepEqual(JSON.parse(JSON.stringify(state.c1)),pre.c1);assert.equal(sha(readFileSync('.env.local')),pre.environmentHash);
 const previous=existsSync(artifact)?json(artifact):null;
 persist(`${root}/reconciliation.json`,{checkedAt:new Date().toISOString(),previousOutcome:previous,manifest:await saveSnapshot(state.payload),counts},true);
 persist(artifact,{status:'RECONCILED_PRESERVED_PROBE_NOT_PASSED',passed:false,preservationPassed:true,counts,workerRestarted:false,smtpConnections:0,noAutomaticRetry:true,privateValuesPrinted:false});
 safe('Read-only reconciliation passed; probe remains failed or unconfirmed',{passed:false,preservationPassed:true,counts});
}
try{
 const mode=process.argv[2];assert.equal(process.argv.length,3);assert(['--check','--run','--approved-child','--reconcile'].includes(mode));const prepared=localReview();
 if(mode==='--check')safe('Transport-only package verified locally',{sourcesMatched:prepared.review.sources.length,authorizationPresent:existsSync(approvalPath),networkRequests:0,databaseWrites:0,smtpConnections:0});
 else if(mode==='--run'){
  const approval=json(approvalPath);assertTransportProbeApproval(approval,{reviewSha256:sha(prepared.bytes)});
  mkdirSync(root,{recursive:true,mode:0o700});assert.equal(spawnSync('git',['check-ignore','--quiet','--',`${root}/probe`],{stdio:'ignore'}).status,0);
  const startedAt=performance.now(),deadlineAt=transportDeadline(approval);claimTransportAttempt(`${root}/attempt.json`,{claimedAt:new Date().toISOString(),reviewSha256:sha(prepared.bytes),parentPid:process.pid,maximumWorkerLaunches:1});
  const childProcess=fork(fileURLToPath(import.meta.url),['--approved-child'],{windowsHide:true,silent:true,execArgv:['--conditions=react-server']});
  try{persist(`${root}/child-started.json`,{pid:childProcess.pid,reviewSha256:sha(prepared.bytes),deadlineAt},true);}catch(error){childProcess.kill('SIGKILL');throw error;}
  childProcess.stdout.resume();childProcess.stderr.resume();
  const timeout=setTimeout(()=>childProcess.kill('SIGKILL'),transportSupervisorDelay({deadlineAt,startedAt}));
  const outcome=await new Promise(resolve=>{childProcess.once('exit',(code,signal)=>resolve({code,signal,observedExit:true}));childProcess.once('error',()=>{childProcess.kill('SIGKILL');if(childProcess.connected)childProcess.disconnect();resolve({code:1,observedExit:false});});});clearTimeout(timeout);
  persist(`${root}/child-terminal.json`,{pid:childProcess.pid,reviewSha256:sha(prepared.bytes),...outcome,observedAt:new Date().toISOString()},true);
  if(outcome.code!==0||!outcome.observedExit){safe('Transport probe stopped; read-only reconciliation required',{passed:false,noAutomaticRetry:true});process.exitCode=1;}else safe('Transport probe complete; read the sanitized result',{passed:json(artifact).passed});
 }else if(mode==='--reconcile'){await reconcile(prepared);}
 else{await child(prepared);persist(artifact,report);safe(report.status,{passed:true,counts});}
}catch(error){
 if(process.argv[2]==='--approved-child'&&counts){
  report={status:'STOPPED_NO_AUTOMATIC_RETRY',passed:false,stage,category:error.name,code:['ERR_ASSERTION','ETIMEDOUT','57014','55P03','25P03'].includes(error.code)?error.code:undefined,counts,failedDatabaseOperation,rollbackConfirmed,preflightCaptured:!!baseline,privateValuesPrinted:false};
  try{persist(artifact,report);}catch{}
 }
 safe('Transport-only operation unavailable',{passed:false,stage,noAutomaticRetry:true});process.exitCode=1;
}finally{transport?.close();try{await db?.end();}catch{}if(process.argv[2]==='--approved-child'){process.removeListener('disconnect',onParentDisconnect);if(process.connected)process.disconnect();}}
