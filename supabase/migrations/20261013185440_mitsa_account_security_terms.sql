do $$ begin assert (select marker='fireworks-foundation-proof-01a12e38' from foundation_probe.environment_identity where singleton), 'unapproved environment'; end $$;
grant create on schema private to app_workspace;

alter table private.security_permits add column target_factor_id uuid;
create unique index registration_intent_provider_user on private.registration_intents(provider_user_id) where provider_user_id is not null;
create table private.registration_test_recipients(
  email text primary key check(email ~ '^foundation-[a-zA-Z0-9-]+@example\.invalid$'),
  enabled boolean not null default false
);
alter table private.registration_test_recipients enable row level security;
alter table private.registration_test_recipients force row level security;
grant select on private.registration_test_recipients to app_workspace;
create policy workspace_read on private.registration_test_recipients for select to app_workspace using(true);

create function private.mitsa_current_terms() returns jsonb
language plpgsql security definer set search_path='' set row_security=on as $$ declare actor uuid:=private.current_actor(); result jsonb; begin
  if actor is null then raise exception 'forbidden' using errcode='42501'; end if;
  select jsonb_build_object('id',v.id,'version',v.version,'content',v.content,'hash',v.content_hash,'status',v.status,
    'accepted',exists(select 1 from private.legal_acceptances a where a.user_id=actor and a.version_id=v.id)) into result
    from private.legal_versions v join private.release_gates g on g.test_terms_id=v.id and g.singleton
    where v.kind='terms' and (v.status='test' or v.status='published' and g.legal_publication_enabled and v.effective_at<=now());
  return result;
end $$;
create function private.mitsa_accept_terms(p_version uuid) returns void
language plpgsql security definer set search_path='' set row_security=on as $$ declare c jsonb:=private.mitsa_auth_context(); terms jsonb:=private.mitsa_current_terms(); begin
  if c is null or c->'verified'<>'true' or terms is null or (terms->>'id')::uuid is distinct from p_version then raise exception 'current Terms unavailable' using errcode='42501'; end if;
  insert into private.legal_acceptances(user_id,version_id,source) values(private.current_actor(),p_version,'first-access') on conflict do nothing;
end $$;
create function private.mitsa_has_current_terms() returns boolean
language sql security invoker set search_path='' as $$ select coalesce((private.mitsa_current_terms()->>'accepted')::boolean,false) $$;
revoke all on function private.mitsa_has_current_terms() from public,anon,authenticated;
grant execute on function private.mitsa_has_current_terms() to app_workspace;

create or replace function private.mitsa_require(p_business uuid,p_action text,p_shop uuid default null) returns text
language plpgsql security invoker set search_path='' as $$ declare r text:=private.mitsa_role(p_business); begin
  if r is null or (r in ('owner','admin') and not private.mitsa_mfa_ready()) or not private.mitsa_has_current_terms() then raise exception 'forbidden' using errcode='42501'; end if;
  if p_shop is not null and not exists(select 1 from private.shops s where s.business_id=p_business and s.id=p_shop and s.active
    and (r in ('owner','admin') or exists(select 1 from private.shop_assignments a where a.business_id=p_business and a.shop_id=p_shop and a.user_id=private.current_actor()))) then raise exception 'forbidden' using errcode='42501'; end if;
  if not (case p_action when 'view' then true when 'manage-staff' then r in ('owner','admin') when 'audit' then r in ('owner','admin') when 'manage-locations' then r in ('owner','admin')
    when 'owner' then r='owner' when 'financial' then r='owner' or (r='admin' and (select admin_financial_access from private.businesses where id=p_business)) else false end) then raise exception 'forbidden' using errcode='42501'; end if;
  return r;
end $$;

-- Preserve the command's transaction/idempotency behavior; Terms must be
-- accepted before the request can create any business or Owner membership.
create or replace function private.mitsa_create_workspace(p_name text,p_location text,p_kind text,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' set row_security=on as $$ declare actor uuid:=private.current_actor(); c jsonb:=private.mitsa_auth_context(); fingerprint text; previous private.access_commands; bid uuid:=gen_random_uuid(); sid uuid:=gen_random_uuid(); result jsonb; begin
  if actor is null or c->'verified'<>'true' or not private.mitsa_mfa_ready() then raise exception 'verified account and MFA required' using errcode='42501'; end if;
  if not private.mitsa_has_current_terms() then raise exception 'current Terms acceptance required' using errcode='42501'; end if;
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

create function private.mitsa_begin_factor_removal(p_factor uuid,p_disable boolean) returns uuid
language plpgsql security definer set search_path='' set row_security=on as $$ declare c jsonb:=private.mitsa_auth_context(); permit uuid; s private.account_security; begin
  if not private.mitsa_recent_auth() or p_disable is null or not coalesce(c->'verifiedFactors' @> jsonb_build_array(p_factor),false) then raise exception 'recent trusted authentication required' using errcode='42501'; end if;
  select * into s from private.account_security where user_id=private.current_actor() for update;
  insert into private.security_permits(user_id,session_id,generation,trusted_factor_id,target_factor_id,action)
    values(s.user_id,(c->>'sessionId')::uuid,s.generation,(c->>'factorId')::uuid,p_factor,case when p_disable then 'disable' else 'remove' end) returning id into permit;
  return permit;
end $$;
create function private.mitsa_finish_factor_removal(p_permit uuid) returns void
language plpgsql security definer set search_path='' set row_security=on as $$ declare c jsonb:=private.mitsa_auth_context(); p private.security_permits; s private.account_security; remaining integer; begin
  if c is null then raise exception 'forbidden' using errcode='42501'; end if;
  select * into s from private.account_security where user_id=private.current_actor() for update;
  select * into p from private.security_permits where id=p_permit and user_id=s.user_id and session_id=(c->>'sessionId')::uuid and action in ('remove','disable') for update;
  if not found then raise exception 'removal authorization expired' using errcode='42501'; end if;
  if p.consumed_at is not null then return; end if;
  if p.generation<>s.generation or p.expires_at<=now() then raise exception 'removal authorization expired' using errcode='42501'; end if;
  if c->'verifiedFactors' @> jsonb_build_array(p.target_factor_id) or p.action='disable' and jsonb_array_length(c->'verifiedFactors')<>0 then raise exception 'provider factor removal incomplete' using errcode='42501'; end if;
  update private.factor_bindings set revoked_at=now() where user_id=s.user_id and factor_id=p.target_factor_id and revoked_at is null;
  select count(*) into remaining from private.factor_bindings b where b.user_id=s.user_id and b.generation=s.generation and b.revoked_at is null and c->'verifiedFactors' @> jsonb_build_array(b.factor_id);
  if p.action='disable' or remaining=0 then
    update private.factor_bindings set revoked_at=coalesce(revoked_at,now()) where user_id=s.user_id;
    update private.account_security set initialized=false,generation=generation+1 where user_id=s.user_id;
  end if;
  update private.security_permits set consumed_at=now() where id=p.id;
  perform private.mitsa_audit(null,case when p.action='disable' or remaining=0 then 'mfa.disabled' else 'mfa.factor-removed' end,p.target_factor_id);
  insert into private.notification_outbox(recipient_id,template,event_key,data)
    values(s.user_id,'mfa-changed',p.id::text,jsonb_build_object('disabled',p.action='disable' or remaining=0));
end $$;

create function private.mitsa_legal_immutable() returns trigger
language plpgsql security invoker set search_path='' as $$ begin
  if tg_op='UPDATE' then
    if old.status<>'draft' and (new.kind,new.version,new.content,new.content_hash) is distinct from (old.kind,old.version,old.content,old.content_hash) then
      raise exception 'create a new legal version' using errcode='55000';
    end if;
  end if;
  if new.content_hash<>encode(sha256(convert_to(new.content,'UTF8')),'hex') then raise exception 'legal content hash mismatch' using errcode='23514'; end if;
  return new;
end $$;
create trigger legal_version_immutable before insert or update on private.legal_versions for each row execute function private.mitsa_legal_immutable();
revoke all on function private.mitsa_legal_immutable() from public,anon,authenticated;

create function private.mitsa_factor_notice() returns trigger
language plpgsql security invoker set search_path='' as $$ begin
  if new.revoked_at is null then
    insert into private.notification_outbox(recipient_id,template,event_key,data)
      values(new.user_id,'mfa-changed','factor-bound:'||new.factor_id::text||':'||new.bound_at::text,jsonb_build_object('action','enrolled')) on conflict(event_key) do nothing;
  end if;
  return new;
end $$;
create trigger factor_binding_notice after insert or update of bound_at on private.factor_bindings for each row execute function private.mitsa_factor_notice();
revoke all on function private.mitsa_factor_notice() from public,anon,authenticated;
create or replace function private.mitsa_security_status() returns jsonb
language plpgsql security definer set search_path='' set row_security=on as $$ declare c jsonb:=private.mitsa_auth_context(); factors jsonb; pending jsonb; begin
  if c is null then raise exception 'forbidden' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',b.factor_id,'active',b.revoked_at is null and b.generation=(select generation from private.account_security where user_id=private.current_actor()) and c->'verifiedFactors' @> jsonb_build_array(b.factor_id),'boundAt',b.bound_at)),'[]')
    into factors from private.factor_bindings b where b.user_id=private.current_actor();
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'targetId',p.target_factor_id,'action',p.action,'expiresAt',p.expires_at)),'[]') into pending
    from private.security_permits p where p.user_id=private.current_actor() and p.session_id=(c->>'sessionId')::uuid and p.action in ('remove','disable') and p.consumed_at is null and p.expires_at>now();
  return jsonb_build_object('ready',private.mitsa_mfa_ready(),'recent',private.mitsa_recent_auth(),'currentFactorId',c->'factorId','factors',factors,'pendingRemovals',pending,
    'initialized',coalesce((select initialized from private.account_security where user_id=private.current_actor()),false));
end $$;

-- Privileged registration service receives only an intent; it never assigns
-- memberships or asks Auth to skip email verification.
create function private.mitsa_registration_intent(p_email text,p_name text,p_terms uuid,p_nonce_hash text,p_accepted boolean) returns uuid
language plpgsql security definer set search_path='' set row_security=on as $$ declare allowed boolean; intent uuid; v private.legal_versions; begin
  if p_email is null or p_email<>lower(btrim(p_email)) or length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_name is null or length(btrim(p_name)) not between 1 and 120 or p_nonce_hash is null or p_nonce_hash !~ '^[0-9a-f]{64}$' or p_accepted is distinct from true then raise exception 'registration unavailable' using errcode='22023'; end if;
  select * into v from private.legal_versions where id=p_terms and kind='terms';
  select (g.registration_enabled and g.eligibility_approved and g.legal_publication_enabled and v.status='published' and v.effective_at<=now())
    or (v.status='test' and exists(select 1 from private.registration_test_recipients r where r.email=p_email and r.enabled)) into allowed
    from private.release_gates g where g.singleton and g.test_terms_id=p_terms;
  if allowed is distinct from true then raise exception 'registration unavailable' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_email,8415));
  if (select count(*) from private.registration_intents where email=p_email and created_at>now()-interval '1 hour')>=3 then raise exception 'registration rate limit' using errcode='54000'; end if;
  insert into private.registration_intents(email,full_name,nonce_hash,terms_id) values(p_email,btrim(p_name),p_nonce_hash,p_terms) returning id into intent;
  return intent;
end $$;

-- Runs before Auth inserts the user. No query/FK to that future Auth row.
create function private.mitsa_before_user_created(event jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$ declare nonce text; v_email text; uid uuid; intent private.registration_intents; allowed boolean; begin
  nonce:=event->'user'->'user_metadata'->>'registration_nonce';
  v_email:=lower(btrim(event->'user'->>'email'));
  uid:=(event->'user'->>'id')::uuid;
  if nonce is null or nonce !~ '^[0-9a-f]{64}$' or uid is null or coalesce((event->'user'->>'is_anonymous')::boolean,true) then return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Registration unavailable.')); end if;
  select * into intent from private.registration_intents ri where ri.nonce_hash=encode(sha256(convert_to(nonce,'UTF8')),'hex') and ri.email=v_email for update;
  if not found or intent.email is distinct from v_email or intent.expires_at<=now() or intent.finalized_at is not null or intent.provider_user_id is not null and intent.provider_user_id<>uid then
    return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Registration unavailable.'));
  end if;
  select (g.registration_enabled and g.eligibility_approved and g.legal_publication_enabled and v.status='published' and v.effective_at<=now())
    or (v.status='test' and exists(select 1 from private.registration_test_recipients r where r.email=intent.email and r.enabled)) into allowed
    from private.release_gates g join private.legal_versions v on v.id=g.test_terms_id where g.singleton and v.id=intent.terms_id;
  if allowed is distinct from true then return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Registration unavailable.')); end if;
  update private.registration_intents set provider_user_id=uid where id=intent.id;
  return '{}'::jsonb;
exception when invalid_text_representation then return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Registration unavailable.'));
end $$;

create function private.mitsa_finalize_registration() returns boolean
language plpgsql security definer set search_path='' set row_security=on as $$ declare c jsonb:=private.mitsa_auth_context(); intent private.registration_intents; begin
  if c is null or c->'verified'<>'true' then raise exception 'verified account required' using errcode='42501'; end if;
  select * into intent from private.registration_intents where provider_user_id=private.current_actor() for update;
  if not found then return false; end if;
  if intent.finalized_at is not null then return true; end if;
  if intent.email is distinct from c->>'email' then raise exception 'registration identity mismatch' using errcode='42501'; end if;
  insert into private.account_profiles(user_id,full_name) values(private.current_actor(),intent.full_name) on conflict do nothing;
  insert into private.legal_acceptances(user_id,version_id,accepted_at,source) values(private.current_actor(),intent.terms_id,intent.accepted_at,'registration') on conflict do nothing;
  update private.registration_intents set finalized_at=now() where id=intent.id;
  return true;
end $$;

do $$ declare f record; begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'
    and p.proname in ('mitsa_current_terms','mitsa_accept_terms','mitsa_begin_factor_removal','mitsa_finish_factor_removal','mitsa_registration_intent','mitsa_finalize_registration') loop
    execute format('alter function %s owner to app_workspace',f.signature);
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    if f.signature::text not like '%mitsa_registration_intent(%' then execute format('grant execute on function %s to authenticated',f.signature); end if;
  end loop;
end $$;
-- Hook role gets only the necessary private relations, never business records.
grant usage on schema private to supabase_auth_admin;
grant select on private.registration_intents,private.registration_test_recipients,private.release_gates,private.legal_versions to supabase_auth_admin;
grant update(provider_user_id) on private.registration_intents to supabase_auth_admin;
create policy hook_intents_select on private.registration_intents for select to supabase_auth_admin using(true);
create policy hook_intents_update on private.registration_intents for update to supabase_auth_admin using(true) with check(true);
create policy hook_recipients on private.registration_test_recipients for select to supabase_auth_admin using(true);
create policy hook_gates on private.release_gates for select to supabase_auth_admin using(true);
create policy hook_versions on private.legal_versions for select to supabase_auth_admin using(true);
revoke all on function private.mitsa_before_user_created(jsonb) from public,anon,authenticated,app_workspace;
grant execute on function private.mitsa_before_user_created(jsonb) to supabase_auth_admin;

grant usage on schema api to service_role;
grant execute on function private.mitsa_registration_intent(text,text,uuid,text,boolean) to service_role;
create function api.mitsa_registration_intent(p_email text,p_name text,p_terms uuid,p_nonce_hash text,p_accepted boolean) returns uuid language sql security invoker set search_path='' as $$ select private.mitsa_registration_intent(p_email,p_name,p_terms,p_nonce_hash,p_accepted) $$;
revoke all on function api.mitsa_registration_intent(text,text,uuid,text,boolean) from public,anon,authenticated;
grant execute on function api.mitsa_registration_intent(text,text,uuid,text,boolean) to service_role;
-- Schema USAGE does not grant access to any private table.
grant usage on schema private to service_role;
create function api.mitsa_current_terms() returns jsonb language sql security invoker set search_path='' as $$ select private.mitsa_current_terms() $$;
create function api.mitsa_accept_terms(p_version uuid) returns void language sql security invoker set search_path='' as $$ select private.mitsa_accept_terms(p_version) $$;
create function api.mitsa_begin_factor_removal(p_factor uuid,p_disable boolean) returns uuid language sql security invoker set search_path='' as $$ select private.mitsa_begin_factor_removal(p_factor,p_disable) $$;
create function api.mitsa_finish_factor_removal(p_permit uuid) returns void language sql security invoker set search_path='' as $$ select private.mitsa_finish_factor_removal(p_permit) $$;
create function api.mitsa_finalize_registration() returns boolean language sql security invoker set search_path='' as $$ select private.mitsa_finalize_registration() $$;
do $$ declare f record; begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='api'
    and p.proname in ('mitsa_current_terms','mitsa_accept_terms','mitsa_begin_factor_removal','mitsa_finish_factor_removal','mitsa_finalize_registration') loop
    execute format('revoke all on function %s from public,anon',f.signature);
    execute format('grant execute on function %s to authenticated',f.signature);
  end loop;
end $$;
revoke create on schema private from app_workspace;
notify pgrst,'reload schema';
