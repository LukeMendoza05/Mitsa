-- STAGE C CANDIDATE. NOT INSTALLED. Apply after 20261016004927 only.
-- Exact legacy definitions are retained; hook pointers do not change.
begin;
do $$ begin assert (select marker='fireworks-foundation-proof-01a12e38' from foundation_probe.environment_identity where singleton), 'unapproved target'; end $$;
DO $baseline$ DECLARE f record; actual text; BEGIN
 FOR f IN SELECT * FROM (VALUES
  ('mitsa_before_user_created','3b9a3d84edaf52207da124f1a1ef2f909f1f855ac47dced61c5dd023f9200f0d','postgres'),
  ('mitsa_current_terms','88f032d6b3390dbe6b739e2969beef228b91efe8d925b8434cd9621e1d4d77b3','app_workspace'),
  ('mitsa_finalize_registration','7a09f6854c00baefbdd1bdb89fb45079139406025f86e82b14d9fd275c58ab65','app_workspace'),
  ('mitsa_isolated_send_email','8c9483aff22dc2ffc10024b97894903e3c80cc53963ba2f92a48102f79ba48f9','postgres')
 ) AS expected(name,sha256,owner) LOOP
  SELECT encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') INTO actual
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='private' AND p.proname=f.name AND pg_get_userbyid(p.proowner)=f.owner;
  ASSERT actual IS NOT DISTINCT FROM f.sha256,'installed function baseline changed';
 END LOOP;
END $baseline$;
grant create on schema private to app_workspace;
CREATE OR REPLACE FUNCTION private.mitsa_before_user_created_legacy(event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$ declare nonce text; v_email text; uid uuid; intent private.registration_intents; allowed boolean; begin
  nonce:=event->'user'->'user_metadata'->>'registration_nonce';
  v_email:=lower(btrim(event->'user'->>'email'));
  uid:=(event->'user'->>'id')::uuid;
  if nonce is null or nonce !~ '^[0-9a-f]{64}$' or uid is null or coalesce((event->'user'->>'is_anonymous')::boolean,true) then return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Registration unavailable.')); end if;
  select * into intent from private.registration_intents ri where ri.nonce_hash=encode(sha256(convert_to(nonce,'UTF8')),'hex') and ri.email=v_email for update;
  if not found or intent.email is distinct from v_email or intent.expires_at<=now() or intent.finalized_at is not null or intent.provider_user_id is not null and intent.provider_user_id<>uid then
    return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Registration unavailable.'));
  end if;
  select (g.registration_enabled and g.eligibility_approved and g.legal_publication_enabled and v.status='published' and v.effective_at<=now())
    or (v.status='test' and (private.mitsa_test_recipient_allowed(intent.email) or private.mitsa_pilot_registration_open())) into allowed
    from private.release_gates g join private.legal_versions v on v.id=g.test_terms_id where g.singleton and v.id=intent.terms_id;
  if allowed is distinct from true then return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Registration unavailable.')); end if;
  update private.registration_intents set provider_user_id=uid where id=intent.id;
  return '{}'::jsonb;
exception when invalid_text_representation then return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Registration unavailable.'));
end $function$;

ALTER FUNCTION private.mitsa_before_user_created_legacy(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.mitsa_before_user_created_legacy(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.mitsa_before_user_created_legacy(jsonb) TO supabase_auth_admin;
CREATE OR REPLACE FUNCTION private.mitsa_current_terms_legacy()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'on'
AS $function$ declare actor uuid:=private.current_actor(); result jsonb; begin
  if actor is null then raise exception 'forbidden' using errcode='42501'; end if;
  select jsonb_build_object('id',v.id,'version',v.version,'content',v.content,'hash',v.content_hash,'status',v.status,
    'accepted',exists(select 1 from private.legal_acceptances a where a.user_id=actor and a.version_id=v.id)) into result
    from private.legal_versions v join private.release_gates g on g.test_terms_id=v.id and g.singleton
    where v.kind='terms' and (v.status='test' or v.status='published' and g.legal_publication_enabled and v.effective_at<=now());
  return result;
end $function$;

ALTER FUNCTION private.mitsa_current_terms_legacy() OWNER TO app_workspace;
REVOKE ALL ON FUNCTION private.mitsa_current_terms_legacy() FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION private.mitsa_finalize_registration_legacy()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'on'
AS $function$ declare c jsonb:=private.mitsa_auth_context(); intent private.registration_intents; begin
  if c is null or c->'verified'<>'true' then raise exception 'verified account required' using errcode='42501'; end if;
  select * into intent from private.registration_intents where provider_user_id=private.current_actor() for update;
  if not found then return false; end if;
  if intent.finalized_at is not null then return true; end if;
  if intent.email is distinct from c->>'email' then raise exception 'registration identity mismatch' using errcode='42501'; end if;
  insert into private.account_profiles(user_id,full_name) values(private.current_actor(),intent.full_name) on conflict do nothing;
  insert into private.legal_acceptances(user_id,version_id,accepted_at,source) values(private.current_actor(),intent.terms_id,intent.accepted_at,'registration') on conflict do nothing;
  update private.registration_intents set finalized_at=now() where id=intent.id;
  return true;
end $function$;

ALTER FUNCTION private.mitsa_finalize_registration_legacy() OWNER TO app_workspace;
REVOKE ALL ON FUNCTION private.mitsa_finalize_registration_legacy() FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION private.mitsa_isolated_send_email_legacy(event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
 SET row_security TO 'on'
AS $function$
declare recipient text; action text; uid uuid; token_hash text; public_key text; v_recipient_hash text; payload jsonb;
begin
  if current_user<>'supabase_auth_admin' then raise exception 'forbidden' using errcode='42501'; end if;
  select c.public_key into public_key from private.isolated_mail_config c where c.singleton and c.enabled;
  if public_key is null then raise exception 'mail unavailable'; end if;
  recipient:=lower(btrim(event->'user'->>'email'));
  uid:=(event->'user'->>'id')::uuid;
  action:=event->'email_data'->>'email_action_type';
  token_hash:=event->'email_data'->>'token_hash';
  if recipient is null or not (private.mitsa_test_recipient_allowed(recipient) or (event->'email_data'->>'email_action_type'='signup' and private.mitsa_pilot_registration_open()) or (event->'email_data'->>'email_action_type'='recovery' and private.mitsa_development_recovery_allowed(uid,recipient)))
    
    or uid is null or action is null or action not in ('signup','recovery')
    or token_hash is null or length(token_hash) not between 32 and 261 or token_hash !~ '^(pkce_)?[a-f0-9]+$'
    or event->'email_data'->>'redirect_to' is distinct from 'http://127.0.0.1:3000/auth/email'
    then raise exception 'mail unavailable'; end if;
  if action='signup' and not exists(select 1 from private.registration_intents i where i.provider_user_id=uid and i.email=recipient and i.expires_at>now() and i.finalized_at is null) then raise exception 'mail unavailable'; end if;
  v_recipient_hash:=encode(sha256(convert_to(recipient,'UTF8')),'hex');
  perform pg_advisory_xact_lock(8417,1);
  if (select count(*) from private.isolated_auth_mail m where m.created_at>statement_timestamp()-interval '1 hour')>=100
    or (select count(*) from private.isolated_auth_mail m where m.recipient_hash=v_recipient_hash and m.created_at>statement_timestamp()-interval '1 hour')>=10 then raise exception 'mail unavailable'; end if;
  -- Discard provider access tokens, metadata and numeric OTPs. A dedicated
  -- local operator key is required to decrypt even the one-time hash/link.
  payload:=jsonb_build_object('email',recipient,'userId',uid,'type',action,'tokenHash',token_hash,'origin','http://127.0.0.1:3000');
  if action='signup' then
    if coalesce(event->'email_data'->>'token','') !~ '^[0-9]{6,10}$' then raise exception 'mail unavailable'; end if;
    payload:=payload||jsonb_build_object('code',event->'email_data'->>'token');
  end if;
  insert into private.isolated_auth_mail(recipient_hash,action,encrypted_payload)
    values(v_recipient_hash,action,extensions.pgp_pub_encrypt(payload::text,extensions.dearmor(public_key),'cipher-algo=aes256,compress-algo=0,unicode-mode=1'));
  return '{}'::jsonb;
exception when others then
  return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Test mail unavailable.'));
end $function$;

ALTER FUNCTION private.mitsa_isolated_send_email_legacy(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.mitsa_isolated_send_email_legacy(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.mitsa_isolated_send_email_legacy(jsonb) TO supabase_auth_admin;

grant select on private.registration_control,private.account_registration_policy,private.auth_mail_dispatch to supabase_auth_admin;
grant insert on private.account_registration_policy to supabase_auth_admin;
grant update(state,provider_user_id,consumed_at,capture_id) on private.auth_mail_dispatch to supabase_auth_admin;
grant update(submission_state) on private.registration_intents to supabase_auth_admin;
create policy persistent_control_hook on private.registration_control for select to supabase_auth_admin using(true);
create policy persistent_policy_hook_read on private.account_registration_policy for select to supabase_auth_admin using(true);
create policy persistent_policy_hook_insert on private.account_registration_policy for insert to supabase_auth_admin with check(true);
create policy persistent_dispatch_hook_read on private.auth_mail_dispatch for select to supabase_auth_admin using(true);
create policy persistent_dispatch_hook_update on private.auth_mail_dispatch for update to supabase_auth_admin using(true) with check(true);
grant select on private.account_registration_policy to app_workspace;
grant update(verified_at) on private.account_registration_policy to app_workspace;
create policy persistent_policy_workspace on private.account_registration_policy for select to app_workspace using(true);
create policy persistent_policy_verified on private.account_registration_policy for update to app_workspace using(true) with check(true);

create or replace function private.mitsa_before_user_created(event jsonb) returns jsonb
language plpgsql security invoker set search_path='' set row_security=on as $$
declare i private.registration_intents; c private.registration_control; uid uuid; address text; nonce text;
 denial jsonb:=jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Registration unavailable.'));
begin
 if current_user<>'supabase_auth_admin' then return denial; end if;
 uid:=(event->'user'->>'id')::uuid;address:=lower(btrim(event->'user'->>'email'));nonce:=event->'user'->'user_metadata'->>'registration_nonce';
 select * into i from private.registration_intents where email=address and nonce_hash=encode(sha256(convert_to(nonce,'UTF8')),'hex') for update;
 if not found or i.submission_id is null then return private.mitsa_before_user_created_legacy(event); end if;
 select * into c from private.registration_control where singleton;
 if uid is null or nonce !~ '^[a-f0-9]{64}$' or event->'user'->'is_anonymous' is distinct from 'false'::jsonb
 or not c.admission_enabled or not c.delivery_enabled or not c.session_policy_ready or c.stopped_at is not null
 or not coalesce(c.transport_ready and c.worker_id is not null and c.worker_until>statement_timestamp()
  and c.heartbeat_at between statement_timestamp()-interval '15 seconds' and statement_timestamp()+interval '1 second',false)
 or c.profile is distinct from i.registration_profile or c.session_policy is distinct from i.registration_session_policy
 or c.terms_id is distinct from i.terms_id or c.privacy_id is distinct from i.privacy_id
 or c.approval_generation is distinct from i.approval_generation or i.creation_deadline<=statement_timestamp()
 or i.expires_at<=statement_timestamp() or i.provider_claimed_at is null or i.finalized_at is not null
 or (i.provider_user_id is not null and i.provider_user_id<>uid)
 or not exists(select 1 from private.auth_mail_dispatch d where d.intent_id=i.id and d.action='signup' and d.state='reserved'
 and d.generation=c.approval_generation and d.authorize_until>statement_timestamp())
 then return denial; end if;
 -- Immutable applicability is derived from the signed intent, never metadata.
 insert into private.account_registration_policy(user_id,intent_id,profile,terms_id,privacy_id,accepted_at,session_policy)
 values(uid,i.id,i.registration_profile,i.terms_id,i.privacy_id,i.accepted_at,i.registration_session_policy) on conflict do nothing;
 if not exists(select 1 from private.account_registration_policy p where p.user_id=uid and p.intent_id=i.id and p.terms_id=i.terms_id and p.privacy_id=i.privacy_id) then return denial; end if;
 update private.registration_intents set provider_user_id=uid,submission_state='pending-verification' where id=i.id;
 return '{}'::jsonb;
exception when invalid_text_representation or unique_violation then return denial;
end $$;

create or replace function private.mitsa_isolated_send_email(event jsonb) returns jsonb
language plpgsql security invoker set search_path='' set row_security=on as $$
declare c private.registration_control; d private.auth_mail_dispatch; i private.registration_intents; a private.account_registration_policy;
 address text; uid uuid; action text; callback text; request_id uuid; public_key text; payload jsonb; capture uuid;
begin
 if current_user<>'supabase_auth_admin' then raise exception 'forbidden'; end if;
 uid:=(event->'user'->>'id')::uuid;address:=lower(btrim(event->'user'->>'email'));
 action:=event->'email_data'->>'email_action_type';callback:=event->'email_data'->>'redirect_to';
 -- A new cohort cannot fall back to the old broad pilot eligibility branch.
 if callback='http://127.0.0.1:3000/auth/email' and not exists(select 1 from private.account_registration_policy where user_id=uid) then
  return private.mitsa_isolated_send_email_legacy(event);
 end if;
 select * into c from private.registration_control where singleton;
 if callback is null or callback !~ '^http://127\.0\.0\.1:3000/auth/email\?request=[0-9a-f-]{36}$' then raise exception 'mail unavailable'; end if;
 request_id:=substring(callback from 'request=([0-9a-f-]{36})$')::uuid;
 perform pg_advisory_xact_lock(8417,1);
 select * into d from private.auth_mail_dispatch where id=request_id for update;
 select * into i from private.registration_intents where id=d.intent_id for update;
 select * into a from private.account_registration_policy where user_id=uid;
 if d.id is null or uid is null or action not in ('signup','recovery') or action is null
 or callback is distinct from c.origin||'/auth/email?request='||request_id::text
 or d.recipient_hash is distinct from encode(sha256(convert_to(address,'UTF8')),'hex')
 or d.action is distinct from action
 or (d.provider_user_id is not null and d.provider_user_id<>uid)
 or d.state<>'reserved' or d.consumed_at is not null or d.authorize_until<=statement_timestamp()
 or not c.delivery_enabled or c.stopped_at is not null or c.approval_generation is distinct from d.generation
 or not coalesce(c.transport_ready and c.worker_id is not null and c.worker_until>statement_timestamp()
  and c.heartbeat_at between statement_timestamp()-interval '15 seconds' and statement_timestamp()+interval '1 second',false)
 or a.user_id is null or a.intent_id is distinct from d.intent_id or a.emergency_blocked
 or (action='signup' and (i.id is null or i.email is distinct from address or i.provider_user_id is distinct from uid
  or i.finalized_at is not null or i.expires_at<=statement_timestamp() or event->'user'->>'email_confirmed_at' is not null))
 or (action='recovery' and (a.verified_at is null or d.provider_user_id is distinct from uid or event->'user'->>'email_confirmed_at' is null))
 or coalesce(event->'email_data'->>'token_hash','') !~ '^(pkce_)?[a-f0-9]+$'
 or length(regexp_replace(coalesce(event->'email_data'->>'token_hash',''),'^pkce_','')) not between 32 and 256
 then raise exception 'mail unavailable'; end if;
 select mc.public_key into public_key from private.isolated_mail_config mc where singleton and enabled;
 if public_key is null then raise exception 'mail unavailable'; end if;
 if (select count(*) from private.isolated_auth_mail where created_at>statement_timestamp()-interval '1 hour')>=100
 or (select count(*) from private.isolated_auth_mail where recipient_hash=d.recipient_hash and created_at>statement_timestamp()-interval '1 hour')>=10 then raise exception 'mail unavailable'; end if;
 payload:=jsonb_build_object('email',address,'userId',uid,'type',action,'tokenHash',event->'email_data'->>'token_hash','origin',c.origin);
 if action='signup' then
  if coalesce(event->'email_data'->>'token','') !~ '^[0-9]{6}$' then raise exception 'mail unavailable'; end if;
  payload:=payload||jsonb_build_object('code',event->'email_data'->>'token');
 end if;
 insert into private.isolated_auth_mail(recipient_hash,action,encrypted_payload)
 values(d.recipient_hash,action,extensions.pgp_pub_encrypt(payload::text,extensions.dearmor(public_key),'cipher-algo=aes256,compress-algo=0,unicode-mode=1')) returning id into capture;
 update private.auth_mail_dispatch set state='queued',consumed_at=statement_timestamp(),capture_id=capture,provider_user_id=uid where id=d.id;
 return '{}'::jsonb;
exception when others then
 -- Exception block rolls back BOTH permit consumption and capture insertion.
 return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Authentication mail unavailable.'));
end $$;

create or replace function private.mitsa_current_terms() returns jsonb
language plpgsql stable security definer set search_path='' set row_security=on as $$
declare actor uuid:=private.current_actor(); a private.account_registration_policy; result jsonb;
begin
 if actor is null then raise exception 'forbidden' using errcode='42501'; end if;
 select * into a from private.account_registration_policy where user_id=actor;
 if not found then return private.mitsa_current_terms_legacy(); end if;
 select jsonb_build_object('id',v.id,'version',v.version,'content',v.content,'hash',v.content_hash,'status',v.status,
 'privacyId',p.id,'privacyVersion',p.version,
 'accepted',exists(select 1 from private.legal_acceptances l where l.user_id=actor and l.version_id=a.terms_id)
 and exists(select 1 from private.legal_acceptances l where l.user_id=actor and l.version_id=a.privacy_id)) into result
 from private.legal_versions v join private.legal_versions p on p.id=a.privacy_id where v.id=a.terms_id and v.kind='terms' and p.kind='privacy'
 and ((a.profile in ('isolated-development','consenting-pilot') and v.status='test' and p.status='test')
 or(a.profile='production' and v.status='published' and p.status='published' and v.effective_at<=statement_timestamp() and p.effective_at<=statement_timestamp()));
 return result;
end $$;
create or replace function private.mitsa_finalize_registration() returns boolean
language plpgsql security definer set search_path='' set row_security=on as $$
declare actor uuid:=private.current_actor(); a private.account_registration_policy;
begin
 select * into a from private.account_registration_policy where user_id=actor;
 if not found then return private.mitsa_finalize_registration_legacy(); end if;
 if not private.mitsa_finalize_registration_legacy() then return false; end if;
 insert into private.legal_acceptances(user_id,version_id,accepted_at,source) values(actor,a.privacy_id,a.accepted_at,'registration') on conflict do nothing;
 update private.account_registration_policy set verified_at=coalesce(verified_at,statement_timestamp()) where user_id=actor;
 return true;
end $$;
-- No existing profile, agreement, factor, membership or ownership is updated.
revoke create on schema private from app_workspace;
notify pgrst,'reload schema';
commit;
