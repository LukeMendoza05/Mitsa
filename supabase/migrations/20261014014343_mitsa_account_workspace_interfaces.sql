-- Reviewed UI dependencies. Isolated target only; no gates are enabled.
do $$ begin assert (select marker='fireworks-foundation-proof-01a12e38' from foundation_probe.environment_identity where singleton), 'unapproved environment'; end $$;
grant create on schema private to app_workspace;

-- Public policy text only. No account, membership, invitation or email data.
create function private.mitsa_registration_policy() returns jsonb
language sql stable security definer set search_path='' set row_security=on as $$
  select jsonb_build_object('id',v.id,'version',v.version,'content',v.content,'hash',v.content_hash,'status',v.status,
    'publicRegistration',g.registration_enabled and g.eligibility_approved and g.legal_publication_enabled and v.status='published' and v.effective_at<=now())
  from private.release_gates g join private.legal_versions v on v.id=g.test_terms_id where g.singleton and v.kind='terms'
    and (v.status='test' or v.status='published' and g.legal_publication_enabled and v.effective_at<=now())
$$;
create function private.mitsa_account_profile() returns jsonb
language plpgsql security definer set search_path='' set row_security=on as $$ declare actor uuid:=private.current_actor(); begin
  if actor is null then raise exception 'forbidden' using errcode='42501'; end if;
  return jsonb_build_object('fullName',(select full_name from private.account_profiles where user_id=actor));
end $$;
create function private.mitsa_account_profile_save(p_name text) returns void
language plpgsql security definer set search_path='' set row_security=on as $$ declare c jsonb:=private.mitsa_auth_context(); begin
  if c is null or c->'verified'<>'true' then raise exception 'forbidden' using errcode='42501'; end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 120 then raise exception 'invalid profile' using errcode='22023'; end if;
  insert into private.account_profiles(user_id,full_name) values(private.current_actor(),btrim(p_name))
    on conflict(user_id) do update set full_name=excluded.full_name;
  perform private.mitsa_audit(null,'account.profile-updated',private.current_actor());
end $$;
create function private.mitsa_workspace_profile_save(p_business uuid,p_name text) returns void
language plpgsql security definer set search_path='' set row_security=on as $$ begin
  perform 1 from private.businesses where id=p_business for update;
  perform private.mitsa_require(p_business,'owner');
  if not private.mitsa_recent_auth() then raise exception 'recent authentication required' using errcode='42501'; end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 120 then raise exception 'invalid business name' using errcode='22023'; end if;
  update private.businesses set name=btrim(p_name) where id=p_business;
  perform private.mitsa_audit(p_business,'workspace.profile-updated',p_business);
end $$;
create function private.mitsa_locations(p_business uuid) returns jsonb
language plpgsql security definer set search_path='' set row_security=on as $$ begin
  perform private.mitsa_require(p_business,'manage-locations');
  return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'kind',kind,'active',active) order by name,id),'[]') from private.shops where business_id=p_business);
end $$;
create function private.mitsa_transfer_cancel(p_business uuid,p_transfer uuid) returns void
language plpgsql security definer set search_path='' set row_security=on as $$ begin
  perform 1 from private.businesses where id=p_business for update;
  perform private.mitsa_require(p_business,'owner');
  update private.ownership_transfers set status='cancelled' where id=p_transfer and business_id=p_business and status='pending';
  if not found then raise exception 'transfer unavailable' using errcode='42501'; end if;
  perform private.mitsa_audit(p_business,'ownership.cancelled',p_transfer);
end $$;
create function private.mitsa_invite_resend(p_business uuid,p_invite uuid,p_hash text) returns jsonb
language plpgsql security definer set search_path='' set row_security=on as $$ declare caller text; inv private.workspace_invitations; expires timestamptz; begin
  perform 1 from private.businesses where id=p_business for update;
  caller:=private.mitsa_require(p_business,'manage-staff');
  select * into inv from private.workspace_invitations where id=p_invite and business_id=p_business for update;
  if not found or inv.status not in ('pending','expired') or caller='admin' and inv.role<>'staff' then raise exception 'invitation unavailable' using errcode='42501'; end if;
  if inv.role='admin' and not private.mitsa_recent_auth() then raise exception 'recent authentication required' using errcode='42501'; end if;
  if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' or p_hash=inv.token_hash then raise exception 'invalid invitation' using errcode='22023'; end if;
  if exists(select 1 from private.invitation_locations l left join private.shops s on s.id=l.shop_id and s.business_id=l.business_id where l.invitation_id=inv.id and (s.id is null or not s.active)) then raise exception 'invalid location assignment' using errcode='22023'; end if;
  if (select count(*) from private.access_audit where business_id=p_business and event in ('invitation.issued','invitation.resent') and created_at>now()-interval '1 hour')>=30 then raise exception 'invitation rate limit' using errcode='54000'; end if;
  update private.workspace_invitations set token_hash=p_hash,status='pending',resolved_at=null,invited_by=private.current_actor(),issued_at=now(),expires_at=now()+interval '7 days' where id=inv.id returning expires_at into expires;
  perform private.mitsa_audit(p_business,'invitation.resent',inv.id);
  return jsonb_build_object('id',inv.id,'email',inv.email,'role',inv.role,'expiresAt',expires);
end $$;

do $$ declare f record; begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'
    and p.proname in ('mitsa_registration_policy','mitsa_account_profile','mitsa_account_profile_save','mitsa_workspace_profile_save','mitsa_locations','mitsa_transfer_cancel','mitsa_invite_resend') loop
    execute format('alter function %s owner to app_workspace',f.signature);
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to authenticated',f.signature);
  end loop;
end $$;
grant execute on function private.mitsa_registration_policy() to anon;
create function api.mitsa_registration_policy() returns jsonb language sql security invoker set search_path='' as $$ select private.mitsa_registration_policy() $$;
create function api.mitsa_account_profile() returns jsonb language sql security invoker set search_path='' as $$ select private.mitsa_account_profile() $$;
create function api.mitsa_account_profile_save(p_name text) returns void language sql security invoker set search_path='' as $$ select private.mitsa_account_profile_save(p_name) $$;
create function api.mitsa_workspace_profile_save(p_business uuid,p_name text) returns void language sql security invoker set search_path='' as $$ select private.mitsa_workspace_profile_save(p_business,p_name) $$;
create function api.mitsa_locations(p_business uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.mitsa_locations(p_business) $$;
create function api.mitsa_transfer_cancel(p_business uuid,p_transfer uuid) returns void language sql security invoker set search_path='' as $$ select private.mitsa_transfer_cancel(p_business,p_transfer) $$;
create function api.mitsa_invite_resend(p_business uuid,p_invite uuid,p_hash text) returns jsonb language sql security invoker set search_path='' as $$ select private.mitsa_invite_resend(p_business,p_invite,p_hash) $$;
do $$ declare f record; begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='api'
    and p.proname in ('mitsa_registration_policy','mitsa_account_profile','mitsa_account_profile_save','mitsa_workspace_profile_save','mitsa_locations','mitsa_transfer_cancel','mitsa_invite_resend') loop
    execute format('revoke all on function %s from public,anon',f.signature);
    execute format('grant execute on function %s to authenticated',f.signature);
  end loop;
end $$;
grant execute on function api.mitsa_registration_policy() to anon;
-- Only this fixed public-policy reader is executable by anon. Schema USAGE
-- confers no table privileges and private is not an exposed Data API schema.
grant usage on schema api,private to anon;
create or replace function private.mitsa_invite_issue(p_business uuid,p_email text,p_role text,p_locations uuid[],p_hash text) returns jsonb
language plpgsql security definer set search_path='' set row_security=on as $$ declare caller text; invite uuid; expires timestamptz; begin
  perform 1 from private.businesses where id=p_business for update;
  caller:=private.mitsa_require(p_business,'manage-staff');
  if p_role is null or p_role not in ('admin','staff') or (p_role='admin' and caller<>'owner') then raise exception 'forbidden' using errcode='42501'; end if;
  if p_role='admin' and not private.mitsa_recent_auth() then raise exception 'recent authentication required' using errcode='42501'; end if;
  if p_email is null or length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid invitation' using errcode='22023'; end if;
  if p_locations is null or exists(select 1 from unnest(p_locations) l where not exists(select 1 from private.shops s where s.business_id=p_business and s.id=l and s.active)) then raise exception 'invalid location assignment' using errcode='22023'; end if;
  -- Workspace lock serializes initial issuance AND resend limits.
  if (select count(*) from private.access_audit where business_id=p_business and event in ('invitation.issued','invitation.resent') and created_at>now()-interval '1 hour')>=30 then raise exception 'invitation rate limit' using errcode='54000'; end if;
  if (select count(*) from private.workspace_invitations where business_id=p_business and issued_at>now()-interval '1 hour')>=30 then raise exception 'invitation rate limit' using errcode='54000'; end if;
  insert into private.workspace_invitations(business_id,email,role,invited_by,token_hash)
    values(p_business,lower(btrim(p_email)),p_role,private.current_actor(),p_hash) returning id,expires_at into invite,expires;
  if p_role='staff' then insert into private.invitation_locations select invite,p_business,l from (select distinct unnest(p_locations) l) locations; end if;
  perform private.mitsa_audit(p_business,'invitation.issued',invite,jsonb_build_object('role',p_role));
  return jsonb_build_object('id',invite,'expiresAt',expires);
end $$;

revoke create on schema private from app_workspace;
notify pgrst,'reload schema';
