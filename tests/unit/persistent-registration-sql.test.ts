import {beforeAll,afterAll,it,expect} from 'vitest';
import type {PGlite} from '@electric-sql/pglite';
import {persistentDatabase} from '../support/persistent-database';
import {hash} from '../../supabase/functions/_shared/registration-intent-auth';
import {readFileSync} from 'node:fs';

let db:PGlite,terms:string,privacy:string;
const generation=crypto.randomUUID(),worker=crypto.randomUUID();
const operator=()=>db.exec('reset role;set session authorization postgres');
const service=()=>db.exec('set role service_role');
async function command(action:string,payload:Record<string,unknown>,request?:string) {
 return (await db.query<{result:Record<string,unknown>|null}>('select api.mitsa_registration_command($1,$2::jsonb,$3,$4) result',[action,JSON.stringify(payload),request??await hash(crypto.randomUUID()),new Date().toISOString()])).rows[0].result;
}
const policy=async()=>(await db.query<{result:{admission:string;delivery:string;policy:unknown}}>('select api.mitsa_persistent_registration_policy() result')).rows[0].result;
async function prepare(label:string) {
 const email=`${label}@example.com`,submissionId=crypto.randomUUID(),nonce=crypto.randomUUID().replaceAll('-','').repeat(2);
 const input={email,submissionId,fullName:'Synthetic account',termsId:terms,privacyId:privacy,accepted:true,fingerprint:await hash(submissionId+email),nonceHash:await hash(nonce)};
 const result=await command('prepare',input);return {...input,nonce,intentId:result!.intentId as string};
}
beforeAll(async()=>{
 db=await persistentDatabase();
 terms=(await db.query<{id:string}>("insert into private.legal_versions(kind,version,content,content_hash,status) values('terms','stage-a-terms','Synthetic only',encode(sha256(convert_to('Synthetic only','UTF8')),'hex'),'test') returning id")).rows[0].id;
 privacy=(await db.query<{id:string}>("insert into private.legal_versions(kind,version,content,content_hash,status) values('privacy','stage-a-privacy','Synthetic only',encode(sha256(convert_to('Synthetic only','UTF8')),'hex'),'test') returning id")).rows[0].id;
 await db.query('update private.release_gates set test_terms_id=$1 where singleton',[terms]);
},60000);
afterAll(async()=>{if(db)await db.close();});
it('installs disabled, preserves existing gates and denies browser/operator-only paths',async()=>{
 expect(await policy()).toMatchObject({admission:'closed',delivery:'closed',policy:null});
 for(const role of ['anon','authenticated','service_role']){
  await db.exec(`set role ${role}`);
  for(const table of ['registration_control','account_registration_policy','auth_mail_dispatch'])await expect(db.query(`select * from private.${table}`)).rejects.toMatchObject({code:'42501'});
  await expect(db.query('select private.mitsa_worker_acquire($1,$2)',[generation,worker])).rejects.toMatchObject({code:'42501'});
  if(role!=='service_role')await expect(command('prepare',{email:'someone@example.com'})).rejects.toMatchObject({code:'42501'});
  await operator();
 }
 expect((await db.query('select registration_enabled,external_mail_enabled from private.release_gates')).rows[0]).toEqual({registration_enabled:false,external_mail_enabled:false});
 expect((await db.query('select * from private.account_registration_policy')).rows).toHaveLength(0);
});
it('requires policy and security readiness, and fences one worker per approval generation',async()=>{
 await db.query('update private.registration_control set approval_generation=$1,admission_enabled=true,delivery_enabled=true,terms_id=$2,privacy_id=$3',[generation,terms,privacy]);
 expect(await policy()).toMatchObject({admission:'unavailable',delivery:'paused'});
 expect((await db.query<{ok:boolean}>('select private.mitsa_worker_acquire($1,$2) ok',[generation,worker])).rows[0].ok).toBe(true);
 expect((await db.query<{ok:boolean}>('select private.mitsa_worker_acquire($1,$2) ok',[generation,crypto.randomUUID()])).rows[0].ok).toBe(false);
 await db.query('select private.mitsa_worker_heartbeat($1,$2,true)',[generation,worker]);
 await db.exec('update private.registration_control set session_policy_ready=true'); // Offline fixture, never risk approval.
 expect(await policy()).toMatchObject({admission:'available',delivery:'available'});
});
it('creates one stable intent, rejects mismatched retries and replayed signed envelopes',async()=>{
 await service();const a=await prepare('durable');
 const responses=await Promise.all([command('prepare',a),command('prepare',a)]);
 expect(responses.every(x=>x?.intentId===a.intentId)).toBe(true);
 await expect(command('prepare',{...a,fullName:'Changed',fingerprint:await hash('changed')})).rejects.toMatchObject({code:'42501'});
 const request=await hash('single-use-envelope');await command('submission-status',a,request);
 await expect(command('submission-status',a,request)).rejects.toMatchObject({code:'23505'});
 expect(await command('claim-signup',a)).toEqual({claimed:false});
 await command('authorize-mail',{email:a.email,intentId:a.intentId,action:'signup',requestKey:a.submissionId});
 const claims=await Promise.all([command('claim-signup',a),command('claim-signup',a)]);
 expect(claims).toEqual([{claimed:true},{claimed:false}]);
 expect(await command('submission-status',a)).toMatchObject({state:'uncertain'});
 await operator();expect((await db.query('select * from private.memberships')).rows).toHaveLength(0);
});
it('binds a provider identity only with a live one-use correlated mail reservation',async()=>{
 await service();const a=await prepare('correlated');
 const uid=crypto.randomUUID(),event={user:{id:uid,email:a.email,is_anonymous:false,user_metadata:{registration_nonce:a.nonce,role:'owner'}}};
 await operator();await db.exec('set session authorization supabase_auth_admin');
 const hook=async(value:unknown)=>(await db.query<{result:{error?:unknown}}>('select private.mitsa_before_user_created($1::jsonb) result',[JSON.stringify(value)])).rows[0].result;
 expect(await hook(event)).toHaveProperty('error');
 await operator();await service();const requestKey=crypto.randomUUID(),mailInput={email:a.email,intentId:a.intentId,action:'signup',requestKey};
 const permit=await command('authorize-mail',mailInput);expect(permit?.sendAllowed).toBe(true);
 expect(await command('authorize-mail',mailInput)).toMatchObject({requestId:permit!.requestId,sendAllowed:false});
 expect(await command('claim-signup',a)).toEqual({claimed:true});
 await operator();await db.exec('set session authorization supabase_auth_admin');expect(await hook(event)).toEqual({});
 expect(await hook({...event,user:{...event.user,id:crypto.randomUUID()}})).toHaveProperty('error');
 await operator();await db.query('insert into auth.users(id,email) values($1,$2)',[uid,a.email]);
 await db.exec("update private.isolated_mail_config set enabled=true,public_key='-----BEGIN PGP PUBLIC KEY BLOCK-----offline'");
 const mail={user:{id:uid,email:a.email,email_confirmed_at:null},email_data:{email_action_type:'signup',token_hash:'f'.repeat(64),token:'654321',redirect_to:`http://127.0.0.1:3000/auth/email?request=${permit!.requestId}`}};
 const capture=async(value:unknown)=>(await db.query<{result:{error?:unknown}}>('select private.mitsa_isolated_send_email($1::jsonb) result',[JSON.stringify(value)])).rows[0].result;
 await db.exec('set session authorization supabase_auth_admin');
 expect(await capture({...mail,email_data:{...mail.email_data,redirect_to:'http://127.0.0.1:3000/auth/email'}})).toHaveProperty('error');
 expect(await capture({...mail,user:{...mail.user,email:'different@example.com'}})).toHaveProperty('error');
 expect(await capture(mail)).toEqual({});expect(await capture(mail)).toHaveProperty('error');
 await operator();expect((await db.query<{state:string}>('select state from private.auth_mail_dispatch where id=$1',[permit!.requestId])).rows[0].state).toBe('queued');
 expect((await db.query('select * from private.memberships where user_id=$1',[uid])).rows).toHaveLength(0);
});
it('keeps pending delivery separate from admission and prevents restart re-delivery after an uncertain SMTP claim',async()=>{
 await operator();await db.exec('update private.registration_control set admission_enabled=false');
 expect(await policy()).toMatchObject({admission:'closed',delivery:'available'});
 const job=(await db.query<{job:{id:string}|null}>('select private.mitsa_worker_claim($1,$2) job',[generation,worker])).rows[0].job;
 expect(job?.id).toBeTruthy();
 await db.exec("update private.registration_control set worker_until=statement_timestamp()-interval '1 second'");
 const replacement=crypto.randomUUID();expect((await db.query<{ok:boolean}>('select private.mitsa_worker_acquire($1,$2) ok',[generation,replacement])).rows[0].ok).toBe(true);
 expect((await db.query<{state:string}>('select state from private.auth_mail_dispatch where id=$1',[job!.id])).rows[0].state).toBe('unconfirmed');
 expect((await db.query<{ok:boolean}>('select private.mitsa_worker_heartbeat($1,$2,true) ok',[generation,worker])).rows[0].ok).toBe(false);
 expect((await db.query<{ok:boolean}>('select private.mitsa_worker_complete($1,$2,$3,\'smtp-accepted\') ok',[generation,worker,job!.id])).rows[0].ok).toBe(false);
 await db.query('select private.mitsa_worker_heartbeat($1,$2,true)',[generation,replacement]);
 expect((await db.query<{job:unknown}>('select private.mitsa_worker_claim($1,$2) job',[generation,replacement])).rows[0].job).toBeNull();
 await db.query('select private.mitsa_registration_stop(true)');
 expect((await db.query<{ok:boolean}>('select private.mitsa_worker_acquire($1,$2) ok',[generation,worker])).rows[0].ok).toBe(false);
 expect(await policy()).toMatchObject({admission:'closed',delivery:'closed'});
});
it('preserves finalized policy and recovery eligibility after finalized intent pruning',async()=>{
 await operator();
 const account=(await db.query<{user_id:string;intent_id:string}>('select user_id,intent_id from private.account_registration_policy limit 1')).rows[0];
 const address=(await db.query<{email:string}>('select email from auth.users where id=$1',[account.user_id])).rows[0].email;
 await db.query('update auth.users set email_confirmed_at=statement_timestamp() where id=$1',[account.user_id]);
 const session=crypto.randomUUID();await db.query("insert into auth.sessions(id,user_id,aal) values($1,$2,'aal1')",[session,account.user_id]);
 await db.exec('set session authorization authenticator;set role authenticated');
 await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:account.user_id,session_id:session,role:'authenticated',aud:'authenticated',is_anonymous:false,exp:4102444800,aal:'aal1',amr:[{method:'password',timestamp:Date.now()/1000}]})]);
 expect((await db.query<{ok:boolean}>('select api.mitsa_finalize_registration() ok')).rows[0].ok).toBe(true);
 await operator();expect((await db.query<{n:number}>('select count(*)::int n from private.legal_acceptances where user_id=$1',[account.user_id])).rows[0].n).toBe(2);
 await db.query('delete from private.registration_intents where id=$1',[account.intent_id]); // In-memory finalized fixture only.
 await db.exec("update private.auth_mail_dispatch set created_at=created_at-interval '2 minutes',authorize_until=authorize_until-interval '2 minutes'");
 await db.query('update private.registration_control set approval_generation=$1,stopped_at=null,delivery_enabled=true,admission_enabled=false,worker_until=null',[generation]);
 await db.query('select private.mitsa_worker_acquire($1,$2)',[generation,worker]);await db.query('select private.mitsa_worker_heartbeat($1,$2,true)',[generation,worker]);
 await service();const permit=await command('authorize-mail',{email:address,action:'recovery',requestKey:crypto.randomUUID()});expect(permit).toMatchObject({sendAllowed:true});
 await operator();await db.exec('set session authorization supabase_auth_admin');
 const mail={user:{id:account.user_id,email:address,email_confirmed_at:new Date().toISOString()},email_data:{email_action_type:'recovery',token_hash:'c'.repeat(64),redirect_to:`http://127.0.0.1:3000/auth/email?request=${permit!.requestId}`}};
 expect((await db.query<{result:unknown}>('select private.mitsa_isolated_send_email($1::jsonb) result',[JSON.stringify(mail)])).rows[0].result).toEqual({});
 await operator();
});
it('reserves the last mail slot before signup without making its own claim fail capacity',async()=>{
 await operator();await db.exec("update private.auth_mail_dispatch set created_at=created_at-interval '2 hours',authorize_until=authorize_until-interval '2 hours';update private.registration_control set admission_enabled=true,hourly_budget=1");
 await service();const a=await prepare('last-slot');
 await command('authorize-mail',{email:a.email,intentId:a.intentId,action:'signup',requestKey:a.submissionId});
 await operator();await db.exec('set role anon');expect((await policy()).admission).toBe('paused');await operator();await service();
 expect(await command('claim-signup',a)).toEqual({claimed:true});
 await operator();await db.exec('update private.registration_control set hourly_budget=10');
});
it('expires unbound creation authority before offering a new request',async()=>{
 await operator();await db.exec("update private.registration_requests set received_at=received_at-interval '2 hours'");await service();const a=await prepare('empty-expired');
 await operator();await db.query("update private.registration_intents set creation_deadline=statement_timestamp()-interval '1 second' where id=$1",[a.intentId]);
 await service();expect(await command('submission-status',a)).toMatchObject({state:'expired',restartAllowed:true});expect(await command('claim-signup',a)).toEqual({claimed:false});await operator();
});
it('renews pending verification with original consent and without renewing account creation',async()=>{
 await service();const a=await prepare('renewal');await command('authorize-mail',{email:a.email,intentId:a.intentId,action:'signup',requestKey:a.submissionId});await command('claim-signup',a);
 const uid=crypto.randomUUID(),event={user:{id:uid,email:a.email,is_anonymous:false,user_metadata:{registration_nonce:a.nonce}}};
 await operator();await db.exec('set session authorization supabase_auth_admin');expect((await db.query<{result:unknown}>('select private.mitsa_before_user_created($1::jsonb) result',[JSON.stringify(event)])).rows[0].result).toEqual({});
 await operator();await db.query('insert into auth.users(id,email) values($1,$2)',[uid,a.email]);
 await db.query("update private.registration_intents set expires_at=statement_timestamp()-interval '1 second',creation_deadline=statement_timestamp()-interval '1 second' where id=$1",[a.intentId]);
 const before=(await db.query('select accepted_at,creation_deadline from private.registration_intents where id=$1',[a.intentId])).rows[0];
 const mailCount=(await db.query('select count(*)::int n from private.auth_mail_dispatch')).rows[0];
 await db.exec('update private.registration_control set admission_enabled=false');await service();
 const renewal={email:a.email,intentId:a.intentId,termsId:terms,privacyId:privacy,accepted:true,passwordProven:true};
 expect(await command('renew-verification',{...renewal,passwordProven:false})).toBeNull();
 expect(await command('renew-verification',{...renewal,privacyId:crypto.randomUUID()})).toBeNull();
 expect(await command('renew-verification',renewal)).toMatchObject({state:'pending-verification',restartAllowed:false});
 await operator();expect((await db.query('select accepted_at,creation_deadline from private.registration_intents where id=$1',[a.intentId])).rows[0]).toEqual(before);
 expect((await db.query('select count(*)::int n from private.auth_mail_dispatch')).rows[0]).toEqual(mailCount);
 await db.exec('set session authorization supabase_auth_admin');expect((await db.query<{result:{error?:unknown}}>('select private.mitsa_before_user_created($1::jsonb) result',[JSON.stringify(event)])).rows[0].result).toHaveProperty('error');await operator();
});
it('rejects null/stale worker evidence and recovers health without a new approval window',async()=>{
 await operator();await db.exec("update private.registration_requests set received_at=received_at-interval '2 hours';update private.registration_control set admission_enabled=true");await service();const a=await prepare('stale-health');
 await command('authorize-mail',{email:a.email,intentId:a.intentId,action:'signup',requestKey:a.submissionId});await command('claim-signup',a);
 await operator();await db.exec('update private.registration_control set heartbeat_at=null,worker_until=null');expect(await policy()).toMatchObject({admission:'paused',delivery:'paused'});
 await db.exec('set session authorization supabase_auth_admin');const event={user:{id:crypto.randomUUID(),email:a.email,is_anonymous:false,user_metadata:{registration_nonce:a.nonce}}};
 expect((await db.query<{result:{error?:unknown}}>('select private.mitsa_before_user_created($1::jsonb) result',[JSON.stringify(event)])).rows[0].result).toHaveProperty('error');
 await operator();await db.query('select private.mitsa_worker_acquire($1,$2)',[generation,worker]);await db.query('select private.mitsa_worker_heartbeat($1,$2,true)',[generation,worker]);
 expect(await policy()).toMatchObject({admission:'available',delivery:'available'});
 await db.exec("update private.registration_control set heartbeat_at=statement_timestamp()-interval '16 seconds'");expect((await policy()).admission).toBe('paused');
 await db.query('select private.mitsa_worker_heartbeat($1,$2,true)',[generation,worker]);expect((await policy()).admission).toBe('available');
});
it('serializes competing recipient reservations and retains the rolling limit',async()=>{
 await operator();await db.exec("update private.registration_requests set received_at=received_at-interval '2 hours'");await service();const a=await prepare('quota-race');
 const results=await Promise.allSettled([command('authorize-mail',{email:a.email,intentId:a.intentId,action:'signup',requestKey:crypto.randomUUID()}),command('authorize-mail',{email:a.email,intentId:a.intentId,action:'signup',requestKey:crypto.randomUUID()})]);
 expect(results.filter(x=>x.status==='fulfilled')).toHaveLength(1);expect((results.find(x=>x.status==='rejected') as PromiseRejectedResult).reason.code).toBe('54000');await operator();
});
it('closes controls through forward recovery while preserving cohorts, consent and actor security',async()=>{
 await operator();const cohort=(await db.query('select * from private.account_registration_policy order by user_id')).rows,consent=(await db.query('select * from private.legal_acceptances order by user_id,version_id')).rows;
 const actor=(await db.query('select pg_get_functiondef(\'private.current_actor()\'::regprocedure) definition')).rows;
 await db.exec(readFileSync('supabase/prepared/persistent-registration-forward-recovery.sql','utf8'));
 expect((await db.query('select * from private.account_registration_policy order by user_id')).rows).toEqual(cohort);expect((await db.query('select * from private.legal_acceptances order by user_id,version_id')).rows).toEqual(consent);
 expect((await db.query('select pg_get_functiondef(\'private.current_actor()\'::regprocedure) definition')).rows).toEqual(actor);
 expect(await policy()).toMatchObject({admission:'closed',delivery:'closed'});
 expect((await db.query<{definition:string}>('select pg_get_functiondef(\'private.mitsa_current_terms()\'::regprocedure) definition')).rows[0].definition).toContain('account_registration_policy');
});
