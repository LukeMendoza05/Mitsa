import {it,expect,vi} from 'vitest';
import {PersistentMailWorker} from '../../scripts/lib/persistent-mail-worker';
const generation=crypto.randomUUID(),workerId=crypto.randomUUID();
const job={id:crypto.randomUUID(),captureId:crypto.randomUUID(),action:'signup',encryptedPayload:'synthetic-ciphertext',createdAt:new Date().toISOString(),databaseNow:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString(),recipientHash:'a'.repeat(64)};
function fixture() {
 let claimed=false,completed=false,heartbeat=true,claimCount=0;
 const query=vi.fn(async(sql:string,_parameters?:unknown[])=>{
  if(sql.includes('mitsa_worker_acquire'))return {rows:[{ok:true}]};
  if(sql.includes('mitsa_worker_heartbeat'))return {rows:[{ok:heartbeat}]};
  if(sql.includes('mitsa_worker_claim')){claimCount++;if(claimed)return {rows:[{job:null}]};claimed=true;return {rows:[{job}]};}
  if(sql.includes('mitsa_worker_complete')){completed=true;return {rows:[{ok:true}]};}
  return {rows:[{ok:true}]};
 });
 const send=vi.fn(async(_job:unknown,authorize:()=>Promise<boolean>)=>{if(!await authorize())throw Error('Closed');});
 return {db:{query},send,closed:()=>{heartbeat=false;},get completed(){return completed;},get claimCount(){return claimCount;}};
}
it('claims once, checks the current fence before sending, and never sends the same job twice',async()=>{
 const f=fixture(),w=new PersistentMailWorker({...f,generation,workerId,transportReady:async()=>true});
 expect(await w.tick()).toBe('sent');expect(await w.tick()).toBe('waiting');expect(f.send).toHaveBeenCalledTimes(1);expect(f.completed).toBe(true);
});
it('retains uncertain delivery, pauses health, and recovers transport without replaying the old job',async()=>{
 const f=fixture();let now=1000;f.send.mockRejectedValueOnce(Error('Synthetic connection lost after DATA'));
 const probe=vi.fn(async()=>true),w=new PersistentMailWorker({...f,generation,workerId,now:()=>now,transportReady:probe});
 expect(await w.tick()).toBe('unconfirmed');expect(await w.tick()).toBe('paused');
 now+=31000;expect(await w.tick()).toBe('waiting');expect(f.send).toHaveBeenCalledTimes(1);expect(probe).toHaveBeenCalledTimes(2);
 expect(f.db.query.mock.calls.some(([sql])=>sql.includes("'unconfirmed','transport'"))).toBe(true);
});
it('stops after fencing rejection and cannot be revived by a new tick',async()=>{
 const f=fixture(),w=new PersistentMailWorker({...f,generation,workerId,transportReady:async()=>true});
 await w.pulse();f.closed();expect(await w.pulse()).toBe('stopped');expect(await w.tick()).toBe('stopped');expect(f.send).not.toHaveBeenCalled();
});
it('does not claim mail while the transport is unavailable',async()=>{
 const f=fixture(),w=new PersistentMailWorker({...f,generation,workerId,transportReady:async()=>false});
 expect(await w.tick()).toBe('paused');expect(f.claimCount).toBe(0);expect(f.send).not.toHaveBeenCalled();
});
it('serializes overlapping ticks',async()=>{
 const f=fixture(),w=new PersistentMailWorker({...f,generation,workerId,transportReady:async()=>true});
 await Promise.all([w.tick(),w.tick(),w.tick()]);expect(f.send).toHaveBeenCalledTimes(1);
});
it('recovers from a database heartbeat outage with a new ownership identity',async()=>{
 const f=fixture();let now=1000;
 const w=new PersistentMailWorker({...f,generation,workerId,now:()=>now,transportReady:async()=>true});
 await w.pulse();f.db.query.mockRejectedValueOnce(Error('Synthetic database outage'));
 expect(await w.pulse()).toBe('paused');expect(f.send).not.toHaveBeenCalled();
 now+=31000;expect(await w.tick()).toBe('sent');
 const owners=f.db.query.mock.calls.filter(([sql])=>sql.includes('mitsa_worker_acquire')).map(([,parameters])=>parameters?.[1]);
 expect(owners).toHaveLength(2);expect(owners[0]).toBe(workerId);expect(owners[1]).not.toBe(workerId);
 expect(f.send).toHaveBeenCalledTimes(1);
});
it('does not resend after SMTP succeeds but completion persistence is unavailable',async()=>{
 const f=fixture();let now=1000,completionAvailable=false;
 const original=f.db.query.getMockImplementation()!;
 f.db.query.mockImplementation(async(sql,parameters)=>{
  if(sql.includes('mitsa_worker_complete')&&!completionAvailable)throw Error('Synthetic completion outage');
  return original(sql,parameters);
 });
 const w=new PersistentMailWorker({...f,generation,workerId,now:()=>now,transportReady:async()=>true});
 expect(await w.tick()).toBe('paused');expect(f.send).toHaveBeenCalledTimes(1);
 completionAvailable=true;now+=31000;expect(await w.tick()).toBe('waiting');
 expect(f.send).toHaveBeenCalledTimes(1);expect(f.completed).toBe(false);
});
