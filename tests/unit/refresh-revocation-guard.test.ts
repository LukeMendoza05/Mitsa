import { beforeEach, afterEach, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

// Offline PostgreSQL only. Executes the exact UNAPPLIED candidate, with no
// hosted Auth credential, user record or provider configuration involved.
let db: PGlite;
let originalActorMetadata: unknown;
const user = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
const session = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', otherSession = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const candidate = readFileSync('supabase/prepared/20261015123215_mitsa_refresh_family_revocation_guard.sql','utf8');
const emergency = readFileSync('supabase/prepared/refresh-family-emergency-rollback.sql','utf8');
const operator = async () => { await db.exec('reset role; set session authorization postgres'); };
async function actor(id=user,sid=session) {
 await db.exec('set session authorization authenticator; set role authenticated');
 await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,session_id:sid,role:'authenticated',aud:'authenticated',is_anonymous:false,exp:4102444800})]);
 return (await db.query<{actor:string|null}>('select private.current_actor() actor')).rows[0].actor;
}
async function revoke() { await operator();await db.exec(`begin; update auth.refresh_tokens set revoked=true,updated_at=statement_timestamp() where session_id='${session}' and not revoked; commit;`); }
beforeEach(async()=>{
 db=new PGlite();
 await db.exec(`create role authenticator login noinherit;create role authenticated nologin;create role anon nologin;create role service_role nologin;create role supabase_auth_admin nologin;create role app_authz nologin;create role app_command nologin;create role app_workspace nologin;
 grant authenticated to authenticator;create schema auth;create schema private;create schema foundation_probe;
 grant usage on schema private to authenticated,app_authz,app_command,app_workspace;
 create table foundation_probe.environment_identity(singleton boolean primary key,marker text);insert into foundation_probe.environment_identity values(true,'fireworks-foundation-proof-01a12e38');
 create table auth.users(id uuid primary key,is_anonymous boolean default false,deleted_at timestamptz,banned_until timestamptz);
 create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users,not_after timestamptz);
 create table auth.refresh_tokens(id bigint generated always as identity primary key,session_id uuid,user_id text,revoked boolean default false,updated_at timestamptz default statement_timestamp());
 insert into auth.users(id) values('${user}'),('${other}');insert into auth.sessions(id,user_id) values('${session}','${user}'),('${otherSession}','${other}');
 insert into auth.refresh_tokens(session_id,user_id) values('${session}','${user}'),('${otherSession}','${other}');`);
 const baseline=readFileSync('supabase/migrations/20261012070606_foundation_verified_actor_adapter.sql','utf8').match(/create function private\.current_actor\(\)[\s\S]*?grant execute on function private\.current_actor\(\) to authenticated, app_authz, app_command;/)?.[0];
 if(!baseline)throw Error('Actor fixture unavailable');await db.exec(baseline);
 originalActorMetadata=(await db.query("select proowner,proacl::text,proconfig,prosecdef,provolatile from pg_proc where oid='private.current_actor()'::regprocedure")).rows[0];
 await db.exec(candidate);
},30000);
afterEach(async()=>{await db?.close();});
it('does not revoke a normal rotation whose replacement commits in the same provider transaction',async()=>{
 expect(await actor()).toBe(user);await operator();
 await db.exec(`begin;update auth.refresh_tokens set revoked=true where session_id='${session}';insert into auth.refresh_tokens(session_id,user_id) values('${session}','${user}');commit;`);
 expect((await db.query<{active:boolean}>('select not_after is null active from auth.sessions where id=$1',[session])).rows[0].active).toBe(true);expect(await actor()).toBe(user);
});
it('records a fully revoked family at commit and denies its bearer while preserving another session',async()=>{
 await revoke();expect((await db.query<{expired:boolean}>('select not_after<=statement_timestamp() expired from auth.sessions where id=$1',[session])).rows[0].expired).toBe(true);
 expect(await actor()).toBeNull();expect(await actor(other,otherSession)).toBe(other);
});
it('cannot restore application access by creating a fresh token during the provider reuse grace period',async()=>{
 await revoke();await db.query('insert into auth.refresh_tokens(session_id,user_id) values($1,$2)',[session,user]);
 expect(await actor()).toBeNull();await operator();expect((await db.query<{expired:boolean}>('select not_after<=statement_timestamp() expired from auth.sessions where id=$1',[session])).rows[0].expired).toBe(true);
});
it('does not retain a revocation from a rolled-back provider transaction',async()=>{
 await db.exec(`begin;update auth.refresh_tokens set revoked=true where session_id='${session}';set constraints all immediate;rollback;`);
 expect((await db.query<{active:boolean}>('select not_after is null active from auth.sessions where id=$1',[session])).rows[0].active).toBe(true);expect(await actor()).toBe(user);
});
it('preserves the actor boundary, creates no table and grants no client trigger execution',async()=>{
 expect((await db.query("select proowner,proacl::text,proconfig,prosecdef,provolatile from pg_proc where oid='private.current_actor()'::regprocedure")).rows[0]).toEqual(originalActorMetadata);
 expect((await db.query<{absent:boolean}>("select to_regclass('private.session_revocations') is null absent")).rows[0].absent).toBe(true);
 for(const role of ['anon','authenticated','service_role','supabase_auth_admin','app_workspace','app_authz','app_command']){
  expect((await db.query<{allowed:boolean}>("select has_function_privilege($1,'private.mitsa_expire_revoked_refresh_family()','EXECUTE') allowed",[role])).rows[0].allowed).toBe(false);
 }
});
it('retains signed-context provenance and expiry checks after the guard is added',async()=>{
 expect(await actor()).toBe(user);
 await db.exec("set session authorization postgres;set role authenticated");
 expect((await db.query<{actor:string|null}>('select private.current_actor() actor')).rows[0].actor).toBeNull();
 await operator();await actor();await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:user,session_id:session,role:'authenticated',aud:'authenticated',is_anonymous:false,exp:1})]);
 expect((await db.query<{actor:string|null}>('select private.current_actor() actor')).rows[0].actor).toBeNull();
});
it('runs the deferred observer for the provider writer without granting function access',async()=>{
 await db.exec('grant usage on schema auth to supabase_auth_admin;grant select,update on auth.refresh_tokens to supabase_auth_admin');
 await db.exec(`begin;set local role supabase_auth_admin;update auth.refresh_tokens set revoked=true where session_id='${session}';commit;reset role;`);
 expect((await db.query<{expired:boolean}>('select not_after<=statement_timestamp() expired from auth.sessions where id=$1',[session])).rows[0].expired).toBe(true);
});
it('emergency rollback removes the provider write dependency while retaining already-revoked bearer denial',async()=>{
 await revoke();await db.exec(emergency);
 expect((await db.query<{n:number}>("select count(*)::int n from pg_trigger where tgrelid='auth.refresh_tokens'::regclass and not tgisinternal")).rows[0].n).toBe(0);
 expect(await actor()).toBeNull();expect(await actor(other,otherSession)).toBe(other);
});
it('permits a fresh independent session for the same user after rollback without reviving the expired one',async()=>{
 await revoke();await db.exec(emergency);const fresh=crypto.randomUUID();
 await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[fresh,user]);await db.query('insert into auth.refresh_tokens(session_id,user_id) values($1,$2)',[fresh,user]);
 expect(await actor()).toBeNull();expect(await actor(user,fresh)).toBe(user);
});
it('expires only the targeted session while preserving another session belonging to the same user',async()=>{
 const independent=crypto.randomUUID();await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[independent,user]);await db.query('insert into auth.refresh_tokens(session_id,user_id) values($1,$2)',[independent,user]);
 await revoke();expect(await actor()).toBeNull();expect(await actor(user,independent)).toBe(user);
});
it('does not expire a session if the provider refresh row has a mismatched user',async()=>{
 await db.query('update auth.refresh_tokens set user_id=$1 where session_id=$2',[other,session]);await revoke();
 expect(await actor()).toBe(user);expect(await actor(other,otherSession)).toBe(other);
});
it('demonstrates a false expiry if a provider transaction makes deferred constraints immediate before normal rotation',async()=>{
 await db.exec(`begin;set constraints all immediate;update auth.refresh_tokens set revoked=true where session_id='${session}';insert into auth.refresh_tokens(session_id,user_id) values('${session}','${user}');commit;`);
 // This is an adverse review finding, NOT a successful compatibility check.
 expect(await actor()).toBeNull();
});
it('demonstrates that disabled PL/pgSQL assertions skip the candidate target-marker preflight',async()=>{
 await db.exec(emergency);await db.exec("update foundation_probe.environment_identity set marker='wrong-offline-marker';set plpgsql.check_asserts=off");await db.exec(candidate);
 // Candidate application in this wrong OFFLINE target demonstrates why ASSERT
 // must not be the sole installation safety guard. No hosted DDL is involved.
 expect((await db.query<{installed:boolean}>("select exists(select 1 from pg_trigger where tgname='mitsa_refresh_family_revocation') installed")).rows[0].installed).toBe(true);
});
