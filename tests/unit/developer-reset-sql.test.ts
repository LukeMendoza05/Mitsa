import {beforeAll,afterAll,describe,it,expect} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {readFileSync} from "node:fs";
import {prepareArchivedDeveloperReset,restoreArchivedDeveloperApplication} from "../../scripts/lib/developer-reset-plan";

describe("Disposable offline developer reset rehearsal",()=>{
 let db:PGlite;const user=crypto.randomUUID(),other=crypto.randomUUID(),business=crypto.randomUUID(),otherBusiness=crypto.randomUUID(),factor=crypto.randomUUID(),session=crypto.randomUUID();let terms:string;
 beforeAll(async()=>{
  db=new PGlite();
  await db.exec(`create role authenticator login noinherit; create role authenticated nologin; create role anon nologin; create role supabase_auth_admin nologin; create role service_role nologin; grant authenticated to authenticator;
   create schema auth;
   create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean not null default false,deleted_at timestamptz,banned_until timestamptz);
   create table auth.sessions(id uuid primary key,user_id uuid references auth.users,not_after timestamptz,factor_id uuid,aal text);
   create table auth.mfa_factors(id uuid primary key,user_id uuid references auth.users,status text,factor_type text);
   alter table auth.sessions enable row level security;
   create function auth.uid() returns uuid language sql as $$select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid$$;
   create function auth.jwt() returns jsonb language sql as $$select current_setting('request.jwt.claims',true)::jsonb$$;
   grant usage on schema auth to authenticated;grant execute on function auth.uid(),auth.jwt() to authenticated;`);
  for(const file of ['20261012053948_foundation_security_proof.sql','20261012054416_foundation_identity.sql','20261012060403_foundation_membership_lock_policy.sql','20261012060628_foundation_current_session_policy.sql','20261012070606_foundation_verified_actor_adapter.sql','20261013181012_mitsa_workspace_foundation.sql','20261013181135_mitsa_membership_commands.sql','20261013185440_mitsa_account_security_terms.sql','20261013223908_mitsa_registration_boundary.sql','20261014014343_mitsa_account_workspace_interfaces.sql']) {
   if(file.includes('foundation_verified_actor_adapter'))await db.exec('revoke usage on schema auth from app_authz,app_command');
   await db.exec(readFileSync(`supabase/migrations/${file}`,'utf8'));
  }
  terms=(await db.query<{id:string}>("insert into private.legal_versions(kind,version,content,content_hash,status) values('terms','reset-local-only','Synthetic agreement',encode(sha256(convert_to('Synthetic agreement','UTF8')),'hex'),'test') returning id")).rows[0].id;
  await db.exec('begin');
  await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'foundation-reset-local@example.invalid',now()),($2,'foundation-unrelated-local@example.invalid',now())",[user,other]);
  for(const [uid,bid] of [[user,business],[other,otherBusiness]]) {
   await db.query("insert into private.businesses(id,name,primary_owner_id) values($1,'Synthetic reset rehearsal',$2)",[bid,uid]);
   await db.query("insert into private.memberships(business_id,user_id,role) values($1,$2,'owner')",[bid,uid]);
   await db.query("insert into private.shops(business_id,id,name) values($1,$2,'Synthetic location')",[bid,crypto.randomUUID()]);
  }
  await db.query("insert into private.account_profiles(user_id,full_name) values($1,'Synthetic reset person')",[user]);
  await db.query("insert into private.account_security(user_id,initialized) values($1,true)",[user]);
  await db.query("insert into private.factor_bindings(user_id,factor_id,generation) values($1,$2,1)",[user,factor]);
  await db.query("insert into private.security_permits(user_id,session_id,generation,action) values($1,$2,1,'enroll')",[user,session]);
  await db.query("insert into auth.sessions(id,user_id,factor_id,aal) values($1,$2,$3,'aal2')",[session,user,factor]);
  await db.query("insert into auth.mfa_factors values($1,$2,'verified','totp')",[factor,user]);
  await db.query("insert into private.legal_acceptances(user_id,version_id,source) values($1,$2,'registration')",[user,terms]);
  await db.query("insert into private.access_audit(business_id,actor_id,event) values($1,$2,'workspace.created')",[business,user]);
  await db.query("insert into private.access_commands values($1,$2,'synthetic-hash','{}',now())",[user,crypto.randomUUID()]);
  await db.exec('commit');
 },60000);
 afterAll(async()=>{if(db)await db.close();});
 it("refuses sole-owner removal from an active workspace and rolls it back",async()=>{
  await db.exec('begin');await db.query('delete from private.memberships where user_id=$1',[user]);
  await expect(db.exec('set constraints all immediate')).rejects.toBeTruthy();await db.exec('rollback');
  expect((await db.query("select 1 from private.memberships where user_id=$1",[user])).rows).toHaveLength(1);
 });
 it("restores application state on transaction failure without changing factors or immutable history",async()=>{
  await db.exec('begin');await prepareArchivedDeveloperReset(db,user,business);await db.exec('set constraints all immediate');await db.exec('rollback');
  expect((await db.query("select status from private.businesses where id=$1",[business])).rows[0]).toEqual({status:'active'});
  expect((await db.query("select 1 from private.factor_bindings where user_id=$1",[user])).rows).toHaveLength(1);
  expect((await db.query("select 1 from private.access_audit where business_id=$1",[business])).rows).toHaveLength(1);
 });
 it("refuses a changed release gate before touching application rows",async()=>{
  await db.exec('begin; update private.release_gates set registration_enabled=true');
  await expect(prepareArchivedDeveloperReset(db,user,business)).rejects.toThrow('Release gates changed');await db.exec('rollback');
 });
 it("restores a committed application phase from its snapshot if the original Auth identity still exists",async()=>{
  const snapshot:Record<string,Record<string,unknown>[]>={};
  for(const table of ['businesses','account_profiles','account_security','factor_bindings','security_permits','memberships'])snapshot[`private.${table}`]=(await db.query<Record<string,unknown>>(`select * from private.${table} where ${table==='businesses'?'id':'user_id'}=$1`,[table==='businesses'?business:user])).rows;
  await db.exec('begin');await prepareArchivedDeveloperReset(db,user,business);await db.exec('commit');
  await db.exec('begin');await restoreArchivedDeveloperApplication(db,user,business,snapshot);await db.exec('set constraints all immediate; commit');
  for(const table of ['account_profiles','account_security','factor_bindings','security_permits','memberships'])expect((await db.query(`select * from private.${table} where user_id=$1`,[user])).rows).toEqual(snapshot[`private.${table}`]);
  expect((await db.query('select status from private.businesses where id=$1',[business])).rows[0]).toEqual({status:'active'});
  // Reset/compensation audit entries remain immutable evidence.
  expect((await db.query('select 1 from private.access_audit where business_id=$1',[business])).rows).toHaveLength(3);
 });
 it("archives the disposable workspace, preserves evidence, and allows a new identity without inherited MFA or memberships",async()=>{
  await db.exec('begin');await prepareArchivedDeveloperReset(db,user,business);await db.exec('set constraints all immediate');
  // Local Auth-table model only; live deletion will require a separately
  // approved supported Supabase admin call, not these SQL statements.
  await db.query('delete from auth.sessions where user_id=$1',[user]);await db.query('delete from auth.mfa_factors where user_id=$1',[user]);await db.query('delete from auth.users where id=$1',[user]);await db.exec('commit');
  expect((await db.query('select status,primary_owner_id from private.businesses where id=$1',[business])).rows[0]).toEqual({status:'closed',primary_owner_id:null});
  for(const [table,column,id] of [['shops','business_id',business],['legal_acceptances','user_id',user],['access_commands','actor_id',user]])expect((await db.query(`select 1 from private.${table} where ${column}=$1`,[id])).rows).toHaveLength(1);
  expect((await db.query('select 1 from private.access_audit where business_id=$1',[business])).rows).toHaveLength(4);
  expect((await db.query('select status from private.businesses where id=$1',[otherBusiness])).rows[0]).toEqual({status:'active'});
  expect((await db.query('select 1 from private.memberships where user_id=$1',[other])).rows).toHaveLength(1);
  const fresh=crypto.randomUUID();await db.query("insert into auth.users(id,email) values($1,'foundation-reset-local@example.invalid')",[fresh]);
  await expect(restoreArchivedDeveloperApplication(db,user,business,{})).rejects.toThrow('Auth identity no longer exists');
  for(const table of ['auth.sessions','auth.mfa_factors','private.memberships','private.factor_bindings','private.legal_acceptances'])expect((await db.query(`select 1 from ${table} where user_id=$1`,[fresh])).rows).toHaveLength(0);
 });
});
