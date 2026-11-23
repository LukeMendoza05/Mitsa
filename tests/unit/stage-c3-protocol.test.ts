import {it,expect} from 'vitest';
import {runC3A,assertC3Preserved} from '../../scripts/lib/stage-c3-protocol.mjs';
const project='mjtejwafxriwntweussc',origin='http://127.0.0.1:3000';
function fixture(failAt=0){
 const calls:{url:string;init:RequestInit}[]=[],claims:number[]=[],results:unknown[]=[],proofs:unknown[]=[];
 return {calls,claims,results,proofs,options:{project,origin,signer:'ab'.repeat(32),publicKey:'public-fixture',
 claim:async(n:number)=>{claims.push(n);},complete:async(r:unknown)=>{results.push(r);},ledgerProof:async(p:unknown)=>{proofs.push(p);},
 send:async(url:string,init:RequestInit)=>{calls.push({url,init});const slot=calls.length;if(slot===failAt)throw Error('timeout');
 const status=[401,401,401,400,200,503,200,401][slot-1];
 const data=slot===8?{code:'42501',message:'permission denied for function mitsa_registration_command'}:slot===5||slot===7?null:{error:slot===4?'input':'unavailable'};
 return new Response(JSON.stringify(data),{status,headers:{'cache-control':'no-store'}});
 }}};
}
it('executes exactly eight harmless requests, exact replay and two private proofs',async()=>{
 const f=fixture();await runC3A(f.options);expect(f.claims).toEqual([1,2,3,4,5,6,7,8]);expect(f.proofs).toHaveLength(2);
 expect(f.calls[4].init).toMatchObject({body:f.calls[5].init.body,headers:f.calls[5].init.headers});
 expect(f.calls[0].init.headers).not.toHaveProperty('x-mitsa-signature');
 for(const c of f.calls){expect(c.init.credentials).toBe('omit');expect(c.init.redirect).toBe('error');expect(c.url).not.toContain('/auth/');expect(c.init.headers).not.toHaveProperty('authorization');}
 expect(f.calls[7].url).toContain('/rest/v1/rpc/');
});
it.each([1,5,6,8])('consumes a failed slot %i without retry or later calls',async(slot)=>{
 const f=fixture(slot);await expect(runC3A(f.options)).rejects.toThrow('timeout');expect(f.calls).toHaveLength(slot);expect(f.claims).toHaveLength(slot);
});
it('does not count a gateway-only 401 as database authorization proof',async()=>{
 const f=fixture();const send=f.options.send;f.options.send=async(u,i)=>{const r=await send(u,i);return f.calls.length===8?new Response('{"message":"Invalid API key"}',{status:401}):r;};
 await expect(runC3A(f.options)).rejects.toThrow('slot 8 failed');
});
it('allows only the exact two signed ledger additions and preserves every other field',()=>{
 const before={rows:{'private.registration_requests':[],business:[{id:1}]},identities:{id:'unchanged'}};
 const proof={slot:5,request_hash:'a'.repeat(64),signed_at:'2026-10-24T00:00:00Z'};
 const after=structuredClone(before) as any;after.rows['private.registration_requests']=[{...proof,received_at:'2026-10-24T00:00:01Z'}];delete after.rows['private.registration_requests'][0].slot;
 expect(assertC3Preserved(before,after,[proof],Date.parse(proof.signed_at),Date.parse('2026-10-24T00:00:02Z')).ledgerRowsAdded).toBe(1);
 expect(()=>assertC3Preserved(before,after,[],0,Date.now())).toThrow();
 after.rows.business[0].id=2;expect(()=>assertC3Preserved(before,after,[proof],0,Date.now())).toThrow();
});
