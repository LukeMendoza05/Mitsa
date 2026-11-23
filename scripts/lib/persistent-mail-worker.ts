import {z} from 'zod';
type Database={query(sql:string,parameters?:unknown[]):Promise<{rows:Record<string,unknown>[]}>};
const jobSchema=z.object({id:z.uuid(),captureId:z.uuid(),action:z.enum(['signup','recovery']),encryptedPayload:z.string().min(1),createdAt:z.iso.datetime({offset:true}),databaseNow:z.iso.datetime({offset:true}),expiresAt:z.iso.datetime({offset:true}),recipientHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
export type PersistentMailJob=z.infer<typeof jobSchema>;
type Event='owned'|'waiting'|'sent'|'unconfirmed'|'paused'|'stopped';
type Dependencies={db:Database;generation:string;workerId?:string;now?:()=>number;
 send:(job:PersistentMailJob,stillAuthorized:()=>Promise<boolean>)=>Promise<void>;
 transportReady:()=>Promise<boolean>;report?:(event:Event)=>void};
/** No SMTP, decryption, credential loading or activation is implicit here. */
export class PersistentMailWorker {
 private readonly deps:Dependencies;
 private workerId:string;private owned=false;private busy=false;private pulsing=false;
 private transport=false;private retryAt=0;private stopped=false;
 constructor(deps:Dependencies){this.deps=deps;this.workerId=deps.workerId??crypto.randomUUID();}
 private now(){return this.deps.now?.()??Date.now();}
 private event(event:Event){this.deps.report?.(event);return event;}
 async pulse():Promise<Event> {
  if(this.stopped)return this.event('stopped');
  if(this.pulsing)return 'waiting';this.pulsing=true;
  try {
   if(!this.owned){
    const r=await this.deps.db.query('select private.mitsa_worker_acquire($1,$2) ok',[this.deps.generation,this.workerId]);
    if(r.rows[0]?.ok!==true)return this.event('waiting');this.owned=true;this.event('owned');
   }
   if(!this.transport&&this.now()>=this.retryAt){this.transport=await this.deps.transportReady();this.retryAt=this.now()+30000;}
   const r=await this.deps.db.query('select private.mitsa_worker_heartbeat($1,$2,$3) ok',[this.deps.generation,this.workerId,this.transport]);
   if(r.rows[0]?.ok!==true){this.stopped=true;this.owned=false;return this.event('stopped');}
   return this.event(this.transport?'waiting':'paused');
  }catch{
   // A lost DB result cannot prove whether a claim/SMTP completion persisted.
   // Acquire as a NEW worker after lease expiry, never replay the old job.
   this.owned=false;this.transport=false;this.workerId=crypto.randomUUID();this.retryAt=this.now()+30000;
   return this.event('paused');
  }finally{this.pulsing=false;}
 }
 async tick():Promise<Event> {
  if(this.busy)return 'waiting';this.busy=true;
  try {
   if(this.stopped)return this.event('stopped');
   if(!this.owned||!this.transport){await this.pulse();if(!this.owned||!this.transport)return this.stopped?'stopped':'paused';}
   const result=await this.deps.db.query('select private.mitsa_worker_claim($1,$2) job',[this.deps.generation,this.workerId]);
   if(result.rows[0]?.job===null)return 'waiting';
   const parsed=jobSchema.safeParse(result.rows[0]?.job);
   if(!parsed.success){this.transport=false;return this.event('paused');}
   const job=parsed.data;
   const stillAuthorized=async()=>{
    const r=await this.deps.db.query(`select exists(select 1 from private.auth_mail_dispatch d join private.registration_control c on c.singleton
     where d.id=$3 and d.state='claimed' and d.claim_worker_id=$2 and d.generation=$1 and c.approval_generation=$1 and c.worker_id=$2
     and c.delivery_enabled and c.stopped_at is null and c.worker_until>statement_timestamp() and private.mitsa_persistent_health()) ok`,[this.deps.generation,this.workerId,job.id]);
    return r.rows[0]?.ok===true;
   };
   try {
    await this.deps.send(job,stillAuthorized);
    const r=await this.deps.db.query("select private.mitsa_worker_complete($1,$2,$3,'smtp-accepted') ok",[this.deps.generation,this.workerId,job.id]);
    return this.event(r.rows[0]?.ok===true?'sent':'unconfirmed');
   }catch{
    this.transport=false;this.retryAt=this.now()+30000;
    // Keep the durable claim after ANY uncertain SMTP outcome. A later resend
    // requires a fresh provider request; this worker never retries this job.
    await this.deps.db.query("select private.mitsa_worker_complete($1,$2,$3,'unconfirmed','transport') ok",[this.deps.generation,this.workerId,job.id]);
    await this.pulse();return this.event('unconfirmed');
   }
  }catch{this.transport=false;this.owned=false;this.workerId=crypto.randomUUID();this.retryAt=this.now()+30000;return this.event('paused');}
  finally{this.busy=false;}
 }
 async stop() {
  this.stopped=true;
  if(this.owned){try{await this.deps.db.query('select private.mitsa_worker_heartbeat($1,$2,false) ok',[this.deps.generation,this.workerId]);}catch{/* Lease fails closed without renewal. */}}
  this.owned=false;return this.event('stopped');
 }
}
