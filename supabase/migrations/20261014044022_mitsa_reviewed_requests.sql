-- Rights and recovery requests, independent review and actual access/correction
-- execution. No operator is provisioned and no disposal/MFA reset is enabled.
do $$ begin assert (select marker='fireworks-foundation-proof-01a12e38' from foundation_probe.environment_identity where singleton), 'unapproved environment'; end $$;
grant create on schema private to app_workspace;
alter table private.account_requests add column details jsonb not null default '{}' check(jsonb_typeof(details)='object' and octet_length(details::text)<=8192);
alter table private.account_requests add column verified_email text;
alter table private.account_requests add column review_evidence text check(length(review_evidence)<=1000);
create unique index requests_one_active_kind on private.account_requests(user_id,kind,coalesce(business_id,'00000000-0000-0000-0000-000000000000'::uuid)) where status in ('pending','under-review','approved');
create table private.request_exports (
  request_id uuid primary key references private.account_requests(id),
  subject_id uuid not null,
  payload jsonb not null,
  payload_hash text not null check(payload_hash ~ '^[0-9a-f]{64}$'),
  access_until timestamptz not null default(now()+interval '24 hours'),
  created_at timestamptz not null default now()
);
create table private.request_receipts (
  request_id uuid primary key references private.account_requests(id),
  executor_id uuid not null,
  outcome jsonb not null,
  created_at timestamptz not null default now()
);
alter table private.request_exports enable row level security;
alter table private.request_exports force row level security;
alter table private.request_receipts enable row level security;
alter table private.request_receipts force row level security;
revoke all on private.request_exports,private.request_receipts from public,anon,authenticated,service_role;
grant select,insert on private.request_exports,private.request_receipts to app_workspace;
create policy workspace_exports_read on private.request_exports for select to app_workspace using(true);
create policy workspace_exports_insert on private.request_exports for insert to app_workspace with check(true);
create policy workspace_receipts_read on private.request_receipts for select to app_workspace using(true);
create policy workspace_receipts_insert on private.request_receipts for insert to app_workspace with check(true);

create function private.mitsa_operator_require(p_scope text) returns void
language plpgsql security invoker set search_path='' as $$ begin
  if not private.mitsa_recent_auth() or not exists(select 1 from private.operator_principals where user_id=private.current_actor() and active and revoked_at is null and scopes @> array[p_scope]) then raise exception 'operator authorization required' using errcode='42501'; end if;
end $$;
revoke all on function private.mitsa_operator_require(text) from public,anon,authenticated,service_role;
grant execute on function private.mitsa_operator_require(text) to app_workspace;

create function private.mitsa_operator_context() returns jsonb
language plpgsql stable security definer set search_path='' set row_security=on as $$ begin
  if private.current_actor() is null or not private.mitsa_mfa_ready() then return null; end if;
  return (select jsonb_build_object('scopes',scopes,'recent',private.mitsa_recent_auth()) from private.operator_principals where user_id=private.current_actor() and active and revoked_at is null);
end $$;
create function private.mitsa_account_requests() returns jsonb
language plpgsql security definer set search_path='' set row_security=on as $$ declare c jsonb:=private.mitsa_auth_context(); begin
  if c is null or c->'verified'<>'true' then raise exception 'verified account required' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'kind',r.kind,'status',r.status,'businessId',r.business_id,'requestedAt',r.requested_at,'reviewTarget',r.response_due_at,'decisionReason',r.decision_reason,'completedAt',r.completed_at,'exportAvailable',exists(select 1 from private.request_exports e where e.request_id=r.id and e.subject_id=r.user_id and e.access_until>now())) order by r.requested_at desc),'[]') from private.account_requests r where r.user_id=private.current_actor());
end $$;
create function private.mitsa_request_create(p_kind text,p_business uuid,p_details jsonb,p_key uuid) returns uuid
language plpgsql security definer set search_path='' set row_security=on as $$
declare c jsonb:=private.mitsa_auth_context(); actor uuid:=private.current_actor(); request_id uuid; fingerprint text; previous private.access_commands;
begin
  if c is null or c->'verified'<>'true' then raise exception 'verified account required' using errcode='42501'; end if;
  if p_kind is null or p_kind not in ('access','correction','deletion','workspace-closure','mfa-recovery') or p_key is null or p_details is null or jsonb_typeof(p_details)<>'object'
    or octet_length(p_details::text)>8192 or exists(select 1 from jsonb_object_keys(p_details) k where k not in ('reason','fullName'))
    or p_details ? 'reason' and (jsonb_typeof(p_details->'reason')<>'string' or length(p_details->>'reason')>2000)
    or p_kind='correction' and (jsonb_typeof(p_details->'fullName') is distinct from 'string' or length(btrim(p_details->>'fullName')) not between 1 and 120)
    or p_kind<>'correction' and p_details ? 'fullName' then raise exception 'invalid request' using errcode='22023'; end if;
  if p_kind='workspace-closure' then
    if p_business is null then raise exception 'workspace required' using errcode='22023'; end if;
    perform private.mitsa_require(p_business,'owner');
    if not private.mitsa_recent_auth() then raise exception 'recent authentication required' using errcode='42501'; end if;
  elsif p_business is not null then raise exception 'invalid request scope' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,8418));
  fingerprint:=encode(sha256(convert_to(jsonb_build_array('account-request',p_kind,p_business,p_details)::text,'UTF8')),'hex');
  select * into previous from private.access_commands where actor_id=actor and command_key=p_key;
  if found then if previous.request_hash<>fingerprint then raise exception 'idempotency conflict' using errcode='23505'; end if;return (previous.outcome->>'id')::uuid;end if;
  select id into request_id from private.account_requests where user_id=actor and kind=p_kind and business_id is not distinct from p_business and status in ('pending','under-review','approved');
  if found then return request_id; end if;
  if (select count(*) from private.account_requests where user_id=actor and requested_at>now()-interval '1 hour')>=5
    or (select count(*) from private.account_requests where user_id=actor and requested_at>now()-interval '1 day')>=20 then raise exception 'request rate limit' using errcode='54000'; end if;
  insert into private.account_requests(user_id,business_id,kind,details,verified_email) values(actor,p_business,p_kind,p_details,c->>'email') returning id into request_id;
  insert into private.request_events(request_id,actor_id,event) values(request_id,actor,'submitted');
  insert into private.access_commands values(actor,p_key,fingerprint,jsonb_build_object('id',request_id),now());
  perform private.mitsa_audit(p_business,'account.request-submitted',request_id,jsonb_build_object('kind',p_kind));
  return request_id;
end $$;
create function private.mitsa_operator_requests() returns jsonb
language plpgsql security definer set search_path='' set row_security=on as $$ declare scopes text[]; begin
  if not private.mitsa_recent_auth() then raise exception 'operator verification required' using errcode='42501'; end if;
  select p.scopes into scopes from private.operator_principals p where p.user_id=private.current_actor() and p.active and p.revoked_at is null;
  if scopes is null then raise exception 'operator authorization required' using errcode='42501'; end if;
  perform private.mitsa_audit(null,'support.cases-viewed');
  return (select coalesce(jsonb_agg(to_jsonb(cases)),'[]') from (select id,user_id,business_id,kind,status,details,requested_at,reviewer_id,decision_reason,completed_at from private.account_requests
    where (kind='mfa-recovery' and scopes @> array['mfa-recovery-review']) or (kind<>'mfa-recovery' and (scopes @> array['privacy-review'] or status='approved' and scopes @> array['privacy-execute'])) order by requested_at,id limit 100) cases);
end $$;
create function private.mitsa_request_review(p_request uuid,p_status text,p_reason text,p_evidence text) returns void
language plpgsql security definer set search_path='' set row_security=on as $$ declare r private.account_requests; actor uuid:=private.current_actor(); begin
  select * into r from private.account_requests where id=p_request for update;
  if not found or r.user_id=actor or r.status not in ('pending','under-review') then raise exception 'independent review required' using errcode='42501'; end if;
  perform private.mitsa_operator_require(case when r.kind='mfa-recovery' then 'mfa-recovery-review' else 'privacy-review' end);
  if p_status is null or p_status not in ('under-review','approved','rejected') or p_reason is null or length(btrim(p_reason)) not between 10 and 1000 then raise exception 'review explanation required' using errcode='22023'; end if;
  if p_status='approved' and (r.status<>'under-review' or p_evidence is null or length(btrim(p_evidence)) not between 12 and 1000) then raise exception 'independent verification evidence required' using errcode='22023'; end if;
  update private.account_requests set status=p_status,reviewer_id=actor,decision_reason=btrim(p_reason),review_evidence=case when p_status='approved' then btrim(p_evidence) else review_evidence end,decided_at=case when p_status in ('approved','rejected') then now() else null end where id=r.id;
  insert into private.request_events(request_id,actor_id,event) values(r.id,actor,p_status);
  perform private.mitsa_audit(r.business_id,'account.request-reviewed',r.id,jsonb_build_object('status',p_status));
end $$;
create function private.mitsa_request_execute(p_request uuid) returns jsonb
language plpgsql security definer set search_path='' set row_security=on as $$ declare r private.account_requests; payload jsonb; outcome jsonb; actor uuid:=private.current_actor(); begin
  perform private.mitsa_operator_require('privacy-execute');
  select * into r from private.account_requests where id=p_request for update;
  if not found or r.user_id=actor or r.reviewer_id is null or r.reviewer_id=r.user_id or r.reviewer_id=actor then raise exception 'independent authorization required' using errcode='42501'; end if;
  if r.status='completed' then return (select x.outcome from private.request_receipts x where x.request_id=r.id); end if;
  if r.status<>'approved' then raise exception 'approved request required' using errcode='42501'; end if;
  if not exists(select 1 from private.operator_principals p where p.user_id=r.reviewer_id and p.active and p.revoked_at is null and p.scopes @> array['privacy-review']) then raise exception 'review authorization no longer active' using errcode='42501'; end if;
  if r.kind='access' then
    payload:=jsonb_build_object('userId',r.user_id,'emailAtRequest',r.verified_email,'profile',(select jsonb_build_object('fullName',p.full_name) from private.account_profiles p where p.user_id=r.user_id),
      'memberships',(select coalesce(jsonb_agg(jsonb_build_object('businessId',m.business_id,'businessName',b.name,'role',m.role,'active',m.active,'locationIds',(select coalesce(jsonb_agg(a.shop_id),'[]') from private.shop_assignments a where a.user_id=r.user_id and a.business_id=m.business_id))),'[]') from private.memberships m join private.businesses b on b.id=m.business_id where m.user_id=r.user_id),
      'agreements',(select coalesce(jsonb_agg(jsonb_build_object('version',v.version,'hash',v.content_hash,'acceptedAt',a.accepted_at,'source',a.source)),'[]') from private.legal_acceptances a join private.legal_versions v on v.id=a.version_id where a.user_id=r.user_id),
      'createdAt',now());
    insert into private.request_exports(request_id,subject_id,payload,payload_hash) values(r.id,r.user_id,payload,encode(sha256(convert_to(payload::text,'UTF8')),'hex'));
    outcome:=jsonb_build_object('kind','access','exportId',r.id);
  elsif r.kind='correction' then
    if length(btrim(r.details->>'fullName')) not between 1 and 120 then raise exception 'invalid correction' using errcode='22023'; end if;
    insert into private.account_profiles(user_id,full_name) values(r.user_id,btrim(r.details->>'fullName')) on conflict(user_id) do update set full_name=excluded.full_name;
    outcome:=jsonb_build_object('kind','correction','profileUpdated',true);
  else raise exception 'separately authorized recovery or disposal execution required' using errcode='42501'; end if;
  insert into private.request_receipts(request_id,executor_id,outcome) values(r.id,actor,outcome);
  update private.account_requests set status='completed',completed_at=now() where id=r.id;
  insert into private.request_events(request_id,actor_id,event) values(r.id,actor,'completed');
  perform private.mitsa_audit(r.business_id,'account.request-completed',r.id,jsonb_build_object('kind',r.kind));
  return outcome;
end $$;
create function private.mitsa_request_export(p_request uuid) returns jsonb
language plpgsql security definer set search_path='' set row_security=on as $$ declare c jsonb:=private.mitsa_auth_context(); result jsonb; begin
  if c is null or c->'verified'<>'true' then raise exception 'verified account required' using errcode='42501'; end if;
  select e.payload into result from private.request_exports e join private.account_requests r on r.id=e.request_id where e.request_id=p_request and e.subject_id=private.current_actor() and e.access_until>now() and r.status='completed' and r.kind='access';
  if not found then raise exception 'export unavailable' using errcode='42501'; end if;
  perform private.mitsa_audit(null,'privacy.export-downloaded',p_request);return result;
end $$;
create function private.mitsa_disposal_preview(p_request uuid) returns jsonb
language plpgsql security definer set search_path='' set row_security=on as $$ declare r private.account_requests; owner_count integer; hold_count integer; begin
  perform private.mitsa_operator_require('privacy-execute');
  select * into r from private.account_requests where id=p_request and kind in ('deletion','workspace-closure') and status='approved';
  if not found or r.user_id=private.current_actor() then raise exception 'approved independent request required' using errcode='42501'; end if;
  select count(*) into owner_count from private.memberships where user_id=r.user_id and role='owner' and active;
  select count(*) into hold_count from private.legal_holds where released_at is null and subject_id in (r.user_id,r.business_id);
  return jsonb_build_object('eligible',false,'disposalGateOpen',(select disposal_enabled from private.release_gates where singleton),'activeOwnerships',owner_count,'legalHolds',hold_count,'reason','Disposal execution requires separate approval and an approved retention/backup procedure. Review does not delete data or complete the request.');
end $$;

do $$ declare f record; begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in ('mitsa_operator_context','mitsa_account_requests','mitsa_request_create','mitsa_operator_requests','mitsa_request_review','mitsa_request_execute','mitsa_request_export','mitsa_disposal_preview') loop
    execute format('alter function %s owner to app_workspace',f.signature);
    execute format('revoke all on function %s from public,anon,service_role',f.signature);
    execute format('grant execute on function %s to authenticated',f.signature);
  end loop;
end $$;
create function api.mitsa_operator_context() returns jsonb language sql security invoker set search_path='' as $$ select private.mitsa_operator_context() $$;
create function api.mitsa_account_requests() returns jsonb language sql security invoker set search_path='' as $$ select private.mitsa_account_requests() $$;
create function api.mitsa_request_create(p_kind text,p_business uuid,p_details jsonb,p_key uuid) returns uuid language sql security invoker set search_path='' as $$ select private.mitsa_request_create(p_kind,p_business,p_details,p_key) $$;
create function api.mitsa_operator_requests() returns jsonb language sql security invoker set search_path='' as $$ select private.mitsa_operator_requests() $$;
create function api.mitsa_request_review(p_request uuid,p_status text,p_reason text,p_evidence text) returns void language sql security invoker set search_path='' as $$ select private.mitsa_request_review(p_request,p_status,p_reason,p_evidence) $$;
create function api.mitsa_request_execute(p_request uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.mitsa_request_execute(p_request) $$;
create function api.mitsa_request_export(p_request uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.mitsa_request_export(p_request) $$;
create function api.mitsa_disposal_preview(p_request uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.mitsa_disposal_preview(p_request) $$;
do $$ declare f record; begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='api' and p.proname in ('mitsa_operator_context','mitsa_account_requests','mitsa_request_create','mitsa_operator_requests','mitsa_request_review','mitsa_request_execute','mitsa_request_export','mitsa_disposal_preview') loop
    execute format('revoke all on function %s from public,anon,service_role',f.signature);
    execute format('grant execute on function %s to authenticated',f.signature);
  end loop;
end $$;
revoke create on schema private from app_workspace;
notify pgrst,'reload schema';
