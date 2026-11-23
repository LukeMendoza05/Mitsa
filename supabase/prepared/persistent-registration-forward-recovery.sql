-- REVIEWED RECOVERY SOURCE. DO NOT EXECUTE DURING STAGE A.
-- Close admission/delivery first. Retain all tables, accounts, cohorts and evidence.
BEGIN;
DO $$ BEGIN ASSERT (select marker='fireworks-foundation-proof-01a12e38' from foundation_probe.environment_identity where singleton),'unapproved target'; END $$;
SELECT private.mitsa_registration_stop(true);
CREATE OR REPLACE FUNCTION private.mitsa_before_user_created(event jsonb)
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
CREATE OR REPLACE FUNCTION private.mitsa_isolated_send_email(event jsonb)
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
-- Cohort-aware Terms/finalization MUST remain if any new cohort exists.
-- Their exact baseline definitions are retained below for a zero-cohort rollback.
DO $rollback$ BEGIN IF NOT EXISTS(select 1 from private.account_registration_policy) THEN
EXECUTE $restore$
CREATE OR REPLACE FUNCTION private.mitsa_current_terms()
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
$restore$;
EXECUTE $restore$
CREATE OR REPLACE FUNCTION private.mitsa_finalize_registration()
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
$restore$;
END IF; END $rollback$;
NOTIFY pgrst,'reload schema';
COMMIT;
-- Disable the local persistent engine only after reviewing cohort compatibility.
-- Any future actor-bound policy must remain in force; this script never changes it.

