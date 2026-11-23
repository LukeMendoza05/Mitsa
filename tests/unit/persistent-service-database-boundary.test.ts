import {beforeAll,afterAll,it,expect} from 'vitest';
import type {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {recoveredC1Database,correctionPath} from '../support/stage-c1-correction';
import {registrationServiceHandler} from '../../supabase/functions/_shared/registration-service';
import {signRegistrationCommand} from '../../supabase/functions/_shared/registration-service-auth';

// Real Edge handler -> corrected PostgreSQL command, entirely in memory.
// No provider user, SMTP transport, hosted credential or session is involved.
const project='mjtejwafxriwntweussc',origin='http://127.0.0.1:3000',signingKey='cd'.repeat(32);
let db:PGlite,commands=0;
beforeAll(async()=>{db=await recoveredC1Database();await db.exec(readFileSync(correctionPath,'utf8'));},60000);
afterAll(async()=>{await db?.close();});
const body=()=>JSON.stringify({version:1,action:'submission-status',payload:{email:'not-registered@example.invalid',submissionId:crypto.randomUUID()}});
async function request(text:string,headers:Record<string,string>={}){
 return new Request('https://synthetic.invalid',{method:'POST',body:text,headers:{origin,apikey:'synthetic-public','content-type':'application/json',...await signRegistrationCommand(signingKey,project,text),...headers}});
}
const handler=registrationServiceHandler({enabled:true,project,origin,signingKey,authorizeApiKey:key=>key==='synthetic-public',
 async command(action,payload,proof){
  commands++;await db.exec('set role service_role');
  try{return (await db.query<{value:unknown}>('select api.mitsa_registration_command($1,$2,$3,$4) value',[action,JSON.stringify(payload),proof.requestHash,proof.signedAt])).rows[0].value;}
  finally{await db.exec('reset role');}
 }
});
it('uses the durable database replay ledger across separate Edge handler invocations',async()=>{
 const first=await request(body()),replay=first.clone();
 const accepted=await handler(first);expect(accepted.status).toBe(200);expect(await accepted.json()).toBeNull();
 const denied=await handler(replay);expect(denied.status).toBe(503);expect(await denied.json()).toEqual({error:'unavailable'});
 expect((await db.query<{n:number}>('select count(*)::int n from private.registration_requests')).rows[0].n).toBe(1);
 expect((await db.query('select * from private.account_registration_policy')).rows).toHaveLength(0);
 expect((await db.query('select * from auth.users')).rows).toHaveLength(0);
});
it('rejects forged and expired signatures before invoking any database command',async()=>{
 const before=commands,text=body();
 for(const headers of [{'x-mitsa-signature':'0'.repeat(64)},await signRegistrationCommand(signingKey,project,text,Date.now()-61000),await signRegistrationCommand(signingKey,'aaaaaaaaaaaaaaaaaaaa',text)]){
  expect((await handler(await request(text,headers))).status).toBe(401);
 }
 expect(commands).toBe(before);
});
it('keeps direct anonymous and authenticated command calls denied after correction',async()=>{
 try{
  for(const role of ['anon','authenticated']){
   await db.exec(`set role ${role}`);
   await expect(db.query('select api.mitsa_registration_command($1,$2,$3,statement_timestamp())',['submission-status',{email:'not-registered@example.invalid',submissionId:crypto.randomUUID()},'ef'.repeat(32)])).rejects.toMatchObject({code:'42501'});
   await db.exec('reset role');
  }
 }finally{await db.exec('reset role');}
 expect((await db.query<{enabled:boolean}>('select admission_enabled or delivery_enabled or session_policy_ready or transport_ready enabled from private.registration_control')).rows[0].enabled).toBe(false);
});
