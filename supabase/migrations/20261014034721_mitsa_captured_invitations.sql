-- Atomic invitation creation/resend and private encrypted synthetic delivery.
do $$ begin assert (select marker='fireworks-foundation-proof-01a12e38' from foundation_probe.environment_identity where singleton), 'unapproved environment'; end $$;
grant create on schema private to app_workspace;
create table private.invitation_deliveries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references private.businesses(id),
  invitation_id uuid not null references private.workspace_invitations(id),
  recipient_hash text not null check(recipient_hash ~ '^[0-9a-f]{64}$'),
  encrypted_payload bytea not null,
  created_at timestamptz not null default now()
);
alter table private.invitation_deliveries enable row level security;
alter table private.invitation_deliveries force row level security;
revoke all on private.invitation_deliveries from public,anon,authenticated,service_role;
grant select,insert on private.invitation_deliveries to app_workspace;
create policy workspace_capture_read on private.invitation_deliveries for select to app_workspace using(true);
create policy workspace_capture_insert on private.invitation_deliveries for insert to app_workspace with check(true);
grant select on private.isolated_mail_config to app_workspace;
create policy workspace_capture_config on private.isolated_mail_config for select to app_workspace using(true);
grant usage on schema extensions to app_workspace;
grant execute on function extensions.gen_random_bytes(integer),extensions.dearmor(text),extensions.pgp_pub_encrypt(text,bytea,text) to app_workspace;

create function private.mitsa_invite_send(p_business uuid,p_email text,p_role text,p_locations uuid[],p_existing uuid,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' set row_security=on as $$
declare actor uuid:=private.current_actor(); caller text; public_key text; recipient text; target_role text;
  inv private.workspace_invitations; previous private.access_commands; fingerprint text; token text;
  issued jsonb; result jsonb; delivery uuid:=gen_random_uuid(); payload jsonb;
begin
  perform 1 from private.businesses where id=p_business for update;
  caller:=private.mitsa_require(p_business,'manage-staff');
  if p_key is null then raise exception 'invalid command' using errcode='22023'; end if;
  select c.public_key into public_key from private.isolated_mail_config c where c.singleton and c.enabled;
  if public_key is null or exists(select 1 from private.release_gates where registration_enabled or external_mail_enabled or legal_publication_enabled or disposal_enabled or eligibility_approved) then raise exception 'test delivery unavailable' using errcode='42501'; end if;
  if p_existing is not null then
    select * into inv from private.workspace_invitations where id=p_existing and business_id=p_business;
    if not found then raise exception 'invitation unavailable' using errcode='42501'; end if;
    recipient:=inv.email;target_role:=inv.role;
  else recipient:=lower(btrim(p_email));target_role:=p_role; end if;
  if recipient is null or recipient !~ '^foundation-[a-zA-Z0-9-]+@example\.invalid$'
    or not exists(select 1 from private.registration_test_recipients r where r.email=recipient and r.enabled)
    or target_role is null or target_role not in ('admin','staff') or caller='admin' and target_role<>'staff'
    then raise exception 'invitation unavailable' using errcode='42501'; end if;
  if target_role='admin' and not private.mitsa_recent_auth() then raise exception 'recent authentication required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text||':'||p_key::text,8414));
  fingerprint:=encode(sha256(convert_to(jsonb_build_array('captured-invite',p_business,p_existing,p_email,p_role,p_locations)::text,'UTF8')),'hex');
  select * into previous from private.access_commands where actor_id=actor and command_key=p_key;
  if found then
    if previous.request_hash<>fingerprint then raise exception 'idempotency conflict' using errcode='23505'; end if;
    return previous.outcome;
  end if;
  token:=encode(extensions.gen_random_bytes(32),'hex');
  if p_existing is null then
    issued:=private.mitsa_invite_issue(p_business,recipient,target_role,p_locations,encode(sha256(convert_to(token,'UTF8')),'hex'));
  else
    issued:=private.mitsa_invite_resend(p_business,p_existing,encode(sha256(convert_to(token,'UTF8')),'hex'));
  end if;
  payload:=jsonb_build_object('email',recipient,'type','invitation','token',token,'invitationId',issued->>'id',
    'businessName',(select name from private.businesses where id=p_business),'role',target_role,'expiresAt',issued->>'expiresAt','origin','http://127.0.0.1:3000');
  insert into private.invitation_deliveries(id,business_id,invitation_id,recipient_hash,encrypted_payload)
    values(delivery,p_business,(issued->>'id')::uuid,encode(sha256(convert_to(recipient,'UTF8')),'hex'),extensions.pgp_pub_encrypt(payload::text,extensions.dearmor(public_key),'cipher-algo=aes256,compress-algo=0,unicode-mode=1'));
  insert into private.notification_outbox(business_id,template,event_key,data,status,resolved_at)
    values(p_business,'workspace-invitation','invitation:'||actor::text||':'||p_key::text,jsonb_build_object('captureId',delivery),'captured',now());
  result:=jsonb_build_object('id',issued->>'id','expiresAt',issued->>'expiresAt','delivery','captured');
  insert into private.access_commands values(actor,p_key,fingerprint,result,now());
  perform private.mitsa_audit(p_business,'invitation.mail-captured',(issued->>'id')::uuid);
  return result;
end $$;
alter function private.mitsa_invite_send(uuid,text,text,uuid[],uuid,uuid) owner to app_workspace;
revoke all on function private.mitsa_invite_send(uuid,text,text,uuid[],uuid,uuid) from public,anon;
grant execute on function private.mitsa_invite_send(uuid,text,text,uuid[],uuid,uuid) to authenticated;
create function api.mitsa_invite_send(p_business uuid,p_email text,p_role text,p_locations uuid[],p_existing uuid,p_key uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.mitsa_invite_send(p_business,p_email,p_role,p_locations,p_existing,p_key) $$;
revoke all on function api.mitsa_invite_send(uuid,text,text,uuid[],uuid,uuid) from public,anon;
grant execute on function api.mitsa_invite_send(uuid,text,text,uuid[],uuid,uuid) to authenticated;
revoke create on schema private from app_workspace;
notify pgrst,'reload schema';
