import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {recoveredC1Database,correctionPath,correctionRecoveryPath} from '../support/stage-c1-correction';
it('atomically rejects wrong targets, unsafe readiness, collisions and function drift before installing',async()=>{
 const db=await recoveredC1Database();try{
  await db.exec('set plpgsql.check_asserts=off');
  for(const mutation of ["update foundation_probe.environment_identity set marker='wrong'","update private.registration_control set session_policy_ready=true","create function private.mitsa_registration_identity() returns void language sql as $$select$$","alter function private.mitsa_before_user_created(jsonb) owner to app_registration","create or replace function private.mitsa_registration_command(p_action text,p_payload jsonb,p_request_hash text,p_signed_at timestamptz) returns jsonb language sql as $$select null::jsonb$$"]){
   await db.exec('begin;'+mutation);await expect(db.exec(readFileSync(correctionPath,'utf8'))).rejects.toMatchObject({code:'P0004'});await db.exec('rollback');
   expect((await db.query("select to_regprocedure('private.mitsa_registration_identity(text,text,uuid,uuid)')::text fn")).rows[0]).toEqual({fn:null});
  }
  await db.exec('set plpgsql.check_asserts=on');
  await db.exec('begin;create role c1_unexpected nologin;alter default privileges in schema private grant execute on functions to c1_unexpected');
  await expect(db.exec(readFileSync(correctionPath,'utf8'))).rejects.toMatchObject({code:'P0004'});await db.exec('rollback');
 }finally{await db.close();}
},60000);
it('restores recovered definitions and keeps retained data, policies, role attributes and Auth privileges intact',async()=>{
 const db=await recoveredC1Database();try{
  const definition=async()=>(await db.query("select p.proname name,pg_get_userbyid(p.proowner) owner,p.proacl::text acl,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in ('current_actor','mitsa_before_user_created','mitsa_isolated_send_email','mitsa_current_terms','mitsa_finalize_registration','mitsa_registration_command') order by 1")).rows;
  const policies=async()=>(await db.query("select to_jsonb(p) p from pg_policies p where schemaname in ('private','foundation_probe') order by schemaname,tablename,policyname")).rows;
  const auth=async()=>(await db.query("select nspname,nspacl::text acl from pg_namespace where nspname='auth'")).rows;
  await db.exec('set role c1_test_root');const uid=crypto.randomUUID(),factor=crypto.randomUUID();await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'retained@example.invalid',statement_timestamp())",[uid]);await db.query("insert into auth.mfa_factors(id,user_id,status,factor_type) values($1,$2,'verified','totp')",[factor,uid]);await db.exec('reset role');
  const before=await definition(),oldPolicies=await policies(),oldAuth=await auth(),users=(await db.query('select * from auth.users order by id')).rows,factors=(await db.query('select * from auth.mfa_factors order by id')).rows;
  await db.exec(readFileSync(correctionPath,'utf8'));
  expect(await policies()).toEqual(oldPolicies);expect(await auth()).toEqual(oldAuth);
  expect((await db.query('select * from auth.users order by id')).rows).toEqual(users);expect((await db.query('select * from auth.mfa_factors order by id')).rows).toEqual(factors);
  expect((await db.query("select rolcanlogin,rolsuper,rolbypassrls from pg_roles where rolname='app_registration'")).rows[0]).toEqual({rolcanlogin:false,rolsuper:false,rolbypassrls:false});
  await db.exec('begin;alter function private.mitsa_registration_identity(text,text,uuid,uuid) set search_path=public');
  await expect(db.exec(readFileSync(correctionRecoveryPath,'utf8'))).rejects.toMatchObject({code:'P0004'});await db.exec('rollback');
  await db.exec(readFileSync(correctionRecoveryPath,'utf8'));
  expect(await definition()).toEqual(before);expect(await policies()).toEqual(oldPolicies);expect(await auth()).toEqual(oldAuth);
  expect((await db.query('select * from auth.users order by id')).rows).toEqual(users);expect((await db.query('select * from auth.mfa_factors order by id')).rows).toEqual(factors);
  expect((await db.query("select has_function_privilege('app_registration','private.mitsa_registration_identity(text,text,uuid,uuid)','EXECUTE') allowed")).rows[0]).toEqual({allowed:false});
  expect((await db.query('select admission_enabled,delivery_enabled,session_policy_ready from private.registration_control')).rows[0]).toEqual({admission_enabled:false,delivery_enabled:false,session_policy_ready:false});
 }finally{await db.close();}
},60000);
