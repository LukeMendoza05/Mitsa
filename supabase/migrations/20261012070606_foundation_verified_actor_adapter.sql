-- Task 3 only. Authentication privilege bridge; no business-module implementation.
-- PostgREST verifies JWTs before establishing this transaction-local context.
-- This sole elevated adapter reads Auth only; business functions remain NOBYPASSRLS.
do $$ begin
  assert current_user = 'postgres', 'adapter must be provisioned by the approved operator';
  assert has_column_privilege('postgres','auth.sessions','not_after','select'), 'operator Auth access absent';
end $$;

create function private.current_actor() returns uuid
language plpgsql stable security definer
set search_path = '' set row_security = on
as $$ declare claims jsonb; actor uuid; session_id uuid;
begin
  -- Reject direct SQL claim injection, even from an operator SET ROLE harness.
  if session_user <> 'authenticator'
    or pg_catalog.current_setting('role',true) is distinct from 'authenticated' then return null; end if;
  claims := nullif(pg_catalog.current_setting('request.jwt.claims',true),'')::jsonb;
  if pg_catalog.jsonb_typeof(claims) is distinct from 'object'
    or claims->>'role' is distinct from 'authenticated'
    or pg_catalog.jsonb_typeof(claims->'sub') is distinct from 'string'
    or pg_catalog.jsonb_typeof(claims->'session_id') is distinct from 'string'
    or pg_catalog.jsonb_typeof(claims->'exp') is distinct from 'number'
    or not coalesce(claims->'aud' = '"authenticated"'::jsonb or claims->'aud' @> '["authenticated"]'::jsonb,false)
    or claims->'is_anonymous' is distinct from 'false'::jsonb
    or (claims->>'exp')::numeric <= pg_catalog.date_part('epoch',pg_catalog.statement_timestamp()) then
    return null;
  end if;
  if claims ? 'nbf' then
    if pg_catalog.jsonb_typeof(claims->'nbf') is distinct from 'number'
      or (claims->>'nbf')::numeric > pg_catalog.date_part('epoch',pg_catalog.statement_timestamp()) then return null; end if;
  end if;
  actor := (claims->>'sub')::uuid;
  session_id := (claims->>'session_id')::uuid;
  return (
    select u.id from auth.users u join auth.sessions s on s.user_id=u.id
    where u.id=actor and s.id=session_id and not u.is_anonymous
      and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= pg_catalog.statement_timestamp())
      and (s.not_after is null or s.not_after > pg_catalog.statement_timestamp())
  );
exception when invalid_text_representation or numeric_value_out_of_range then return null;
end $$;
revoke all on function private.current_actor() from public, anon, authenticated, app_authz, app_command;
grant execute on function private.current_actor() to authenticated, app_authz, app_command;

create or replace function private.session_is_active() returns boolean
language sql stable security definer set search_path = '' set row_security = on
as $$ select private.current_actor() is not null $$;

create or replace function private.has_shop_access(p_business uuid,p_shop uuid,p_capability text)
returns boolean language sql stable security definer set search_path = '' set row_security = on
as $$ select exists (
  select 1 from private.memberships m
  join private.shops s on s.business_id=m.business_id and s.id=p_shop
  where m.business_id=p_business and m.user_id=(select private.current_actor()) and m.active
    and (m.role='owner' or exists (
      select 1 from private.shop_assignments a
      where a.business_id=m.business_id and a.user_id=m.user_id and a.shop_id=p_shop
    ))
    and case p_capability
      when 'view' then true when 'operate' then true
      when 'ordinary_price' then m.role='owner'
      when 'discount' then m.role in ('owner','manager')
      when 'credit' then m.role in ('owner','manager')
      when 'reverse' then m.role in ('owner','manager')
      else false end
) $$;

alter policy member_self on private.memberships
  using (user_id=(select private.current_actor()) and active);
alter policy command_membership_lock on private.memberships
  using (user_id=(select private.current_actor()) and active) with check(false);
alter policy result_read on foundation_probe.command_results
  using (actor_id=(select private.current_actor()) and private.has_shop_access(business_id,shop_id,'operate'));
alter policy result_insert on foundation_probe.command_results
  with check (actor_id=(select private.current_actor()) and private.has_shop_access(business_id,shop_id,'operate'));
alter policy event_insert on foundation_probe.events
  with check (actor_id=(select private.current_actor()) and private.has_shop_access(business_id,shop_id,'operate'));

create or replace function private.foundation_increment(p_business uuid,p_resource uuid,p_delta integer,p_key uuid)
returns jsonb language plpgsql security definer set search_path = '' set row_security = on
as $$ declare
  actor uuid := private.current_actor(); resource foundation_probe.resources%rowtype;
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


create or replace function api.foundation_identity() returns jsonb
language plpgsql security invoker set search_path = ''
as $$ declare actor uuid := private.current_actor(); memberships jsonb; begin
  if actor is null then raise exception 'forbidden' using errcode='42501'; end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('businessId',m.business_id,'role',m.role)),'[]'::jsonb)
    into memberships from private.memberships m where m.user_id=actor and m.active;
  return pg_catalog.jsonb_build_object('userId',actor,'memberships',memberships);
end $$;

-- Synthetic capability proof only, not a product/price-management endpoint.
create function api.foundation_capabilities(p_business uuid,p_shop uuid) returns jsonb
language plpgsql security invoker set search_path = ''
as $$ begin
  if not private.session_is_active() then raise exception 'forbidden' using errcode='42501'; end if;
  return pg_catalog.jsonb_build_object(
    'price',private.has_shop_access(p_business,p_shop,'ordinary_price'),
    'discount',private.has_shop_access(p_business,p_shop,'discount'));
end $$;
revoke all on function api.foundation_capabilities(uuid,uuid) from public, anon;
grant execute on function api.foundation_capabilities(uuid,uuid) to authenticated;

-- Remove only the obsolete policy/column grant introduced by our own migrations.
-- No platform-owned functions, owners, RLS flags, or other Auth policies are changed.
drop policy foundation_current_session on auth.sessions;
revoke select(id,user_id) on auth.sessions from app_authz;

do $$ begin
  assert (select count(*)=2 from pg_roles where rolname in ('app_authz','app_command') and not rolcanlogin and not rolbypassrls and not rolsuper), 'unsafe business roles';
  assert not has_schema_privilege('app_authz','auth','usage') and not has_schema_privilege('app_command','auth','usage'), 'unexpected managed Auth grants';
  assert not has_function_privilege('anon','private.current_actor()','execute'), 'anonymous adapter execution';
  assert (select bool_and(c.relrowsecurity and c.relforcerowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('private','foundation_probe') and c.relkind='r'), 'business RLS changed';
  assert (select pg_get_userbyid(proowner)='app_authz' from pg_proc where oid='private.has_shop_access(uuid,uuid,text)'::regprocedure), 'helper owner changed';
end $$;
notify pgrst,'reload schema';
