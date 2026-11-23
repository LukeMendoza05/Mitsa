import {beforeAll,afterAll,it,expect} from 'vitest';
import type {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {persistentDatabase} from '../support/persistent-database';

// Executes only in-memory PostgreSQL. No hosted project/configuration is loaded.
const schema=readFileSync('supabase/prepared/20261016004927_mitsa_persistent_registration_inactive.sql','utf8');
const hooks=readFileSync('supabase/prepared/20261016005221_mitsa_persistent_registration_hooks_inactive.sql','utf8');
let db:PGlite, originalActor:string, oldPolicies:Record<string,unknown>[];
const exists=async(name:string)=>(await db.query<{found:string|null}>('select to_regclass($1)::text found',[name])).rows[0].found;
const policies=async()=>(await db.query<Record<string,unknown>>("select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where tablename not in ('registration_control','account_registration_policy','auth_mail_dispatch') order by schemaname,tablename,policyname")).rows;
beforeAll(async()=>{
 db=await persistentDatabase({installPrepared:false});
 originalActor=(await db.query<{definition:string}>("select pg_get_functiondef('private.current_actor()'::regprocedure) definition")).rows[0].definition;
 oldPolicies=await policies();
},60000);
afterAll(async()=>{await db?.close();});

it('rejects the wrong or missing target marker before creating any object',async()=>{
 for(const change of ["update foundation_probe.environment_identity set marker='wrong'","delete from foundation_probe.environment_identity"]){
  await db.exec('begin;'+change);
  await expect(db.exec(schema)).rejects.toMatchObject({code:'P0004'});
  await db.exec('rollback');
  expect(await exists('private.registration_control')).toBeNull();
  expect((await db.query("select rolname from pg_roles where rolname='app_registration'")).rows).toHaveLength(0);
 }
});
it('fails atomically on an object collision instead of taking over an existing role',async()=>{
 await db.exec('create role app_registration nologin');
 await expect(db.exec(schema)).rejects.toMatchObject({code:'42710'});
 await db.exec('rollback');
 expect(await exists('private.registration_control')).toBeNull();
 await db.exec('drop role app_registration');
});
it('rejects drifted hook definitions and owners without installing compatibility copies',async()=>{
 await db.exec(schema);
 const original=(await db.query<{definition:string}>("select pg_get_functiondef('private.mitsa_isolated_send_email(jsonb)'::regprocedure) definition")).rows[0].definition;
 await db.exec("create or replace function private.mitsa_isolated_send_email(event jsonb) returns jsonb language plpgsql set search_path='' as $$begin return '{}'::jsonb; end$$");
 await expect(db.exec(hooks)).rejects.toMatchObject({code:'P0004'});
 await db.exec('rollback');
 expect((await db.query<{found:string|null}>("select to_regprocedure('private.mitsa_isolated_send_email_legacy(jsonb)')::text found")).rows[0].found).toBeNull();
 await db.exec(original);
 await db.exec('alter function private.mitsa_isolated_send_email(jsonb) owner to app_registration');
 await expect(db.exec(hooks)).rejects.toMatchObject({code:'P0004'});
 await db.exec('rollback');
 await db.exec('alter function private.mitsa_isolated_send_email(jsonb) owner to postgres');
 await db.exec(hooks);
});
it('preserves the actor, existing RLS policies and managed Auth schema while inactive',async()=>{
 expect((await db.query<{definition:string}>("select pg_get_functiondef('private.current_actor()'::regprocedure) definition")).rows[0].definition).toBe(originalActor);
 const current=await policies();
 const key=(row:Record<string,unknown>)=>`${row.schemaname}.${row.tablename}.${row.policyname}`;
 for(const previous of oldPolicies)expect(current.find(row=>key(row)===key(previous))).toEqual(previous);
 const additions=current.filter(row=>!oldPolicies.some(previous=>key(previous)===key(row)));
 expect(additions.map(row=>[row.tablename,row.policyname,row.cmd,row.roles,row.qual,row.with_check])).toEqual([
  ['isolated_auth_mail','persistent_captures','SELECT',['app_registration'],'true',null],
  ['legal_versions','persistent_versions','SELECT',['app_registration'],'true',null],
  ['pilot_mail_deliveries','persistent_prior_deliveries','SELECT',['app_registration'],'true',null],
  ['registration_intents','persistent_intents','ALL',['app_registration'],'true','true'],
  ['registration_requests','persistent_requests_insert','INSERT',['app_registration'],null,'true'],
  ['registration_requests','persistent_requests_read','SELECT',['app_registration'],'true',null],
 ]);
 expect((await db.query('select admission_enabled,delivery_enabled,session_policy_ready,approval_generation from private.registration_control')).rows[0]).toEqual({admission_enabled:false,delivery_enabled:false,session_policy_ready:false,approval_generation:null});
 expect((await db.query("select tgname from pg_trigger where tgrelid='auth.refresh_tokens'::regclass and not tgisinternal")).rows).toEqual([]);
 expect((await db.query('select * from auth.users')).rows).toEqual([]);
});
