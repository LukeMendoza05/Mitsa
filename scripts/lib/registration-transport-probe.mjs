// One-shot transport diagnostic. Never call tick(), claim, complete or send.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
export const transportProbeLimits=Object.freeze({databaseRequests:192,databaseConnections:3,readQueries:180,writeQueries:4,transactionQueries:8,smtpVerifications:1,workerLaunches:1,workerMinutes:5,authRequests:0,edgeRequests:0,emails:0,secretMetadataRequests:2});
export const probeSql=Object.freeze({
 begin:'begin isolation level repeatable read',
 lock:'lock table private.registration_control, private.auth_mail_dispatch in share row exclusive mode nowait',
 inspect:"select (select marker from foundation_probe.environment_identity where singleton) marker,(select to_jsonb(c) from private.registration_control c where singleton) control,(select count(*)::int from private.auth_mail_dispatch) dispatches,(select count(*)::int from pg_trigger where tgrelid in ('private.registration_control'::regclass,'private.auth_mail_dispatch'::regclass) and not tgisinternal) triggers",
 health:"select private.mitsa_persistent_health() healthy,private.mitsa_persistent_registration_policy()->>'admission' admission,(select transport_ready from private.registration_control where singleton) ready",
 rollback:'rollback',
 acquire:'select private.mitsa_worker_acquire($1,$2) ok',
 heartbeat:'select private.mitsa_worker_heartbeat($1,$2,$3) ok',
 shutdown:'select private.mitsa_worker_heartbeat($1,$2,false) ok'
});
export function assertTransportProbeApproval(approval,{reviewSha256,now=Date.now()}){
 assert.equal(approval?.approved,true,'transport approval missing');
 assert.equal(approval.scope,'D-transport-only-rollback-v1');assert.equal(approval.project,'mjtejwafxriwntweussc');
 assert.equal(approval.reviewSha256,reviewSha256);assert.deepEqual(approval.limits,transportProbeLimits);
 const start=Date.parse(approval.notBefore),end=Date.parse(approval.notAfter);
 assert(Number.isFinite(start)&&Number.isFinite(end)&&end>start&&end-start<=1800000&&now>=start&&now<end,'transport approval expired or invalid');
 assert.equal(typeof approval.evidence,'string');assert(approval.evidence.trim().length>0,'human approval evidence missing');
}
export function assertTransportBudget(counts){
 for(const key of ['databaseRequests','readQueries','writeQueries','transactionQueries'])assert(Number.isSafeInteger(counts[key])&&counts[key]>=0&&counts[key]<=transportProbeLimits[key],'invalid transport budget');
 assert.equal(counts.databaseRequests,counts.readQueries+counts.writeQueries+counts.transactionQueries,'inconsistent transport budget');
 return counts;
}
export function nextTransportBudget(counts,kind){
 assertTransportBudget(counts);assert(['readQueries','writeQueries','transactionQueries'].includes(kind),'invalid operation category');
 assert(counts.databaseRequests<transportProbeLimits.databaseRequests&&counts[kind]<transportProbeLimits[kind],'transport budget exhausted');
 const next={...counts,databaseRequests:counts.databaseRequests+1,[kind]:counts[kind]+1};return assertTransportBudget(next);
}
export function transportDeadline(approval,now=Date.now()){
 const end=Math.min(Date.parse(approval.notAfter),now+300000);assert(Number.isFinite(end)&&end>now,'transport runtime expired');return end;
}
export function transportSupervisorDelay({deadlineAt,startedAt,now=Date.now(),monotonicNow=performance.now()}){
 assert([deadlineAt,startedAt,now,monotonicNow].every(Number.isFinite),'invalid supervisor clock');
 return Math.max(0,Math.min(deadlineAt-now,300000-Math.max(0,monotonicNow-startedAt)));
}
export function claimTransportAttempt(path,record){
 assert.equal(record.maximumWorkerLaunches,1);assert(Number.isSafeInteger(record.parentPid)&&record.parentPid>0);assert(/^[a-f0-9]{64}$/.test(record.reviewSha256));
 writeFileSync(path,JSON.stringify(record,null,2)+'\n',{mode:0o600,flush:true,flag:'wx'});
}
export function assertProbeChildStopped(started,terminal,{reviewSha256,isRunning}){
 assert.equal(started?.reviewSha256,reviewSha256);assert(Number.isSafeInteger(started?.pid)&&started.pid>0,'child identity unavailable');
 if(terminal){assert.equal(terminal.pid,started.pid);assert.equal(terminal.reviewSha256,reviewSha256);}
 // A stale state file is never proof the child stopped. An unknown/denied PID
 // check must throw; only an authoritative missing process permits recovery.
 assert.equal(isRunning(started.pid),false,'probe child is still running or its state is unknown');
}
export function protectedTransportCredentials({present,read}){
 try{
  assert(present());const value=read();assert(typeof value.sender==='string'&&value.sender.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.sender));assert(/^[a-z]{16}$/i.test(value.appPassword));return value;
 }catch{throw Error('Protected SMTP configuration unavailable');}
}
export function protectedSecretMetadata(run){
 try{
  const rows=JSON.parse(run());assert(Array.isArray(rows));
  const result=rows.map(r=>({name:r.name,digest:r.digest??r.value}));assert(result.every(r=>typeof r.name==='string'&&r.name.length>0&&/^[a-f0-9]{64}$/.test(r.digest)));assert.equal(new Set(result.map(r=>r.name)).size,result.length);return result.sort((a,b)=>a.name.localeCompare(b.name));
 }catch{throw Error('Management secret metadata unavailable');}
}
/** The caller persists each reservation before issuing the query. Recovery
 * rollback has a reserved slot; no COMMIT is ever accepted in the probe phase. */
export function probeQueryKind(sql,{phase,deliverySql}){
 if(sql===deliverySql||sql===probeSql.acquire||sql===probeSql.heartbeat||sql===probeSql.shutdown){assert.equal(phase,'probe');return 'writeQueries';}
 if(sql===probeSql.begin||sql===probeSql.lock){assert.equal(phase,'probe');return 'transactionQueries';}
 if(sql==='begin isolation level repeatable read read only'||sql==='commit'){assert.notEqual(phase,'probe','probe must never commit');return 'transactionQueries';}
 if(sql===probeSql.rollback)return 'transactionQueries';
 assert(/^select\b/i.test(sql.trim()),'unreviewed statement');
 // Read paths are frozen catalog/collector SQL; probe phase has a smaller list.
 if(phase==='probe')assert([probeSql.inspect,probeSql.health].includes(sql),'unreviewed probe read');
 assert(!/\bprivate\.mitsa_worker_|;/i.test(sql),'write hidden in read path');
 return 'readQueries';
}
/** No retries or timer loop. All database effects remain in this uncommitted
 * transaction, and the only externally visible operation is SMTP verify(). */
export async function transportProbe({db,generation,senderHash,deliverySql,expectedControl,verifyTransport,WorkerClass,workerId=crypto.randomUUID(),onRollback=()=>{}}){
 let began=false,worker,stopped=false,rolledBack=false,rollbackAttempted=false,probed=false;
 try{
  await db.query(probeSql.begin);began=true;
  await db.query(probeSql.lock);
  const current=(await db.query(probeSql.inspect)).rows[0];
  assert.equal(current.marker,'fireworks-foundation-proof-01a12e38');assert.equal(current.dispatches,0,'transport-only probe requires empty dispatch table');assert.equal(current.triggers,0,'unexpected control/dispatch side effects');
  assert.deepEqual(current.control,expectedControl,'control drift');
  for(const key of ['admission_enabled','delivery_enabled','transport_ready','session_policy_ready'])assert.equal(current.control[key],false);
  assert.equal(current.control.session_policy,'strict');assert.equal(current.control.approval_generation,null);
  const r=await db.query(deliverySql,[generation,senderHash]);assert.equal(r.rows.length,1);
  assert.deepEqual(r.rows[0],{admission_enabled:false,delivery_enabled:true,transport_ready:false,session_policy_ready:false});
  worker=new WorkerClass({db,generation,workerId,transportReady:async()=>{assert(!probed,'SMTP slot already used');probed=true;return verifyTransport();},send:async()=>{throw Error('transport-only probe cannot send');}});
  assert.equal(await worker.pulse(),'waiting','transport/acquisition/heartbeat did not pass');
  assert(probed,'SMTP verification was not reached');
  assert.deepEqual((await db.query(probeSql.health)).rows[0],{healthy:true,admission:'closed',ready:true});
  await worker.stop();stopped=true;
  const after=(await db.query(probeSql.health)).rows[0];assert.equal(after.ready,false);assert.equal(after.admission,'closed');
  rollbackAttempted=true;await db.query(probeSql.rollback);rolledBack=true;onRollback();
  return {smtpVerified:true,heartbeatVerified:true,admissionStayedClosed:true,rolledBack:true,committedDatabaseWrites:0,messagesSent:0};
 }finally{
  try{if(worker&&!stopped)await worker.stop();}
  finally{if(began&&!rollbackAttempted){rollbackAttempted=true;await db.query(probeSql.rollback);onRollback();}}
 }
}
