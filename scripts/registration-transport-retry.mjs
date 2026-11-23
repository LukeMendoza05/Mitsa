// New independently budgeted B scope. Never edits/reuses original D attempts.
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {fork} from 'node:child_process';
import {disconnectCompletedTransportChild,installTransportDisconnect,cleanupTransportResources,superviseTransportChild,remainingTransportRuntime} from './lib/registration-transport-lifecycle.mjs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {parse} from 'dotenv';
import pg from 'pg';
import nodemailer from 'nodemailer';
import {collectCurrentPreservation,compareCurrentPreservation} from './lib/current-preservation.mjs';
import {evidenceKeys,loadPrivateEvidence,savePrivateEvidence,readJson,sha256} from './lib/preservation-private-evidence.mjs';
import {assertFinalApproval,finalLimits,reserveFinalOperation,assertTransportPreservation} from './lib/registration-final-controls.mjs';
import {transportProbe,probeSql,protectedTransportCredentials,assertProbeChildStopped} from './lib/registration-transport-probe.mjs';
import {PersistentMailWorker} from './lib/persistent-mail-worker.ts';
import {gmailCredentialFilePresent,readProtectedGmailCredentials} from './lib/gmail-credentials.mjs';
import {assertTestTarget} from './test-target.mjs';
import {testDatabaseConfig} from './postgres-config.mjs';
import {assertCurrentSecurity} from './lib/current-preservation-security.mjs';
const root='.secrets/registration-final-v1/B-lifecycle-v3',reviewPath='config/registration-transport-lifecycle-review.json',artifact='artifacts/registration-transport-lifecycle-result.json',bodyArtifact='artifacts/registration-transport-lifecycle-body-result.json';
const persist=(p,v,exclusive=false)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n',{mode:0o600,flush:true,flag:exclusive?'wx':'w'});
let db,transport,reconciliationTimer,childDeadline,emergencyDisconnect,stage='local',budget,rolledBack=false;
const clearTimers=()=>{clearTimeout(reconciliationTimer);clearTimeout(childDeadline);};
function frozen(){const bytes=readFileSync(reviewPath),r=JSON.parse(bytes);for(const f of [...r.sources,...r.historicalEvidence])assert.equal(sha256(readFileSync(f.path)),f.sha256);assert.equal(r.project,'mjtejwafxriwntweussc');assert.equal(r.marker,'fireworks-foundation-proof-01a12e38');assert.equal(r.scope,'B-transport-lifecycle-v3');assert.deepEqual(r.limits,finalLimits.B);assert.deepEqual(r.timing,{workSeconds:210,hardStopSeconds:240,overallSeconds:300,reconcileStopSeconds:290});return {bytes,r};}
function approval(bytes){const a=readJson(root+'/approval.json');assertFinalApproval(a,{stage:'B',reviewSha256:sha256(bytes)});assert.equal(a.scope,'B-transport-lifecycle-v3');assert.equal(a.marker,'fireworks-foundation-proof-01a12e38');assert.equal(a.acceptedCandidateManifestSha256,'05206a18393390f9849ea5c2e3b3ae8a50f2b0e25f86bcdc0056ed02ab77318e');assert.deepEqual(a.preservationPolicy,{allowKnownActivityChanges:false,maxActivityRows:0});return a;}
async function accepted(keys){const r=readJson(reviewPath),a=readJson('.secrets/registration-final-v1/A/accepted.json');assert.equal(a.acceptedByHuman,true);assert(a.evidence?.trim());assert.equal(a.manifestSha256,r.acceptedCandidateManifestSha256);assert.equal(sha256(readFileSync(a.manifest)),a.manifestSha256);const payload=await loadPrivateEvidence(a.manifest,keys);assert.equal(payload.reviewSha256,r.baseReview.sha256);return {a,payload};}
async function child(){
 assert(process.send);const launch=await new Promise(resolve=>process.once('message',resolve));assert.deepEqual(launch,{type:'APPROVED_TRANSPORT_CHILD_START'});
 const {bytes,r}=frozen(),a=approval(bytes);assert(process.send);const attempt=readJson(root+'/attempt.json');assert.equal(attempt.parentPid,process.ppid);assert.equal(attempt.childPid,process.pid);assert.equal(attempt.reviewSha256,sha256(bytes));assert(!existsSync(root+'/budget.json'));
 emergencyDisconnect=installTransportDisconnect({getTransport:()=>transport,getDatabase:()=>db,clearTimers});
 const keys=await evidenceKeys(),reference=await accepted(keys),comparisonKey=Buffer.from(reference.payload.comparisonKey,'base64');assert.equal(comparisonKey.length,32);
 for(const previous of r.previousWorkers){const old=readJson(previous.attempt);const terminal=readJson(previous.terminal);assert.equal(old.childPid??old.pid,terminal.pid);try{process.kill(terminal.pid,0);throw Error('Prior worker still running');}catch(e){if(e.code!=='ESRCH')throw Error('Prior worker absence not confirmed');}}
 const op=parse(readFileSync('.secrets/operator.env')),local=parse(readFileSync('.env.local')),target=readJson('config/test-target.json');assertTestTarget({projectRef:op.TEST_PROJECT_REF,url:op.TEST_SUPABASE_URL,databaseUrl:op.TEST_DATABASE_URL},target);assert(!local.MITSA_REGISTRATION_ENGINE||local.MITSA_REGISTRATION_ENGINE==='legacy');assert.equal(local.MITSA_REGISTRATION_SERVICE_ENABLED,'false');
 budget={sqlRequests:0,selects:0,writeCalls:0,transactionStatements:0,databaseConnections:1,smtpVerifications:0};persist(root+'/budget.json',budget,true);
 const started=performance.now();db=new pg.Client({...testDatabaseConfig(op.TEST_DATABASE_URL,target),connectionTimeoutMillis:10000,statement_timeout:15000,lock_timeout:2000,idle_in_transaction_session_timeout:30000});db.on('error',()=>{});
 childDeadline=setTimeout(()=>{process.exitCode=1;try{transport?.close();}finally{db?.connection?.stream?.destroy();}},remainingTransportRuntime({claimedAt:attempt.claimedAt,notAfter:a.notAfter,maximumMs:210000}));
 const delivery=readFileSync('supabase/security-proposals/persistent-registration-delivery-controls.sql.txt','utf8'),writes=new Set([delivery,probeSql.acquire,probeSql.heartbeat,probeSql.shutdown]);
 const query=async(sql,args)=>{assert(Date.now()<Math.min(Date.parse(a.notAfter),Date.parse(attempt.claimedAt)+210000)&&performance.now()-started<210000);const kind=writes.has(sql)?'writeCalls':/^select\b/i.test(sql)?'selects':'transactionStatements';assert(kind!=='transactionStatements'||[probeSql.begin,probeSql.lock,'begin isolation level repeatable read read only','commit','rollback'].includes(sql));budget=reserveFinalOperation(budget,kind,finalLimits.B);persist(root+'/budget.json',budget);return db.query(sql,args);};
 const observe=async()=>{
  let began=false,terminal=false;await query('begin isolation level repeatable read read only');began=true;
  try{const payload=await collectCurrentPreservation({query},{expected:r.expectedRegistry,comparisonKey});terminal=true;await query('commit');began=false;
   const manifest=await savePrivateEvidence(root,{payload,comparisonKey:reference.payload.comparisonKey},keys);persist(root+'/last-observation.json',{manifest});assertCurrentSecurity(payload,readJson('config/stage-c1-identity-boundary-baseline.json'),readJson('artifacts/stage-c1-identity-boundary-manifest.json'));return {payload,manifest};
  }catch(e){if(began&&!terminal){try{await query('rollback');}catch{}}throw e;}
 };
 stage='connect';await db.connect();stage='preservation-preflight';const observation=await observe(),before=observation.payload,preManifest=observation.manifest;const delta=compareCurrentPreservation(reference.payload.payload,before);assertTransportPreservation(delta,a.preservationPolicy);persist(root+'/preflight.json',{manifest:preManifest,preservationDifference:delta},true);
 stage='control-read';const current=(await query(probeSql.inspect)).rows[0];assert.equal(current.marker,r.marker);const credentials=protectedTransportCredentials({present:gmailCredentialFilePresent,read:readProtectedGmailCredentials});
 stage='rollback-only-transport';const result=await transportProbe({db:{query},generation:r.generation,senderHash:sha256(credentials.sender.trim().toLowerCase()),deliverySql:delivery,expectedControl:current.control,WorkerClass:PersistentMailWorker,onRollback:()=>{rolledBack=true;},verifyTransport:async()=>{
  assert(budget.smtpVerifications<1);budget.smtpVerifications++;persist(root+'/budget.json',budget);transport=nodemailer.createTransport({host:'smtp.gmail.com',port:465,secure:true,pool:false,auth:{user:credentials.sender,pass:credentials.appPassword},tls:{servername:'smtp.gmail.com',rejectUnauthorized:true},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000});try{return await transport.verify();}finally{transport.close();}
 }});
 stage='preservation-postflight';const postObservation=await observe(),after=postObservation.payload,postDelta=compareCurrentPreservation(before,after);assertTransportPreservation(postDelta,a.preservationPolicy);const postManifest=postObservation.manifest;
 persist(bodyArtifact,{status:'TRANSPORT_BODY_PASSED_PENDING_EXIT',budget,rolledBack,result,preservationPreflight:delta,preservationPostflight:postDelta,preManifest,postManifest,runtimeSeconds:Number(((performance.now()-started)/1000).toFixed(3)),messagesSent:0,accountsCreated:0,strictOptionA:'BLOCKED_SU-519045',privateValuesPrinted:false});
}
async function reconcile(){
 const {bytes,r}=frozen(),a=approval(bytes);const terminal=readJson(root+'/terminal.json'),attempt=readJson(root+'/attempt.json');const deadline=Math.min(Date.parse(a.notAfter),Date.parse(attempt.claimedAt)+290000);assert(Date.now()+55000<deadline);assertProbeChildStopped({pid:attempt.childPid,reviewSha256:sha256(bytes)},{pid:terminal.pid,reviewSha256:sha256(bytes)},{reviewSha256:sha256(bytes),isRunning:pid=>{try{process.kill(pid,0);return true;}catch(e){if(e.code==='ESRCH')return false;throw Error('Unknown child state');}}});assert(!existsSync(root+'/reconciliation-attempt.json'));
 budget=readJson(root+'/budget.json');assert.equal(budget.databaseConnections,1);persist(root+'/reconciliation-attempt.json',{claimedAt:new Date().toISOString()},true);budget.databaseConnections=2;persist(root+'/budget.json',budget);
 const keys=await evidenceKeys(),reference=await accepted(keys),key=Buffer.from(reference.payload.comparisonKey,'base64'),op=parse(readFileSync('.secrets/operator.env'));db=new pg.Client({...testDatabaseConfig(op.TEST_DATABASE_URL,readJson('config/test-target.json')),connectionTimeoutMillis:10000,statement_timeout:15000,idle_in_transaction_session_timeout:30000});db.on('error',()=>{});
 reconciliationTimer=setTimeout(()=>db?.connection?.stream?.destroy(),deadline-Date.now());
 const query=async(sql,args)=>{assert(Date.now()<deadline);const kind=/^select\b/i.test(sql)?'selects':'transactionStatements';assert(kind==='selects'||['begin isolation level repeatable read read only','commit','rollback'].includes(sql));budget=reserveFinalOperation(budget,kind,finalLimits.B);persist(root+'/budget.json',budget);return db.query(sql,args);};
 await db.connect();await query('begin isolation level repeatable read read only');const payload=await collectCurrentPreservation({query},{expected:r.expectedRegistry,comparisonKey:key});await query('commit');const manifest=await savePrivateEvidence(root,{payload,comparisonKey:reference.payload.comparisonKey},keys),difference=compareCurrentPreservation(reference.payload.payload,payload);persist(root+'/reconciliation.json',{manifest,difference,budget,readOnly:true,doesNotAuthorizeRetry:true});console.log(JSON.stringify({status:'READ_ONLY_RECONCILIATION_COMPLETE',difference,budget,privateValuesPrinted:false}));
}
try{
 const mode=process.argv[2];assert.equal(process.argv.length,3);assert(['--check','--run','--child','--reconcile'].includes(mode));const {bytes}=frozen();
 if(mode==='--check'){console.log(JSON.stringify({status:'LOCAL_LIFECYCLE_RETEST_READY_NOT_APPROVED',acceptedReferencePresent:existsSync('.secrets/registration-final-v1/A/accepted.json'),approvalPresent:existsSync(root+'/approval.json'),attemptPresent:existsSync(root+'/attempt.json'),limits:finalLimits.B,hostedRequests:0,credentialsDecrypted:false}));}
 else if(mode==='--child')await child();
 else if(mode==='--reconcile')await reconcile();
 else{
  const a=approval(bytes);assert(Date.parse(a.notAfter)-Date.now()>=300000,'Approval needs five full minutes remaining');assert(!existsSync(root+'/attempt.json'));const keys=await evidenceKeys();await accepted(keys);mkdirSync(root,{recursive:true});stage='parent';const startedAt=performance.now();persist(root+'/attempt.json',{parentPid:process.pid,reviewSha256:sha256(bytes),claimedAt:new Date().toISOString(),workerLaunches:1,reservedMinutes:5},true);
  const worker=fork(fileURLToPath(import.meta.url),['--child'],{windowsHide:true,silent:true});const attempt=readJson(root+'/attempt.json');attempt.childPid=worker.pid;persist(root+'/attempt.json',attempt);
  const supervision=superviseTransportChild(worker,{claimedAt:attempt.claimedAt,notAfter:a.notAfter,startedAt});worker.send({type:'APPROVED_TRANSPORT_CHILD_START'},()=>{});const outcome=await supervision;const elapsed=performance.now()-startedAt;persist(root+'/terminal.json',{pid:worker.pid,...outcome,runtimeSeconds:Number((elapsed/1000).toFixed(3)),finishedAt:new Date().toISOString()});
  assert(!outcome.expired&&outcome.observedExit&&outcome.streamsClosed&&!outcome.streamError&&outcome.code===0&&outcome.signal===null&&elapsed<240000,'Natural child termination unconfirmed');
  try{process.kill(worker.pid,0);throw Error('Child still present');}catch(e){assert.equal(e.code,'ESRCH','Child absence unconfirmed');}
  const cleanup=readJson(root+'/cleanup.json'),body=readJson(bodyArtifact);assert.equal(cleanup.status,'CLEANUP_COMPLETED');assert.equal(body.status,'TRANSPORT_BODY_PASSED_PENDING_EXIT');assert(body.rolledBack&&body.preservationPreflight.exactMatch&&body.preservationPostflight.exactMatch);
  persist(artifact,{status:'PASSED',scope:'B-transport-lifecycle-v3',bodyArtifact,budget:readJson(root+'/budget.json'),naturalChildExit:true,childAbsent:true,cleanupVerified:true,runtimeSeconds:Number((elapsed/1000).toFixed(3)),messagesSent:0,accountsCreated:0,strictOptionA:'BLOCKED_SU-519045'});console.log(JSON.stringify({status:'PASSED',detailsArtifact:artifact,privateValuesPrinted:false}));
 }
}catch(error){if(stage!=='local'){persist(stage==='parent'?artifact:bodyArtifact,{status:'FAILED_NO_AUTOMATIC_RETRY',stage,category:error.name,budget,rolledBack,privateValuesPrinted:false});}console.error(JSON.stringify({status:'STOPPED_NO_AUTOMATIC_RETRY',stage,category:error.name,privateValuesPrinted:false}));process.exitCode=1;}
finally{
 try{const cleaned=await cleanupTransportResources({transport,database:db,clearTimers});if(emergencyDisconnect)persist(root+'/cleanup.json',{status:'CLEANUP_COMPLETED',...cleaned,resourcesBeforeIpcClose:process.getActiveResourcesInfo().sort()},true);}
 catch{process.exitCode=1;if(emergencyDisconnect)persist(root+'/cleanup.json',{status:'CLEANUP_FAILED',privateValuesPrinted:false},true);}
 finally{if(emergencyDisconnect)disconnectCompletedTransportChild(process,emergencyDisconnect);}
}
