// Exact operator queries. No managed Auth-table write, schema change or grants.
export const cSql=Object.freeze({
 users:"select id,email_confirmed_at from auth.users where email=any($1::text[])",
 notices:"select id,kind,version,status,content,content_hash from private.legal_versions where id=any($1::uuid[]) order by kind",
 quota:"select (select count(*) from private.auth_mail_dispatch where created_at>statement_timestamp()-interval '1 hour')+(select count(*) from private.pilot_mail_deliveries where created_at>statement_timestamp()-interval '1 hour') hourly,(select count(*) from private.auth_mail_dispatch where created_at>statement_timestamp()-interval '1 day')+(select count(*) from private.pilot_mail_deliveries where created_at>statement_timestamp()-interval '1 day') daily",
 clock:'select statement_timestamp() now',
 dispatch:"select d.id,d.intent_id,d.provider_user_id,d.capture_id,d.recipient_hash,d.state,d.action,m.created_at,m.created_at+interval '3600 seconds' expires_at,encode(m.encrypted_payload,'base64') encrypted_payload from private.auth_mail_dispatch d join private.isolated_auth_mail m on m.id=d.capture_id where d.id=$1::uuid and d.generation=$2::uuid",
 replay:"select count(*)::int n from private.registration_requests where request_hash=$1",
 restore:`update private.registration_control c set
 (profile,project_ref,origin,admission_enabled,delivery_enabled,approval_generation,stopped_at,terms_id,privacy_id,session_policy,session_policy_ready,worker_id,worker_until,heartbeat_at,transport_ready,approved_sender_sha256,hourly_budget,daily_budget,otp_digits,otp_expiry_seconds)=
 (select r.profile,r.project_ref,r.origin,r.admission_enabled,r.delivery_enabled,r.approval_generation,r.stopped_at,r.terms_id,r.privacy_id,r.session_policy,r.session_policy_ready,r.worker_id,r.worker_until,r.heartbeat_at,r.transport_ready,r.approved_sender_sha256,r.hourly_budget,r.daily_budget,r.otp_digits,r.otp_expiry_seconds from jsonb_populate_record(null::private.registration_control,$1::jsonb) r)
 where c.singleton and c.project_ref='mjtejwafxriwntweussc' and c.origin='http://127.0.0.1:3000' and c.session_policy='strict'
 and not(c.admission_enabled or c.delivery_enabled or c.transport_ready or c.session_policy_ready)
 and c.approval_generation is null and c.stopped_at is not null
 and ($1::jsonb->>'admission_enabled')='false' and ($1::jsonb->>'delivery_enabled')='false'
 and ($1::jsonb->>'transport_ready')='false' and ($1::jsonb->>'session_policy_ready')='false'
 and ($1::jsonb->>'session_policy')='strict' and ($1::jsonb->>'profile')='isolated-development'
 and ($1::jsonb->>'project_ref')='mjtejwafxriwntweussc' and ($1::jsonb->>'origin')='http://127.0.0.1:3000'
 and $1::jsonb->'approval_generation'='null'::jsonb
 and c.approved_sender_sha256=$2 and exists(select 1 from foundation_probe.environment_identity where singleton and marker='fireworks-foundation-proof-01a12e38')
 returning singleton`
});
