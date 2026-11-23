// Bounded, no-account C3A protocol. No environment, provider client or logging.
import assert from 'node:assert/strict';
import {createHash,randomUUID,randomBytes} from 'node:crypto';
import {signRegistrationCommand} from '../../supabase/functions/_shared/registration-service-auth.ts';
export const c3aMaximum=8;
export const sha256=v=>createHash('sha256').update(v).digest('hex');
export async function runC3A({project,origin,publicKey,signer,send,claim,complete,ledgerProof,now=()=>Date.now()}){
 assert.equal(project,'mjtejwafxriwntweussc');assert.equal(origin,'http://127.0.0.1:3000');
 const service=`https://${project}.supabase.co/functions/v1/mitsa-registration-service`;
 const payload=()=>({email:`c3a-${randomUUID()}@example.invalid`,submissionId:randomUUID()});
 const body=JSON.stringify({version:1,action:'submission-status',payload:payload()});
 const common={origin,apikey:publicKey,'content-type':'application/json'};
 let replay;
 for(let slot=1;slot<=c3aMaximum;slot++){
  let text=body,url=service,headers={...common};
  if(slot===2)Object.assign(headers,await signRegistrationCommand(signer,'aaaaaaaaaaaaaaaaaaaa',text,now()));
  if(slot===3)Object.assign(headers,await signRegistrationCommand(signer,project,text,now()-120000));
  if(slot===4){text=JSON.stringify({version:1,action:'unsupported',payload:{}});Object.assign(headers,await signRegistrationCommand(signer,project,text,now()));}
  if(slot===5||slot===7){
   text=JSON.stringify({version:1,action:'submission-status',payload:payload()});
   Object.assign(headers,await signRegistrationCommand(signer,project,text,now()));
   await ledgerProof({slot,request_hash:sha256(headers['x-mitsa-nonce']),signed_at:new Date(Number(headers['x-mitsa-time'])*1000).toISOString()});
   if(slot===5)replay={text,headers:{...headers}};
  }
  if(slot===6){text=replay.text;headers={...replay.headers};}
  if(slot===8){
   url=`https://${project}.supabase.co/rest/v1/rpc/mitsa_registration_command`;
   headers={apikey:publicKey,'content-type':'application/json','content-profile':'api','accept-profile':'api'};
   text=JSON.stringify({p_action:'submission-status',p_payload:payload(),p_request_hash:randomBytes(32).toString('hex'),p_signed_at:new Date(now()).toISOString()});
  }
  // Claim durably BEFORE network. Exceptions/timeouts consume the slot. No retry.
  await claim(slot);
  const response=await send(url,{method:'POST',body:text,headers,credentials:'omit',redirect:'error',signal:AbortSignal.timeout(15000)});
  const reader=response.body?.getReader();let raw='',bytes=0;
  if(reader)for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.length;assert(bytes<=1024,'unexpected response size');raw+=new TextDecoder().decode(part.value);}
  const data=JSON.parse(raw),status=response.status,noStore=(response.headers.get('cache-control')??'').split(',').map(s=>s.trim()).includes('no-store');
  let passed=false,category;
  if([1,2,3,6].includes(slot)){passed=status===(slot===6?503:401)&&JSON.stringify(data)==='{"error":"unavailable"}'&&noStore;category=slot===6?'durable-replay-denied':'signature-denied';}
  if(slot===4){passed=status===400&&JSON.stringify(data)==='{"error":"input"}'&&noStore;category='unsupported-action-denied';}
  if(slot===5||slot===7){passed=status===200&&data===null&&noStore;category='unknown-submission-null';}
  if(slot===8){passed=[401,403].includes(status)&&data?.code==='42501'&&data?.message==='permission denied for function mitsa_registration_command';category=passed?'database-permission-denied':'permission-denial-unconfirmed';}
  await complete({slot,status,category,passed,noStore:slot<8?noStore:undefined});
  assert(passed,`C3A slot ${slot} failed; no retry`);
 }
}
// Compare complete encrypted preservation payloads, permitting only exact signed
// request hashes actually claimed by slots 5/7. Nothing is deleted or normalized.
export function assertC3Preserved(expected,observed,proofs,start,end,{requireBoth=false}={}){
 const table='private.registration_requests',before=expected.rows[table],after=observed.rows[table];
 assert(Array.isArray(before)&&Array.isArray(after));
 const existing=new Map(before.map(r=>[r.request_hash,r]));
 const additions=after.filter(r=>!existing.has(r.request_hash));
 assert(additions.length<=2);if(requireBoth)assert.equal(additions.length,2);
 for(const r of before)assert.deepEqual(after.find(a=>a.request_hash===r.request_hash),r,'prior ledger record changed');
 for(const row of additions){
  assert.deepEqual(Object.keys(row).sort(),['received_at','request_hash','signed_at']);
  const proof=proofs.find(p=>p.request_hash===row.request_hash);assert(proof&&[5,7].includes(proof.slot));
  assert.equal(Date.parse(row.signed_at),Date.parse(proof.signed_at));
  assert(Date.parse(row.received_at)>=start&&Date.parse(row.received_at)<=end,'ledger outside approved execution');
 }
 const copy=structuredClone(observed);copy.rows[table]=structuredClone(before);assert.deepEqual(copy,expected,'unapproved preservation delta');
 return {ledgerRowsAdded:additions.length,allOtherPreserved:true};
}
