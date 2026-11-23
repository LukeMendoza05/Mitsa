-- STAGE C CANDIDATE. NOT INSTALLED. All new controls start disabled.
-- Dependencies: installed Mitsa workspace, registration-intent, encrypted-mail,
-- developer recipient, pilot and development-recovery migrations.
-- This file never writes auth.* or changes a business RLS policy.
begin;
do $$ begin
 assert (select marker='fireworks-foundation-proof-01a12e38' from foundation_probe.environment_identity where singleton), 'unapproved target';
 assert not exists(select 1 from pg_trigger where tgrelid='auth.refresh_tokens'::regclass and not tgisinternal), 'unexpected Auth trigger';
end $$;

create role app_registration nologin nosuperuser nobypassrls nocreatedb nocreaterole noinherit;
grant app_registration to postgres;
grant usage,create on schema private to app_registration;
grant usage on schema api,auth to app_registration;
grant select(id,email,email_confirmed_at,deleted_at,banned_until,is_anonymous) on auth.users to app_registration;

create table private.registration_control(
 singleton boolean primary key default true check(singleton),
 profile text not null default 'isolated-development' check(profile in ('isolated-development','consenting-pilot','production')),
 project_ref text not null default 'mjtejwafxriwntweussc' check(project_ref='mjtejwafxriwntweussc'),
 origin text not null default 'http://127.0.0.1:3000' check(origin='http://127.0.0.1:3000'),
 admission_enabled boolean not null default false, delivery_enabled boolean not null default false,
 approval_generation uuid, stopped_at timestamptz,
 terms_id uuid references private.legal_versions(id),privacy_id uuid references private.legal_versions(id),
 session_policy text not null default 'strict' check(session_policy in ('strict','bounded-development-1h')),
 session_policy_ready boolean not null default false,
 worker_id uuid,worker_until timestamptz,heartbeat_at timestamptz,
 transport_ready boolean not null default false,
 approved_sender_sha256 text check(approved_sender_sha256 ~ '^[0-9a-f]{64}$'),
 hourly_budget integer not null default 10 check(hourly_budget between 1 and 10),
 daily_budget integer not null default 20 check(daily_budget between 1 and 20),
 otp_digits integer not null default 6 check(otp_digits=6),otp_expiry_seconds integer not null default 3600 check(otp_expiry_seconds=3600),
 check(not(admission_enabled or delivery_enabled) or (approval_generation is not null and stopped_at is null)),
 check(profile<>'production' or session_policy='strict')
);
insert into private.registration_control(singleton) values(true);

alter table private.registration_intents
 add column submission_id uuid unique,
 add column submission_fingerprint text check(submission_fingerprint ~ '^[0-9a-f]{64}$'),
 add column privacy_id uuid references private.legal_versions(id),
 add column creation_deadline timestamptz,
 add column provider_claimed_at timestamptz,
 add column renewed_at timestamptz,
 add column submission_state text check(submission_state in ('prepared','submitted','pending-verification','uncertain','expired','verified')),
 add column approval_generation uuid;
alter table private.registration_intents
 add column registration_profile text check(registration_profile in ('isolated-development','consenting-pilot','production')),
 add column registration_session_policy text check(registration_session_policy in ('strict','bounded-development-1h'));
alter table private.registration_intents add constraint persistent_submission_complete check(
 submission_id is null or (submission_fingerprint is not null and privacy_id is not null and creation_deadline is not null
 and submission_state is not null and approval_generation is not null and registration_profile is not null and registration_session_policy is not null));

-- The Before User Created hook assigns this BEFORE auth.users insertion.
-- Deliberately no FK to the future provider row, nor to prunable intent history.
create table private.account_registration_policy(
 user_id uuid primary key,intent_id uuid not null unique,
 profile text not null check(profile in ('isolated-development','consenting-pilot','production')),
 terms_id uuid not null references private.legal_versions(id),privacy_id uuid not null references private.legal_versions(id),
 accepted_at timestamptz not null,
 session_policy text not null check(session_policy in ('strict','bounded-development-1h')),
 assigned_at timestamptz not null default statement_timestamp(),
 verified_at timestamptz,
 emergency_blocked boolean not null default false,
 check(profile<>'production' or session_policy='strict')
);
create table private.auth_mail_dispatch(
 id uuid primary key default gen_random_uuid(),request_key uuid not null unique,action text not null check(action in ('signup','recovery')),
 recipient_hash text not null check(recipient_hash ~ '^[0-9a-f]{64}$'),
 intent_id uuid not null,provider_user_id uuid,
 generation uuid not null,state text not null default 'reserved'
 check(state in ('reserved','queued','claimed','smtp-accepted','cancelled','superseded','expired','failed','unconfirmed')),
 created_at timestamptz not null default statement_timestamp(),
 authorize_until timestamptz not null default(statement_timestamp()+interval '2 minutes'),
 consumed_at timestamptz,capture_id uuid unique references private.isolated_auth_mail(id),
 claim_worker_id uuid,claimed_at timestamptz,completed_at timestamptz,
 failure_category text check(failure_category in ('transport','authentication','configuration','timeout','shutdown','expired','superseded')),
 check(authorize_until<=created_at+interval '2 minutes'),
 check((state not in ('queued','claimed','smtp-accepted','unconfirmed')) or capture_id is not null),
 check((state not in ('claimed','smtp-accepted','unconfirmed')) or claimed_at is not null)
);
create index auth_mail_dispatch_budget on private.auth_mail_dispatch(created_at,recipient_hash);
create index auth_mail_dispatch_pending on private.auth_mail_dispatch(state,created_at);

do $$ declare t text; begin
 foreach t in array array['registration_control','account_registration_policy','auth_mail_dispatch'] loop
  execute format('alter table private.%I enable row level security',t);
  execute format('alter table private.%I force row level security',t);
  execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);
  execute format('grant select,insert,update on private.%I to app_registration',t);
  execute format('create policy registration_command on private.%I for all to app_registration using(true) with check(true)',t);
 end loop;
end $$;
revoke insert,update on private.account_registration_policy from app_registration;
grant select,insert,update on private.registration_intents to app_registration;
create policy persistent_intents on private.registration_intents for all to app_registration using(true) with check(true);
grant select,insert on private.registration_requests to app_registration;
create policy persistent_requests_read on private.registration_requests for select to app_registration using(true);
create policy persistent_requests_insert on private.registration_requests for insert to app_registration with check(true);
grant select on private.legal_versions,private.isolated_auth_mail,private.pilot_mail_deliveries to app_registration;
create policy persistent_versions on private.legal_versions for select to app_registration using(true);
create policy persistent_captures on private.isolated_auth_mail for select to app_registration using(true);
create policy persistent_prior_deliveries on private.pilot_mail_deliveries for select to app_registration using(true);

create function private.mitsa_persistent_health() returns boolean language sql stable security invoker set search_path='' as $$
 select coalesce((select approval_generation is not null and stopped_at is null and transport_ready
 and worker_id is not null and worker_until>statement_timestamp()
 and heartbeat_at between statement_timestamp()-interval '15 seconds' and statement_timestamp()+interval '1 second'
 from private.registration_control where singleton),false)
$$;
create function private.mitsa_persistent_capacity(p_recipient_hash text default null) returns boolean
language sql stable security invoker set search_path='' as $$
 select coalesce((select
  (select count(*) from private.auth_mail_dispatch where created_at>statement_timestamp()-interval '1 hour' and state not in ('cancelled','expired','superseded'))
   +(select count(*) from private.pilot_mail_deliveries where created_at>statement_timestamp()-interval '1 hour')<c.hourly_budget
  and (select count(*) from private.auth_mail_dispatch where created_at>statement_timestamp()-interval '24 hours' and state not in ('cancelled','expired','superseded'))
   +(select count(*) from private.pilot_mail_deliveries where created_at>statement_timestamp()-interval '24 hours')<c.daily_budget
  and (p_recipient_hash is null or not exists(select 1 from private.auth_mail_dispatch where recipient_hash=p_recipient_hash and created_at>statement_timestamp()-interval '1 minute')
   and not exists(select 1 from private.pilot_mail_deliveries where recipient_hash=p_recipient_hash and created_at>statement_timestamp()-interval '1 minute'))
 from private.registration_control c where singleton),false)
$$;
create function private.mitsa_persistent_registration_policy() returns jsonb
language plpgsql stable security definer set search_path='' set row_security=on as $$
declare c private.registration_control; t private.legal_versions; p private.legal_versions; bundle jsonb; ready boolean;
begin
 select * into c from private.registration_control where singleton;
 select * into t from private.legal_versions where id=c.terms_id and kind='terms';
 select * into p from private.legal_versions where id=c.privacy_id and kind='privacy';
 if t.id is not null and p.id is not null and t.status=p.status
 and ((c.profile in ('isolated-development','consenting-pilot') and t.status='test')
 or (c.profile='production' and t.status='published' and t.effective_at<=statement_timestamp() and p.effective_at<=statement_timestamp())) then
  bundle:=jsonb_build_object('termsId',t.id,'privacyId',p.id,'termsVersion',t.version,'privacyVersion',p.version,'termsContent',t.content,'privacyContent',p.content,'termsHash',t.content_hash,'privacyHash',p.content_hash,'status',t.status);
 end if;
 ready:=private.mitsa_persistent_health() and private.mitsa_persistent_capacity();
 return jsonb_build_object('version',1,'policy',bundle,
 'admission',case when not c.admission_enabled or c.approval_generation is null or c.stopped_at is not null then 'closed'
 when bundle is null or not c.session_policy_ready then 'unavailable' when not c.delivery_enabled or not ready then 'paused' else 'available' end,
 'delivery',case when not c.delivery_enabled or c.approval_generation is null or c.stopped_at is not null then 'closed'
 when bundle is null then 'unavailable' when not ready then 'paused' else 'available' end);
end $$;
create function api.mitsa_persistent_registration_policy() returns jsonb language sql security invoker set search_path='' as $$ select private.mitsa_persistent_registration_policy() $$;

-- All service commands require an independently authenticated private Edge
-- signature; browser/anon roles cannot execute this SQL entrypoint.
create function private.mitsa_registration_command(p_action text,p_payload jsonb,p_request_hash text,p_signed_at timestamptz) returns jsonb
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
create function api.mitsa_registration_command(p_action text,p_payload jsonb,p_request_hash text,p_signed_at timestamptz) returns jsonb
language sql security invoker set search_path='' as $$ select private.mitsa_registration_command(p_action,p_payload,p_request_hash,p_signed_at) $$;

-- Worker commands are NOT Data API endpoints and NOT executable by service_role.
-- The isolated operator connects separately; no DB/SMTP credentials enter Next.
create function private.mitsa_worker_acquire(p_generation uuid,p_worker uuid) returns boolean
language plpgsql security definer set search_path='' set row_security=on as $$ declare c private.registration_control; begin
 select * into c from private.registration_control where singleton for update;
 if p_generation is null or p_worker is null or c.approval_generation is distinct from p_generation or c.stopped_at is not null
 or not c.delivery_enabled or (c.worker_until>statement_timestamp() and c.worker_id is distinct from p_worker) then return false; end if;
 -- Never automatically retry a job that may already have reached SMTP.
 update private.auth_mail_dispatch set state='unconfirmed',completed_at=statement_timestamp(),failure_category='timeout'
  where state='claimed' and claim_worker_id is distinct from p_worker;
 update private.registration_control set worker_id=p_worker,worker_until=statement_timestamp()+interval '60 seconds',heartbeat_at=statement_timestamp(),transport_ready=false where singleton;
 return true;
end $$;
create function private.mitsa_worker_heartbeat(p_generation uuid,p_worker uuid,p_ready boolean) returns boolean
language plpgsql security definer set search_path='' set row_security=on as $$ begin
 update private.registration_control set heartbeat_at=statement_timestamp(),worker_until=statement_timestamp()+interval '60 seconds',transport_ready=p_ready
 where singleton and approval_generation=p_generation and worker_id=p_worker and stopped_at is null and delivery_enabled and worker_until>statement_timestamp();
 return found;
end $$;
create function private.mitsa_worker_claim(p_generation uuid,p_worker uuid) returns jsonb
language plpgsql security definer set search_path='' set row_security=on as $$ declare c private.registration_control; d private.auth_mail_dispatch; result jsonb; begin
 select * into c from private.registration_control where singleton for update;
 if c.approval_generation is distinct from p_generation or c.worker_id is distinct from p_worker or not c.delivery_enabled
  or not private.mitsa_persistent_health() then return null; end if;
 update private.auth_mail_dispatch set state='expired',completed_at=statement_timestamp(),failure_category='expired'
 where state in ('reserved','queued') and (generation<>p_generation or (state='reserved' and authorize_until<=statement_timestamp())
  or (state='queued' and (select created_at from private.isolated_auth_mail where id=capture_id)<=statement_timestamp()-interval '3540 seconds'));
 select * into d from private.auth_mail_dispatch where generation=p_generation and state='queued' order by created_at,id limit 1 for update skip locked;
 if not found then return null; end if;
 if exists(select 1 from private.auth_mail_dispatch newer where newer.recipient_hash=d.recipient_hash and newer.action=d.action and newer.consumed_at>d.consumed_at) then
  update private.auth_mail_dispatch set state='superseded',completed_at=statement_timestamp(),failure_category='superseded' where id=d.id; return null;
 end if;
 update private.auth_mail_dispatch set state='claimed',claim_worker_id=p_worker,claimed_at=statement_timestamp() where id=d.id;
 select jsonb_build_object('id',d.id,'captureId',d.capture_id,'action',d.action,'encryptedPayload',encode(m.encrypted_payload,'base64'),
  'createdAt',m.created_at,'databaseNow',statement_timestamp(),'expiresAt',m.created_at+interval '3600 seconds','recipientHash',d.recipient_hash) into result
 from private.isolated_auth_mail m where m.id=d.capture_id;
 return result;
end $$;
create function private.mitsa_worker_complete(p_generation uuid,p_worker uuid,p_dispatch uuid,p_state text,p_category text default null) returns boolean
language plpgsql security definer set search_path='' set row_security=on as $$ begin
 if p_state not in ('smtp-accepted','failed','unconfirmed') then return false; end if;
 update private.auth_mail_dispatch set state=p_state,completed_at=statement_timestamp(),failure_category=p_category
 where id=p_dispatch and state='claimed' and claim_worker_id=p_worker and generation=p_generation
 and exists(select 1 from private.registration_control where singleton and approval_generation=p_generation and worker_id=p_worker and worker_until>statement_timestamp() and stopped_at is null);
 return found;
end $$;
create function private.mitsa_registration_stop(p_delivery boolean default false) returns void
language plpgsql security definer set search_path='' set row_security=on as $$ begin
 update private.registration_control set admission_enabled=false,
 delivery_enabled=case when p_delivery then false else delivery_enabled end,
 approval_generation=case when p_delivery then null else approval_generation end,
 stopped_at=case when p_delivery then statement_timestamp() else stopped_at end,
 transport_ready=case when p_delivery then false else transport_ready end where singleton;
 if p_delivery then update private.auth_mail_dispatch set state='cancelled',completed_at=statement_timestamp(),failure_category='shutdown' where state in ('reserved','queued'); end if;
 if p_delivery then update private.auth_mail_dispatch set state='unconfirmed',completed_at=statement_timestamp(),failure_category='shutdown' where state='claimed'; end if;
end $$;

do $$ declare f record; begin
 for f in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='private' and (p.proname like 'mitsa_persistent_%' or p.proname like 'mitsa_worker_%' or p.proname in ('mitsa_registration_command','mitsa_registration_stop')) loop
  execute format('alter function %s owner to app_registration',f.signature);
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 end loop;
end $$;
grant execute on function private.mitsa_persistent_registration_policy() to anon,authenticated;
grant execute on function private.mitsa_registration_command(text,jsonb,text,timestamptz) to service_role;
revoke all on function api.mitsa_persistent_registration_policy(),api.mitsa_registration_command(text,jsonb,text,timestamptz) from public,anon,authenticated,service_role;
grant execute on function api.mitsa_persistent_registration_policy() to anon,authenticated;
grant execute on function api.mitsa_registration_command(text,jsonb,text,timestamptz) to service_role;
revoke create on schema private from app_registration;
notify pgrst,'reload schema';
commit;
