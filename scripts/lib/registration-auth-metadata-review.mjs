// Reviewed SELECT sources only. This module has no client, credentials or executor.
import assert from 'node:assert/strict';
export const userFields=['created_at','updated_at','last_sign_in_at','email_confirmed_at','phone_confirmed_at','confirmation_sent_at','recovery_sent_at','email_change_sent_at','phone_change_sent_at','reauthentication_sent_at','banned_until','deleted_at','is_anonymous','is_sso_user','is_super_admin','aud','role'];
export const factorFields=['user_id','factor_type','status','created_at','updated_at'];
export const actions=['login','logout','invite_accepted','user_signedup','user_invited','user_deleted','user_modified','user_recovery_requested','user_reauthenticate_requested','user_confirmation_requested','user_repeated_signup','user_updated_password','token_revoked','token_refreshed','factor_in_progress','factor_unenrolled','challenge_created','verification_attempted','factor_deleted','factor_updated','identity_linked','identity_unlinked','passkey_created','passkey_updated','passkey_deleted','recovery_codes_generated','recovery_codes_verified','recovery_codes_regenerated','recovery_codes_deleted'];
const required=[['auth.users',['id',...userFields]],['auth.mfa_factors',factorFields]];
const columns=[...required,['auth.audit_log_entries',['payload','created_at']]].flatMap(([relation,names])=>names.map(name=>`('${relation}','${name}',${relation!=='auth.audit_log_entries'})`)).join(',');
export const guardSql=`select
 (select marker from foundation_probe.environment_identity where singleton) as marker,
 (select not (admission_enabled or delivery_enabled or transport_ready or session_policy_ready) and session_policy='strict' and terms_id is null and privacy_id is null from private.registration_control where singleton) as controls_closed,
 (select not (registration_enabled or external_mail_enabled or eligibility_approved or legal_publication_enabled or disposal_enabled) from private.release_gates where singleton) as release_closed,
 (select not (enabled or smtp_enabled) from private.pilot_registration_window where singleton) as pilot_closed,
 (select coalesce(jsonb_agg(jsonb_build_object('relation',v.relation,'column',v.column_name,'required',v.required,'present',a.attnum is not null,'readable',coalesce(has_column_privilege(c.oid,a.attnum,'SELECT'),false)) order by v.relation,v.column_name),'[]'::jsonb)
  from (values ${columns}) v(relation,column_name,required)
  left join pg_class c on c.oid=to_regclass(v.relation)
  left join pg_attribute a on a.attrelid=c.oid and a.attname=v.column_name and a.attnum>0 and not a.attisdropped) as columns`;
export const userSql=`select created_at,updated_at,last_sign_in_at,email_confirmed_at,phone_confirmed_at,
 confirmation_sent_at,recovery_sent_at,email_change_sent_at,phone_change_sent_at,reauthentication_sent_at,
 banned_until,deleted_at,is_anonymous,is_sso_user,is_super_admin is true as privileged_auth_flag,
 aud='authenticated' as expected_audience,role='authenticated' as expected_auth_role
 from auth.users where id=$1::uuid`;
export const factorSql=`select
 case when factor_type::text in ('totp','phone','webauthn') then factor_type::text else 'other' end as kind,
 case when status::text in ('verified','unverified') then status::text else 'other' end as state,
 count(*)::int as count,min(created_at) as first_created_at,max(updated_at) as last_updated_at
 from auth.mfa_factors where user_id=$1::uuid group by 1,2 order by 1,2`;
// actor_id denotes the actor; traits.user_id is an explicit target in reviewed
// upstream admin events. Neither relationship establishes the column mutated.
export const boundedAuditSql=`with scoped as (select
  case when payload->>'action' in (${actions.map(a=>`'${a}'`).join(',')}) then payload->>'action' else 'other' end as action,
  case when payload->>'actor_id'=$1::text then 'actor' else 'explicit_target' end as relation,created_at
  from auth.audit_log_entries
  where (payload->>'actor_id'=$1::text or payload->'traits'->>'user_id'=$1::text)
   and created_at >= $2::timestamptz and created_at <= $3::timestamptz
  order by created_at desc limit 201)
 select action,relation,count(*)::int as count,min(created_at) as first_at,max(created_at) as last_at,
 (select count(*)=201 from scoped) as truncated from scoped group by action,relation order by action,relation`;
export const queries=Object.freeze({guard:guardSql,user:userSql,factors:factorSql,audit:boundedAuditSql});
export function changedAccount(before,after){
 const old=new Map(before.identities.users.map(r=>[r.id,r.digest]));
 assert.equal(old.size,before.identities.users.length);assert.equal(after.identities.users.length,old.size);
 assert(after.identities.users.every(r=>old.has(r.id)));assert.equal(new Set(after.identities.users.map(r=>r.id)).size,old.size);
 const changed=after.identities.users.filter(r=>old.get(r.id)!==r.digest);assert.equal(changed.length,1);
 assert.match(changed[0].id,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
 return changed[0].id; // private parameter only; never serialize or log
}
export function safeSummary(user,factors,audit,window){
 assert.equal(user.length,1);const u=user[0],within=t=>t==null?null:Date.parse(t)>=Date.parse(window.start)&&Date.parse(t)<=Date.parse(window.end);
 return {accountFound:true,metadataActivityWithinEvidenceWindow:{updated:within(u.updated_at),signIn:within(u.last_sign_in_at),recoveryRequest:within(u.recovery_sent_at)},
  currentStatus:{emailVerified:u.email_confirmed_at!=null,phoneVerified:u.phone_confirmed_at!=null,deleted:u.deleted_at!=null,bannedAtInspection:u.banned_until!=null&&Date.parse(u.banned_until)>Date.parse(window.inspectedAt),anonymous:u.is_anonymous,sso:u.is_sso_user,privilegedAuthFlag:u.privileged_auth_flag,expectedAudience:u.expected_audience,expectedAuthRole:u.expected_auth_role},
  factors:factors.map(r=>({kind:['totp','phone','webauthn'].includes(r.kind)?r.kind:'other',state:['verified','unverified'].includes(r.state)?r.state:'other',count:r.count})),
  auditAvailable:audit!==null,audit:audit?.map(r=>({action:actions.includes(r.action)?r.action:'other',relation:r.relation==='actor'?'actor':'explicit_target',count:r.count,truncated:r.truncated}))??[],
  historicalChangedColumnKnown:false,activityDoesNotProveCause:true,baselineAccepted:false,transportRetryApproved:false};
}
