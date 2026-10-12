do $$ declare invalid_count integer; begin
  assert (select count(*)=2 from pg_roles where rolname in ('app_authz','app_command') and not rolcanlogin and not rolbypassrls and not rolsuper), 'unsafe or missing custom role';
  assert not has_schema_privilege('app_authz','auth','usage') and not has_schema_privilege('app_command','auth','usage'), 'business roles have managed Auth schema access';
  assert (select p.pronargs=0 and p.prorettype='uuid'::regtype and p.prosecdef and pg_get_userbyid(p.proowner)='postgres' and 'search_path=""'=any(p.proconfig) and 'row_security=on'=any(p.proconfig) from pg_proc p where p.oid='private.current_actor()'::regprocedure), 'unsafe Auth-only adapter';
  assert not has_function_privilege('anon','private.current_actor()','execute'), 'anonymous adapter access';
  assert not has_column_privilege('app_authz','auth.sessions','id','select'), 'obsolete Auth column access';
  select count(*) into invalid_count from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('private','foundation_probe') and c.relkind='r'
    and (not c.relrowsecurity or not c.relforcerowsecurity or pg_get_userbyid(c.relowner) in ('app_authz','app_command'));
  assert invalid_count=0, 'unsafe table owner or RLS flags';
  assert not has_function_privilege('anon','api.foundation_increment(uuid,uuid,integer,uuid)','execute'), 'anon execute granted';
  assert not has_function_privilege('anon','api.foundation_identity()','execute'), 'anon identity execute granted';
  assert not has_function_privilege('anon','public.rls_auto_enable()','execute'), 'platform event helper exposed to anon';
  assert not has_function_privilege('authenticated','public.rls_auto_enable()','execute'), 'platform event helper exposed to authenticated';
  assert not has_table_privilege('authenticated','foundation_probe.resources','update'), 'direct authenticated DML granted';
  assert not pg_has_role('authenticated','app_command','member'), 'authenticated may assume command owner';
  assert not pg_has_role('authenticated','app_authz','member'), 'authenticated may assume helper owner';
  assert not has_schema_privilege('app_command','private','create'), 'command owner may create objects';
  assert exists(select 1 from pg_policies where schemaname='private' and tablename='memberships' and policyname='command_membership_lock' and roles=array['app_command']::name[] and with_check='false'), 'membership lock must deny actual updates';
  assert not exists(select 1 from pg_policies where schemaname='auth' and policyname='foundation_current_session'), 'obsolete custom Auth policy remains';
  assert (select relrowsecurity and pg_get_userbyid(relowner)='supabase_auth_admin' from pg_class where oid='auth.sessions'::regclass), 'managed Auth ownership or RLS changed';
  assert (select p.prosecdef and pg_get_userbyid(p.proowner)='app_command' and 'search_path=""'=any(p.proconfig) and 'row_security=on'=any(p.proconfig) from pg_proc p where p.oid='private.foundation_increment(uuid,uuid,integer,uuid)'::regprocedure), 'unsafe command definition';
  assert (select not p.prosecdef from pg_proc p where p.oid='api.foundation_increment(uuid,uuid,integer,uuid)'::regprocedure), 'wrapper bypasses caller privileges';
  assert (select 'security_invoker=true'=any(c.reloptions) from pg_class c where c.oid='api.foundation_resources'::regclass), 'view bypasses RLS';
  assert (select marker='fireworks-foundation-proof-01a12e38' from foundation_probe.environment_identity where singleton), 'wrong test database';
end $$;
