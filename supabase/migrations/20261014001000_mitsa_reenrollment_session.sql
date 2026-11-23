-- Isolated-only safeguard: protects reenrollment after an authorized MFA reset.
do $$ begin assert (select marker='fireworks-foundation-proof-01a12e38' from foundation_probe.environment_identity where singleton), 'unapproved environment'; end $$;
alter table private.account_security add column reset_at timestamptz, add column reenrollment_session_id uuid;
alter table private.security_permits add column issued_at timestamptz;
update private.security_permits set issued_at=expires_at-interval '5 minutes';
alter table private.security_permits alter column issued_at set default statement_timestamp(), alter column issued_at set not null;
-- Only new fields are backfilled. Preserve generations, bindings and permits.
update private.account_security s set reset_at=statement_timestamp() where not s.initialized and exists(select 1 from private.factor_bindings b where b.user_id=s.user_id and b.revoked_at is not null);

create or replace function private.mitsa_prepare_enrollment() returns uuid
language plpgsql security definer set search_path='' set row_security=on as $$ declare c jsonb:=private.mitsa_auth_context(); s private.account_security; permit uuid; begin
  if c is null or c->'verified'<>'true' or not coalesce((c->>'passwordAt')::numeric between extract(epoch from statement_timestamp()-interval '5 minutes') and extract(epoch from statement_timestamp()+interval '5 seconds'),false) then raise exception 'recent password required' using errcode='42501'; end if;
  insert into private.account_security(user_id) values(private.current_actor()) on conflict do nothing;
  select * into s from private.account_security where user_id=private.current_actor() for update;
  if s.recovery_locked or (s.initialized and not private.mitsa_recent_auth()) then raise exception 'trusted MFA required' using errcode='42501'; end if;
  if not s.initialized and s.reset_at is not null and not coalesce(
    s.reenrollment_session_id=(c->>'sessionId')::uuid or (c->>'passwordAt')::numeric>floor(extract(epoch from s.reset_at)),false)
    then raise exception 'new password sign-in required' using errcode='42501'; end if;
  if not s.initialized and jsonb_array_length(c->'verifiedFactors')<>0 then raise exception 'existing factors require reviewed initialization' using errcode='42501'; end if;
  insert into private.security_permits(user_id,session_id,generation,trusted_factor_id,action)
    values(s.user_id,(c->>'sessionId')::uuid,s.generation,case when s.initialized then (c->>'factorId')::uuid end,'enroll') returning id into permit;
  return permit;
end $$;

create or replace function private.mitsa_bind_factor(p_factor uuid,p_permit uuid) returns void
language plpgsql security definer set search_path='' set row_security=on as $$ declare c jsonb:=private.mitsa_auth_context(); s private.account_security; p private.security_permits; begin
  if c is null or c->>'aal'<>'aal2' or c->'verified'<>'true' or (c->>'factorId')::uuid is distinct from p_factor or not(c->'verifiedFactors' @> jsonb_build_array(p_factor)) then raise exception 'verified MFA required' using errcode='42501'; end if;
  insert into private.account_security(user_id) values(private.current_actor()) on conflict do nothing;
  select * into s from private.account_security where user_id=private.current_actor() for update;
  if s.recovery_locked then raise exception 'recovery review required' using errcode='42501'; end if;
  select * into p from private.security_permits where id=p_permit and user_id=s.user_id and session_id=(c->>'sessionId')::uuid and action='enroll' for update;
  if not found or p.consumed_at is not null or p.expires_at<=now() or p.generation<>s.generation then raise exception 'trusted enrollment required' using errcode='42501'; end if;
  if not s.initialized and s.reset_at is not null and p.issued_at<s.reset_at then raise exception 'new enrollment authorization required' using errcode='42501'; end if;
  if s.initialized and (not(c->'verifiedFactors' @> jsonb_build_array(p.trusted_factor_id)) or not exists(
    select 1 from private.factor_bindings where user_id=s.user_id and factor_id=p.trusted_factor_id and generation=s.generation and revoked_at is null)) then raise exception 'trusted enrollment required' using errcode='42501'; end if;
  if not coalesce((c->>'passwordAt')::numeric >= extract(epoch from statement_timestamp()-interval '5 minutes'),false) then raise exception 'recent password required' using errcode='42501'; end if;
  update private.security_permits set consumed_at=now() where id=p.id;
  insert into private.factor_bindings(user_id,factor_id,generation) values(s.user_id,p_factor,s.generation)
    on conflict(user_id,factor_id) do update set generation=excluded.generation,revoked_at=null,bound_at=now();
  update private.account_security set initialized=true where user_id=s.user_id;
  perform private.mitsa_audit(null,'mfa.factor-bound',p_factor);
end $$;

create or replace function private.mitsa_finish_factor_removal(p_permit uuid) returns void
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
    update private.account_security set initialized=false,generation=generation+1,reset_at=statement_timestamp(),reenrollment_session_id=p.session_id where user_id=s.user_id;
  end if;
  update private.security_permits set consumed_at=now() where id=p.id;
  perform private.mitsa_audit(null,case when p.action='disable' or remaining=0 then 'mfa.disabled' else 'mfa.factor-removed' end,p.target_factor_id);
  insert into private.notification_outbox(recipient_id,template,event_key,data)
    values(s.user_id,'mfa-changed',p.id::text,jsonb_build_object('disabled',p.action='disable' or remaining=0));
end $$;

notify pgrst,'reload schema';
