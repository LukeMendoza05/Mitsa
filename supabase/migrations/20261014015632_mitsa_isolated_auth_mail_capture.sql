-- PENDING EXPLICIT APPROVAL: isolated Auth mail capture, never a production hook.
do $$ begin assert (select marker='fireworks-foundation-proof-01a12e38' from foundation_probe.environment_identity where singleton), 'unapproved environment'; end $$;
create table private.isolated_mail_config (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false,
  public_key text check(public_key like '-----BEGIN PGP PUBLIC KEY BLOCK-----%'),
  check(not enabled or public_key is not null)
);
insert into private.isolated_mail_config(singleton) values(true);
create table private.isolated_auth_mail (
  id uuid primary key default gen_random_uuid(),
  recipient_hash text not null check(recipient_hash ~ '^[0-9a-f]{64}$'),
  action text not null check(action in ('signup','recovery')),
  encrypted_payload bytea not null,
  created_at timestamptz not null default statement_timestamp()
);
create index isolated_auth_mail_limits on private.isolated_auth_mail(recipient_hash,created_at);
alter table private.isolated_mail_config enable row level security;
alter table private.isolated_mail_config force row level security;
alter table private.isolated_auth_mail enable row level security;
alter table private.isolated_auth_mail force row level security;
revoke all on private.isolated_mail_config,private.isolated_auth_mail from public,anon,authenticated,service_role,app_workspace;
grant select on private.isolated_mail_config,private.isolated_auth_mail to supabase_auth_admin;
grant insert on private.isolated_auth_mail to supabase_auth_admin;
create policy auth_mail_config on private.isolated_mail_config for select to supabase_auth_admin using(true);
create policy auth_mail_limit on private.isolated_auth_mail for select to supabase_auth_admin using(true);
create policy auth_mail_capture on private.isolated_auth_mail for insert to supabase_auth_admin with check(true);
grant usage on schema extensions to supabase_auth_admin;
grant execute on function extensions.dearmor(text),extensions.pgp_pub_encrypt(text,bytea,text) to supabase_auth_admin;

create function private.mitsa_isolated_send_email(event jsonb) returns jsonb
language plpgsql security invoker set search_path='' set row_security=on as $$
declare recipient text; action text; uid uuid; token_hash text; public_key text; v_recipient_hash text; payload jsonb;
begin
  if current_user<>'supabase_auth_admin' then raise exception 'forbidden' using errcode='42501'; end if;
  select c.public_key into public_key from private.isolated_mail_config c where c.singleton and c.enabled;
  if public_key is null then raise exception 'mail unavailable'; end if;
  recipient:=lower(btrim(event->'user'->>'email'));
  uid:=(event->'user'->>'id')::uuid;
  action:=event->'email_data'->>'email_action_type';
  token_hash:=event->'email_data'->>'token_hash';
  if recipient is null or recipient !~ '^foundation-[a-zA-Z0-9-]+@example\.invalid$'
    or not exists(select 1 from private.registration_test_recipients r where r.email=recipient and r.enabled)
    or uid is null or action is null or action not in ('signup','recovery')
    or token_hash is null or length(token_hash) not between 32 and 256 or token_hash !~ '^[a-f0-9]+$'
    or event->'email_data'->>'redirect_to' is distinct from 'http://127.0.0.1:3000/auth/email'
    then raise exception 'mail unavailable'; end if;
  if action='signup' and not exists(select 1 from private.registration_intents i where i.provider_user_id=uid and i.email=recipient and i.expires_at>now() and i.finalized_at is null) then raise exception 'mail unavailable'; end if;
  v_recipient_hash:=encode(sha256(convert_to(recipient,'UTF8')),'hex');
  perform pg_advisory_xact_lock(8417,1);
  if (select count(*) from private.isolated_auth_mail m where m.created_at>statement_timestamp()-interval '1 hour')>=100
    or (select count(*) from private.isolated_auth_mail m where m.recipient_hash=v_recipient_hash and m.created_at>statement_timestamp()-interval '1 hour')>=10 then raise exception 'mail unavailable'; end if;
  -- Discard provider access tokens, metadata and numeric OTPs. A dedicated
  -- local operator key is required to decrypt even the one-time hash/link.
  payload:=jsonb_build_object('email',recipient,'userId',uid,'type',action,'tokenHash',token_hash,'origin','http://127.0.0.1:3000');
  insert into private.isolated_auth_mail(recipient_hash,action,encrypted_payload)
    values(v_recipient_hash,action,extensions.pgp_pub_encrypt(payload::text,extensions.dearmor(public_key),'cipher-algo=aes256,compress-algo=0,unicode-mode=1'));
  return '{}'::jsonb;
exception when others then
  return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Test mail unavailable.'));
end $$;
revoke all on function private.mitsa_isolated_send_email(jsonb) from public,anon,authenticated,service_role,app_workspace;
grant execute on function private.mitsa_isolated_send_email(jsonb) to supabase_auth_admin;
-- Deliberately leaves capture disabled and does not change any Auth setting.
