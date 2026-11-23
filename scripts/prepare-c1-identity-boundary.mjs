// LOCAL SOURCE GENERATOR ONLY. PGlite only; no operator credentials or network.
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {recoveredC1Database} from '../tests/support/stage-c1-correction.ts';
const sha=v=>createHash('sha256').update(v).digest('hex');
const lit=s=>"'"+s.replaceAll("'","''")+"'";
const old=readFileSync('supabase/prepared/20261016004927_mitsa_persistent_registration_inactive.sql','utf8');
const hooks=readFileSync('supabase/prepared/20261016005221_mitsa_persistent_registration_hooks_inactive.sql','utf8');
const recovery=readFileSync('supabase/prepared/persistent-registration-forward-recovery.sql','utf8');
assert.equal(sha(old),'94ed8deb2f9f41e694b0d45721ef7e6e086919565e9832bd73d1b9c77b393422');
assert.equal(sha(hooks),'9ce542c21d00dc350f43b7e72fba2083d43042f2d001361cb9940e4120290ae7');
assert.equal(sha(recovery),'556516507c2331b0500c7a3542511a1296f2379a685fe7431571e87798782a58');
const baseline=JSON.parse(readFileSync('config/stage-c1-identity-boundary-baseline.json','utf8'));
const original=old.slice(old.indexOf('create function private.mitsa_registration_command('),old.indexOf('create function api.mitsa_registration_command(')).trim().replace('create function','create or replace function');
assert(original.startsWith('create or replace function private.mitsa_registration_command('));
let command=original;
function change(from,to){assert.equal(command.split(from).length,2,'expected exactly one reviewed replacement');command=command.replace(from,to);}
change('exists(select 1 from auth.users u where u.id=provider_user_id and u.email=address and u.email_confirmed_at is null and u.deleted_at is null and (u.banned_until is null or u.banned_until<=statement_timestamp()))',"exists(select 1 from private.mitsa_registration_identity('pending',address,registration_intents.id,registration_intents.provider_user_id))");
change(`not exists(select 1 from auth.users u join private.account_registration_policy ap on ap.user_id=u.id
     where u.id=i.provider_user_id and u.email=address and u.email_confirmed_at is null and u.deleted_at is null
     and (u.banned_until is null or u.banned_until<=statement_timestamp()) and not ap.emergency_blocked)`,"not exists(select 1 from private.mitsa_registration_identity('pending',address,i.id,i.provider_user_id))");
change("exists(select 1 from auth.users where id=i.provider_user_id and (email_confirmed_at is not null or deleted_at is not null or banned_until>statement_timestamp()))", "not exists(select 1 from private.mitsa_registration_identity('pending',address,i.id,i.provider_user_id))");
change(`select ap.* into a from auth.users u join private.account_registration_policy ap on ap.user_id=u.id
     where u.email=address and u.email_confirmed_at is not null and u.deleted_at is null
     and not u.is_anonymous and (u.banned_until is null or u.banned_until<=statement_timestamp()) and not ap.emergency_blocked and ap.verified_at is not null;`, `select ap.* into a from private.mitsa_registration_identity('recovery',address) identity
     join private.account_registration_policy ap on ap.user_id=identity.user_id and ap.intent_id=identity.intent_id
     where not ap.emergency_blocked and ap.verified_at is not null;`);
assert(!command.includes('auth.users'));
const restoreHooks=hooks.slice(hooks.indexOf('create or replace function private.mitsa_before_user_created(event'),hooks.indexOf('-- No existing profile')).trim();
assert.equal((restoreHooks.match(/create or replace function/g)||[]).length,4);
const guard=`do $preflight$ declare f record; observed record; begin
 assert current_user='postgres','approved installing role required';
 assert (select marker='fireworks-foundation-proof-01a12e38' from foundation_probe.environment_identity where singleton),'unapproved target';
 assert (select count(*)=1 from private.registration_control),'control singleton required';
 assert (select not(admission_enabled or delivery_enabled or transport_ready or session_policy_ready)
   and approval_generation is null and worker_id is null and worker_until is null and heartbeat_at is null
   and terms_id is null and privacy_id is null and approved_sender_sha256 is null and stopped_at is not null
   and session_policy='strict' from private.registration_control where singleton),'recovered inactive controls required';
 assert not exists(select 1 from private.account_registration_policy),'cohort drift';
 assert not exists(select 1 from private.auth_mail_dispatch),'dispatch drift';
 assert not exists(select 1 from private.registration_intents where submission_id is not null),'persistent intent drift';
 assert (select not(registration_enabled or external_mail_enabled or eligibility_approved or legal_publication_enabled or disposal_enabled) from private.release_gates where singleton),'release controls must remain closed';
 assert (select not(enabled or smtp_enabled) from private.pilot_registration_window where singleton),'pilot controls must remain closed';
 assert not exists(select 1 from pg_trigger where tgrelid='auth.refresh_tokens'::regclass and not tgisinternal),'unexpected Auth trigger';
 assert (select not(rolsuper or rolbypassrls or rolcanlogin or rolcreaterole or rolcreatedb or rolinherit) from pg_roles where rolname='app_registration'),'registration role drift';
 assert not has_schema_privilege('app_registration','auth','USAGE'),'unexpected direct Auth access';
 assert not has_schema_privilege('app_registration','private','CREATE') and not has_schema_privilege('app_registration','auth','CREATE'),'unexpected schema creation privilege';
 assert has_schema_privilege('postgres','private','CREATE') and has_schema_privilege('postgres','auth','USAGE'),'identity owner unavailable';
 assert pg_has_role('postgres','app_registration','MEMBER') and pg_has_role('postgres','app_workspace','MEMBER'),'function replacement privileges unavailable';
 for f in select unnest(array['id','email','email_confirmed_at','deleted_at','banned_until','is_anonymous']) col loop
  assert has_column_privilege('postgres','auth.users',f.col,'SELECT'),'identity owner cannot read required column';
 end loop;
 assert not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private'
  and c.relname in ('registration_control','account_registration_policy','auth_mail_dispatch') and not(c.relrowsecurity and c.relforcerowsecurity)),'forced RLS required';
 assert (select count(*)=3 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname in ('registration_control','account_registration_policy','auth_mail_dispatch')),'retained tables required';
 for f in select * from (values
 ${baseline.functions.map(f=>`(${[f.schema,f.name,f.sha256,f.owner,f.acl].map(lit).join(',')})`).join(',\n ')}
 ) expected(schema_name,function_name,sha256,owner,acl) loop
  assert (select count(*)=1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=f.schema_name and p.proname=f.function_name),'function signature collision';
  select pg_get_userbyid(pr.proowner) owner,pr.proacl::text acl,encode(sha256(convert_to(pg_get_functiondef(pr.oid),'UTF8')),'hex') digest into observed
  from pg_proc pr join pg_namespace n on n.oid=pr.pronamespace where n.nspname=f.schema_name and pr.proname=f.function_name;
  assert observed.owner=f.owner and observed.acl is not distinct from f.acl and observed.digest=f.sha256,'recovered function drift';
 end loop;
end $preflight$;`;
const helper=`-- Only this private, fixed-query function reads managed identity columns.
-- Existing postgres privileges are used; no managed schema/table grant changes.
create function private.mitsa_registration_identity(p_mode text,p_email text,p_intent_id uuid default null,p_user_id uuid default null)
returns table(user_id uuid,intent_id uuid) language plpgsql stable security definer
set search_path='' set row_security=on as $identity$
declare matched_user uuid; matched_intent uuid;
begin
 if p_mode is null or p_mode not in ('pending','recovery') or p_email is null
 or p_email<>lower(btrim(p_email)) or length(p_email)>254
 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$'
 or (p_mode='pending' and (p_intent_id is null or p_user_id is null))
 or (p_mode='recovery' and (p_intent_id is not null or p_user_id is not null)) then return; end if;
 select u.id,a.intent_id into strict matched_user,matched_intent
 from auth.users u join private.account_registration_policy a on a.user_id=u.id
 where u.email=p_email and u.deleted_at is null and (u.banned_until is null or u.banned_until<=statement_timestamp())
 and not coalesce(u.is_anonymous,true) and not a.emergency_blocked
 and ((p_mode='pending' and u.id=p_user_id and a.intent_id=p_intent_id and u.email_confirmed_at is null
  and exists(select 1 from private.registration_intents i where i.id=a.intent_id and i.provider_user_id=u.id
   and i.email=p_email and i.submission_id is not null and i.finalized_at is null
   and i.terms_id=a.terms_id and i.privacy_id=a.privacy_id and i.registration_profile=a.profile
   and i.registration_session_policy=a.session_policy))
 or (p_mode='recovery' and u.email_confirmed_at is not null and a.verified_at is not null));
 return query select matched_user,matched_intent;
exception when others then
 -- No raw provider error, identity fields or exception text leaves the boundary.
 return;
end $identity$;
alter function private.mitsa_registration_identity(text,text,uuid,uuid) owner to postgres;
revoke all on function private.mitsa_registration_identity(text,text,uuid,uuid) from public,anon,authenticated,service_role,supabase_auth_admin,app_workspace;
grant execute on function private.mitsa_registration_identity(text,text,uuid,uuid) to app_registration;`;
const end=`do $acceptance$ begin
 assert (select pg_get_userbyid(proowner)='postgres' and prosecdef and proconfig=array['search_path=""','row_security=on'] from pg_proc where oid='private.mitsa_registration_identity(text,text,uuid,uuid)'::regprocedure),'helper owner/security settings changed';
 assert not exists(select 1 from pg_proc p cross join lateral aclexplode(p.proacl) x where p.oid='private.mitsa_registration_identity(text,text,uuid,uuid)'::regprocedure
  and (x.grantee not in ((select oid from pg_roles where rolname='postgres'),(select oid from pg_roles where rolname='app_registration')) or x.privilege_type<>'EXECUTE' or x.is_grantable)),'unexpected helper grant';
 assert not has_schema_privilege('app_registration','auth','USAGE'),'Auth permissions changed';
 assert has_function_privilege('app_registration','private.mitsa_registration_identity(text,text,uuid,uuid)','EXECUTE'),'helper execution missing';
 assert not has_function_privilege('anon','private.mitsa_registration_identity(text,text,uuid,uuid)','EXECUTE')
  and not has_function_privilege('authenticated','private.mitsa_registration_identity(text,text,uuid,uuid)','EXECUTE')
  and not has_function_privilege('service_role','private.mitsa_registration_identity(text,text,uuid,uuid)','EXECUTE')
  and not has_function_privilege('supabase_auth_admin','private.mitsa_registration_identity(text,text,uuid,uuid)','EXECUTE')
  and not has_function_privilege('app_workspace','private.mitsa_registration_identity(text,text,uuid,uuid)','EXECUTE'),'helper exposed';
 assert position('auth.users' in pg_get_functiondef('private.mitsa_registration_command(text,jsonb,text,timestamptz)'::regprocedure))=0,'direct Auth command read retained';
 assert (select not(admission_enabled or delivery_enabled or transport_ready or session_policy_ready) and approval_generation is null and worker_id is null and terms_id is null and privacy_id is null from private.registration_control where singleton),'controls changed';
 assert not exists(select 1 from private.account_registration_policy) and not exists(select 1 from private.auth_mail_dispatch),'unexpected registration data';
end $acceptance$;
notify pgrst,'reload schema';
commit;`;
const source=`-- C1 CORRECTION CANDIDATE ONLY. Not installed. Apply to recovered retained C1 objects.
-- No managed Auth ownership/grant/table writes, new roles/tables, RLS changes or activation.
begin;
set local plpgsql.check_asserts=on;
${guard}
do $$ begin assert not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','api') and p.proname='mitsa_registration_identity'),'helper collision'; end $$;
${helper}
${command}
${restoreHooks}
${end}
`;
const dest='supabase/prepared/20261023122336_mitsa_registration_identity_boundary.sql';
const recoveryDest='supabase/prepared/20261023122341_mitsa_registration_identity_boundary_recovery.sql';
// Recovery must reject later source/owner/grant drift, not overwrite it.
const db=await recoveredC1Database();let installed;
try{
 await db.exec(source);
 installed=(await db.query("select n.nspname schema,p.proname name,pg_get_userbyid(p.proowner) owner,p.proacl::text acl,encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') sha256 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('api','private') and (p.proname='mitsa_registration_identity' or p.proname=any($1::text[])) order by 1,2",[baseline.functions.map(f=>f.name)])).rows;
}finally{await db.close();}
const recoveryGuard=`do $recovery_drift$ declare f record; observed record; begin
 for f in select * from (values
 ${installed.map(f=>`(${[f.schema,f.name,f.sha256,f.owner,f.acl].map(lit).join(',')})`).join(',\n ')}
 ) expected(schema_name,function_name,sha256,owner,acl) loop
  assert (select count(*)=1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=f.schema_name and p.proname=f.function_name),'recovery function collision';
  select pg_get_userbyid(p.proowner) owner,p.proacl::text acl,encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') digest into observed
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=f.schema_name and p.proname=f.function_name;
  assert observed.owner=f.owner and observed.acl is not distinct from f.acl and observed.digest=f.sha256,'recovery baseline drift';
 end loop;
end $recovery_drift$;`;
const rollback=recovery.slice(recovery.indexOf('SELECT private.mitsa_registration_stop(true);'),recovery.indexOf("NOTIFY pgrst,'reload schema';"));
const recoverySource=`-- C1 CORRECTION RECOVERY CANDIDATE ONLY. Zero-cohort inactive-installation scope.
-- Restore the recovered baseline, retain all data/objects and make the helper inert.
begin;
set local plpgsql.check_asserts=on;
do $$ begin
 assert (select marker='fireworks-foundation-proof-01a12e38' from foundation_probe.environment_identity where singleton),'unapproved target';
 assert not exists(select 1 from private.account_registration_policy) and not exists(select 1 from private.auth_mail_dispatch),'new recovery scope required for cohorts/dispatches';
end $$;
${recoveryGuard}
${rollback}
${original}
revoke all on function private.mitsa_registration_identity(text,text,uuid,uuid) from public,anon,authenticated,service_role,supabase_auth_admin,app_workspace,app_registration;
notify pgrst,'reload schema';
commit;
`;
// Explicit generation is local only. --check verifies without overwriting sources.
const check=process.argv[2]==='--check';assert(process.argv.length===(check?3:2));
for(const [path,value] of [[dest,source],[recoveryDest,recoverySource]]){
 if(check)assert.equal(readFileSync(path,'utf8'),value,'corrective source drift');
 else writeFileSync(path,value);
}
console.log(JSON.stringify({localOnly:true,mode:check?'check':'generate',files:[dest,recoveryDest].map(path=>({path,sha256:sha(readFileSync(path))})),hostedChanges:0}));
