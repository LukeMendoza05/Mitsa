-- PREPARED ONLY. Separate approval required before applying to isolated project
-- mjtejwafxriwntweussc. No activation, data deletion or Auth pointer changes.
do $$ begin
 assert (select marker='fireworks-foundation-proof-01a12e38' from foundation_probe.environment_identity where singleton),'unapproved target';
 assert (select not(registration_enabled or external_mail_enabled or eligibility_approved or legal_publication_enabled or disposal_enabled) from private.release_gates where singleton),'production gates must remain closed';
 assert not private.mitsa_pilot_registration_open(),'close pilot before hook change';
end $$;

-- Provider role only; no elevated execution and no workspace privileges.
create function private.mitsa_development_recovery_allowed(p_user uuid,p_email text)
returns boolean language sql stable security invoker set search_path='' set row_security=on as $$
 select current_user='supabase_auth_admin' and private.mitsa_pilot_registration_open()
  and exists(select 1 from auth.users u join private.registration_intents i on i.provider_user_id=u.id and i.email=u.email
   where u.id=p_user and u.email=p_email and p_email=lower(btrim(p_email))
    and u.email_confirmed_at is not null and not u.is_anonymous and u.deleted_at is null
    and (u.banned_until is null or u.banned_until<=statement_timestamp())
    and i.finalized_at is not null)
$$;
revoke all on function private.mitsa_development_recovery_allowed(uuid,text) from public,anon,authenticated,service_role,app_workspace;
grant execute on function private.mitsa_development_recovery_allowed(uuid,text) to supabase_auth_admin;

do $$ declare definition text; old text; begin
 definition:=pg_get_functiondef('private.mitsa_isolated_send_email(jsonb)'::regprocedure);
 old:='not (private.mitsa_test_recipient_allowed(recipient) or (event->''email_data''->>''email_action_type''=''signup'' and private.mitsa_pilot_registration_open()))';
 assert position(old in definition)>0,'unexpected installed capture implementation';
 assert position('pg_advisory_xact_lock(8417,1)' in definition)>0,'capture rate lock missing';
 assert position('pgp_pub_encrypt' in definition)>0,'encrypted capture missing';
 execute replace(definition,old,
  'not (private.mitsa_test_recipient_allowed(recipient) or (event->''email_data''->>''email_action_type''=''signup'' and private.mitsa_pilot_registration_open()) or (event->''email_data''->>''email_action_type''=''recovery'' and private.mitsa_development_recovery_allowed(uid,recipient)))');
end $$;
-- Original hook owner, ACL, invoker mode, pinned path, origin, intent binding,
-- ciphertext, provider-token checks and capture limits are preserved.
