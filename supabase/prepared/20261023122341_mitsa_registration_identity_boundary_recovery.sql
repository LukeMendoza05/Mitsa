-- C1 CORRECTION RECOVERY CANDIDATE ONLY. Zero-cohort inactive-installation scope.
-- Restore the recovered baseline, retain all data/objects and make the helper inert.
begin;
set local plpgsql.check_asserts=on;
do $$ begin
 assert (select marker='fireworks-foundation-proof-01a12e38' from foundation_probe.environment_identity where singleton),'unapproved target';
 assert not exists(select 1 from private.account_registration_policy) and not exists(select 1 from private.auth_mail_dispatch),'new recovery scope required for cohorts/dispatches';
end $$;
do $recovery_drift$ declare f record; observed record; begin
 for f in select * from (values
 ('api','mitsa_current_terms','daa85b620b364f922125bbecadae970e85d2554d327541722b15c00804a56768','postgres','{postgres=X/postgres,authenticated=X/postgres}'),
 ('api','mitsa_finalize_registration','f79f46199de12101972394e73c75561fbf26987432c9e50cbea4941090cba758','postgres','{postgres=X/postgres,authenticated=X/postgres}'),
 ('api','mitsa_persistent_registration_policy','45800dd4826641fbfecf94f7996e6691d2363d0eae481afa39421988f564a5af','postgres','{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}'),
 ('api','mitsa_registration_command','d796e261bd3ec748c418abb860b44a95c9302e81093ad74b44fdf6a6e6e08a54','postgres','{postgres=X/postgres,service_role=X/postgres}'),
 ('private','current_actor','587affbee9b5b7bf9cfd3b8bf343eda75626ec0fb9b886b9f3c370995182d652','postgres','{postgres=X/postgres,authenticated=X/postgres,app_authz=X/postgres,app_command=X/postgres,app_workspace=X/postgres}'),
 ('private','mitsa_before_user_created','9612969f9f84cb8e9b39be5bd2e19aa566b0dbe6a55b04ecb882d440643b9930','postgres','{postgres=X/postgres,supabase_auth_admin=X/postgres}'),
 ('private','mitsa_before_user_created_legacy','120b4658e6b20ed2bd47c8b0ad718c8bdabd2bc54c2223ea394cd069445e1390','postgres','{postgres=X/postgres,supabase_auth_admin=X/postgres}'),
 ('private','mitsa_current_terms','19111029f28bf6de5e5d2a1d23bd1c250dbd6143fe8f344d1cf5c2e97d24ba4f','app_workspace','{app_workspace=X/app_workspace,authenticated=X/app_workspace}'),
 ('private','mitsa_current_terms_legacy','91a6ceaa33867e6b32ce713638a373afaf0f48310fa818d8db0973a5a4c96c7b','app_workspace','{app_workspace=X/app_workspace}'),
 ('private','mitsa_finalize_registration','27895c0997305fb6fd57b10c45fa85bd66555e2fc369e31cc60e12b5a845980d','app_workspace','{app_workspace=X/app_workspace,authenticated=X/app_workspace}'),
 ('private','mitsa_finalize_registration_legacy','0ae0d229fb5843f639f32ed8505bd6100e65958f1a4aa228858cc3d2b277ca8c','app_workspace','{app_workspace=X/app_workspace}'),
 ('private','mitsa_isolated_send_email','ef005411c8101dd6b9434eb2bf98bfc2d0157aaeb66f784ab9fb43ab3efcb03a','postgres','{postgres=X/postgres,supabase_auth_admin=X/postgres}'),
 ('private','mitsa_isolated_send_email_legacy','ff886c10125a10c6671a0b35c8849a7a9b5a377920c463da9d997b6379a1f274','postgres','{postgres=X/postgres,supabase_auth_admin=X/postgres}'),
 ('private','mitsa_persistent_capacity','125b6f7eeb250c0ecc554f699f6b00a55f8230dc6181f9d917c004ef9c5b5740','app_registration','{app_registration=X/app_registration}'),
 ('private','mitsa_persistent_health','362ddfac300500c3eff7913c29ddbeae5c156c1f5086aa30b7afad301aa4c947','app_registration','{app_registration=X/app_registration}'),
 ('private','mitsa_persistent_registration_policy','f60cf65dd0b618bf5168cc0cc43b95da2a4931af3e8295884b3a30dd9181a0ba','app_registration','{app_registration=X/app_registration,anon=X/app_registration,authenticated=X/app_registration}'),
 ('private','mitsa_registration_command','9388036468ad46e39081268eb5be4a73bfe5dfa5bd7ab989a7719342d41983cf','app_registration','{app_registration=X/app_registration,service_role=X/app_registration}'),
 ('private','mitsa_registration_identity','16f06f8505131cfe20d94822aedce884d05910da55e541934ea6a8ae46bd1119','postgres','{postgres=X/postgres,app_registration=X/postgres}'),
 ('private','mitsa_registration_stop','3503cb9ba95a592962d49a00ebc59a6ff4e4e0ae796681464a1557eb72c81155','app_registration','{app_registration=X/app_registration}'),
 ('private','mitsa_worker_acquire','f18de4bb59f259ae7bd607ac94429a8fa6ce3ab19f71bab3c6a245d35a7f69b5','app_registration','{app_registration=X/app_registration}'),
 ('private','mitsa_worker_claim','70d3665357acd050d66138889fa31d5e2baccbdc669d9a5ebb7bf9613fccab98','app_registration','{app_registration=X/app_registration}'),
 ('private','mitsa_worker_complete','95d4ad05c198f2313f2377c1f80fb3d13bac56dd18900551a9c7165ecc257399','app_registration','{app_registration=X/app_registration}'),
 ('private','mitsa_worker_heartbeat','ae0af63a63c2d014e8f84c11cac103c34596eebdb198f417c5b076b85a8132cc','app_registration','{app_registration=X/app_registration}')
 ) expected(schema_name,function_name,sha256,owner,acl) loop
  assert (select count(*)=1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=f.schema_name and p.proname=f.function_name),'recovery function collision';
  select pg_get_userbyid(p.proowner) owner,p.proacl::text acl,encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') digest into observed
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=f.schema_name and p.proname=f.function_name;
  assert observed.owner=f.owner and observed.acl is not distinct from f.acl and observed.digest=f.sha256,'recovery baseline drift';
 end loop;
end $recovery_drift$;
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

create or replace function private.mitsa_registration_command(p_action text,p_payload jsonb,p_request_hash text,p_signed_at timestamptz) returns jsonb
language plpgsql security definer set search_path='' set row_security=on as $$
declare c private.registration_control; i private.registration_intents; d private.auth_mail_dispatch; a private.account_registration_policy;
 address text; uid uuid; fingerprint text; recipient text; result jsonb; n uuid;
begin
 if p_request_hash is null or p_request_hash !~ '^[0-9a-f]{64}$' or p_signed_at is null
 or abs(extract(epoch from statement_timestamp()-p_signed_at))>60 or jsonb_typeof(p_payload)<>'object' then
 raise exception 'registration unavailable' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(8416,1);
 if (select count(*) from private.registration_requests where received_at>statement_timestamp()-interval '1 minute')>=30
 or (select count(*) from private.registration_requests where received_at>statement_timestamp()-interval '1 hour')>=100 then
 raise exception 'request limit' using errcode='54000'; end if;
 insert into private.registration_requests(request_hash,signed_at) values(p_request_hash,p_signed_at);
 select * into c from private.registration_control where singleton for update;
 address:=lower(btrim(p_payload->>'email'));
 if address is null or length(address)>254 or address !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
 raise exception 'invalid request' using errcode='22023'; end if;
 recipient:=encode(sha256(convert_to(address,'UTF8')),'hex');
 if p_action='prepare' then
  n:=(p_payload->>'submissionId')::uuid;
  fingerprint:=p_payload->>'fingerprint';
  if n is null or fingerprint is null or fingerprint !~ '^[0-9a-f]{64}$'
   or p_payload->>'nonceHash' is null or p_payload->>'nonceHash' !~ '^[0-9a-f]{64}$'
   or length(btrim(p_payload->>'fullName')) not between 1 and 120 or p_payload->>'fullName' is null
   or p_payload->'accepted' is distinct from 'true'::jsonb then raise exception 'invalid request' using errcode='22023'; end if;
  select * into i from private.registration_intents where submission_id=n for update;
  if found then
   if i.email<>address or i.submission_fingerprint<>fingerprint or i.nonce_hash<>p_payload->>'nonceHash' then
    raise exception 'submission mismatch' using errcode='42501'; end if;
  else
   if private.mitsa_persistent_registration_policy()->>'admission'<>'available'
    or c.terms_id is distinct from (p_payload->>'termsId')::uuid or c.privacy_id is distinct from (p_payload->>'privacyId')::uuid then
    raise exception 'registration closed' using errcode='42501'; end if;
   if (select count(*) from private.registration_intents where email=address and created_at>statement_timestamp()-interval '1 hour')>=3 then
    raise exception 'recipient limit' using errcode='54000'; end if;
   insert into private.registration_intents(email,full_name,nonce_hash,terms_id,privacy_id,submission_id,submission_fingerprint,creation_deadline,submission_state,approval_generation,registration_profile,registration_session_policy)
    values(address,btrim(p_payload->>'fullName'),p_payload->>'nonceHash',c.terms_id,c.privacy_id,n,fingerprint,statement_timestamp()+interval '2 minutes','prepared',c.approval_generation,c.profile,c.session_policy) returning * into i;
  end if;
 elsif p_action in ('claim-signup','submission-status','continue-verification','renew-verification') then
  select * into i from private.registration_intents where email=address
   and ((p_action in ('claim-signup','submission-status') and submission_id=(p_payload->>'submissionId')::uuid)
   or (p_action='continue-verification' and p_payload->'passwordProven'='true'::jsonb and provider_user_id is not null
    and exists(select 1 from auth.users u where u.id=provider_user_id and u.email=address and u.email_confirmed_at is null and u.deleted_at is null and (u.banned_until is null or u.banned_until<=statement_timestamp())))
   or (p_action='renew-verification' and id=(p_payload->>'intentId')::uuid))
   order by created_at desc limit 1 for update;
  if not found or i.submission_id is null then return null; end if;
  if p_action='renew-verification' then
   if p_payload->'passwordProven' is distinct from 'true'::jsonb or p_payload->'accepted' is distinct from 'true'::jsonb
   or i.finalized_at is not null or i.provider_user_id is null
   or i.terms_id is distinct from (p_payload->>'termsId')::uuid or i.privacy_id is distinct from (p_payload->>'privacyId')::uuid
   or c.terms_id is distinct from i.terms_id or c.privacy_id is distinct from i.privacy_id
   or not exists(select 1 from auth.users u join private.account_registration_policy ap on ap.user_id=u.id
     where u.id=i.provider_user_id and u.email=address and u.email_confirmed_at is null and u.deleted_at is null
     and (u.banned_until is null or u.banned_until<=statement_timestamp()) and not ap.emergency_blocked) then return null; end if;
   -- Extend only continuation, never creation authority or original consent.
   update private.registration_intents set expires_at=statement_timestamp()+interval '24 hours',renewed_at=statement_timestamp() where id=i.id returning * into i;
  end if;
  if p_action='claim-signup' then
   if i.provider_claimed_at is not null then return jsonb_build_object('claimed',false); end if;
   if i.creation_deadline<=statement_timestamp() or i.expires_at<=statement_timestamp()
    or i.approval_generation is distinct from c.approval_generation
    or not c.admission_enabled or not c.delivery_enabled or not c.session_policy_ready or not private.mitsa_persistent_health()
    or c.terms_id is distinct from i.terms_id or c.privacy_id is distinct from i.privacy_id
    or not exists(select 1 from private.auth_mail_dispatch permit where permit.intent_id=i.id and permit.action='signup' and permit.generation=c.approval_generation
      and permit.state='reserved' and permit.authorize_until>statement_timestamp()) then return jsonb_build_object('claimed',false); end if;
   update private.registration_intents set provider_claimed_at=statement_timestamp(),submission_state='submitted' where id=i.id;
   return jsonb_build_object('claimed',true);
  end if;
 elsif p_action='authorize-mail' then
  n:=(p_payload->>'requestKey')::uuid;
  if n is null then raise exception 'invalid request' using errcode='22023'; end if;
  select * into d from private.auth_mail_dispatch where request_key=n for update;
  if found then
   if d.recipient_hash<>recipient or d.action is distinct from p_payload->>'action' then raise exception 'request mismatch' using errcode='42501'; end if;
   return jsonb_build_object('requestId',d.id,'expiresAt',d.authorize_until,'sendAllowed',false);
  end if;
  if private.mitsa_persistent_registration_policy()->>'delivery'<>'available' then return null; end if;
  if not private.mitsa_persistent_capacity(recipient) then raise exception 'mail limit' using errcode='54000'; end if;
  if p_payload->>'action'='signup' then
   select * into i from private.registration_intents where email=address and id=(p_payload->>'intentId')::uuid for update;
   if not found or i.submission_id is null then return null; end if;
   if i.finalized_at is not null then return null; end if;
   if i.expires_at<=statement_timestamp() then return jsonb_build_object('error','verification-expired'); end if;
   if i.provider_user_id is not null and exists(select 1 from auth.users where id=i.provider_user_id and (email_confirmed_at is not null or deleted_at is not null or banned_until>statement_timestamp())) then return null; end if;
  elsif p_payload->>'action'='recovery' then
   select ap.* into a from auth.users u join private.account_registration_policy ap on ap.user_id=u.id
     where u.email=address and u.email_confirmed_at is not null and u.deleted_at is null
     and not u.is_anonymous and (u.banned_until is null or u.banned_until<=statement_timestamp()) and not ap.emergency_blocked and ap.verified_at is not null;
   if not found then return null; end if;
   i.id:=a.intent_id;i.provider_user_id:=a.user_id;
  else raise exception 'invalid action' using errcode='22023'; end if;
  insert into private.auth_mail_dispatch(request_key,action,recipient_hash,intent_id,provider_user_id,generation)
   values(n,p_payload->>'action',recipient,i.id,i.provider_user_id,c.approval_generation) returning * into d;
  return jsonb_build_object('requestId',d.id,'expiresAt',d.authorize_until,'sendAllowed',true);
 elsif p_action='mail-status' then
  select * into d from private.auth_mail_dispatch where id=(p_payload->>'requestId')::uuid and recipient_hash=recipient;
  return jsonb_build_object('state',case d.state when 'reserved' then 'requested' when 'queued' then 'processing' when 'claimed' then 'processing'
    when 'smtp-accepted' then 'sent' when 'unconfirmed' then 'unconfirmed' else 'unavailable' end);
 else raise exception 'invalid command' using errcode='22023'; end if;
 if i.finalized_at is not null then i.submission_state:='verified';
 elsif i.expires_at<=statement_timestamp() or (i.provider_user_id is null and i.creation_deadline<=statement_timestamp()) then i.submission_state:='expired';
 elsif i.provider_user_id is not null then i.submission_state:='pending-verification';
 elsif i.provider_claimed_at is not null then i.submission_state:='uncertain'; end if;
 return jsonb_build_object('submissionId',i.submission_id,'intentId',i.id,'state',i.submission_state,'creationDeadline',i.creation_deadline,'expiresAt',i.expires_at,
  'restartAllowed',i.provider_user_id is null and i.creation_deadline<=statement_timestamp());
end $$;
revoke all on function private.mitsa_registration_identity(text,text,uuid,uuid) from public,anon,authenticated,service_role,supabase_auth_admin,app_workspace,app_registration;
notify pgrst,'reload schema';
commit;
