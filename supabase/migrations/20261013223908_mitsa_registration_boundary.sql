-- Applied only to the approved isolated project after preflight and recovery snapshot.
do $$ begin assert (select marker='fireworks-foundation-proof-01a12e38' from foundation_probe.environment_identity where singleton), 'unapproved environment'; end $$;
grant create on schema private to app_workspace;

-- No raw nonce, signature, name or email is retained in the replay ledger.
create table private.registration_requests(
  request_hash text primary key check(request_hash ~ '^[0-9a-f]{64}$'),
  signed_at timestamptz not null, received_at timestamptz not null default statement_timestamp()
);
create index registration_requests_received on private.registration_requests(received_at);
alter table private.registration_requests enable row level security;
alter table private.registration_requests force row level security;
revoke all on private.registration_requests from public,anon,authenticated,service_role;
grant select,insert on private.registration_requests to app_workspace;
create policy workspace_read on private.registration_requests for select to app_workspace using(true);
create policy workspace_insert on private.registration_requests for insert to app_workspace with check(true);

create function private.mitsa_signed_registration_intent(p_email text,p_name text,p_terms uuid,p_nonce_hash text,p_accepted boolean,p_request_hash text,p_signed_at timestamptz) returns uuid
language plpgsql security definer set search_path='' set row_security=on as $$ declare intent uuid; begin
  if p_request_hash is null or p_request_hash !~ '^[0-9a-f]{64}$' or p_signed_at is null
    or abs(extract(epoch from statement_timestamp()-p_signed_at))>60 then raise exception 'registration unavailable' using errcode='42501'; end if;
  -- One lock across instances protects replay and global limits. The internal
  -- command separately locks each email and enforces three intents per hour.
  perform pg_advisory_xact_lock(8416,1);
  if exists(select 1 from private.registration_requests where request_hash=p_request_hash) then raise exception 'registration unavailable' using errcode='23505'; end if;
  if (select count(*) from private.registration_requests where received_at>statement_timestamp()-interval '1 minute')>=30
    or (select count(*) from private.registration_requests where received_at>statement_timestamp()-interval '1 hour')>=100 then raise exception 'registration unavailable' using errcode='54000'; end if;
  insert into private.registration_requests(request_hash,signed_at) values(p_request_hash,p_signed_at);
  -- Any policy/input/rate failure rolls back BOTH the ledger and intent. The
  -- private server signature has already been verified by the Edge handler.
  intent:=private.mitsa_registration_intent(p_email,p_name,p_terms,p_nonce_hash,p_accepted);
  return intent;
end $$;
alter function private.mitsa_signed_registration_intent(text,text,uuid,text,boolean,text,timestamptz) owner to app_workspace;
revoke all on function private.mitsa_signed_registration_intent(text,text,uuid,text,boolean,text,timestamptz) from public,anon,authenticated;
grant execute on function private.mitsa_signed_registration_intent(text,text,uuid,text,boolean,text,timestamptz) to service_role;

-- Remove the legacy service entry point: signed requests must use the atomic
-- boundary. Its internal implementation remains available only to its owner.
revoke all on function api.mitsa_registration_intent(text,text,uuid,text,boolean) from public,anon,authenticated,service_role;
revoke all on function private.mitsa_registration_intent(text,text,uuid,text,boolean) from public,anon,authenticated,service_role;
create function api.mitsa_signed_registration_intent(p_email text,p_name text,p_terms uuid,p_nonce_hash text,p_accepted boolean,p_request_hash text,p_signed_at timestamptz) returns uuid
language sql security invoker set search_path='' as $$ select private.mitsa_signed_registration_intent(p_email,p_name,p_terms,p_nonce_hash,p_accepted,p_request_hash,p_signed_at) $$;
revoke all on function api.mitsa_signed_registration_intent(text,text,uuid,text,boolean,text,timestamptz) from public,anon,authenticated;
grant execute on function api.mitsa_signed_registration_intent(text,text,uuid,text,boolean,text,timestamptz) to service_role;
revoke create on schema private from app_workspace;
notify pgrst,'reload schema';
