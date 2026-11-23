import {beforeAll,afterAll,it,expect} from 'vitest';
import type {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {persistentDatabase} from '../support/persistent-database';

// Executes the exact REVIEW-ONLY proposal in memory, never in hosted Postgres.
// Synthetic claim contexts do not verify JWT signatures or provider revocation.
let db:PGlite,terms:string,privacy:string,slug:string,location:string;
const user=crypto.randomUUID(),session=crypto.randomUUID(),factor=crypto.randomUUID(),other=crypto.randomUUID(),otherSession=crypto.randomUUID();
const operator=()=>db.exec('reset role;set session authorization postgres');
async function authenticated(actor=user,sid=session){
 await db.exec('set session authorization authenticator;set role authenticated');
 await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:actor,session_id:sid,role:'authenticated',aud:'authenticated',is_anonymous:false,exp:4102444800,aal:'aal2',amr:[{method:'password',timestamp:Date.now()/1000},{method:'totp',timestamp:Date.now()/1000}]})]);
}
const actor=async()=>(await db.query<{id:string|null}>('select private.current_actor() id')).rows[0].id;
beforeAll(async()=>{
 db=await persistentDatabase();
 await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'session-policy@example.invalid',now()),($2,'unassigned-policy@example.invalid',now())",[user,other]);
 await db.query("insert into auth.sessions(id,user_id,factor_id,aal) values($1,$2,$3,'aal2'),($4,$5,null,'aal1')",[session,user,factor,otherSession,other]);
 const versions=(await db.query<{id:string;kind:string}>("insert into private.legal_versions(kind,version,content,content_hash,status) values('terms','session-policy-terms','Offline only',encode(sha256(convert_to('Offline only','UTF8')),'hex'),'test'),('privacy','session-policy-privacy','Offline only',encode(sha256(convert_to('Offline only','UTF8')),'hex'),'test') returning id,kind")).rows;
 terms=versions.find(v=>v.kind==='terms')!.id;privacy=versions.find(v=>v.kind==='privacy')!.id;
 await db.query('update private.release_gates set test_terms_id=$1 where singleton',[terms]);
 await authenticated();
 const permit=(await db.query<{id:string}>('select api.mitsa_prepare_enrollment() id')).rows[0].id;
 await operator();await db.query("insert into auth.mfa_factors values($1,$2,'verified','totp')",[factor,user]);
 await authenticated();await db.query('select api.mitsa_bind_factor($1,$2)',[factor,permit]);await db.query('select api.mitsa_accept_terms($1)',[terms]);
 const workspace=(await db.query<{value:{slug:string;id:string}}>("select api.mitsa_create_workspace('Offline session policy','Offline location','warehouse',$1) value",[crypto.randomUUID()])).rows[0].value;slug=workspace.slug;
 await operator();location=(await db.query<{id:string}>('select id from private.shops where business_id=$1',[workspace.id])).rows[0].id;
 await db.query("insert into private.account_registration_policy(user_id,intent_id,profile,terms_id,privacy_id,accepted_at,session_policy,verified_at) values($1,$2,'isolated-development',$3,$4,now(),'bounded-development-1h',now())",[user,crypto.randomUUID(),terms,privacy]);
 // Model the Privacy acceptance written by normal registration finalization.
 await db.query("insert into private.legal_acceptances(user_id,version_id,source) values($1,$2,'registration')",[user,privacy]);
 await db.exec(readFileSync('supabase/security-proposals/one-hour-development-session.sql.txt','utf8'));
},60000);
afterAll(async()=>{if(db)await db.close();});
it('preserves the original actor owner/ACL and installs no Auth trigger',async()=>{
 await operator();const baseline=JSON.parse(readFileSync('config/persistent-registration-function-baseline.json','utf8')).functions.find((f:{name:string})=>f.name==='current_actor');
 const value=(await db.query<{owner:string;acl:string;definition:string}>("select pg_get_userbyid(proowner) owner,proacl::text acl,pg_get_functiondef(oid) definition from pg_proc where oid='private.current_actor()'::regprocedure")).rows[0];
 expect(value.owner).toBe(baseline.owner);expect(value.acl).toBe(baseline.acl);expect(createHash('sha256').update(value.definition).digest('hex')).not.toBe(baseline.sha256);
 expect((await db.query<{n:number}>("select count(*)::int n from pg_trigger where tgrelid='auth.refresh_tokens'::regclass and not tgisinternal")).rows[0].n).toBe(0);
});
it('permits a fresh trusted owner, then denies direct RPC and shop RLS after one hour',async()=>{
 await authenticated();expect(await actor()).toBe(user);expect((await db.query<{value:{role:string}}>('select api.mitsa_workspace($1) value',[slug])).rows[0].value.role).toBe('owner');
 expect((await db.query('select id from private.shops where id=$1',[location])).rows).toHaveLength(1);
 await operator();await db.query("update auth.sessions set created_at=statement_timestamp()-interval '1 hour' where id=$1",[session]);
 await authenticated();expect(await actor()).toBeNull();await expect(db.query('select api.mitsa_workspace($1)',[slug])).rejects.toMatchObject({code:'42501'});
 expect((await db.query('select id from private.shops where id=$1',[location])).rows).toHaveLength(0);
});
it('does not reset the age bound when claims refresh or MFA assurance is renewed',async()=>{
 await operator();await db.query("update auth.sessions set created_at=statement_timestamp()-interval '61 minutes',aal='aal2' where id=$1",[session]);
 await authenticated();expect(await actor()).toBeNull();await expect(db.query('select api.mitsa_prepare_enrollment()')).rejects.toMatchObject({code:'42501'});
});
it('preserves unassigned accounts and rejects a new identity accessing the other tenant',async()=>{
 await operator();await db.query("update auth.sessions set created_at=statement_timestamp()-interval '2 hours' where id=$1",[otherSession]);
 await authenticated(other,otherSession);expect(await actor()).toBe(other);await expect(db.query('select api.mitsa_workspace($1)',[slug])).rejects.toMatchObject({code:'42501'});
 expect((await db.query('select id from private.shops where id=$1',[location])).rows).toHaveLength(0);
});
it('allows a fresh session for the same owner without changing memberships or the old session',async()=>{
 await operator();const fresh=crypto.randomUUID();await db.query("insert into auth.sessions(id,user_id,factor_id,aal) values($1,$2,$3,'aal2')",[fresh,user,factor]);
 await authenticated(user,fresh);expect(await actor()).toBe(user);expect((await db.query<{value:{role:string}}>('select api.mitsa_workspace($1) value',[slug])).rows[0].value.role).toBe('owner');
 await authenticated();expect(await actor()).toBeNull();
});
it('honors emergency cohort denial and rejects direct operator claim injection',async()=>{
 await operator();await db.query('update private.account_registration_policy set emergency_blocked=true where user_id=$1',[user]);
 const fresh=crypto.randomUUID();await db.query("insert into auth.sessions(id,user_id,factor_id,aal) values($1,$2,$3,'aal2')",[fresh,user,factor]);
 await authenticated(user,fresh);expect(await actor()).toBeNull();await operator();await db.exec('set role authenticated');expect(await actor()).toBeNull();
});
