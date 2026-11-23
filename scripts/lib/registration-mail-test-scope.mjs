// Local operator test guard only. No credentials, provider client or activation.
// Claims are immutable and consumed BEFORE the caller attempts any network I/O.
import {mkdirSync,readFileSync,writeFileSync,readdirSync,openSync,fsyncSync,closeSync,rmdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
class ScopeError extends Error {constructor(code){super(code);this.name='MailTestScopeError';this.code=code;}}
const need=(ok,code)=>{if(!ok)throw new ScopeError(code);};
function persist(path,value){let fd;try{fd=openSync(path,'wx',0o600);writeFileSync(fd,JSON.stringify(value));fsyncSync(fd);}catch{throw new ScopeError('SCOPE_STORAGE_UNAVAILABLE');}finally{if(fd!==undefined)closeSync(fd);}}
/** This private authorization is an operator record of a NEW explicit human
 * approval, not a browser input, a grant of application access or risk acceptance.
 * No such authorization file is created by this module or the review generator.
 */
export function registrationMailTestScope({root,reviewBytes,fixtureBytes,authorization,now=()=>Date.now()}){
 let review,fixtures;
 try{review=JSON.parse(String(reviewBytes));fixtures=JSON.parse(String(fixtureBytes));}catch{throw new ScopeError('SCOPE_INPUT_INVALID');}
 need(authorization?.approved===true,'SCOPE_NOT_APPROVED');
 need(review.project==='mjtejwafxriwntweussc'&&authorization.project===review.project&&fixtures.project===review.project,'SCOPE_TARGET_MISMATCH');
 need(authorization.reviewId===review.reviewId&&fixtures.reviewId===review.reviewId&&authorization.reviewSha256===sha(reviewBytes)&&sha(fixtureBytes)===review.privateFixtures.sha256,'SCOPE_REVIEW_MISMATCH');
 need(Array.isArray(authorization.sections)&&authorization.sections.includes('D')&&authorization.sections.every(s=>['C3B','D','E','F'].includes(s)),'SCOPE_SELECTION_INVALID');
 need(review.sections.D.externalEmailsAggregate===14&&review.sections.D.smtpVerifyConnections===12&&review.sections.D.workerLaunches===5&&review.sections.D.workerRuntimeMinutesAggregate===300,'SCOPE_LIMIT_MISMATCH');
 for(const [section,limit] of [['C3B',6],['E',6],['F',2]])need(review.sections[section].externalEmailsWithinD===limit,'SCOPE_LIMIT_MISMATCH');
 const start=Date.parse(authorization.notBefore),end=Date.parse(authorization.notAfter);
 need(Number.isFinite(start)&&Number.isFinite(end)&&end>start&&end-start<=86400000,'SCOPE_LIFETIME_INVALID');
 const active=()=>need(now()>=start&&now()<end,'SCOPE_EXPIRED_OR_NOT_STARTED');active();
 need(Array.isArray(fixtures.fixtures)&&fixtures.fixtures.length===4&&new Set(fixtures.fixtures.map(f=>f.label)).size===4,'SCOPE_FIXTURES_INVALID');
 const recipientByLabel=new Map(fixtures.fixtures.map(f=>[f.label,sha(f.email)]));
 const authorizationSha256=sha(JSON.stringify(authorization));
 const binding={reviewSha256:sha(reviewBytes),reviewId:review.reviewId,project:review.project};
 mkdirSync(root,{recursive:true,mode:0o700});
 try{persist(join(root,'binding.json'),binding);}catch{
  try{need(JSON.stringify(JSON.parse(readFileSync(join(root,'binding.json'))))===JSON.stringify(binding),'SCOPE_STORAGE_BINDING_MISMATCH');}catch{throw new ScopeError('SCOPE_STORAGE_BINDING_MISMATCH');}
 }
 const authorizationPath=join(root,`authorization-${authorizationSha256}.json`);
 try{persist(authorizationPath,authorization);}catch{
  try{need(JSON.stringify(JSON.parse(readFileSync(authorizationPath)))===JSON.stringify(authorization),'SCOPE_AUTHORIZATION_RECORD_INVALID');}catch{throw new ScopeError('SCOPE_AUTHORIZATION_RECORD_INVALID');}
 }
 function records(kind){
  return readdirSync(root).filter(n=>new RegExp(`^${kind}-[0-9]{3}$`).test(n)).map(n=>{
   try{return JSON.parse(readFileSync(join(root,n,'claim.json')));}catch{throw new ScopeError('SCOPE_CLAIM_UNCONFIRMED');}
  });
 }
 function lock(name,work){
  const path=join(root,name);try{mkdirSync(path);}catch{throw new ScopeError('SCOPE_BUSY_OR_RECONCILIATION_REQUIRED');}
  try{return work();}finally{try{rmdirSync(path);}catch{/* A leftover lock fails closed. */}}
 }
 function claim(kind,maximum,details){
  active();for(let slot=1;slot<=maximum;slot++){
   const path=join(root,`${kind}-${String(slot).padStart(3,'0')}`);
   try{mkdirSync(path);}catch(error){if(error?.code==='EEXIST')continue;throw new ScopeError('SCOPE_STORAGE_UNAVAILABLE');}
   const record={kind,slot,claimedAt:now(),authorizationSha256,...details};persist(join(path,'claim.json'),record);return record;
  }
  throw new ScopeError('SCOPE_BUDGET_EXHAUSTED');
 }
 // Any partially written claim requires explicit reconciliation; never hide it
 // with a new state file or turn an uncertain attempt into available capacity.
 for(const kind of ['worker','mail','verify','phaseC3B','phaseE','phaseF'])records(kind);
 const liveLeases=new WeakSet();
 function leaseActive(lease){active();need(lease&&liveLeases.has(lease)&&now()<lease.deadline,'SCOPE_WORKER_LEASE_EXPIRED');}
 return {
  reserveWorker(minutes){
   active();need(Number.isInteger(minutes)&&minutes>0&&minutes<=300,'SCOPE_RUNTIME_INVALID');
   return lock('worker-reservation-lock',()=>{
    const prior=records('worker');need(prior.reduce((n,r)=>n+r.minutes,0)+minutes<=300,'SCOPE_RUNTIME_EXHAUSTED');
    const deadline=Math.min(now()+minutes*60000,end),record=claim('worker',5,{minutes,deadline});
    const lease=Object.freeze({slot:record.slot,deadline});liveLeases.add(lease);return lease;
   });
  },
  assertWorkerActive:leaseActive,
  reserveVerification(lease){leaseActive(lease);return claim('verify',12,{});},
  reserveMail(lease,{section,recipientHash,jobId}){
   leaseActive(lease);need(['C3B','E','F'].includes(section)&&authorization.sections.includes(section),'SCOPE_SECTION_NOT_APPROVED');
   need(typeof jobId==='string'&&/^[0-9a-f-]{36}$/.test(jobId),'SCOPE_JOB_INVALID');
   const labels=review.sections[section].fixtures;
   need(labels.some(label=>recipientByLabel.get(label)===recipientHash),'SCOPE_RECIPIENT_NOT_APPROVED');
   // Serialize reservation, not the network operation. The lock is released
   // before SMTP; a process crash after sending cannot replay the immutable job.
   return lock('mail-reservation-lock',()=>{
    const prior=records('mail');
    need(!prior.some(r=>r.recipientHash===recipientHash&&now()-r.claimedAt<60000),'SCOPE_RECIPIENT_COOLDOWN');
    const path=join(root,'job-'+sha(jobId));try{mkdirSync(path);}catch{throw new ScopeError('SCOPE_JOB_ALREADY_CLAIMED');}
    // Independent atomic slots enforce both per-phase and shared limits. An
    // interrupted multi-claim may waste capacity, but can never increase it.
    claim('phase'+section,review.sections[section].externalEmailsWithinD,{jobHash:sha(jobId)});
    return claim('mail',14,{section,recipientHash,jobHash:sha(jobId)});
   });
  }
 };
}

/** Wrap the existing worker dependencies; never replace its database fences.
 * Scope denial pauses transport and blocks sends. It never fabricates delivery.
 */
export function guardMailTestWorker(scope,lease,{transportReady,send,sectionForJob}){
 let blocked=false;
 const isActive=()=>{try{scope.assertWorkerActive(lease);return !blocked;}catch{blocked=true;return false;}};
 return {
  isActive,
  async transportReady(){
   if(blocked)return false;
   try{scope.reserveVerification(lease);}catch{blocked=true;return false;}
   return transportReady();
  },
  async send(job,stillAuthorized){
   if(blocked)throw new ScopeError('SCOPE_STOPPED');
   try{scope.reserveMail(lease,{section:sectionForJob(job),recipientHash:job.recipientHash,jobId:job.id});}catch(error){blocked=true;throw error;}
   return send(job,async()=>{if(!isActive())return false;const allowed=await stillAuthorized();return allowed&&isActive();});
  }
 };
}
