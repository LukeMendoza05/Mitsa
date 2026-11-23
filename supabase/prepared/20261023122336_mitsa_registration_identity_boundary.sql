-- C1 CORRECTION CANDIDATE ONLY. Not installed. Apply to recovered retained C1 objects.
-- No managed Auth ownership/grant/table writes, new roles/tables, RLS changes or activation.
begin;
set local plpgsql.check_asserts=on;
do $preflight$ declare f record; observed record; begin
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
 ('api','mitsa_current_terms','daa85b620b364f922125bbecadae970e85d2554d327541722b15c00804a56768','postgres','{postgres=X/postgres,authenticated=X/postgres}'),
 ('api','mitsa_finalize_registration','f79f46199de12101972394e73c75561fbf26987432c9e50cbea4941090cba758','postgres','{postgres=X/postgres,authenticated=X/postgres}'),
 ('api','mitsa_persistent_registration_policy','45800dd4826641fbfecf94f7996e6691d2363d0eae481afa39421988f564a5af','postgres','{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}'),
 ('api','mitsa_registration_command','d796e261bd3ec748c418abb860b44a95c9302e81093ad74b44fdf6a6e6e08a54','postgres','{postgres=X/postgres,service_role=X/postgres}'),
 ('private','current_actor','587affbee9b5b7bf9cfd3b8bf343eda75626ec0fb9b886b9f3c370995182d652','postgres','{postgres=X/postgres,authenticated=X/postgres,app_authz=X/postgres,app_command=X/postgres,app_workspace=X/postgres}'),
 ('private','mitsa_before_user_created','3b9a3d84edaf52207da124f1a1ef2f909f1f855ac47dced61c5dd023f9200f0d','postgres','{postgres=X/postgres,supabase_auth_admin=X/postgres}'),
 ('private','mitsa_before_user_created_legacy','120b4658e6b20ed2bd47c8b0ad718c8bdabd2bc54c2223ea394cd069445e1390','postgres','{postgres=X/postgres,supabase_auth_admin=X/postgres}'),
 ('private','mitsa_current_terms','88f032d6b3390dbe6b739e2969beef228b91efe8d925b8434cd9621e1d4d77b3','app_workspace','{app_workspace=X/app_workspace,authenticated=X/app_workspace}'),
 ('private','mitsa_current_terms_legacy','91a6ceaa33867e6b32ce713638a373afaf0f48310fa818d8db0973a5a4c96c7b','app_workspace','{app_workspace=X/app_workspace}'),
 ('private','mitsa_finalize_registration','7a09f6854c00baefbdd1bdb89fb45079139406025f86e82b14d9fd275c58ab65','app_workspace','{app_workspace=X/app_workspace,authenticated=X/app_workspace}'),
 ('private','mitsa_finalize_registration_legacy','0ae0d229fb5843f639f32ed8505bd6100e65958f1a4aa228858cc3d2b277ca8c','app_workspace','{app_workspace=X/app_workspace}'),
 ('private','mitsa_isolated_send_email','8c9483aff22dc2ffc10024b97894903e3c80cc53963ba2f92a48102f79ba48f9','postgres','{postgres=X/postgres,supabase_auth_admin=X/postgres}'),
 ('private','mitsa_isolated_send_email_legacy','ff886c10125a10c6671a0b35c8849a7a9b5a377920c463da9d997b6379a1f274','postgres','{postgres=X/postgres,supabase_auth_admin=X/postgres}'),
 ('private','mitsa_persistent_capacity','125b6f7eeb250c0ecc554f699f6b00a55f8230dc6181f9d917c004ef9c5b5740','app_registration','{app_registration=X/app_registration}'),
 ('private','mitsa_persistent_health','362ddfac300500c3eff7913c29ddbeae5c156c1f5086aa30b7afad301aa4c947','app_registration','{app_registration=X/app_registration}'),
 ('private','mitsa_persistent_registration_policy','f60cf65dd0b618bf5168cc0cc43b95da2a4931af3e8295884b3a30dd9181a0ba','app_registration','{app_registration=X/app_registration,anon=X/app_registration,authenticated=X/app_registration}'),
 ('private','mitsa_registration_command','16a289aaa4617069aeb9a2e88c5ff3af3bcc9d2181b96178633a54d5cc4dc3b7','app_registration','{app_registration=X/app_registration,service_role=X/app_registration}'),
 ('private','mitsa_registration_stop','3503cb9ba95a592962d49a00ebc59a6ff4e4e0ae796681464a1557eb72c81155','app_registration','{app_registration=X/app_registration}'),
 ('private','mitsa_worker_acquire','f18de4bb59f259ae7bd607ac94429a8fa6ce3ab19f71bab3c6a245d35a7f69b5','app_registration','{app_registration=X/app_registration}'),
 ('private','mitsa_worker_claim','70d3665357acd050d66138889fa31d5e2baccbdc669d9a5ebb7bf9613fccab98','app_registration','{app_registration=X/app_registration}'),
 ('private','mitsa_worker_complete','95d4ad05c198f2313f2377c1f80fb3d13bac56dd18900551a9c7165ecc257399','app_registration','{app_registration=X/app_registration}'),
 ('private','mitsa_worker_heartbeat','ae0af63a63c2d014e8f84c11cac103c34596eebdb198f417c5b076b85a8132cc','app_registration','{app_registration=X/app_registration}')
 ) expected(schema_name,function_name,sha256,owner,acl) loop
  assert (select count(*)=1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=f.schema_name and p.proname=f.function_name),'function signature collision';
  select pg_get_userbyid(pr.proowner) owner,pr.proacl::text acl,encode(sha256(convert_to(pg_get_functiondef(pr.oid),'UTF8')),'hex') digest into observed
  from pg_proc pr join pg_namespace n on n.oid=pr.pronamespace where n.nspname=f.schema_name and pr.proname=f.function_name;
  assert observed.owner=f.owner and observed.acl is not distinct from f.acl and observed.digest=f.sha256,'recovered function drift';
 end loop;
end $preflight$;
do $$ begin assert not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','api') and p.proname='mitsa_registration_identity'),'helper collision'; end $$;
-- Only this private, fixed-query function reads managed identity columns.
-- Existing postgres privileges are used; no managed schema/table grant changes.
create function private.mitsa_registration_identity(p_mode text,p_email text,p_intent_id uuid default null,p_user_id uuid default null)
returns table(user_id uuid,intent_id uuid) language plpgsql stable security definer
set search_path='' set row_security=on as $identity$
declare matched_user uuid; matched_intent uuid;
begin
 if p_mode is null or p_mode not in ('pending','recovery') or p_email is null
 or p_email<>lower(btrim(p_email)) or length(p_email)>254
 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
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
grant execute on function private.mitsa_registration_identity(text,text,uuid,uuid) to app_registration;
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
    and exists(select 1 from private.mitsa_registration_identity('pending',address,registration_intents.id,registration_intents.provider_user_id)))
   or (p_action='renew-verification' and id=(p_payload->>'intentId')::uuid))
   order by created_at desc limit 1 for update;
  if not found or i.submission_id is null then return null; end if;
  if p_action='renew-verification' then
   if p_payload->'passwordProven' is distinct from 'true'::jsonb or p_payload->'accepted' is distinct from 'true'::jsonb
   or i.finalized_at is not null or i.provider_user_id is null
   or i.terms_id is distinct from (p_payload->>'termsId')::uuid or i.privacy_id is distinct from (p_payload->>'privacyId')::uuid
   or c.terms_id is distinct from i.terms_id or c.privacy_id is distinct from i.privacy_id
   or not exists(select 1 from private.mitsa_registration_identity('pending',address,i.id,i.provider_user_id)) then return null; end if;
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
   if i.provider_user_id is not null and not exists(select 1 from private.mitsa_registration_identity('pending',address,i.id,i.provider_user_id)) then return null; end if;
  elsif p_payload->>'action'='recovery' then
   select ap.* into a from private.mitsa_registration_identity('recovery',address) identity
     join private.account_registration_policy ap on ap.user_id=identity.user_id and ap.intent_id=identity.intent_id
     where not ap.emergency_blocked and ap.verified_at is not null;
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
do $acceptance$ begin
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
commit;
