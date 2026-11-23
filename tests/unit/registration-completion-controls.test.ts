import {beforeAll,afterAll,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import type {PGlite} from '@electric-sql/pglite';
import {recoveredC1Database,correctionPath} from '../support/stage-c1-correction';
let db:PGlite;
const proposal=(name:string)=>readFileSync(`supabase/security-proposals/persistent-registration-${name}.sql.txt`,'utf8');
beforeAll(async()=>{db=await recoveredC1Database();await db.exec(readFileSync(correctionPath,'utf8'));},60000);
afterAll(async()=>{await db?.close();});
const generation='8a52e28b-cfb4-497a-b419-0e5a131cf71b';
it('adds only two unpublished immutable notices while keeping every control disabled',async()=>{
 const before=(await db.query('select count(*)::int n from private.legal_versions')).rows[0] as {n:number};
 await db.exec(proposal('test-notices'));
 const rows=(await db.query("select kind,status,content_hash=encode(sha256(convert_to(content,'UTF8')),'hex') valid from private.legal_versions where version='isolated-persistent-synthetic-v1' order by kind")).rows;
 expect(rows).toEqual([{kind:'privacy',status:'test',valid:true},{kind:'terms',status:'test',valid:true}]);
 expect((await db.query('select count(*)::int n from private.legal_versions')).rows[0]).toEqual({n:before.n+2});
 expect((await db.query('select admission_enabled or delivery_enabled or session_policy_ready enabled from private.registration_control')).rows[0]).toEqual({enabled:false});
});
it('fails collision without rewriting an accepted notice',async()=>{
 await expect(db.exec(proposal('test-notices'))).rejects.toThrow('notice collision');await db.exec('rollback');
 expect((await db.query("select count(*)::int n from private.legal_versions where version='isolated-persistent-synthetic-v1'")).rows[0]).toEqual({n:2});
});
it('starts delivery readiness separately and cannot start admission without a healthy worker',async()=>{
 const result=await db.query(proposal('delivery-controls'),[generation,'ab'.repeat(32)]);
 expect(result.rows).toEqual([{admission_enabled:false,delivery_enabled:true,transport_ready:false,session_policy_ready:false}]);
 expect((await db.query(proposal('admission-controls'),[generation])).rows).toHaveLength(0);
 expect((await db.query(proposal('delivery-controls'),[generation,'ab'.repeat(32)])).rows).toHaveLength(0);
 expect((await db.query('select * from auth.users')).rows).toHaveLength(0);
 expect((await db.query('select * from private.auth_mail_dispatch')).rows).toHaveLength(0);
});
it('full stop fences only the matching generation and preserves accounts and notices',async()=>{
 const captureId=crypto.randomUUID(),intentId=crypto.randomUUID(),workerId=crypto.randomUUID();
 // In-memory ciphertext placeholder only; no provider message or cryptography
 // claim. Exercise the actual state transition and constraints on shutdown.
 await db.query("insert into private.isolated_auth_mail(id,recipient_hash,action,encrypted_payload) values($1,$2,'signup',decode('ab','hex'))",[captureId,'ab'.repeat(32)]);
 await db.query("insert into private.auth_mail_dispatch(request_key,action,recipient_hash,intent_id,generation,state) values($1,'signup',$2,$3,$4,'reserved')",[crypto.randomUUID(),'ab'.repeat(32),intentId,generation]);
 await db.query("insert into private.auth_mail_dispatch(request_key,action,recipient_hash,intent_id,generation,state,capture_id,claim_worker_id,claimed_at) values($1,'signup',$2,$3,$4,'claimed',$5,$6,statement_timestamp())",[crypto.randomUUID(),'ab'.repeat(32),intentId,generation,captureId,workerId]);
 const wrong=await db.query(proposal('operational-stop'),[crypto.randomUUID()]);expect(wrong.rows).toEqual([{stopped_controls:0,cancelled:0,unconfirmed:0}]);
 const right=await db.query(proposal('operational-stop'),[generation]);expect(right.rows).toEqual([{stopped_controls:1,cancelled:1,unconfirmed:1}]);
 expect((await db.query('select admission_enabled or delivery_enabled or session_policy_ready enabled from private.registration_control')).rows[0]).toEqual({enabled:false});
 expect((await db.query("select count(*)::int n from private.legal_versions where version='isolated-persistent-synthetic-v1'")).rows[0]).toEqual({n:2});
});
