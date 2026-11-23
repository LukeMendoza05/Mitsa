-- Approved isolated implementation. Deliberately refuses any other environment.
do $$ begin
  assert (select marker='fireworks-foundation-proof-01a12e38' from foundation_probe.environment_identity where singleton), 'unapproved environment';
  assert not exists(select 1 from private.businesses b where (select count(*) from private.memberships m where m.business_id=b.id and m.active and m.role='owner')<>1), 'resolve ownership before migration';
end $$;

create role app_workspace nologin nobypassrls nosuperuser nocreatedb nocreaterole noinherit;
grant app_workspace to postgres;
grant usage, create on schema private to app_workspace;
-- ALTER FUNCTION OWNER requires the incoming owner to have CREATE temporarily.
grant create on schema private to app_authz;
grant usage on schema api to app_workspace;
grant execute on function private.current_actor() to app_workspace;

-- These are synthetic isolated memberships only. A real manager-to-Admin
-- promotion requires separate Owner approval; this migration cannot run there.
alter table private.memberships drop constraint memberships_role_check;
update private.memberships set role=case role when 'manager' then 'admin' when 'cashier' then 'staff' else role end;
alter table private.memberships add constraint memberships_role_check check(role in ('owner','admin','staff'));
alter table private.memberships add column joined_at timestamptz not null default now();
alter table private.businesses
  add column slug text,
  add column country text not null default 'PH' check(country='PH'),
  add column currency text not null default 'PHP' check(currency='PHP'),
  add column timezone text not null default 'Asia/Manila' check(timezone='Asia/Manila'),
  add column status text not null default 'active' check(status in ('active','suspended','closed')),
  add column primary_owner_id uuid,
  add column admin_financial_access boolean not null default false,
  add column created_at timestamptz not null default now();
update private.businesses b set slug='workspace-'||b.id::text,
  primary_owner_id=(select user_id from private.memberships m where m.business_id=b.id and m.active and m.role='owner');
alter table private.businesses alter column slug set not null;
alter table private.businesses alter column slug set default ('workspace-'||gen_random_uuid()::text);
alter table private.businesses add constraint businesses_slug_key unique(slug);
alter table private.businesses add constraint businesses_slug_format check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug)<=90);
alter table private.businesses add constraint primary_owner_membership foreign key(id,primary_owner_id)
  references private.memberships(business_id,user_id) deferrable initially deferred;
create unique index memberships_one_active_owner on private.memberships(business_id) where active and role='owner';
alter table private.shops add column kind text not null default 'shop' check(kind in ('shop','warehouse'));
alter table private.shops add column active boolean not null default true;

create table private.account_profiles(
  user_id uuid primary key references auth.users(id), full_name text not null check(length(full_name) between 1 and 120),
  created_at timestamptz not null default now(), deletion_requested_at timestamptz
);
create table private.account_security(
  user_id uuid primary key references auth.users(id), initialized boolean not null default false,
  recovery_locked boolean not null default false, generation integer not null default 1 check(generation>0)
);
create table private.factor_bindings(
  user_id uuid not null references private.account_security(user_id), factor_id uuid not null,
  generation integer not null, bound_at timestamptz not null default now(), revoked_at timestamptz,
  primary key(user_id,factor_id)
);
create table private.security_permits(
  id uuid primary key default gen_random_uuid(), user_id uuid not null references private.account_security(user_id),
  session_id uuid not null, generation integer not null, trusted_factor_id uuid,
  action text not null check(action in ('enroll','disable','remove','recovery')),
  expires_at timestamptz not null default (now()+interval '5 minutes'), consumed_at timestamptz
);
create table private.access_audit(
  id uuid primary key default gen_random_uuid(), business_id uuid references private.businesses(id), actor_id uuid,
  event text not null check(length(event) between 1 and 80), target_id uuid,
  detail jsonb not null default '{}' check(jsonb_typeof(detail)='object'), created_at timestamptz not null default now()
);
create index access_audit_workspace_time on private.access_audit(business_id,created_at desc);
create table private.access_commands(
  actor_id uuid not null, command_key uuid not null, request_hash text not null,
  outcome jsonb not null, created_at timestamptz not null default now(), primary key(actor_id,command_key)
);
create table private.workspace_invitations(
  id uuid primary key default gen_random_uuid(), business_id uuid not null references private.businesses(id),
  email text not null check(email=lower(btrim(email)) and length(email)<=254),
  role text not null check(role in ('admin','staff')), invited_by uuid not null,
  token_hash text unique check(token_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending' check(status in ('pending','accepted','revoked','expired')),
  issued_at timestamptz not null default now(), expires_at timestamptz not null default(now()+interval '7 days'),
  resolved_at timestamptz, accepted_by uuid,
  unique(id,business_id),
  check(expires_at=issued_at+interval '7 days')
);
create index invitation_workspace_status on private.workspace_invitations(business_id,status);
create table private.invitation_locations(
  invitation_id uuid not null, business_id uuid not null, shop_id uuid not null,
  primary key(invitation_id,shop_id), foreign key(business_id,shop_id) references private.shops(business_id,id)
  ,foreign key(invitation_id,business_id) references private.workspace_invitations(id,business_id)
);
create table private.ownership_transfers(
  id uuid primary key default gen_random_uuid(), business_id uuid not null references private.businesses(id),
  outgoing_id uuid not null, incoming_id uuid not null, remove_outgoing boolean not null default false,
  status text not null default 'pending' check(status in ('pending','completed','cancelled','expired')),
  created_at timestamptz not null default now(), expires_at timestamptz not null default(now()+interval '24 hours'),
  outgoing_confirmed_at timestamptz not null default now(), incoming_confirmed_at timestamptz, completed_at timestamptz,
  check(outgoing_id<>incoming_id)
);
create unique index ownership_one_pending on private.ownership_transfers(business_id) where status='pending';
create table private.legal_versions(
  id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('terms','privacy','cookies')),
  version text not null, content text not null, content_hash text not null check(content_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'draft' check(status in ('draft','test','published')),
  approved_at timestamptz, effective_at timestamptz, created_at timestamptz not null default now(),
  unique(kind,version), check(status<>'published' or (approved_at is not null and effective_at is not null))
);
create table private.legal_acceptances(
  user_id uuid not null, version_id uuid not null references private.legal_versions(id),
  accepted_at timestamptz not null default now(), source text not null check(source in ('registration','first-access','renewal')),
  primary key(user_id,version_id)
);
create table private.release_gates(
  singleton boolean primary key default true check(singleton),
  registration_enabled boolean not null default false, external_mail_enabled boolean not null default false,
  legal_publication_enabled boolean not null default false, disposal_enabled boolean not null default false,
  eligibility_approved boolean not null default false, test_terms_id uuid references private.legal_versions(id)
);
insert into private.release_gates(singleton) values(true);
create table private.registration_intents(
  id uuid primary key default gen_random_uuid(), email text not null, full_name text not null,
  nonce_hash text unique not null check(nonce_hash ~ '^[0-9a-f]{64}$'),
  terms_id uuid not null references private.legal_versions(id), accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(), expires_at timestamptz not null default(now()+interval '24 hours'),
  provider_user_id uuid, finalized_at timestamptz
);
create table private.operator_principals(
  user_id uuid primary key references auth.users(id), active boolean not null default false,
  scopes text[] not null default '{}', created_at timestamptz not null default now(), revoked_at timestamptz
);
create table private.account_requests(
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  business_id uuid references private.businesses(id),
  kind text not null check(kind in ('access','correction','deletion','workspace-closure','mfa-recovery')),
  status text not null default 'pending' check(status in ('pending','under-review','approved','rejected','completed')),
  requested_at timestamptz not null default now(), response_due_at timestamptz not null default(now()+interval '15 days'),
  reviewer_id uuid, decision_reason text, decided_at timestamptz, completed_at timestamptz,
  check(status<>'completed' or completed_at is not null), check(reviewer_id is null or reviewer_id<>user_id)
);
create table private.request_events(
  id uuid primary key default gen_random_uuid(), request_id uuid not null references private.account_requests(id),
  actor_id uuid, event text not null, created_at timestamptz not null default now()
);
create table private.notification_outbox(
  id uuid primary key default gen_random_uuid(), business_id uuid references private.businesses(id), recipient_id uuid,
  template text not null, event_key text unique not null, data jsonb not null default '{}',
  status text not null default 'queued' check(status in ('queued','processing','delivered','failed','captured')),
  attempts integer not null default 0 check(attempts between 0 and 5),
  available_at timestamptz not null default now(), lease_until timestamptz,
  created_at timestamptz not null default now(), resolved_at timestamptz
);
create table private.retention_rules(
  category text primary key, policy_version text not null, rules jsonb not null,
  status text not null default 'proposed' check(status in ('proposed','approved')), approved_at timestamptz,
  check(status<>'approved' or approved_at is not null)
);
create table private.legal_holds(
  id uuid primary key default gen_random_uuid(), category text not null references private.retention_rules(category),
  subject_id uuid not null, reason text not null, authority text not null, review_at timestamptz not null,
  created_at timestamptz not null default now(), released_at timestamptz
);
create table private.abuse_windows(
  bucket_hash text not null, action text not null, window_start timestamptz not null,
  attempts integer not null check(attempts>0), primary key(bucket_hash,action,window_start)
);

-- No new business code owns tables, bypasses RLS, or reads managed Auth.
do $$ declare t record; begin
  for t in select tablename from pg_tables where schemaname='private' loop
    execute format('alter table private.%I enable row level security',t.tablename);
    execute format('alter table private.%I force row level security',t.tablename);
  end loop;
  for t in select unnest(array['businesses','shops','memberships','shop_assignments','account_profiles','account_security',
    'factor_bindings','security_permits','access_audit','access_commands','workspace_invitations','invitation_locations',
    'ownership_transfers','legal_versions','legal_acceptances','release_gates','registration_intents','operator_principals',
    'account_requests','request_events','notification_outbox','retention_rules','legal_holds','abuse_windows']) as name loop
    execute format('grant select, insert, update, delete on private.%I to app_workspace',t.name);
    execute format('create policy workspace_command on private.%I to app_workspace using(true) with check(true)',t.name);
  end loop;
end $$;
grant select on private.businesses,private.account_security,private.factor_bindings to app_authz;
create policy helper_businesses on private.businesses for select to app_authz using(true);
create policy helper_security on private.account_security for select to app_authz using(true);
create policy helper_factors on private.factor_bindings for select to app_authz using(true);

-- Authentication-only adapter: current actor only; no arbitrary-user argument,
-- factor secrets, membership data or tenant lookup. Auth remains platform-owned.
create function private.mitsa_auth_context() returns jsonb
language plpgsql stable security definer set search_path='' set row_security=on
as $$ declare actor uuid:=private.current_actor(); claims jsonb; result jsonb; begin
  if actor is null then return null; end if;
  claims:=current_setting('request.jwt.claims',true)::jsonb;
  select jsonb_build_object('userId',actor,'email',lower(u.email),'verified',u.email_confirmed_at is not null,
    'sessionId',s.id,'factorId',s.factor_id,'aal',claims->>'aal',
    'verifiedFactors',coalesce((select jsonb_agg(f.id) from auth.mfa_factors f where f.user_id=actor and f.status='verified' and f.factor_type='totp'),'[]'),
    'passwordAt',(select max((v->>'timestamp')::numeric) from jsonb_array_elements(coalesce(claims->'amr','[]')) v where v->>'method'='password'),
    'totpAt',(select max((v->>'timestamp')::numeric) from jsonb_array_elements(coalesce(claims->'amr','[]')) v where v->>'method'='totp'))
  into result from auth.users u join auth.sessions s on s.user_id=u.id where u.id=actor and s.id=(claims->>'session_id')::uuid;
  return result;
exception when invalid_text_representation or numeric_value_out_of_range then return null;
end $$;
revoke all on function private.mitsa_auth_context() from public,anon,authenticated;
grant execute on function private.mitsa_auth_context() to app_authz,app_workspace;

create function private.mitsa_mfa_ready() returns boolean
language sql stable security definer set search_path='' set row_security=on
as $$ select coalesce((
  select c->>'aal'='aal2' and c->'verified'='true' and not s.recovery_locked and exists(
    select 1 from private.factor_bindings b where b.user_id=s.user_id and b.factor_id=(c->>'factorId')::uuid
      and b.revoked_at is null and b.generation=s.generation and c->'verifiedFactors' @> jsonb_build_array(b.factor_id)
  ) from private.account_security s cross join lateral(select private.mitsa_auth_context() c) ctx where s.user_id=private.current_actor()
),false) $$;
alter function private.mitsa_mfa_ready() owner to app_authz;
revoke all on function private.mitsa_mfa_ready() from public,anon;
grant execute on function private.mitsa_mfa_ready() to app_workspace,authenticated,app_command;

create function private.mitsa_recent_auth() returns boolean
language sql stable security invoker set search_path=''
as $$ select coalesce(private.mitsa_mfa_ready() and (c->>'passwordAt')::numeric between extract(epoch from statement_timestamp()-interval '5 minutes') and extract(epoch from statement_timestamp()+interval '5 seconds')
  and (c->>'totpAt')::numeric between extract(epoch from statement_timestamp()-interval '5 minutes') and extract(epoch from statement_timestamp()+interval '5 seconds'),false)
  from (select private.mitsa_auth_context() c) ctx $$;
revoke all on function private.mitsa_recent_auth() from public,anon,authenticated;
grant execute on function private.mitsa_recent_auth() to app_workspace;

create function private.mitsa_role(p_business uuid) returns text
language sql stable security definer set search_path='' set row_security=on
as $$ select m.role from private.memberships m join private.businesses b on b.id=m.business_id
  where m.business_id=p_business and m.user_id=private.current_actor() and m.active and b.status='active' $$;
alter function private.mitsa_role(uuid) owner to app_authz;
revoke all on function private.mitsa_role(uuid) from public,anon,authenticated;
grant execute on function private.mitsa_role(uuid) to app_workspace;

create function private.mitsa_require(p_business uuid,p_action text,p_shop uuid default null) returns text
language plpgsql security invoker set search_path='' as $$ declare r text:=private.mitsa_role(p_business); begin
  if r is null or (r in ('owner','admin') and not private.mitsa_mfa_ready()) then raise exception 'forbidden' using errcode='42501'; end if;
  if p_shop is not null and not exists(select 1 from private.shops s where s.business_id=p_business and s.id=p_shop and s.active
    and (r in ('owner','admin') or exists(select 1 from private.shop_assignments a where a.business_id=p_business and a.shop_id=p_shop and a.user_id=private.current_actor()))) then
    raise exception 'forbidden' using errcode='42501'; end if;
  if not (case p_action when 'view' then true when 'manage-staff' then r in ('owner','admin')
    when 'audit' then r in ('owner','admin') when 'manage-locations' then r in ('owner','admin')
    when 'owner' then r='owner' when 'financial' then r='owner' or (r='admin' and (select admin_financial_access from private.businesses where id=p_business))
    else false end) then raise exception 'forbidden' using errcode='42501'; end if;
  return r;
end $$;
revoke all on function private.mitsa_require(uuid,text,uuid) from public,anon,authenticated;
grant execute on function private.mitsa_require(uuid,text,uuid) to app_workspace;

create function private.mitsa_owner_invariant() returns trigger
language plpgsql security definer set search_path='' set row_security=on as $$ declare bid uuid; b private.businesses; n integer; oid uuid; begin
  if tg_table_name='businesses' then bid:=coalesce(new.id,old.id);
  else bid:=coalesce(new.business_id,old.business_id); end if;
  select * into b from private.businesses where id=bid;
  if not found or b.status<>'active' then return null; end if;
  select count(*),(array_agg(user_id))[1] into n,oid from private.memberships where business_id=bid and active and role='owner';
  if n<>1 then raise exception 'active workspace requires exactly one Owner' using errcode='23514'; end if;
  if b.primary_owner_id is null then update private.businesses set primary_owner_id=oid where id=bid;
  elsif b.primary_owner_id<>oid then raise exception 'primary Owner mismatch' using errcode='23514'; end if;
  return null;
end $$;
alter function private.mitsa_owner_invariant() owner to app_workspace;
revoke all on function private.mitsa_owner_invariant() from public,anon,authenticated;
create constraint trigger workspace_owner after insert or update on private.businesses deferrable initially deferred for each row execute function private.mitsa_owner_invariant();
create constraint trigger membership_owner after insert or update or delete on private.memberships deferrable initially deferred for each row execute function private.mitsa_owner_invariant();

create function private.mitsa_audit(p_business uuid,p_event text,p_target uuid default null,p_detail jsonb default '{}') returns void
language sql security invoker set search_path='' as $$ insert into private.access_audit(business_id,actor_id,event,target_id,detail)
  values(p_business,private.current_actor(),p_event,p_target,p_detail) $$;
revoke all on function private.mitsa_audit(uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.mitsa_audit(uuid,text,uuid,jsonb) to app_workspace;

-- Public wrappers are invoker functions; implementations have a restricted,
-- non-table-owning, non-bypass role. No direct table DML is granted to clients.
create function private.mitsa_identity() returns jsonb
language plpgsql security definer set search_path='' set row_security=on as $$ declare c jsonb:=private.mitsa_auth_context(); items jsonb; begin
  if c is null then raise exception 'forbidden' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'slug',b.slug,'name',b.name,'role',m.role,
    'requiresMfa',m.role in ('owner','admin') and not private.mitsa_mfa_ready()) order by b.name,b.id),'[]') into items
    from private.memberships m join private.businesses b on b.id=m.business_id where m.user_id=private.current_actor() and m.active and b.status='active';
  return jsonb_build_object('userId',c->'userId','email',c->'email','verified',c->'verified','mfaReady',private.mitsa_mfa_ready(),'workspaces',items);
end $$;
create function private.mitsa_security_status() returns jsonb
language plpgsql security definer set search_path='' set row_security=on as $$ declare c jsonb:=private.mitsa_auth_context(); factors jsonb; begin
  if c is null then raise exception 'forbidden' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',b.factor_id,'active',b.revoked_at is null and c->'verifiedFactors' @> jsonb_build_array(b.factor_id),'boundAt',b.bound_at)),'[]')
    into factors from private.factor_bindings b where b.user_id=private.current_actor();
  return jsonb_build_object('ready',private.mitsa_mfa_ready(),'factors',factors,'initialized',coalesce((select initialized from private.account_security where user_id=private.current_actor()),false));
end $$;
create function private.mitsa_prepare_enrollment() returns uuid
language plpgsql security definer set search_path='' set row_security=on as $$ declare c jsonb:=private.mitsa_auth_context(); s private.account_security; permit uuid; begin
  if c is null or c->'verified'<>'true' or not coalesce((c->>'passwordAt')::numeric >= extract(epoch from statement_timestamp()-interval '5 minutes'),false) then raise exception 'recent password required' using errcode='42501'; end if;
  insert into private.account_security(user_id) values(private.current_actor()) on conflict do nothing;
  select * into s from private.account_security where user_id=private.current_actor() for update;
  if s.recovery_locked or (s.initialized and not private.mitsa_recent_auth()) then raise exception 'trusted MFA required' using errcode='42501'; end if;
  if not s.initialized and jsonb_array_length(c->'verifiedFactors')<>0 then raise exception 'existing factors require reviewed initialization' using errcode='42501'; end if;
  insert into private.security_permits(user_id,session_id,generation,trusted_factor_id,action)
    values(s.user_id,(c->>'sessionId')::uuid,s.generation,case when s.initialized then (c->>'factorId')::uuid end,'enroll') returning id into permit;
  return permit;
end $$;
create function private.mitsa_bind_factor(p_factor uuid,p_permit uuid) returns void
language plpgsql security definer set search_path='' set row_security=on as $$ declare c jsonb:=private.mitsa_auth_context(); s private.account_security; p private.security_permits; begin
  if c is null or c->>'aal'<>'aal2' or c->'verified'<>'true' or (c->>'factorId')::uuid is distinct from p_factor or not(c->'verifiedFactors' @> jsonb_build_array(p_factor)) then raise exception 'verified MFA required' using errcode='42501'; end if;
  insert into private.account_security(user_id) values(private.current_actor()) on conflict do nothing;
  select * into s from private.account_security where user_id=private.current_actor() for update;
  if s.recovery_locked then raise exception 'recovery review required' using errcode='42501'; end if;
  select * into p from private.security_permits where id=p_permit and user_id=s.user_id and session_id=(c->>'sessionId')::uuid and action='enroll' for update;
  if not found or p.consumed_at is not null or p.expires_at<=now() or p.generation<>s.generation then raise exception 'trusted enrollment required' using errcode='42501'; end if;
  if s.initialized and (not(c->'verifiedFactors' @> jsonb_build_array(p.trusted_factor_id)) or not exists(
    select 1 from private.factor_bindings where user_id=s.user_id and factor_id=p.trusted_factor_id and generation=s.generation and revoked_at is null)) then raise exception 'trusted enrollment required' using errcode='42501'; end if;
  if not coalesce((c->>'passwordAt')::numeric >= extract(epoch from statement_timestamp()-interval '5 minutes'),false) then raise exception 'recent password required' using errcode='42501'; end if;
  update private.security_permits set consumed_at=now() where id=p.id;
  insert into private.factor_bindings(user_id,factor_id,generation) values(s.user_id,p_factor,s.generation)
    on conflict(user_id,factor_id) do update set generation=excluded.generation,revoked_at=null,bound_at=now();
  update private.account_security set initialized=true where user_id=s.user_id;
  perform private.mitsa_audit(null,'mfa.factor-bound',p_factor);
end $$;

create function private.mitsa_create_workspace(p_name text,p_location text,p_kind text,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' set row_security=on as $$ declare actor uuid:=private.current_actor(); c jsonb:=private.mitsa_auth_context(); fingerprint text; previous private.access_commands; bid uuid:=gen_random_uuid(); sid uuid:=gen_random_uuid(); result jsonb; begin
  if actor is null or c->'verified'<>'true' or not private.mitsa_mfa_ready() then raise exception 'verified account and MFA required' using errcode='42501'; end if;
  if p_key is null or p_name is null or length(btrim(p_name)) not between 1 and 120 or p_location is null or length(btrim(p_location)) not between 1 and 120 or p_kind not in ('shop','warehouse') or p_kind is null then raise exception 'invalid workspace' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text||':'||p_key::text,8414));
  fingerprint:=encode(sha256(convert_to(jsonb_build_array('create',p_name,p_location,p_kind)::text,'UTF8')),'hex');
  select * into previous from private.access_commands where actor_id=actor and command_key=p_key;
  if found then if previous.request_hash<>fingerprint then raise exception 'idempotency conflict' using errcode='23505'; end if; return previous.outcome; end if;
  insert into private.businesses(id,name,slug,primary_owner_id) values(bid,btrim(p_name),'workspace-'||bid::text,actor);
  insert into private.shops(business_id,id,name,kind) values(bid,sid,btrim(p_location),p_kind);
  insert into private.memberships(business_id,user_id,role) values(bid,actor,'owner');
  result:=jsonb_build_object('id',bid,'slug','workspace-'||bid::text,'locationId',sid);
  insert into private.access_commands values(actor,p_key,fingerprint,result,now());
  perform private.mitsa_audit(bid,'workspace.created',bid);
  return result;
end $$;
create function private.mitsa_workspace(p_slug text) returns jsonb
language plpgsql security definer set search_path='' set row_security=on as $$ declare b private.businesses; r text; locations jsonb; begin
  select * into b from private.businesses where slug=p_slug;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  r:=private.mitsa_require(b.id,'view');
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'kind',s.kind) order by s.name),'[]') into locations from private.shops s where s.business_id=b.id and s.active and
    (r in ('owner','admin') or exists(select 1 from private.shop_assignments a where a.business_id=b.id and a.user_id=private.current_actor() and a.shop_id=s.id));
  return jsonb_build_object('id',b.id,'name',b.name,'slug',b.slug,'role',r,'locations',locations,'adminFinancialAccess',case when r='owner' then b.admin_financial_access else null end,
    'canViewFinancial',r='owner' or (r='admin' and b.admin_financial_access),'country',b.country,'currency',b.currency,'timezone',b.timezone);
end $$;
create function private.mitsa_financial_setting(p_business uuid,p_enabled boolean) returns void
language plpgsql security definer set search_path='' set row_security=on as $$ begin
  perform 1 from private.businesses where id=p_business for update;
  perform private.mitsa_require(p_business,'owner');
  if p_enabled is null or not private.mitsa_recent_auth() then raise exception 'recent authentication required' using errcode='42501'; end if;
  update private.businesses set admin_financial_access=p_enabled where id=p_business;
  perform private.mitsa_audit(p_business,'financial.admin-access',null,jsonb_build_object('enabled',p_enabled));
end $$;

-- Make the existing synthetic interface respect the approved new roles and MFA.
create or replace function private.has_shop_access(p_business uuid,p_shop uuid,p_capability text) returns boolean
language sql stable security definer set search_path='' set row_security=on as $$ select exists(
  select 1 from private.memberships m join private.shops s on s.business_id=m.business_id and s.id=p_shop
  join private.businesses b on b.id=m.business_id
  where m.business_id=p_business and m.user_id=private.current_actor() and m.active and s.active and b.status='active'
    and (m.role in ('owner','admin') and private.mitsa_mfa_ready() or m.role='staff' and exists(select 1 from private.shop_assignments a where a.business_id=m.business_id and a.user_id=m.user_id and a.shop_id=p_shop))
    and case p_capability when 'view' then true when 'operate' then true when 'ordinary_price' then m.role='owner'
      when 'discount' then m.role in ('owner','admin') when 'credit' then m.role in ('owner','admin') when 'reverse' then m.role in ('owner','admin') else false end) $$;

-- Audit and acceptance history cannot be changed by application command roles.
revoke update,delete on private.access_audit,private.access_commands,private.legal_acceptances,private.request_events from app_workspace;
create trigger immutable_access_audit before update or delete on private.access_audit for each row execute function private.reject_history_mutation();
create trigger immutable_access_commands before update or delete on private.access_commands for each row execute function private.reject_history_mutation();
create trigger immutable_legal_acceptances before update or delete on private.legal_acceptances for each row execute function private.reject_history_mutation();
create trigger immutable_request_events before update or delete on private.request_events for each row execute function private.reject_history_mutation();

do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private' and p.proname in ('mitsa_identity','mitsa_security_status','mitsa_prepare_enrollment','mitsa_bind_factor','mitsa_create_workspace','mitsa_workspace','mitsa_financial_setting') loop
    execute format('alter function %s owner to app_workspace',f.signature);
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to authenticated',f.signature);
  end loop;
end $$;
create function api.mitsa_identity() returns jsonb language sql security invoker set search_path='' as $$ select private.mitsa_identity() $$;
create function api.mitsa_security_status() returns jsonb language sql security invoker set search_path='' as $$ select private.mitsa_security_status() $$;
create function api.mitsa_prepare_enrollment() returns uuid language sql security invoker set search_path='' as $$ select private.mitsa_prepare_enrollment() $$;
create function api.mitsa_bind_factor(p_factor uuid,p_permit uuid default null) returns void language sql security invoker set search_path='' as $$ select private.mitsa_bind_factor(p_factor,p_permit) $$;
create function api.mitsa_create_workspace(p_name text,p_location text,p_kind text,p_key uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.mitsa_create_workspace(p_name,p_location,p_kind,p_key) $$;
create function api.mitsa_workspace(p_slug text) returns jsonb language sql security invoker set search_path='' as $$ select private.mitsa_workspace(p_slug) $$;
create function api.mitsa_financial_setting(p_business uuid,p_enabled boolean) returns void language sql security invoker set search_path='' as $$ select private.mitsa_financial_setting(p_business,p_enabled) $$;
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='api' and p.proname like 'mitsa_%' loop
    execute format('revoke all on function %s from public,anon',f.signature);
    execute format('grant execute on function %s to authenticated',f.signature);
  end loop;
end $$;
revoke create on schema private from app_workspace,app_authz;
notify pgrst,'reload schema';
