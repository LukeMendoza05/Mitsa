-- Current-actor only; exposes neither auth.sessions nor arbitrary membership lookup.
create function api.foundation_identity() returns jsonb
language plpgsql security invoker set search_path = ''
as $$ declare memberships jsonb; begin
  if not private.session_is_active() then raise exception 'session revoked' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('businessId',m.business_id,'role',m.role)),'[]'::jsonb)
    into memberships from private.memberships m where m.user_id=auth.uid() and m.active;
  return jsonb_build_object('userId',auth.uid(),'memberships',memberships);
end $$;
revoke all on function api.foundation_identity() from public, anon;
grant execute on function api.foundation_identity() to authenticated;
notify pgrst,'reload schema';
