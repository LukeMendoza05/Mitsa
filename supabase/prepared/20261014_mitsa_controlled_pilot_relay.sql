-- PREPARED, NOT APPLIED. Requires fresh reviewed isolated activation approval.
-- Kept outside migrations to prevent accidental deployment with db push.
do $$ begin
 assert (select marker='fireworks-foundation-proof-01a12e38' from foundation_probe.environment_identity where singleton),'unapproved target';
 assert (select not(registration_enabled or external_mail_enabled or eligibility_approved or legal_publication_enabled or disposal_enabled) from private.release_gates where singleton),'release gates must be closed';
end $$;
create table private.pilot_registration_window(
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 smtp_enabled boolean not null default false,
 approved_at timestamptz,
 expires_at timestamptz,
 origin text not null default 'http://127.0.0.1:3000' check(origin='http://127.0.0.1:3000'),
 provider_otp_expiry_seconds integer check(provider_otp_expiry_seconds between 60 and 86400),
 approved_sender_sha256 text check(approved_sender_sha256 ~ '^[a-f0-9]{64}$'),
 check(not enabled or (approved_at is not null and expires_at>approved_at and expires_at<=approved_at+interval '2 hours')),
 check(not smtp_enabled or enabled and provider_otp_expiry_seconds is not null and approved_sender_sha256 is not null)
);
insert into private.pilot_registration_window(singleton) values(true);
alter table private.pilot_registration_window enable row level security;
alter table private.pilot_registration_window force row level security;
revoke all on private.pilot_registration_window from public,anon,authenticated,service_role;
grant select on private.pilot_registration_window to app_workspace,supabase_auth_admin;
create policy pilot_read on private.pilot_registration_window for select to app_workspace,supabase_auth_admin using(true);

create function private.mitsa_pilot_registration_open() returns boolean
language sql stable security invoker set search_path='' set row_security=on as $$
 select exists(select 1 from private.pilot_registration_window p cross join private.release_gates g
  where p.singleton and g.singleton and p.enabled and p.smtp_enabled
  and p.approved_at<=statement_timestamp() and p.expires_at>statement_timestamp()
  and p.provider_otp_expiry_seconds is not null
  and not(g.registration_enabled or g.external_mail_enabled or g.eligibility_approved or g.legal_publication_enabled or g.disposal_enabled))
$$;
revoke all on function private.mitsa_pilot_registration_open() from public,anon,authenticated,service_role;
grant execute on function private.mitsa_pilot_registration_open() to app_workspace,supabase_auth_admin;

-- Extend test-terms eligibility only behind a deliberately approved local pilot
-- window. Existing private signatures, replay ledger, email/nonce/user binding,
-- Terms, rate caps and public publication gates remain unchanged.
do $$ declare definition text; old text; signature regprocedure; begin
 signature:='private.mitsa_registration_intent(text,text,uuid,text,boolean)'::regprocedure;
 definition:=pg_get_functiondef(signature);old:='private.mitsa_test_recipient_allowed(p_email)';
 assert position(old in definition)>0,'unexpected intent implementation';
 execute replace(definition,old,'(private.mitsa_test_recipient_allowed(p_email) or private.mitsa_pilot_registration_open())');
 signature:='private.mitsa_before_user_created(jsonb)'::regprocedure;
 definition:=pg_get_functiondef(signature);old:='private.mitsa_test_recipient_allowed(intent.email)';
 assert position(old in definition)>0,'unexpected provider hook';
 execute replace(definition,old,'(private.mitsa_test_recipient_allowed(intent.email) or private.mitsa_pilot_registration_open())');
 signature:='private.mitsa_isolated_send_email(jsonb)'::regprocedure;
 definition:=pg_get_functiondef(signature);old:='not private.mitsa_test_recipient_allowed(recipient)';
 assert position(old in definition)>0,'unexpected capture hook';
 -- Real recipients qualify only for signup. Direct recovery/email-change mail
 -- cannot acquire permission from the pilot window.
 execute replace(definition,old,'not (private.mitsa_test_recipient_allowed(recipient) or (event->''email_data''->>''email_action_type''=''signup'' and private.mitsa_pilot_registration_open()))');
 signature:='private.mitsa_registration_policy()'::regprocedure;
 definition:=pg_get_functiondef(signature);old:='''publicRegistration'',g.registration_enabled';
 assert position(old in definition)>0,'unexpected policy implementation';
 execute replace(definition,old,'''pilotRegistration'',private.mitsa_pilot_registration_open(),''publicRegistration'',g.registration_enabled');
end $$;

-- Operator-only durable claim ledger; contains no email/code/hash or message
-- body. SMTP uncertainty retains the claim rather than retrying automatically.
create table private.pilot_mail_deliveries(
 capture_id uuid primary key references private.isolated_auth_mail(id),
 recipient_hash text not null check(recipient_hash ~ '^[a-f0-9]{64}$'),
 state text not null default 'claimed' check(state in ('claimed','smtp-accepted','unconfirmed')),
 created_at timestamptz not null default statement_timestamp()
);
alter table private.pilot_mail_deliveries enable row level security;
alter table private.pilot_mail_deliveries force row level security;
revoke all on private.pilot_mail_deliveries from public,anon,authenticated,service_role,app_workspace,supabase_auth_admin;
-- No activation, recipient insertion, external sending or Auth setting change.
notify pgrst,'reload schema';
