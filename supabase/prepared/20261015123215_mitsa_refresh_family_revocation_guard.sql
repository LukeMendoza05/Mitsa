-- UNAPPLIED REVIEW CANDIDATE. Requires separate explicit approval.
-- Approved isolated target only; no account, factor or business-data mutation.
do $$ begin
 assert current_user='postgres','approved operator required';
 assert (select marker='fireworks-foundation-proof-01a12e38' from foundation_probe.environment_identity where singleton),'isolated target marker mismatch';
 assert (select encode(sha256(convert_to(pg_get_functiondef(oid),'UTF8')),'hex')='587affbee9b5b7bf9cfd3b8bf343eda75626ec0fb9b886b9f3c370995182d652' from pg_proc where oid='private.current_actor()'::regprocedure),'actor definition differs from reviewed baseline';
 assert to_regclass('private.session_revocations') is null,'revocation ledger already exists';
 assert not exists(select 1 from pg_trigger where tgrelid='auth.refresh_tokens'::regclass and not tgisinternal),'Auth refresh trigger set changed';
end $$;

create function private.mitsa_expire_revoked_refresh_family() returns trigger
language plpgsql security definer set search_path='' set row_security=on as $$ begin
 if TG_TABLE_SCHEMA<>'auth' or TG_TABLE_NAME<>'refresh_tokens' or TG_OP<>'UPDATE' then raise exception 'invalid trigger context' using errcode='42501'; end if;
 if NEW.session_id is not null
 and not exists(select 1 from auth.refresh_tokens r where r.session_id=NEW.session_id and not r.revoked) then
  -- A fixed expired instant avoids provider/application clock skew reopening
  -- the already-revoked session. This does not change code or JWT lifetimes.
  update auth.sessions s set not_after='1970-01-01 00:00:00+00'::timestamptz
   where s.id=NEW.session_id and s.user_id::text=NEW.user_id::text
   and (s.not_after is null or s.not_after>'1970-01-01 00:00:00+00'::timestamptz);
 end if;
 return NEW;
end $$;
revoke all on function private.mitsa_expire_revoked_refresh_family() from public,anon,authenticated,service_role,supabase_auth_admin,app_workspace,app_authz,app_command;
-- Deferred until the provider transaction completes: normal rotation has a
-- replacement token; family revocation commits with none. No token value is read.
create constraint trigger mitsa_refresh_family_revocation
after update on auth.refresh_tokens deferrable initially deferred
for each row when (OLD.revoked=false and NEW.revoked=true)
execute function private.mitsa_expire_revoked_refresh_family();
