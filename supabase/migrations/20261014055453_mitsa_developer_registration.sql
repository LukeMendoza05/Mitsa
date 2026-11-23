-- Prepared for explicit isolated activation approval. Not a public-signup gate.
do $$ begin assert (select marker='fireworks-foundation-proof-01a12e38' from foundation_probe.environment_identity where singleton), 'unapproved environment'; end $$;
create table private.developer_registration_recipients (
  email text primary key check(email=lower(btrim(email)) and length(email)<=254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  singleton boolean not null default true unique check(singleton),
  enabled boolean not null default false,
  approved_at timestamptz not null,
  approval_reference text not null check(approval_reference='mitsa-developer-registration-isolated-v1')
);
alter table private.developer_registration_recipients enable row level security;
alter table private.developer_registration_recipients force row level security;
revoke all on private.developer_registration_recipients from public,anon,authenticated,service_role;
grant select on private.developer_registration_recipients to app_workspace,supabase_auth_admin;
create policy developer_registration_read on private.developer_registration_recipients for select to app_workspace,supabase_auth_admin using(true);

create function private.mitsa_test_recipient_allowed(p_email text) returns boolean
language sql stable security invoker set search_path='' set row_security=on as $$
  select exists(select 1 from private.registration_test_recipients r where r.email=p_email and r.enabled)
    or (exists(select 1 from private.developer_registration_recipients r where r.email=p_email and r.enabled and r.approved_at<=statement_timestamp())
      and exists(select 1 from private.release_gates g where g.singleton and not g.registration_enabled and not g.eligibility_approved and not g.external_mail_enabled and not g.legal_publication_enabled and not g.disposal_enabled))
$$;
revoke all on function private.mitsa_test_recipient_allowed(text) from public,anon,authenticated,service_role;
grant execute on function private.mitsa_test_recipient_allowed(text) to app_workspace,supabase_auth_admin;

-- Replace only recipient eligibility. Preserve signature verification, replay,
-- exact agreement, nonce binding, expiry, verification and all shared limits.
do $$ declare definition text; old text; signature regprocedure; begin
  signature:='private.mitsa_registration_intent(text,text,uuid,text,boolean)'::regprocedure;
  definition:=pg_get_functiondef(signature);
  old:='exists(select 1 from private.registration_test_recipients r where r.email=p_email and r.enabled)';
  assert position(old in definition)>0,'unexpected intent implementation';
  execute replace(definition,old,'private.mitsa_test_recipient_allowed(p_email)');
  signature:='private.mitsa_before_user_created(jsonb)'::regprocedure;
  definition:=pg_get_functiondef(signature);
  old:='exists(select 1 from private.registration_test_recipients r where r.email=intent.email and r.enabled)';
  assert position(old in definition)>0,'unexpected signup hook implementation';
  execute replace(definition,old,'private.mitsa_test_recipient_allowed(intent.email)');
  signature:='private.mitsa_isolated_send_email(jsonb)'::regprocedure;
  definition:=pg_get_functiondef(signature);
  old:='recipient !~ ''^foundation-[a-zA-Z0-9-]+@example\.invalid$''';
  assert position(old in definition)>0,'unexpected mail recipient guard';
  definition:=replace(definition,old,'not private.mitsa_test_recipient_allowed(recipient)');
  old:='or not exists(select 1 from private.registration_test_recipients r where r.email=recipient and r.enabled)';
  assert position(old in definition)>0,'unexpected mail allowlist guard';
  execute replace(definition,old,'');
end $$;
-- No recipient is inserted, enabled or granted a role by this migration.
notify pgrst,'reload schema';
