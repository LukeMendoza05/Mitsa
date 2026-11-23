import {afterAll,beforeAll,it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {onboardingProbeSql as sql} from '../../scripts/lib/onboarding-probe-sql.mjs';
// Isolated in-memory PostgreSQL syntax/value tests, not hosted/RLS acceptance.
const db=new PGlite({extensions:{pgcrypto}}),id='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002',key=Buffer.alloc(32,5),recipient='a'.repeat(64);
beforeAll(async()=>{await db.exec(`
create schema auth;create schema private;create schema extensions;create extension pgcrypto with schema extensions;
create table auth.users(id uuid,email text,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz,is_super_admin bool,is_anonymous bool,encrypted_password text);
create table auth.sessions(id uuid,user_id uuid,not_after timestamptz,aal text);
create table auth.mfa_factors(id uuid,user_id uuid,factor_type text,status text,secret text);
create table private.account_registration_policy(user_id uuid,intent_id uuid,terms_id uuid,privacy_id uuid,session_policy text,emergency_blocked bool);
create table private.registration_intents(id uuid,provider_user_id uuid,provider_claimed_at timestamptz,nonce_hash text,approval_generation uuid,registration_profile text);
create table private.memberships(user_id uuid,business_id uuid,role text,active bool);
create table private.operator_principals(user_id uuid,active bool);
create table private.factor_bindings(user_id uuid,factor_id uuid,revoked_at timestamptz,generation uuid);
create table private.account_security(user_id uuid,generation uuid);
create table private.businesses(id uuid,slug text,primary_owner_id uuid);
create table private.shops(business_id uuid,name text,kind text,active bool);
create table private.registration_control(singleton bool,worker_id uuid,approval_generation uuid,transport_ready bool);
create table private.auth_mail_dispatch(id uuid,intent_id uuid,provider_user_id uuid,capture_id uuid,recipient_hash text,generation uuid,state text,action text,claimed_at timestamptz);
create table private.isolated_auth_mail(id uuid,created_at timestamptz,encrypted_payload text);
create table private.pilot_mail_deliveries(recipient_hash text,created_at timestamptz);
create function private.mitsa_persistent_health() returns bool language sql as 'select false';
`);
 await db.query(`insert into auth.users values($1,$2,now(),null,null,false,false,'DO-NOT-RETURN-PASSWORD')`,[id,'offline+e-a@gmail.com']);
 await db.query(`insert into auth.sessions values($1,$1,null,'aal2');`,[id]);
 await db.query(`insert into auth.mfa_factors values($1,$1,'totp','verified','DO-NOT-RETURN-FACTOR')`,[id]);
 await db.query(`insert into private.account_registration_policy values($1,$1,$1,$1,'strict',false)`,[id]);
 await db.query(`insert into private.registration_intents values($1,$1,now(),'BOUND-NONCE',$1,'isolated-development')`,[id]);
 await db.query(`insert into private.factor_bindings values($1,$1,null,$1)`,[id]);await db.query(`insert into private.account_security values($1,$1)`,[id]);
 await db.query(`insert into private.memberships values($1,$1,'owner',true)`,[id]);await db.query(`insert into private.businesses values($1,'workspace-offline',$1)`,[id]);await db.query(`insert into private.shops values($1,'Offline Warehouse','warehouse',true)`,[id]);
 await db.query(`insert into private.registration_control values(true,$1,$1,false)`,[id]);
 await db.query(`insert into private.isolated_auth_mail values($1,now(),'DO-NOT-RETURN-CAPTURE')`,[id]);
 await db.query(`insert into private.auth_mail_dispatch values($1,$1,$1,$1,$2,$1,'smtp-accepted','signup',now())`,[id,recipient]);
},30000);
afterAll(async()=>{await db.close();});
it('executes every reviewed SELECT using bound parameters and returns no credential, factor secret, raw email or capture',async()=>{
 const args:Record<string,unknown[]>={absent:['offline+e-a@gmail.com'],registration:['offline+e-a@gmail.com',id],session:[id,id],mfa:[id,key],workspace:[id,'Offline Warehouse',key],clock:[],queue:[id,[recipient]],health:[id,id],dispatch:[id,id],capacity:[recipient,id]};
 for(const [name,text] of Object.entries(sql)){expect(text.trim()).toMatch(/^select\b/);const result=await db.query(text,args[name]);const output=JSON.stringify(result.rows);expect(output).not.toMatch(/DO-NOT-RETURN|offline\+e-a|BOUND-NONCE/);expect(result.rows.length).toBeGreaterThan(0);}
 const r:any=(await db.query(sql.registration,args.registration)).rows[0];expect(r).toMatchObject({email_confirmed:true,active:true,intent_bound:true,generation_bound:true,profile_bound:true,memberships:1});
});
it('changes the protected MFA digest when the stored factor changes, without returning its secret',async()=>{
 const before:any=(await db.query(sql.mfa,[id,key])).rows[0];await db.query(`update auth.mfa_factors set secret='DIFFERENT-PRIVATE-FACTOR' where id=$1`,[id]);
 const after:any=(await db.query(sql.mfa,[id,key])).rows[0];expect(after.factors[0].protected).not.toBe(before.factors[0].protected);expect(after.factors[0].trusted).toBe(true);expect(JSON.stringify(after)).not.toContain('DIFFERENT-PRIVATE');
});
it('allows retained terminal dispatch history but detects foreign pending work',async()=>{
 expect((await db.query<any>(sql.queue,[id,[recipient]])).rows[0].invalid_jobs).toBe(0);
 await db.query(`insert into private.auth_mail_dispatch(id,recipient_hash,generation,state,action) values($1,$2,$1,'queued','signup')`,[other,'b'.repeat(64)]);
 expect((await db.query<any>(sql.queue,[id,[recipient]])).rows[0].invalid_jobs).toBe(1);
 await db.query(`update private.auth_mail_dispatch set state='unconfirmed' where id=$1`,[other]);expect((await db.query<any>(sql.queue,[id,[recipient]])).rows[0].invalid_jobs).toBe(1);
 await db.query(`update private.auth_mail_dispatch set state='smtp-accepted' where id=$1`,[other]);expect((await db.query<any>(sql.queue,[id,[recipient]])).rows[0].invalid_jobs).toBe(0);
});
it('uses durable claim time for quota even when a dispatch was captured earlier, and includes pilot usage',async()=>{
 await db.query(`insert into private.pilot_mail_deliveries values($1,now())`,[recipient]);
 const result:any=(await db.query(sql.capacity,[recipient,other])).rows[0];expect(result.hourly).toBe(2);expect(result.daily).toBe(2);expect(result.recipient_recent).toBe(true);
});
it('detects coherent binding/account generation changes and membership changes independently of a factor secret or workspace row',async()=>{
 const before:any=(await db.query(sql.mfa,[id,key])).rows[0];const businessBefore:any=(await db.query(sql.workspace,[id,'Offline Warehouse',key])).rows[0];
 await db.query('update private.factor_bindings set generation=$1 where user_id=$2',[other,id]);await db.query('update private.account_security set generation=$1 where user_id=$2',[other,id]);
 const after:any=(await db.query(sql.mfa,[id,key])).rows[0];expect(after.factors[0].trusted).toBe(true);expect(after.factors[0].protected).toBe(before.factors[0].protected);expect(after.factors[0].bindingProtected).not.toBe(before.factors[0].bindingProtected);expect(after.factors[0].accountProtected).not.toBe(before.factors[0].accountProtected);
 await db.query("update private.memberships set role='admin' where user_id=$1",[id]);const businessAfter:any=(await db.query(sql.workspace,[id,'Offline Warehouse',key])).rows[0];expect(businessAfter.workspaces[0].digest).toBe(businessBefore.workspaces[0].digest);expect(businessAfter.workspaces[0].membershipProtected).not.toBe(businessBefore.workspaces[0].membershipProtected);
});
