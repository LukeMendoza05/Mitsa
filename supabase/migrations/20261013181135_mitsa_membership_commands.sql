do $$ begin assert (select marker='fireworks-foundation-proof-01a12e38' from foundation_probe.environment_identity where singleton), 'unapproved environment'; end $$;
grant create on schema private to app_workspace;

create function private.mitsa_members(p_business uuid) returns jsonb
language plpgsql security definer set search_path='' set row_security=on as $$ declare result jsonb; begin
  perform private.mitsa_require(p_business,'manage-staff');
  select coalesce(jsonb_agg(jsonb_build_object('userId',m.user_id,'role',m.role,'active',m.active,
    'name',p.full_name,'locations',coalesce((select jsonb_agg(a.shop_id) from private.shop_assignments a where a.business_id=p_business and a.user_id=m.user_id),'[]')) order by m.joined_at),'[]')
    into result from private.memberships m left join private.account_profiles p on p.user_id=m.user_id where m.business_id=p_business;
  return result;
end $$;
create function private.mitsa_member_update(p_business uuid,p_user uuid,p_role text,p_active boolean,p_locations uuid[]) returns void
language plpgsql security definer set search_path='' set row_security=on as $$ declare caller text; target private.memberships; begin
  perform 1 from private.businesses where id=p_business for update;
  caller:=private.mitsa_require(p_business,'manage-staff');
  select * into target from private.memberships where business_id=p_business and user_id=p_user for update;
  if not found or target.role='owner' or p_role is null or p_role not in ('admin','staff') or p_active is null
    or caller='admin' and (target.role<>'staff' or p_role<>'staff') then raise exception 'forbidden' using errcode='42501'; end if;
  if (target.role='admin' or p_role='admin') and not private.mitsa_recent_auth() then raise exception 'recent authentication required' using errcode='42501'; end if;
  if p_locations is null or exists(select 1 from unnest(p_locations) l where not exists(select 1 from private.shops s where s.business_id=p_business and s.id=l and s.active)) then raise exception 'invalid location assignment' using errcode='22023'; end if;
  update private.memberships set role=p_role,active=p_active where business_id=p_business and user_id=p_user;
  delete from private.shop_assignments where business_id=p_business and user_id=p_user;
  if p_role='staff' and p_active then insert into private.shop_assignments select p_business,p_user,l from (select distinct unnest(p_locations) l) locations; end if;
  perform private.mitsa_audit(p_business,'membership.updated',p_user,jsonb_build_object('role',p_role,'active',p_active,'locations',p_locations));
end $$;
create function private.mitsa_location_save(p_business uuid,p_id uuid,p_name text,p_kind text,p_active boolean) returns uuid
language plpgsql security definer set search_path='' set row_security=on as $$ declare lid uuid:=coalesce(p_id,gen_random_uuid()); begin
  perform 1 from private.businesses where id=p_business for update;
  perform private.mitsa_require(p_business,'manage-locations');
  if p_name is null or length(btrim(p_name)) not between 1 and 120 or p_kind is null or p_kind not in ('shop','warehouse') or p_active is null then raise exception 'invalid location' using errcode='22023'; end if;
  if p_id is null then insert into private.shops(business_id,id,name,kind,active) values(p_business,lid,btrim(p_name),p_kind,p_active);
  else
    update private.shops set name=btrim(p_name),kind=p_kind,active=p_active where business_id=p_business and id=lid;
    if not found then raise exception 'forbidden' using errcode='42501'; end if;
  end if;
  perform private.mitsa_audit(p_business,'location.updated',lid,jsonb_build_object('active',p_active));
  return lid;
end $$;
create function private.mitsa_invite_issue(p_business uuid,p_email text,p_role text,p_locations uuid[],p_hash text) returns jsonb
language plpgsql security definer set search_path='' set row_security=on as $$ declare caller text; invite uuid; expires timestamptz; begin
  perform 1 from private.businesses where id=p_business for update;
  caller:=private.mitsa_require(p_business,'manage-staff');
  if p_role is null or p_role not in ('admin','staff') or (p_role='admin' and caller<>'owner') then raise exception 'forbidden' using errcode='42501'; end if;
  if p_email is null or length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid invitation' using errcode='22023'; end if;
  if p_locations is null or exists(select 1 from unnest(p_locations) l where not exists(select 1 from private.shops s where s.business_id=p_business and s.id=l and s.active)) then raise exception 'invalid location assignment' using errcode='22023'; end if;
  -- Workspace lock serializes the shared invitation burst limit.
  if (select count(*) from private.workspace_invitations where business_id=p_business and issued_at>now()-interval '1 hour')>=30 then raise exception 'invitation rate limit' using errcode='54000'; end if;
  insert into private.workspace_invitations(business_id,email,role,invited_by,token_hash)
    values(p_business,lower(btrim(p_email)),p_role,private.current_actor(),p_hash) returning id,expires_at into invite,expires;
  if p_role='staff' then insert into private.invitation_locations select invite,p_business,l from (select distinct unnest(p_locations) l) locations; end if;
  perform private.mitsa_audit(p_business,'invitation.issued',invite,jsonb_build_object('role',p_role));
  return jsonb_build_object('id',invite,'expiresAt',expires);
end $$;
create function private.mitsa_invites(p_business uuid) returns jsonb
language plpgsql security definer set search_path='' set row_security=on as $$ begin
  perform private.mitsa_require(p_business,'manage-staff');
  return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'email',email,'role',role,'status',case when status='pending' and expires_at<=now() then 'expired' else status end,'expiresAt',expires_at) order by issued_at desc),'[]') from private.workspace_invitations where business_id=p_business);
end $$;
create function private.mitsa_invite_revoke(p_business uuid,p_invite uuid) returns void
language plpgsql security definer set search_path='' set row_security=on as $$ declare caller text; inv private.workspace_invitations; begin
  perform 1 from private.businesses where id=p_business for update;
  caller:=private.mitsa_require(p_business,'manage-staff');
  select * into inv from private.workspace_invitations where id=p_invite and business_id=p_business for update;
  if not found or caller='admin' and inv.role<>'staff' then raise exception 'forbidden' using errcode='42501'; end if;
  if inv.status='pending' then
    update private.workspace_invitations set status='revoked',resolved_at=now(),token_hash=null where id=inv.id;
    perform private.mitsa_audit(p_business,'invitation.revoked',inv.id);
  end if;
end $$;
create function private.mitsa_invite_context(p_hash text) returns jsonb
language plpgsql security definer set search_path='' set row_security=on as $$ declare inv private.workspace_invitations; c jsonb:=private.mitsa_auth_context(); begin
  -- Only an authenticated, matching verified recipient receives business details.
  if c is null or c->'verified'<>'true' then raise exception 'forbidden' using errcode='42501'; end if;
  select * into inv from private.workspace_invitations where token_hash=p_hash and status='pending' and expires_at>now();
  if not found or inv.email<>c->>'email' then raise exception 'invitation unavailable' using errcode='42501'; end if;
  return jsonb_build_object('id',inv.id,'businessName',(select name from private.businesses where id=inv.business_id),'role',inv.role,'expiresAt',inv.expires_at);
end $$;
create function private.mitsa_invite_accept(p_hash text) returns jsonb
language plpgsql security definer set search_path='' set row_security=on as $$ declare inv private.workspace_invitations; c jsonb:=private.mitsa_auth_context(); inviter text; existing private.memberships; bid uuid; begin
  if c is null or c->'verified'<>'true' then raise exception 'verified account required' using errcode='42501'; end if;
  select business_id into bid from private.workspace_invitations where token_hash=p_hash;
  perform 1 from private.businesses where id=bid and status='active' for update;
  if not found then raise exception 'invitation unavailable' using errcode='42501'; end if;
  select * into inv from private.workspace_invitations where token_hash=p_hash for update;
  if not found or inv.email<>c->>'email' then raise exception 'invitation unavailable' using errcode='42501'; end if;
  if inv.status='accepted' and inv.accepted_by=private.current_actor() then
    -- Idempotent outcome only; the membership may have subsequently been removed.
    return jsonb_build_object('slug',(select slug from private.businesses where id=bid),'accepted',true);
  end if;
  if inv.status<>'pending' or inv.expires_at<=now() then raise exception 'invitation unavailable' using errcode='42501'; end if;
  select role into inviter from private.memberships where business_id=bid and user_id=inv.invited_by and active;
  if inviter is null or inviter not in ('owner','admin') or inv.role='admin' and inviter<>'owner' then raise exception 'invitation unavailable' using errcode='42501'; end if;
  if exists(select 1 from private.invitation_locations l left join private.shops s on s.business_id=l.business_id and s.id=l.shop_id where l.invitation_id=inv.id and (s.id is null or not s.active)) then raise exception 'invitation unavailable' using errcode='42501'; end if;
  if not exists(select 1 from private.legal_acceptances a join private.legal_versions v on v.id=a.version_id
    where a.user_id=private.current_actor() and v.kind='terms' and v.id=(select test_terms_id from private.release_gates where singleton)) then raise exception 'current Terms acceptance required' using errcode='42501'; end if;
  select * into existing from private.memberships where business_id=bid and user_id=private.current_actor() for update;
  if found and existing.active then raise exception 'already a member' using errcode='23505'; end if;
  insert into private.memberships(business_id,user_id,role,active) values(bid,private.current_actor(),inv.role,true)
    on conflict(business_id,user_id) do update set role=excluded.role,active=true,joined_at=now();
  delete from private.shop_assignments where business_id=bid and user_id=private.current_actor();
  if inv.role='staff' then insert into private.shop_assignments select bid,private.current_actor(),shop_id from private.invitation_locations where invitation_id=inv.id; end if;
  update private.workspace_invitations set status='accepted',resolved_at=now(),accepted_by=private.current_actor() where id=inv.id;
  perform private.mitsa_audit(bid,'invitation.accepted',inv.id,jsonb_build_object('role',inv.role));
  return jsonb_build_object('slug',(select slug from private.businesses where id=bid),'accepted',true);
end $$;

create function private.mitsa_transfer_propose(p_business uuid,p_incoming uuid,p_remove_outgoing boolean) returns uuid
language plpgsql security definer set search_path='' set row_security=on as $$ declare transfer uuid; begin
  perform 1 from private.businesses where id=p_business for update;
  perform private.mitsa_require(p_business,'owner');
  if not private.mitsa_recent_auth() or p_remove_outgoing is null then raise exception 'recent authentication required' using errcode='42501'; end if;
  -- Verified membership at creation; final incoming confirmation independently
  -- requires a verified current actor and trusted MFA before any transfer.
  if not exists(select 1 from private.memberships where business_id=p_business and user_id=p_incoming and active and role='admin') then raise exception 'active Admin required' using errcode='22023'; end if;
  update private.ownership_transfers set status='cancelled' where business_id=p_business and status='pending';
  insert into private.ownership_transfers(business_id,outgoing_id,incoming_id,remove_outgoing)
    values(p_business,private.current_actor(),p_incoming,p_remove_outgoing) returning id into transfer;
  perform private.mitsa_audit(p_business,'ownership.proposed',transfer,jsonb_build_object('incomingId',p_incoming,'adminFinancialReset',true));
  return transfer;
end $$;
create function private.mitsa_transfer_confirm(p_transfer uuid) returns jsonb
language plpgsql security definer set search_path='' set row_security=on as $$ declare tr private.ownership_transfers; bid uuid; actor uuid:=private.current_actor(); begin
  select business_id into bid from private.ownership_transfers where id=p_transfer;
  perform 1 from private.businesses where id=bid for update;
  perform private.mitsa_require(bid,'view');
  select * into tr from private.ownership_transfers where id=p_transfer for update;
  if not found or tr.status<>'pending' or tr.expires_at<=now() or actor not in (tr.outgoing_id,tr.incoming_id) or not private.mitsa_recent_auth() then raise exception 'transfer confirmation unavailable' using errcode='42501'; end if;
  if not exists(select 1 from private.memberships where business_id=bid and user_id=tr.outgoing_id and active and role='owner')
    or not exists(select 1 from private.memberships where business_id=bid and user_id=tr.incoming_id and active and role='admin') then raise exception 'membership changed' using errcode='42501'; end if;
  if actor=tr.outgoing_id then tr.outgoing_confirmed_at:=now();
  else tr.incoming_confirmed_at:=now(); end if;
  update private.ownership_transfers set outgoing_confirmed_at=tr.outgoing_confirmed_at,incoming_confirmed_at=tr.incoming_confirmed_at where id=tr.id;
  if tr.outgoing_confirmed_at>now()-interval '5 minutes' and tr.incoming_confirmed_at>now()-interval '5 minutes' then
    update private.memberships set role='admin',active=not tr.remove_outgoing where business_id=bid and user_id=tr.outgoing_id;
    update private.memberships set role='owner' where business_id=bid and user_id=tr.incoming_id;
    update private.businesses set primary_owner_id=tr.incoming_id,admin_financial_access=false where id=bid;
    update private.ownership_transfers set status='completed',completed_at=now() where id=tr.id;
    insert into private.notification_outbox(business_id,recipient_id,template,event_key,data)
      select bid,m.user_id,'ownership-transferred',tr.id::text||':'||m.user_id::text,jsonb_build_object('adminFinancialAccess',false)
      from private.memberships m where m.business_id=bid and (m.active and m.role in ('owner','admin') or m.user_id=tr.outgoing_id);
    perform private.mitsa_audit(bid,'ownership.completed',tr.id,jsonb_build_object('incomingId',tr.incoming_id,'adminFinancialReset',true));
    return jsonb_build_object('completed',true);
  end if;
  return jsonb_build_object('completed',false);
end $$;
create function private.mitsa_transfers(p_business uuid) returns jsonb
language plpgsql security definer set search_path='' set row_security=on as $$ begin
  perform private.mitsa_require(p_business,'view');
  return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'incomingId',incoming_id,'outgoingId',outgoing_id,'removeOutgoing',remove_outgoing,'status',case when status='pending' and expires_at<=now() then 'expired' else status end,'expiresAt',expires_at,'outgoingConfirmedAt',outgoing_confirmed_at,'incomingConfirmedAt',incoming_confirmed_at) order by created_at desc),'[]')
    from private.ownership_transfers where business_id=p_business and private.current_actor() in (incoming_id,outgoing_id));
end $$;
create function private.mitsa_audit_history(p_business uuid) returns jsonb
language plpgsql security definer set search_path='' set row_security=on as $$ begin
  perform private.mitsa_require(p_business,'audit');
  return (select coalesce(jsonb_agg(to_jsonb(events)),'[]') from (select id,actor_id,event,target_id,detail,created_at from private.access_audit where business_id=p_business order by created_at desc,id limit 100) events);
end $$;

do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'
    and p.proname in ('mitsa_members','mitsa_member_update','mitsa_location_save','mitsa_invite_issue','mitsa_invites','mitsa_invite_revoke','mitsa_invite_context','mitsa_invite_accept','mitsa_transfer_propose','mitsa_transfer_confirm','mitsa_transfers','mitsa_audit_history') loop
    execute format('alter function %s owner to app_workspace',f.signature);
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to authenticated',f.signature);
  end loop;
end $$;
create function api.mitsa_members(p_business uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.mitsa_members(p_business) $$;
create function api.mitsa_member_update(p_business uuid,p_user uuid,p_role text,p_active boolean,p_locations uuid[]) returns void language sql security invoker set search_path='' as $$ select private.mitsa_member_update(p_business,p_user,p_role,p_active,p_locations) $$;
create function api.mitsa_location_save(p_business uuid,p_id uuid,p_name text,p_kind text,p_active boolean) returns uuid language sql security invoker set search_path='' as $$ select private.mitsa_location_save(p_business,p_id,p_name,p_kind,p_active) $$;
create function api.mitsa_invite_issue(p_business uuid,p_email text,p_role text,p_locations uuid[],p_hash text) returns jsonb language sql security invoker set search_path='' as $$ select private.mitsa_invite_issue(p_business,p_email,p_role,p_locations,p_hash) $$;
create function api.mitsa_invites(p_business uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.mitsa_invites(p_business) $$;
create function api.mitsa_invite_revoke(p_business uuid,p_invite uuid) returns void language sql security invoker set search_path='' as $$ select private.mitsa_invite_revoke(p_business,p_invite) $$;
create function api.mitsa_invite_context(p_hash text) returns jsonb language sql security invoker set search_path='' as $$ select private.mitsa_invite_context(p_hash) $$;
create function api.mitsa_invite_accept(p_hash text) returns jsonb language sql security invoker set search_path='' as $$ select private.mitsa_invite_accept(p_hash) $$;
create function api.mitsa_transfer_propose(p_business uuid,p_incoming uuid,p_remove_outgoing boolean) returns uuid language sql security invoker set search_path='' as $$ select private.mitsa_transfer_propose(p_business,p_incoming,p_remove_outgoing) $$;
create function api.mitsa_transfer_confirm(p_transfer uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.mitsa_transfer_confirm(p_transfer) $$;
create function api.mitsa_transfers(p_business uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.mitsa_transfers(p_business) $$;
create function api.mitsa_audit_history(p_business uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.mitsa_audit_history(p_business) $$;
do $$ declare f record; begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='api' and p.proname like 'mitsa_%' loop
    execute format('revoke all on function %s from public,anon',f.signature);
    execute format('grant execute on function %s to authenticated',f.signature);
  end loop;
end $$;
revoke create on schema private from app_workspace;
notify pgrst,'reload schema';
