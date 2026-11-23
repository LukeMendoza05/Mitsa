import {it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {fingerprintSql,compareCurrentPreservation,assertRegistry,activityFields,collectCurrentPreservation,captureGuardSql} from '../../scripts/lib/current-preservation.mjs';
const key=Buffer.alloc(32,9),otherKey=Buffer.alloc(32,8);
it('uses server-side HMAC and whole-row SHA without returning credential columns',async()=>{
 const db=new PGlite({extensions:{pgcrypto}});try{
  await db.exec("create schema extensions;create extension pgcrypto with schema extensions;create schema auth;create table auth.users(id uuid primary key,last_sign_in_at timestamptz,updated_at timestamptz,encrypted_password text,confirmation_token text,raw_app_meta_data jsonb);insert into auth.users values('00000000-0000-4000-8000-000000000001',now(),now(),'PRIVATE-PASSWORD-HASH','PRIVATE-TOKEN','{}')");
  const sql=fingerprintSql('auth.users',['id'],{auth:true}),old=(await db.query(sql,[key])).rows as any[];
  expect(Object.keys(old[0]).sort()).toEqual(['activity_digest','digest','key','legacy_digest','protected_digest']);expect(JSON.stringify(old)).not.toContain('PRIVATE');
  const changedKey=(await db.query(sql,[otherKey])).rows as any[];expect(changedKey[0].digest).not.toBe(old[0].digest);expect(changedKey[0].legacy_digest).toBe(old[0].legacy_digest);
  const wrap=(r:any[])=>({format:'mitsa-preservation-v2',registry:[],controls:{},security:{},rows:{},identities:{'auth.users':r}});
  await db.exec("update auth.users set last_sign_in_at=last_sign_in_at+interval '1 hour',updated_at=updated_at+interval '1 hour'");const activity=(await db.query(sql,[key])).rows as any[];
  const diff=compareCurrentPreservation(wrap(old),wrap(activity));expect(diff.exactMatch).toBe(false);expect(diff.automaticallyAccepted).toBe(false);expect(diff.findings[0].category).toBe('known-activity-fields-only');
  await db.exec("update auth.users set confirmation_token='CHANGED-PRIVATE-TOKEN'");const sensitive=(await db.query(sql,[key])).rows as any[];expect(compareCurrentPreservation(wrap(activity),wrap(sensitive)).findings[0].category).toBe('protected-or-unclassified-change');
  await db.exec("alter table auth.users add column new_security_field text default 'unknown'");const unknown=(await db.query(sql,[key])).rows as any[];expect(compareCurrentPreservation(wrap(sensitive),wrap(unknown)).findings[0].category).toBe('protected-or-unclassified-change');
 }finally{await db.close();}
},30000);
it('requires reviewed table/column registry and fails on unknown fields',()=>{
 const expected={applicationTables:['private.example'],columns:{'private.example':['id'],'auth.identities':['id'],'auth.mfa_factors':['id'],'auth.users':['id']}};
 const rows=['auth.identities','auth.mfa_factors','auth.users','private.example'].map(t=>({schema:t.split('.')[0],table:t.split('.')[1],columns:[{name:'id'}],keys:['id']}));expect(()=>assertRegistry(rows,expected)).not.toThrow();rows[0].columns.push({name:'unexpected'});expect(()=>assertRegistry(rows,expected)).toThrow();
});
it('permits no SQL identifier injection or arbitrary Auth relation',()=>{
 expect(()=>fingerprintSql('auth.users;drop schema auth',['id'])).toThrow();expect(()=>fingerprintSql('auth.sessions',['id'],{auth:true})).toThrow();expect(()=>fingerprintSql('private.example',['id;select 1'])).toThrow();expect(activityFields).toEqual(['last_sign_in_at','updated_at']);
});
it('never hides registry, policy, permission or MFA changes',()=>{
 const base={format:'mitsa-preservation-v2',registry:[],controls:{},security:{policies:[]},rows:{},identities:{'auth.mfa_factors':[{key:'a',digest:'old'}]}};const next=structuredClone(base);next.security.policies.push('changed' as never);next.identities['auth.mfa_factors'][0].digest='new';const r=compareCurrentPreservation(base,next);expect(r.exactMatch).toBe(false);expect(r.findings.map((f:any)=>f.category)).toEqual(['security','protected-or-unclassified-change']);expect(r.automaticallyAccepted).toBe(false);
});
it('preserves duplicate-row multiplicity rather than losing it in a map',()=>{
 const b={format:'mitsa-preservation-v2',registry:[],controls:{},security:{},rows:{'private.example':[{key:'same',digest:'same'},{key:'same',digest:'same'}]},identities:{}},a=structuredClone(b);a.rows['private.example'].pop();const r=compareCurrentPreservation(b,a);expect(r.findings[0]).toMatchObject({added:0,removed:1,changed:0});expect(r.exactMatch).toBe(false);
});
it('the new capture uses exactly 52 SELECTs for 41 app tables, three Auth projections and seven security groups',async()=>{
 const tables=Array.from({length:41},(_,n)=>'private.table_'+n).sort(),all=['auth.identities','auth.mfa_factors','auth.users',...tables];
 const registry=all.map(t=>({schema:t.split('.')[0],table:t.split('.')[1],columns:[{name:'id'}],keys:['id']})),expected={applicationTables:tables,columns:Object.fromEntries(all.map(t=>[t,['id']]))},calls:string[]=[];
 const db={query:async(sql:string)=>{calls.push(sql);return {rows:sql===captureGuardSql?[{marker:'fireworks-foundation-proof-01a12e38',hmac_available:true,release_closed:true,pilot_closed:true,registration_auth_usage:false,registration_private_create:false,controls:{admission:false,delivery:false,transport:false,security:false,policy:'strict',termsSelected:false,privacySelected:false},registry}]:[]};}};
 const result=await collectCurrentPreservation(db,{expected,comparisonKey:key});expect(calls).toHaveLength(52);expect(calls.every(sql=>sql.startsWith('select'))).toBe(true);expect(Object.keys(result.rows)).toHaveLength(41);expect(Object.keys(result.identities)).toHaveLength(3);expect(Object.keys(result.security)).toHaveLength(7);
});
it('executes the exact guard SQL offline, including pgcrypto permission and composite-key metadata',async()=>{
 const db=new PGlite({extensions:{pgcrypto}});try{
  await db.exec("create schema extensions;create extension pgcrypto with schema extensions;create schema private;create schema foundation_probe;create schema auth;create table foundation_probe.environment_identity(singleton boolean primary key,marker text);insert into foundation_probe.environment_identity values(true,'fireworks-foundation-proof-01a12e38');create table private.registration_control(singleton boolean primary key,admission_enabled boolean,delivery_enabled boolean,transport_ready boolean,session_policy_ready boolean,session_policy text,terms_id uuid,privacy_id uuid);insert into private.registration_control values(true,false,false,false,false,'strict',null,null);create table private.release_gates(singleton boolean,registration_enabled boolean,external_mail_enabled boolean,legal_publication_enabled boolean,eligibility_approved boolean,disposal_enabled boolean);insert into private.release_gates values(true,false,false,false,false,false);create table private.pilot_registration_window(singleton boolean,enabled boolean,smtp_enabled boolean);insert into private.pilot_registration_window values(true,false,false);create table private.example(business_id uuid,id uuid,primary key(business_id,id))");
  await db.exec('create role app_registration nologin noinherit');const result=(await db.query(captureGuardSql)).rows[0] as any;expect(result.hmac_available).toBe(true);expect(result.registration_auth_usage).toBe(false);expect(result.registration_private_create).toBe(false);expect(result.controls.policy).toBe('strict');expect(result.registry.find((r:any)=>r.table==='example').keys).toEqual(['business_id','id']);expect(result.registry.find((r:any)=>r.table==='example').columns.map((c:any)=>c.name)).toEqual(['business_id','id']);
 }finally{await db.close();}
},30000);
