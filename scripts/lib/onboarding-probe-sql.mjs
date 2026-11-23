// Reviewed SELECT-only operator probes. No credential/token/secret is returned.
export const onboardingProbeSql=Object.freeze({
 absent:'select id from auth.users where lower(email)=$1',
 registration:`select u.id,u.email_confirmed_at is not null email_confirmed,u.deleted_at is null and (u.banned_until is null or u.banned_until<=statement_timestamp()) active,
 coalesce(u.is_super_admin,false) super_admin,u.is_anonymous,
 p.intent_id,p.terms_id,p.privacy_id,p.session_policy,p.emergency_blocked,
 i.provider_user_id=u.id and i.id=p.intent_id and i.provider_claimed_at is not null and i.nonce_hash is not null intent_bound,
 i.approval_generation=$2::uuid generation_bound,i.registration_profile='isolated-development' profile_bound,
 (select count(*)::int from private.memberships m where m.user_id=u.id) memberships,
 exists(select 1 from private.operator_principals o where o.user_id=u.id and o.active) platform_operator
 from auth.users u left join private.account_registration_policy p on p.user_id=u.id
 left join private.registration_intents i on i.id=p.intent_id where lower(u.email)=$1`,
 session:`select exists(select 1 from auth.sessions s where s.id=$1::uuid and s.user_id=$2::uuid and (s.not_after is null or s.not_after>statement_timestamp())) live,
 (select s.aal::text from auth.sessions s where s.id=$1::uuid and s.user_id=$2::uuid) aal,
 extract(epoch from statement_timestamp())::bigint database_seconds`,
 mfa:`select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'type',f.factor_type,'status',f.status,
 'trusted',b.factor_id is not null and b.revoked_at is null and b.generation=s.generation,
 'protected',encode(extensions.hmac(convert_to(jsonb_build_array(f.id,f.user_id,f.factor_type,f.status,f.secret)::text,'UTF8'),$2::bytea,'sha256'),'hex'),
 'bindingProtected',encode(extensions.hmac(convert_to(coalesce(to_jsonb(b)::text,'null'),'UTF8'),$2::bytea,'sha256'),'hex'),
 'accountProtected',encode(extensions.hmac(convert_to(coalesce(to_jsonb(s)::text,'null'),'UTF8'),$2::bytea,'sha256'),'hex')) order by f.id),'[]'::jsonb) factors
 from auth.mfa_factors f left join private.factor_bindings b on b.factor_id=f.id and b.user_id=f.user_id
 left join private.account_security s on s.user_id=f.user_id where f.user_id=$1::uuid`,
 workspace:`select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'slug',b.slug,'role',m.role,'active',m.active,
 'primaryOwner',b.primary_owner_id=$1::uuid,'locationMatches',exists(select 1 from private.shops sh where sh.business_id=b.id and sh.name=$2 and sh.kind='warehouse' and sh.active),
 'digest',encode(extensions.hmac(convert_to(to_jsonb(b)::text,'UTF8'),$3::bytea,'sha256'),'hex'),
 'membershipProtected',encode(extensions.hmac(convert_to(to_jsonb(m)::text,'UTF8'),$3::bytea,'sha256'),'hex')) order by b.id),'[]'::jsonb) workspaces
 from private.memberships m join private.businesses b on b.id=m.business_id where m.user_id=$1::uuid`,
 clock:'select extract(epoch from statement_timestamp())::bigint database_seconds',
 queue:`select count(*)::int invalid_jobs from private.auth_mail_dispatch d where d.state in ('reserved','queued','claimed','unconfirmed')
 and (d.generation is distinct from $1::uuid or not(d.recipient_hash=any($2::text[])))`,
 health:`select c.worker_id=$2::uuid and c.approval_generation=$1::uuid and c.transport_ready and private.mitsa_persistent_health() healthy
 from private.registration_control c where c.singleton`,
 dispatch:`select d.id,d.intent_id,d.provider_user_id,d.capture_id,d.recipient_hash,d.generation,d.state,d.action,
 m.created_at,m.created_at+interval '3600 seconds' expires_at from private.auth_mail_dispatch d
 join private.isolated_auth_mail m on m.id=d.capture_id where d.id=$1::uuid and d.generation=$2::uuid`,
 capacity:`select (select count(*)::int from private.auth_mail_dispatch where claimed_at>statement_timestamp()-interval '1 hour')+
 (select count(*)::int from private.pilot_mail_deliveries where created_at>statement_timestamp()-interval '1 hour') hourly,
 (select count(*)::int from private.auth_mail_dispatch where claimed_at>statement_timestamp()-interval '1 day')+
 (select count(*)::int from private.pilot_mail_deliveries where created_at>statement_timestamp()-interval '1 day') daily,
 exists(select 1 from private.auth_mail_dispatch where recipient_hash=$1 and id<>$2::uuid and claimed_at>statement_timestamp()-interval '60 seconds') recipient_recent,
 statement_timestamp() database_now`
});
