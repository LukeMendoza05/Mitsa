import {it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {queries,userFields,factorFields,changedAccount,safeSummary} from '../../scripts/lib/registration-auth-metadata-review.mjs';
const id='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const start='2026-10-24T02:55:33.452Z',end='2026-10-27T00:56:16.503Z';
it('derives exactly one private identity from same-set evidence and rejects ambiguity',()=>{
 const b={identities:{users:[{id,digest:'old'},{id:other,digest:'same'}]}},a=structuredClone(b);a.identities.users[0].digest='new';expect(changedAccount(b,a)).toBe(id);
 expect(()=>changedAccount(b,b)).toThrow();a.identities.users[1].digest='different';expect(()=>changedAccount(b,a)).toThrow();a.identities.users.pop();expect(()=>changedAccount(b,a)).toThrow();
});
it('reviewed SQL excludes credentials, identities and unrestricted account projection',()=>{
 const sql=Object.values(queries).join('\n');for(const forbidden of ['encrypted_password','password_hash','refresh_token','recovery_token','confirmation_token','secret','raw_user_meta_data','raw_app_meta_data','ip_address','actor_username','actor_name'])expect(sql).not.toContain(forbidden);
 expect(queries.user).toContain('where id=$1::uuid');expect(queries.factors).toContain('where user_id=$1::uuid');expect(queries.user).not.toContain('select *');expect(queries.audit).not.toContain('select *');
 expect(sql).not.toMatch(/\b(insert|update|delete|alter|grant|revoke|create|set|copy|call)\b/i);
});
it('exact SELECTs work offline and never return unrelated records or raw audit payloads',async()=>{
 const db=new PGlite();try{
  await db.exec(`create schema auth;create schema private;create schema foundation_probe;
   create table foundation_probe.environment_identity(singleton boolean,marker text);
   insert into foundation_probe.environment_identity values(true,'fireworks-foundation-proof-01a12e38');
   create table private.registration_control(singleton boolean,admission_enabled boolean default false,delivery_enabled boolean default false,transport_ready boolean default false,session_policy_ready boolean default false,session_policy text default 'strict',terms_id uuid,privacy_id uuid);
   insert into private.registration_control(singleton) values(true);
   create table private.release_gates(singleton boolean,registration_enabled boolean default false,external_mail_enabled boolean default false,eligibility_approved boolean default false,legal_publication_enabled boolean default false,disposal_enabled boolean default false);
   insert into private.release_gates(singleton) values(true);
   create table private.pilot_registration_window(singleton boolean,enabled boolean default false,smtp_enabled boolean default false);
   insert into private.pilot_registration_window(singleton) values(true);
   create table auth.users(id uuid primary key,${userFields.map(f=>f+(['is_anonymous','is_sso_user','is_super_admin'].includes(f)?' boolean':['aud','role'].includes(f)?' text':' timestamptz')).join(',')});
   create table auth.mfa_factors(${factorFields.map(f=>f+(f==='user_id'?' uuid':['created_at','updated_at'].includes(f)?' timestamptz':' text')).join(',')});
   create table auth.audit_log_entries(payload jsonb,created_at timestamptz)`);
  const guard=(await db.query(queries.guard)).rows[0] as any;expect(guard.marker).toBe('fireworks-foundation-proof-01a12e38');expect(guard.controls_closed&&guard.release_closed&&guard.pilot_closed).toBe(true);expect(guard.columns.every((r:any)=>r.present&&r.readable)).toBe(true);
  await db.query('insert into auth.users(id,updated_at,last_sign_in_at,aud,role,email_confirmed_at) values($1,$2,$2,\'authenticated\',\'authenticated\',$2),($3,$2,$2,\'unrelated\',\'unrelated\',$2)',[id,start,other]);
  await db.query('insert into auth.mfa_factors values($1,\'totp\',\'verified\',$3,$3),($2,\'phone\',\'unverified\',$3,$3)',[id,other,start]);
  for(const payload of [{actor_id:id,action:'login',actor_username:'PRIVATE'},{actor_id:other,action:'logout',traits:{user_id:id,user_email:'PRIVATE'}},{actor_id:other,action:'user_deleted'},{actor_id:id,action:'PRIVATE-ACTION'}])await db.query('insert into auth.audit_log_entries values($1,$2)',[JSON.stringify(payload),start]);
  const user=(await db.query(queries.user,[id])).rows,factors=(await db.query(queries.factors,[id])).rows,audit=(await db.query(queries.audit,[id,start,end])).rows;
  expect(user).toHaveLength(1);expect(factors).toHaveLength(1);expect(audit).toHaveLength(3);expect(audit.some((r:any)=>r.action==='user_deleted')).toBe(false);expect(JSON.stringify(audit)).not.toContain('PRIVATE');
  const report=safeSummary(user,factors,audit,{start,end,inspectedAt:end});for(const hidden of [id,other,start,'PRIVATE'])expect(JSON.stringify(report)).not.toContain(hidden);expect(report.historicalChangedColumnKnown).toBe(false);expect(report.baselineAccepted).toBe(false);
  for(let i=0;i<202;i++)await db.query('insert into auth.audit_log_entries values($1,$2)',[JSON.stringify({actor_id:id,action:'login'}),end]);
  const bounded=(await db.query(queries.audit,[id,start,end])).rows as any[];expect(bounded.reduce((n,r)=>n+r.count,0)).toBe(201);expect(bounded.every(r=>r.truncated)).toBe(true);
  await db.exec('drop table auth.audit_log_entries');const unavailable=(await db.query(queries.guard)).rows[0] as any;expect(unavailable.columns.filter((r:any)=>!r.present).every((r:any)=>!r.required)).toBe(true);
 }finally{await db.close();}
},30000);
it('an absent audit history does not become a clean account finding',()=>{
 const report=safeSummary([{}],[],null,{start,end,inspectedAt:end});expect(report.auditAvailable).toBe(false);expect(report.activityDoesNotProveCause).toBe(true);expect(report.historicalChangedColumnKnown).toBe(false);
});
