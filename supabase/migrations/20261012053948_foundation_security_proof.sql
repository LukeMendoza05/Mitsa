-- Tasks 1–3 only: access foundation and synthetic security/transaction probes.
-- No catalog, inventory, sales, payment or checkout implementation.
create role app_authz nologin nobypassrls nosuperuser nocreatedb nocreaterole noinherit;
create role app_command nologin nobypassrls nosuperuser nocreatedb nocreaterole noinherit;
grant app_authz, app_command to postgres;

create schema private;
create schema api;
create schema foundation_probe;
revoke all on schema private, api, foundation_probe from public, anon, authenticated;
grant usage on schema private to authenticated, app_authz, app_command;
grant usage on schema api to authenticated;
grant usage on schema foundation_probe to authenticated, app_command;
grant usage on schema auth to app_authz, app_command;
grant execute on function auth.uid(), auth.jwt() to app_authz, app_command;

alter default privileges in schema private revoke execute on functions from public;
alter default privileges in schema api revoke execute on functions from public;
alter default privileges in schema foundation_probe revoke execute on functions from public;

create table private.businesses (id uuid primary key, name text not null);
create table private.shops (
  business_id uuid not null references private.businesses(id),
  id uuid not null, name text not null, primary key (business_id, id)
);
create table private.memberships (
  business_id uuid not null references private.businesses(id),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('owner','manager','cashier')),
  active boolean not null default true,
  primary key (business_id, user_id)
);
create table private.shop_assignments (
  business_id uuid not null, user_id uuid not null, shop_id uuid not null,
  primary key (business_id, user_id, shop_id),
  foreign key (business_id, user_id) references private.memberships(business_id, user_id),
  foreign key (business_id, shop_id) references private.shops(business_id, id)
);
create index shop_assignment_lookup on private.shop_assignments(user_id, business_id, shop_id);
create table foundation_probe.environment_identity (
  singleton boolean primary key default true check (singleton), marker text not null unique
);
insert into foundation_probe.environment_identity(marker) values ('fireworks-foundation-proof-01a12e38');
create table foundation_probe.resources (
  business_id uuid not null, shop_id uuid not null, id uuid primary key,
  initial_value integer not null check (initial_value >= 0),
  value integer not null check (value >= 0),
  unique (business_id, shop_id, id),
  foreign key (business_id, shop_id) references private.shops(business_id, id)
);
create table foundation_probe.command_results (
  actor_id uuid not null, command_key uuid not null, request_hash text not null,
  business_id uuid not null, shop_id uuid not null, resource_id uuid not null,
  resulting_value integer not null, primary key (actor_id, command_key),
  foreign key (business_id, shop_id, resource_id) references foundation_probe.resources(business_id, shop_id, id)
);
create table foundation_probe.events (
  actor_id uuid not null, command_key uuid not null,
  business_id uuid not null, shop_id uuid not null, resource_id uuid not null,
  delta integer not null, resulting_value integer not null,
  created_at timestamptz not null default now(),
  primary key (actor_id, command_key),
  foreign key (actor_id, command_key) references foundation_probe.command_results(actor_id, command_key),
  foreign key (business_id, shop_id, resource_id) references foundation_probe.resources(business_id, shop_id, id)
);

-- Helper role sees only the columns needed to answer current-actor questions.
grant select on private.memberships, private.shop_assignments, private.shops to app_authz;
grant select (id, user_id) on auth.sessions to app_authz;
grant create on schema private to app_authz, app_command;

create function private.session_is_active() returns boolean
language sql stable security definer set search_path = '' set row_security = on
as $$ select auth.uid() is not null and exists (
  select 1 from auth.sessions s where s.id = nullif(auth.jwt()->>'session_id','')::uuid and s.user_id = auth.uid()
) $$;
alter function private.session_is_active() owner to app_authz;

create function private.has_shop_access(p_business uuid, p_shop uuid, p_capability text)
returns boolean language sql stable security definer set search_path = '' set row_security = on
as $$ select private.session_is_active() and exists (
  select 1 from private.memberships m
  join private.shops s on s.business_id = m.business_id and s.id = p_shop
  where m.business_id = p_business and m.user_id = auth.uid() and m.active
  and (m.role = 'owner' or exists (
    select 1 from private.shop_assignments a where a.business_id = m.business_id and a.user_id = m.user_id and a.shop_id = p_shop
  ))
  and case p_capability
    when 'view' then true when 'operate' then true
    when 'ordinary_price' then m.role = 'owner'
    when 'discount' then m.role in ('owner','manager')
    when 'credit' then m.role in ('owner','manager')
    when 'reverse' then m.role in ('owner','manager')
    else false end
) $$;
alter function private.has_shop_access(uuid,uuid,text) owner to app_authz;

do $$ declare t record; begin
  for t in select schemaname, tablename from pg_tables where schemaname in ('private','foundation_probe') loop
    execute format('alter table %I.%I enable row level security', t.schemaname, t.tablename);
    execute format('alter table %I.%I force row level security', t.schemaname, t.tablename);
  end loop;
end $$;
create policy helper_memberships on private.memberships for select to app_authz using (true);
create policy helper_assignments on private.shop_assignments for select to app_authz using (true);
create policy helper_shops on private.shops for select to app_authz using (true);
create policy operator_marker on foundation_probe.environment_identity for select to postgres using (true);
create policy member_self on private.memberships for select to authenticated, app_command
  using (user_id = (select auth.uid()) and active and (select private.session_is_active()));
create policy assigned_shops on private.shops for select to authenticated
  using (private.has_shop_access(business_id,id,'view'));
create policy resource_read on foundation_probe.resources for select to authenticated, app_command
  using (private.has_shop_access(business_id,shop_id,'view'));
create policy resource_update on foundation_probe.resources for update to app_command
  using (private.has_shop_access(business_id,shop_id,'operate'))
  with check (private.has_shop_access(business_id,shop_id,'operate'));
create policy result_read on foundation_probe.command_results for select to app_command
  using (actor_id = (select auth.uid()) and private.has_shop_access(business_id,shop_id,'operate'));
create policy result_insert on foundation_probe.command_results for insert to app_command
  with check (actor_id = (select auth.uid()) and private.has_shop_access(business_id,shop_id,'operate'));
create policy event_insert on foundation_probe.events for insert to app_command
  with check (actor_id = (select auth.uid()) and private.has_shop_access(business_id,shop_id,'operate'));

grant select (business_id,user_id,role,active) on private.memberships to authenticated, app_command;
-- FOR SHARE requires UPDATE privilege; no UPDATE policy exists for this role.
grant update (active) on private.memberships to app_command;
grant select on private.shops to authenticated;
grant select on foundation_probe.resources to authenticated, app_command;
grant update (value) on foundation_probe.resources to app_command;
grant select, insert on foundation_probe.command_results to app_command;
grant insert on foundation_probe.events to app_command;

create function private.foundation_increment(p_business uuid,p_resource uuid,p_delta integer,p_key uuid)
returns jsonb language plpgsql security definer set search_path = '' set row_security = on
as $$ declare
  actor uuid := auth.uid(); resource foundation_probe.resources%rowtype;
  previous foundation_probe.command_results%rowtype; fingerprint text; next_value integer;
begin
  if actor is null or not private.session_is_active() then raise exception 'forbidden' using errcode='42501'; end if;
  perform 1 from private.memberships m where m.business_id=p_business and m.user_id=actor and m.active for share;
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  if p_key is null or p_delta is null or p_delta=0 or p_delta not between -10 and 10 then
    raise exception 'invalid command' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text || ':' || p_key::text, 7319));
  fingerprint := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    pg_catalog.jsonb_build_array(p_business,p_resource,p_delta)::text,'UTF8')),'hex');
  select * into previous from foundation_probe.command_results r where r.actor_id=actor and r.command_key=p_key;
  if found then
    if previous.request_hash <> fingerprint then raise exception 'idempotency conflict' using errcode='23505'; end if;
    return pg_catalog.jsonb_build_object('value',previous.resulting_value,'commandKey',p_key);
  end if;
  select * into resource from foundation_probe.resources r where r.id=p_resource and r.business_id=p_business for update;
  if not found or not private.has_shop_access(p_business,resource.shop_id,'operate') then
    raise exception 'forbidden' using errcode='42501';
  end if;
  update foundation_probe.resources set value=value+p_delta where id=p_resource returning value into next_value;
  if not found then raise exception 'projection update failed'; end if;
  insert into foundation_probe.command_results values (actor,p_key,fingerprint,p_business,resource.shop_id,p_resource,next_value);
  insert into foundation_probe.events(actor_id,command_key,business_id,shop_id,resource_id,delta,resulting_value)
    values (actor,p_key,p_business,resource.shop_id,p_resource,p_delta,next_value);
  return pg_catalog.jsonb_build_object('value',next_value,'commandKey',p_key);
end $$;
alter function private.foundation_increment(uuid,uuid,integer,uuid) owner to app_command;

create function private.reject_history_mutation() returns trigger
language plpgsql set search_path = '' as $$ begin raise exception 'immutable history' using errcode='55000'; end $$;
create trigger immutable_results before update or delete on foundation_probe.command_results
for each row execute function private.reject_history_mutation();
create trigger immutable_events before update or delete on foundation_probe.events
for each row execute function private.reject_history_mutation();

create view api.foundation_resources with (security_invoker=true) as
  select id,business_id,shop_id,value from foundation_probe.resources;
create function api.foundation_increment(p_business uuid,p_resource uuid,p_delta integer,p_key uuid)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.foundation_increment(p_business,p_resource,p_delta,p_key) $$;

revoke all on all functions in schema private, api from public, anon, authenticated;
grant execute on function private.session_is_active(), private.has_shop_access(uuid,uuid,text) to authenticated, app_command;
grant execute on function private.foundation_increment(uuid,uuid,integer,uuid), api.foundation_increment(uuid,uuid,integer,uuid) to authenticated;
grant select on api.foundation_resources to authenticated;
revoke create on schema private from app_authz, app_command;

-- Version-controlled isolated API exposure; dashboard schema settings are overridden.
alter role authenticator set pgrst.db_schemas = 'api';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
