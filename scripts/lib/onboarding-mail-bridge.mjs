// Inactive acceptance-harness bridge. No clients, credentials, timers or worker
// processes are opened here. All network/decryption/evidence ports are explicit.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {PersistentMailWorker} from './persistent-mail-worker.ts';
import {onboardingProbeSql as probes} from './onboarding-probe-sql.mjs';
export const onboardingWorkerSql=Object.freeze({
 acquire:'select private.mitsa_worker_acquire($1,$2) ok',
 heartbeat:'select private.mitsa_worker_heartbeat($1,$2,$3) ok',
 claim:'select private.mitsa_worker_claim($1,$2) job',
 authorized:`select exists(select 1 from private.auth_mail_dispatch d join private.registration_control c on c.singleton
     where d.id=$3 and d.state='claimed' and d.claim_worker_id=$2 and d.generation=$1 and c.approval_generation=$1 and c.worker_id=$2
     and c.delivery_enabled and c.stopped_at is null and c.worker_until>statement_timestamp() and private.mitsa_persistent_health()) ok`,
 complete:"select private.mitsa_worker_complete($1,$2,$3,'smtp-accepted') ok",
 uncertain:"select private.mitsa_worker_complete($1,$2,$3,'unconfirmed','transport') ok",
 shutdown:'select private.mitsa_worker_heartbeat($1,$2,false) ok'
});
const hash=v=>createHash('sha256').update(v).digest('hex');
const origin='http://127.0.0.1:3000';
const common={email:z.email(),userId:z.uuid(),tokenHash:z.string().regex(/^(pkce_)?[a-f0-9]{32,256}$/),origin:z.literal(origin)};
const payload=z.discriminatedUnion('type',[
 z.object({...common,type:z.literal('signup'),code:z.string().regex(/^\d{6}$/)}).strict(),
 z.object({...common,type:z.literal('recovery')}).strict()
]);
/** Uses the unchanged, real PersistentMailWorker. A failure permanently stops
 * this bounded bridge, even though the general worker supports later recovery.
 * A separately approved F runner must exercise restarts; it cannot be earned by
 * silently repeating SMTP verification or resetting this bridge's authority.
 */
export function createOnboardingMailBridge(d){
 assert(z.uuid().safeParse(d.generation).success&&z.uuid().safeParse(d.workerId).success,'Worker identity unavailable');
 for(const key of ['assertExecutionReady','fixtureState','decryptPayload','persistPrivate','diagnosticClaims','verifyTransport','sendSignup','sendRecovery','closeTransport'])assert(typeof d[key]==='function','Explicit private worker port missing');
 const fixtures=['e-a','e-b'].map(label=>{const f=d.scope.fixture(label);assert(f&&d.scope.assertRecipient(label,f.email));return Object.freeze({...f});});
 const recipientHashes=fixtures.map(f=>hash(f.email));
 const counted=d.scope.wrapSql(d.db.query.bind(d.db),{readOnlySql:new Set([probes.queue,probes.health,probes.dispatch,probes.capacity,onboardingWorkerSql.authorized]),writeSql:new Set(Object.values(onboardingWorkerSql).filter(s=>s!==onboardingWorkerSql.authorized))});
 let phase='new',owned=false,shutdownAck=false,closing=false,busy=false,transportClosed=false,pending;
 const delivered=new Map(),receipts=new Set(),events=[];
 const ready=async()=>{assert(!['failed','stopped'].includes(phase),'Bounded worker cannot restart');d.scope.active();await d.assertExecutionReady();};
 const query=async(text,args)=>{
  if(Object.values(onboardingWorkerSql).includes(text))assert(args?.[0]===d.generation&&args?.[1]===d.workerId,'Worker ownership changed; no bounded reacquisition');
  try{const result=await counted(text,args,{cleanup:closing});if(closing&&(text===onboardingWorkerSql.shutdown))shutdownAck=result.rows[0]?.ok===true;return result;}
  catch{throw Error('Private bounded-worker database operation failed');}
 };
 const queue=async()=>{const row=(await query(probes.queue,[d.generation,recipientHashes])).rows[0];assert(row?.invalid_jobs===0,'Foreign or uncertain pending work requires reconciliation');};
 const capacity=async(job)=>{
  const row=(await query(probes.capacity,[job.recipientHash,job.id])).rows[0],now=Date.parse(row?.database_now);
  assert(Number.isFinite(now)&&Number(row.hourly)<=10&&Number(row.daily)<=20&&row.recipient_recent===false,'Mail quota or recipient cooldown unavailable');
  const historical=await d.diagnosticClaims();assert(Array.isArray(historical),'Diagnostic quota evidence missing');
  assert(historical.every(r=>Number.isFinite(r.at)&&/^[a-f0-9]{64}$/.test(r.recipientHash)&&r.at<=now),'Diagnostic quota evidence invalid');
  assert(Number(row.hourly)+historical.filter(r=>now-r.at<3600000).length<=10&&Number(row.daily)+historical.filter(r=>now-r.at<86400000).length<=20,'Combined diagnostic quota exhausted');
  assert(!historical.some(r=>r.recipientHash===job.recipientHash&&now-r.at<60000),'Recent diagnostic recipient claim');
  assert(now>=Date.parse(job.createdAt)&&now+60000<Date.parse(job.expiresAt),'Provider message is expired or future-dated');return now;
 };
 const worker=new PersistentMailWorker({db:{query},generation:d.generation,workerId:d.workerId,now:d.now,
  report:event=>{events.push(event);if(event==='owned')owned=true;if(!closing&&['paused','unconfirmed','stopped'].includes(event))phase='failed';},
  transportReady:async()=>{await ready();d.scope.reserve('smtpVerifications');return await d.verifyTransport()===true;},
  send:async(job,stillAuthorized)=>{
   await ready();await queue();
   const row=(await query(probes.dispatch,[job.id,d.generation])).rows[0];
   assert(row&&row.id===job.id&&row.capture_id===job.captureId&&row.generation===d.generation&&row.state==='claimed'&&row.action===job.action&&row.recipient_hash===job.recipientHash,'Dispatch binding unavailable');
   assert(Date.parse(row.created_at)===Date.parse(job.createdAt)&&Date.parse(row.expires_at)===Date.parse(job.expiresAt)&&Date.parse(job.expiresAt)-Date.parse(job.createdAt)===3600000,'Capture lifetime mismatch');
   const decoded=payload.parse(await d.decryptPayload(job.encryptedPayload)),fixture=fixtures.find(f=>f.email===decoded.email);
   assert(fixture&&d.scope.assertRecipient(fixture.label,decoded.email)&&hash(decoded.email)===job.recipientHash&&decoded.type===job.action,'Approved recipient/action binding unavailable');
   const observed=await d.fixtureState(fixture.label);
   assert(observed?.userId===decoded.userId&&decoded.userId===row.provider_user_id&&observed.intentId===row.intent_id,'Provider identity/intent binding unavailable');
   const now=await capacity(job);assert(await stillAuthorized(),'Worker fence closed');
   const message={eventKey:job.id,recipient:decoded.email,providerTokenHash:decoded.tokenHash,issuedAt:Date.parse(job.createdAt),...(decoded.type==='signup'?{providerCode:decoded.code}:{})};
   // The private writer MUST encrypt and verify this before any SMTP attempt.
   await d.persistPrivate({kind:'mail-before-send',fixture:fixture.label,jobId:job.id,decoded,dispatch:row});
   d.scope.reserve('emails',{fixture:fixture.label,job:job.id});
   const authorizeAndClaim=async()=>{await ready();await capacity(job);return stillAuthorized();};
   const response=await (decoded.type==='signup'?d.sendSignup:d.sendRecovery)({message,authorizeAndClaim},now);
   assert(response?.status==='smtp-accepted','SMTP acceptance unconfirmed');
   pending={fixture:fixture.label,action:decoded.type,jobId:job.id,recipientBound:true,intentBound:true,providerIssued:true,smtpAccepted:true,...(decoded.type==='signup'?{code:decoded.code}:{tokenHash:decoded.tokenHash})};
   await d.persistPrivate({kind:'mail-smtp-accepted',...pending});
  }
 });
 const run=async operation=>{assert(!busy,'Overlapping bounded worker operation');busy=true;try{await ready();await queue();const result=await operation();assert(phase!=='failed','Bounded worker failed; no automatic retry');return result;}catch{phase='failed';throw Error('Bounded onboarding mail operation failed; private evidence retained; no automatic retry');}finally{busy=false;}};
 return {
  async pulse(){return run(async()=>{const event=await worker.pulse();assert(owned&&event==='waiting','Worker ownership or transport unavailable');const row=(await query(probes.health,[d.generation,d.workerId])).rows[0];assert(row?.healthy===true,'Worker health unconfirmed');phase='running';return {owned:true,healthy:true};});},
  async tick(){return run(async()=>{assert(phase==='running','Pulse and owned health required before claim');pending=undefined;const event=await worker.tick();assert(['waiting','sent'].includes(event),'Delivery completion unconfirmed');
   if(event==='sent'){assert(pending,'Private delivered-message evidence missing');await d.persistPrivate({kind:'mail-dispatch-completed',...pending});delivered.set(pending.fixture+':'+pending.action,pending);pending=undefined;}return {event};});},
  async stop(){assert(!busy,'Cannot close an in-flight mail operation');if(closing){assert((!owned||shutdownAck)&&transportClosed,'Bounded worker cleanup remains unconfirmed');return {logicalShutdown:!owned||shutdownAck,transportClosed};}closing=true;phase='stopped';let error=false;
   try{await worker.stop();assert(!owned||shutdownAck,'Worker shutdown acknowledgement unavailable');}catch{error=true;}
   try{await d.closeTransport();transportClosed=true;}catch{error=true;}
   if(error)throw Error('Bounded worker cleanup unconfirmed; emergency control closure required');return {logicalShutdown:!owned||shutdownAck,transportClosed};},
  latestDeliveredMessage(label,action){const m=delivered.get(label+':'+action);assert(m,'Completed provider delivery unavailable');return {...m};},
  async confirmHumanReceipt(label,action,jobId){await ready();const m=delivered.get(label+':'+action);assert(m&&m.jobId===jobId,'Receipt must match the current approved dispatch');await d.persistPrivate({kind:'human-inbox-receipt',fixture:label,action,jobId});receipts.add(jobId);},
  receiptConfirmed(label,action){const m=delivered.get(label+':'+action);return !!m&&receipts.has(m.jobId);},
  status(){return {phase,owned,logicalShutdown:closing&&(!owned||shutdownAck),transportClosed,completedMessages:delivered.size,humanReceipts:receipts.size,events:[...events],hostedAcceptanceCompleted:false};}
 };
}
