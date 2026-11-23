import {beforeAll,afterAll,afterEach,it,expect} from 'vitest';
import type {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {recoveredC1Database,correctionPath,correctionRecoveryPath} from '../support/stage-c1-correction';
let db:PGlite;
const operator=()=>db.exec('reset role');
const root=()=>db.exec('reset role;set role c1_test_root');
const helper=async(mode:string|null,email:string|null,intent:string|null=null,user:string|null=null)=>(await db.query('select * from private.mitsa_registration_identity($1,$2,$3,$4)',[mode,email,intent,user])).rows;
const command=async(action:string,payload:Record<string,unknown>,request=crypto.randomUUID().replaceAll('-','').repeat(2))=>(await db.query<{value:Record<string,unknown>|null}>('select api.mitsa_registration_command($1,$2,$3,statement_timestamp()) value',[action,JSON.stringify(payload),request])).rows[0].value;
let pending:{user:string;intent:string;email:string;terms:string;privacy:string};
async function seed(label:string,verified=false){
 await root();const user=crypto.randomUUID(),intent=crypto.randomUUID(),email=label+'@example.invalid';
 const versions=[];for(const kind of ['terms','privacy'])versions.push((await db.query<{id:string}>("insert into private.legal_versions(kind,version,content,content_hash,status) values($1,$2,'Fixture',encode(sha256(convert_to('Fixture','UTF8')),'hex'),'test') returning id",[kind,label+'-'+kind])).rows[0].id);
 await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,case when $3 then statement_timestamp() end)',[user,email,verified]);
 await db.query(`insert into private.registration_intents(id,email,full_name,nonce_hash,terms_id,privacy_id,provider_user_id,submission_id,submission_fingerprint,creation_deadline,submission_state,approval_generation,registration_profile,registration_session_policy)
 values($1,$2,'Fixture',encode(sha256(convert_to($3,'UTF8')),'hex'),$4,$5,$6,$7,repeat('a',64),statement_timestamp()+interval '2 minutes','pending-verification',$8,'isolated-development','strict')`,[intent,email,user.replaceAll('-','').repeat(2),versions[0],versions[1],user,crypto.randomUUID(),crypto.randomUUID()]);
 await db.query(`insert into private.account_registration_policy(user_id,intent_id,profile,terms_id,privacy_id,accepted_at,session_policy,verified_at)
 values($1,$2,'isolated-development',$3,$4,statement_timestamp(),'strict',case when $5 then statement_timestamp() end)`,[user,intent,versions[0],versions[1],verified]);
 await operator();return {user,intent,email,terms:versions[0],privacy:versions[1]};
}
beforeAll(async()=>{db=await recoveredC1Database();},60000);
afterAll(async()=>{await db?.close();});
afterEach(async()=>{if(db)await db.exec('rollback;reset role');});

it('reproduces the real missing-grant environment and installs without changing managed Auth ACLs',async()=>{
 expect((await db.query("select has_schema_privilege(current_user,'auth','USAGE') usage,has_schema_privilege('app_registration','auth','USAGE') direct")).rows[0]).toEqual({usage:true,direct:false});
 // The exact candidate performs no Auth GRANT; owner grant authority is unused.
 expect(readFileSync(correctionPath,'utf8')).not.toMatch(/(?:grant|revoke)\s+[\s\S]{0,100}\s+on\s+(?:schema\s+auth|auth\.users)/i);
 const acl=(await db.query("select nspacl::text acl from pg_namespace where nspname='auth'")).rows;
 await db.exec('set role service_role');
 await expect(command('continue-verification',{email:'missing@example.invalid',passwordProven:true})).rejects.toMatchObject({code:'42501'});await operator();
 await db.exec(readFileSync(correctionPath,'utf8'));
 expect((await db.query("select nspacl::text acl from pg_namespace where nspname='auth'")).rows).toEqual(acl);
 expect((await db.query<{direct:boolean}>("select has_schema_privilege('app_registration','auth','USAGE') direct")).rows[0].direct).toBe(false);
 expect((await db.query('select admission_enabled,delivery_enabled,session_policy_ready,approval_generation,worker_id from private.registration_control')).rows[0]).toEqual({admission_enabled:false,delivery_enabled:false,session_policy_ready:false,approval_generation:null,worker_id:null});
});
it('matches only the exact pending identity and returns only its two internal identifiers',async()=>{
 pending=await seed('pending-identity');await db.exec('set role app_registration');
 expect(await helper('pending',pending.email,pending.intent,pending.user)).toEqual([{user_id:pending.user,intent_id:pending.intent}]);
 expect(await helper('pending',pending.email,crypto.randomUUID(),pending.user)).toEqual([]);
 expect(await helper('pending',pending.email,pending.intent,crypto.randomUUID())).toEqual([]);
 expect(await helper('pending','other@example.invalid',pending.intent,pending.user)).toEqual([]);
 await operator();
});
it('rejects banned, deleted, anonymous, verified and blocked pending identities',async()=>{
 for(const mutation of ["update auth.users set deleted_at=statement_timestamp() where id=$1","update auth.users set banned_until=statement_timestamp()+interval '1 day' where id=$1","update auth.users set is_anonymous=true where id=$1","update auth.users set email_confirmed_at=statement_timestamp() where id=$1","update private.account_registration_policy set emergency_blocked=true where user_id=$1"]){
  await root();await db.exec('begin');await db.query(mutation,[pending.user]);await db.exec('set role app_registration');expect(await helper('pending',pending.email,pending.intent,pending.user)).toEqual([]);await root();await db.exec('rollback');await operator();
 }
});
it('rejects missing, mismatched and finalized signed-intent bindings',async()=>{
 for(const mutation of ["update private.registration_intents set privacy_id=terms_id where id=$1","update private.registration_intents set finalized_at=statement_timestamp() where id=$1","delete from private.registration_intents where id=$1"]){
  await root();await db.exec('begin');await db.query(mutation,[pending.intent]);await db.exec('set role app_registration');expect(await helper('pending',pending.email,pending.intent,pending.user)).toEqual([]);await root();await db.exec('rollback');await operator();
 }
});
it('keeps password-proven continuation and consent renewal independent of admission and delivery',async()=>{
 await db.exec('set role service_role');
 expect(await command('continue-verification',{email:pending.email,passwordProven:true})).toMatchObject({intentId:pending.intent,state:'pending-verification'});
 expect(await command('continue-verification',{email:pending.email,passwordProven:false})).toBeNull();
 await operator();await db.query('update private.registration_control set terms_id=$1,privacy_id=$2',[pending.terms,pending.privacy]);
 await db.exec('set role service_role');expect(await command('renew-verification',{email:pending.email,intentId:pending.intent,passwordProven:true,accepted:true,termsId:pending.terms,privacyId:pending.privacy})).toMatchObject({intentId:pending.intent});
 await operator();await db.exec('update private.registration_control set terms_id=null,privacy_id=null');
});
it('requires verified durable cohort eligibility for recovery and survives pruned intent history',async()=>{
 const account=await seed('recovery-identity',true);await root();await db.query('delete from private.registration_intents where id=$1',[account.intent]);await db.exec('set role app_registration');
 expect(await helper('recovery',account.email)).toEqual([{user_id:account.user,intent_id:account.intent}]);
 await root();await db.query('update private.account_registration_policy set verified_at=null where user_id=$1',[account.user]);await db.exec('set role app_registration');expect(await helper('recovery',account.email)).toEqual([]);
 await root();await db.query('update private.account_registration_policy set verified_at=statement_timestamp(),emergency_blocked=true where user_id=$1',[account.user]);await db.exec('set role app_registration');expect(await helper('recovery',account.email)).toEqual([]);await operator();
});
it('fails closed on duplicate matches and permission loss without returning provider details',async()=>{
 const first=await seed('duplicate-match',true);const second=await seed('second-match',true);
 await root();await db.query('update auth.users set email=$1 where id=$2',[first.email,second.user]);await db.exec('set role app_registration');expect(await helper('recovery',first.email)).toEqual([]);
 await root();await db.exec('begin;alter function private.mitsa_registration_identity(text,text,uuid,uuid) owner to app_registration');await db.exec('set role app_registration');expect(await helper('pending',pending.email,pending.intent,pending.user)).toEqual([]);
 await root();await db.exec('rollback');await operator();
});
it('denies browser, service, hook and workspace roles direct helper execution',async()=>{
 for(const role of ['anon','authenticated','service_role','supabase_auth_admin','app_workspace']){
  await db.exec(`set role ${role}`);
  await expect(helper('recovery','nobody@example.invalid')).rejects.toMatchObject({code:'42501'});
  await operator();
 }
 await db.exec('set role app_registration');expect(await helper('recovery','nobody@example.invalid')).toEqual([]);
 await expect(db.query('select id from auth.users')).rejects.toMatchObject({code:'42501'});
 await expect(db.exec('alter function private.mitsa_registration_identity(text,text,uuid,uuid) set search_path=public')).rejects.toMatchObject({code:'42501'});await operator();
});
it('returns no identity for invalid input and does not expose arbitrary pre-cohort Auth users',async()=>{
 await root();await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,statement_timestamp())',[crypto.randomUUID(),'retained-fixture@example.invalid']);await operator();
 await db.exec('set role app_registration');
 for(const [mode,email] of [['unknown','retained-fixture@example.invalid'],['recovery','Retained-fixture@example.invalid'],['recovery',' bad@example.invalid'],['recovery','a'.repeat(255)+'@example.invalid'],['recovery','retained-fixture@example.invalid'],[null,null]])expect(await helper(mode,email)).toEqual([]);
 expect(await helper('pending','retained-fixture@example.invalid')).toEqual([]);
 expect(await helper('recovery','retained-fixture@example.invalid',crypto.randomUUID(),crypto.randomUUID())).toEqual([]);
 await operator();
});
