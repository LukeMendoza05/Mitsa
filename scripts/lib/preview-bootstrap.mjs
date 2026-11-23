// Source-only derivation for a NEW EMPTY preview database. Never connects.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const digest=b=>createHash('sha256').update(b).digest('hex');
export const previewBootstrapInputs=[
 'supabase/migrations/20261012053948_foundation_security_proof.sql',
 'supabase/migrations/20261012054416_foundation_identity.sql',
 'supabase/migrations/20261012060403_foundation_membership_lock_policy.sql',
 // Never install the historical temporary policy on managed auth.sessions.
 'supabase/migrations/20261012070606_foundation_verified_actor_adapter.sql',
 'supabase/migrations/20261013181012_mitsa_workspace_foundation.sql',
 'supabase/migrations/20261013181135_mitsa_membership_commands.sql',
 'supabase/migrations/20261013185440_mitsa_account_security_terms.sql',
 'supabase/migrations/20261013223908_mitsa_registration_boundary.sql',
 'supabase/migrations/20261014001000_mitsa_reenrollment_session.sql',
 'supabase/migrations/20261014014343_mitsa_account_workspace_interfaces.sql',
 'supabase/migrations/20261014015632_mitsa_isolated_auth_mail_capture.sql',
 'supabase/migrations/20261014021816_mitsa_capture_pkce_compatibility.sql',
 'supabase/migrations/20261014034721_mitsa_captured_invitations.sql',
 'supabase/migrations/20261014044022_mitsa_reviewed_requests.sql',
 'supabase/migrations/20261014055453_mitsa_developer_registration.sql',
 'supabase/migrations/20261014094354_mitsa_capture_verification_codes.sql',
 'supabase/prepared/20261014_mitsa_controlled_pilot_relay.sql',
 'supabase/migrations/20261015072934_mitsa_development_recovery_eligibility.sql',
 'supabase/prepared/20261016004927_mitsa_persistent_registration_inactive.sql',
 'supabase/prepared/20261016005221_mitsa_persistent_registration_hooks_inactive.sql',
 'supabase/prepared/20261023122336_mitsa_registration_identity_boundary.sql'
];
const preflight=`do $preview_preflight$ begin
 assert current_user='postgres','approved preview installer required';
 assert not exists(select 1 from pg_namespace where nspname in ('private','api','foundation_probe')),'new empty application database required';
 assert not exists(select 1 from pg_roles where rolname in ('app_authz','app_command','app_workspace','app_registration')),'role collision';
 assert (select count(*)=0 from auth.users) and (select count(*)=0 from auth.sessions) and (select count(*)=0 from auth.mfa_factors),'empty Auth state required';
 assert has_schema_privilege('postgres','auth','USAGE'),'installer identity read unavailable';
 assert has_table_privilege('postgres','auth.users','SELECT') and has_table_privilege('postgres','auth.sessions','SELECT') and has_table_privilege('postgres','auth.mfa_factors','SELECT'),'installer Auth read unavailable';
 assert has_column_privilege('postgres','auth.users','id','REFERENCES'),'Auth foreign-key reference unavailable';
 assert has_schema_privilege('postgres','extensions','USAGE WITH GRANT OPTION'),'extension schema grant authority unavailable';
 assert has_function_privilege('postgres','extensions.dearmor(text)','EXECUTE WITH GRANT OPTION') and has_function_privilege('postgres','extensions.pgp_pub_encrypt(text,bytea,text)','EXECUTE WITH GRANT OPTION'),'encryption function grant authority unavailable';
end $preview_preflight$;
`;
const postflight=`
alter table private.registration_control add constraint preview_strict_policy_only check(session_policy='strict');
alter table private.account_registration_policy add constraint preview_cohort_strict_only check(session_policy='strict');
alter table private.registration_intents add constraint preview_intent_strict_only check(registration_session_policy is null or registration_session_policy='strict');
do $preview_postflight$ declare t record; populated boolean; begin
 assert (select marker='__PREVIEW_DATABASE_MARKER__' from foundation_probe.environment_identity where singleton),'preview marker mismatch';
 assert (select project_ref='__PREVIEW_PROJECT_REF__' and not(admission_enabled or delivery_enabled or transport_ready or session_policy_ready) and session_policy='strict'
 and approval_generation is null and worker_id is null and terms_id is null and privacy_id is null from private.registration_control where singleton),'persistent controls must stay closed';
 assert (select not(registration_enabled or external_mail_enabled or eligibility_approved or legal_publication_enabled or disposal_enabled) from private.release_gates where singleton),'release controls must stay closed';
 assert (select not(enabled or smtp_enabled) from private.pilot_registration_window where singleton),'pilot controls must stay closed';
 assert (select not enabled and public_key is null from private.isolated_mail_config where singleton),'mail capture must stay closed';
 assert not exists(select 1 from auth.users) and not exists(select 1 from auth.sessions) and not exists(select 1 from auth.mfa_factors),'Auth state changed';
 for t in select tablename from pg_tables where schemaname='private' and tablename not in ('release_gates','registration_control','pilot_registration_window','isolated_mail_config') loop
  execute format('select exists(select 1 from private.%I)',t.tablename) into strict populated;
  assert not populated,'unexpected private state';
 end loop;
 assert not exists(select 1 from private.businesses) and not exists(select 1 from private.memberships) and not exists(select 1 from private.shops),'business state must stay empty';
 assert not exists(select 1 from private.account_registration_policy) and not exists(select 1 from private.auth_mail_dispatch) and not exists(select 1 from private.legal_versions),'no cohort, mail or legal data may be copied';
 assert not has_schema_privilege('app_registration','auth','USAGE') and not has_schema_privilege('app_authz','auth','USAGE') and not has_schema_privilege('app_command','auth','USAGE'),'custom roles must not access managed Auth directly';
 assert not has_schema_privilege('app_registration','private','CREATE'),'registration schema creation privilege retained';
 assert (select bool_and(c.relrowsecurity and c.relforcerowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('private','foundation_probe') and c.relkind='r'),'forced RLS required';
 assert not exists(select 1 from pg_roles where rolname in ('app_authz','app_command','app_workspace','app_registration') and (rolsuper or rolbypassrls or rolcanlogin or rolcreaterole or rolcreatedb or rolinherit)),'unsafe application role';
end $preview_postflight$;
notify pgrst,'reload schema';
`;
function replaceExactly(source,from,to){assert.equal(source.split(from).length,2,'Reviewed transformation no longer applies');return source.replace(from,to);}
export function previewBootstrapTemplate(){
 const target=JSON.parse(readFileSync('config/test-target.json','utf8')),provenance=[],parts=[];
 for(const path of previewBootstrapInputs){
  const bytes=readFileSync(path);let sql=bytes.toString('utf8').replaceAll('\r\n','\n'),transforms=[];
  if(path.endsWith('foundation_security_proof.sql')){
   for(const line of ['grant usage on schema auth to app_authz, app_command;','grant execute on function auth.uid(), auth.jwt() to app_authz, app_command;','grant select (id, user_id) on auth.sessions to app_authz;'])sql=replaceExactly(sql,line,'-- Preview: obsolete transient managed-Auth grant omitted.');
   transforms.push('omit_three_obsolete_managed_auth_grants');
  }
  if(path.endsWith('foundation_verified_actor_adapter.sql')){
   for(const line of ['drop policy foundation_current_session on auth.sessions;','revoke select(id,user_id) on auth.sessions from app_authz;'])sql=replaceExactly(sql,line,'-- Preview: no temporary managed-Auth policy/grant was installed.');
   transforms.push('omit_drop_and_revoke_for_never_installed_auth_policy');
  }
  if(path.endsWith('20261016004927_mitsa_persistent_registration_inactive.sql')){
   sql=replaceExactly(sql,'grant usage on schema api,auth to app_registration;','grant usage on schema api to app_registration;');
   sql=replaceExactly(sql,'grant select(id,email,email_confirmed_at,deleted_at,banned_until,is_anonymous) on auth.users to app_registration;','-- Preview: corrected private identity boundary is installed in this transaction.');
   transforms.push('omit_unsupported_registration_auth_grants');
  }
  if(path.endsWith('20261023122336_mitsa_registration_identity_boundary.sql')){
   const start=sql.indexOf('create function private.mitsa_registration_identity('),end=sql.indexOf('do $acceptance$');assert(start>=0&&end>start);
   sql=sql.slice(start,end);transforms.push('use_exact_corrective_function_bodies_without_recovered_database_preflight');
  }
  sql=sql.replace(/^begin;\s*$/gmi,'').replace(/^commit;\s*$/gmi,'');
  sql=sql.replaceAll(target.databaseMarker,'__PREVIEW_DATABASE_MARKER__').replaceAll(target.projectRef,'__PREVIEW_PROJECT_REF__');
  assert(!/\b(?:alter\s+table|insert\s+into|update|delete\s+from)\s+auth\./i.test(sql)&&!/\b(?:create\s+trigger|drop\s+trigger|create\s+policy|alter\s+policy|drop\s+policy)\b[^;]*\bon\s+auth\./i.test(sql),'Managed Auth mutation is forbidden');
  provenance.push({path,sha256:digest(bytes),transforms});parts.push('-- SOURCE: '+path+'\n'+sql);
 }
 const sql='-- NEW EMPTY PREVIEW ONLY. TEMPLATE; NOT APPROVED FOR HOSTED EXECUTION.\n'+preflight+parts.join('\n')+postflight;
 assert(!sql.includes(target.projectRef)&&!sql.includes(target.databaseMarker),'Original target leaked into candidate');
 return {sql,provenance,sha256:digest(sql)};
}
export function materializePreviewBootstrap(projectRef){
 const retained=JSON.parse(readFileSync('config/test-target.json','utf8')).projectRef;
 assert(/^[a-z]{20}$/.test(projectRef)&&projectRef!==retained&&projectRef!=='unconfiguredpreviewx','Only a new separately approved project reference may be bound');
 const result=previewBootstrapTemplate(),marker='mitsa-preview-foundation-'+projectRef;
 const sql=result.sql.replaceAll('__PREVIEW_PROJECT_REF__',projectRef).replaceAll('__PREVIEW_DATABASE_MARKER__',marker);
 return {...result,sql,standaloneSql:'begin;\n'+sql+'\ncommit;\n',sha256:digest(sql),projectRef,marker};
}
