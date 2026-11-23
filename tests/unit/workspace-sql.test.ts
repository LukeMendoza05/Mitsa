import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import {claimPilotMailDelivery} from '../../scripts/lib/pilot-mail-claim';
import {renewDevelopmentMailLease} from '../../scripts/lib/development-mail-lease';

// Execute the migration and its security functions, rather than matching SQL text.
// These synthetic contexts do not replace hosted signed-JWT tests.
describe("Mitsa workspace PostgreSQL foundation", () => {
  let db: PGlite;
  const actor = "11111111-1111-4111-8111-111111111111";
  const session = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const factor = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const executor = "22222222-2222-4222-8222-222222222222";
  const executorSession = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const executorFactor = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const claims = () => JSON.stringify({ sub: actor, session_id: session, role: "authenticated", aud: "authenticated", is_anonymous: false, exp: 4102444800, aal: "aal2", amr: [{ method: "password", timestamp: Date.now() / 1000 }, { method: "totp", timestamp: Date.now() / 1000 }] });
  const trusted = async () => { await db.exec("set session authorization authenticator; set role authenticated"); await db.query("select set_config('request.jwt.claims',$1,false)", [claims()]); };
  const operator = async () => { await db.exec("reset role; set session authorization postgres"); };
  const trustedExecutor = async () => { await trusted(); const value=JSON.parse(claims());value.sub=executor;value.session_id=executorSession;await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(value)]); };
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`create role authenticator login noinherit; create role authenticated nologin; create role anon nologin; create role supabase_auth_admin nologin; create role service_role nologin;
      grant authenticated to authenticator;
      create schema auth;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean not null default false,deleted_at timestamptz,banned_until timestamptz);
      create table auth.sessions(id uuid primary key,user_id uuid references auth.users,not_after timestamptz,factor_id uuid,aal text);
      create table auth.mfa_factors(id uuid primary key,user_id uuid references auth.users,status text,factor_type text);
      alter table auth.sessions enable row level security;
      create function auth.uid() returns uuid language sql as $$ select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid $$;
      create function auth.jwt() returns jsonb language sql as $$ select current_setting('request.jwt.claims',true)::jsonb $$;
      grant usage on schema auth to authenticated;
      grant execute on function auth.uid(),auth.jwt() to authenticated;`);
    await db.exec(`create schema extensions;
      -- Policy-only encryption/randomness stubs; hosted tests prove actual
      -- pgcrypto encryption and entropy. No stub is used by the application.
      create function extensions.dearmor(text) returns bytea language sql as $$select convert_to($1,'UTF8')$$;
      create function extensions.pgp_pub_encrypt(text,bytea,text) returns bytea language sql as $$select convert_to($1,'UTF8')$$;
      create function extensions.gen_random_bytes(integer) returns bytea language sql as $$select decode(replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''),'hex')$$;`);
    for (const file of ["20261012053948_foundation_security_proof.sql", "20261012054416_foundation_identity.sql", "20261012060403_foundation_membership_lock_policy.sql", "20261012060628_foundation_current_session_policy.sql", "20261012070606_foundation_verified_actor_adapter.sql", "20261013181012_mitsa_workspace_foundation.sql", "20261013181135_mitsa_membership_commands.sql", "20261013185440_mitsa_account_security_terms.sql"]) {
      // The original hosted setup revoked these legacy grants before the
      // reviewed adapter repair; reproduce that established precondition.
      if (file.includes("foundation_verified_actor_adapter")) await db.exec("revoke usage on schema auth from app_authz,app_command");
      const sql = readFileSync(`supabase/migrations/${file}`, "utf8");
      try { await db.exec(sql); }
      catch (error) {
        const pg = error as { message: string; position?: number; internalQuery?: string; where?: string };
        throw new Error(`${file}: ${pg.message}; position=${pg.position}; ${pg.internalQuery ?? ""}; ${pg.where ?? ""}`, { cause: error });
      }
    }
    await db.exec(readFileSync("supabase/migrations/20261013223908_mitsa_registration_boundary.sql", "utf8"));
    await db.exec(readFileSync("supabase/migrations/20261014001000_mitsa_reenrollment_session.sql", "utf8"));
    await db.exec(readFileSync("supabase/migrations/20261014014343_mitsa_account_workspace_interfaces.sql", "utf8"));
    await db.exec(readFileSync("supabase/migrations/20261014015632_mitsa_isolated_auth_mail_capture.sql", "utf8"));
    await db.exec(readFileSync("supabase/migrations/20261014021816_mitsa_capture_pkce_compatibility.sql", "utf8"));
    await db.exec(readFileSync("supabase/migrations/20261014034721_mitsa_captured_invitations.sql", "utf8"));
    await db.exec(readFileSync("supabase/migrations/20261014044022_mitsa_reviewed_requests.sql", "utf8"));
    // Prepared developer-email migration is tested here, never applied remotely
    // without the user's new explicit activation approval.
    await db.exec(readFileSync("supabase/migrations/20261014055453_mitsa_developer_registration.sql", "utf8"));
    await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'synthetic@example.invalid',now())", [actor]);
    await db.query("insert into auth.sessions(id,user_id,factor_id,aal) values($1,$2,$3,'aal2')", [session, actor, factor]);
  }, 60000);
  afterAll(async () => { if (db) await db.close(); });

  it("denies MFA without an application binding, then binds a real verified factor", async () => {
    await trusted();
    expect((await db.query<{ ready: boolean }>("select private.mitsa_mfa_ready() ready")).rows[0].ready).toBe(false);
    const permit = (await db.query<{ permit: string }>("select api.mitsa_prepare_enrollment() permit")).rows[0].permit;
    await operator();
    await db.query("insert into auth.mfa_factors values($1,$2,'verified','totp')", [factor, actor]);
    await trusted();
    await expect(db.query("select api.mitsa_bind_factor($1)", [factor])).rejects.toMatchObject({ code: "42501" });
    await db.query("select api.mitsa_bind_factor($1,$2)", [factor, permit]);
    expect((await db.query<{ ready: boolean }>("select private.mitsa_mfa_ready() ready")).rows[0].ready).toBe(true);
  });

  it("atomically creates a workspace and replays once while rejecting changed payloads", async () => {
    const key = crypto.randomUUID();
    const call = () => db.query<{ result: { id: string; slug: string } }>("select api.mitsa_create_workspace('Synthetic business','Main shop','shop',$1) result", [key]);
    await expect(call()).rejects.toMatchObject({ code: "42501" });
    await operator();
    const terms = (await db.query<{ id: string }>("insert into private.legal_versions(kind,version,content,content_hash,status) values('terms','synthetic-v1','Synthetic testing agreement',encode(sha256(convert_to('Synthetic testing agreement','UTF8')),'hex'),'test') returning id")).rows[0].id;
    await db.query("update private.release_gates set test_terms_id=$1 where singleton", [terms]);
    await trusted();
    await db.query("select api.mitsa_accept_terms($1)", [terms]);
    const first = (await call()).rows[0].result;
    expect((await call()).rows[0].result).toEqual(first);
    await expect(db.query("select api.mitsa_create_workspace('Changed','Main shop','shop',$1)", [key])).rejects.toMatchObject({ code: "23505" });
    expect((await db.query<{ result: { role: string; locations: unknown[] } }>("select api.mitsa_workspace($1) result", [first.slug])).rows[0].result).toMatchObject({ role: "owner", locations: [{ name: "Main shop" }] });
    await operator();
    expect((await db.query<{ count: number }>("select count(*)::int count from private.businesses")).rows[0].count).toBe(1);
    await trusted();
  });

  it("rejects an active workspace without an Owner at commit", async () => {
    await operator();
    await db.exec("begin");
    await db.exec("insert into private.businesses(id,name) values(gen_random_uuid(),'Ownerless')");
    await expect(db.exec("commit")).rejects.toMatchObject({ code: "23514" });
    await db.exec("rollback");
    await trusted();
  });

  it("denies direct SQL claim injection and direct client table writes", async () => {
    await operator();
    await db.exec("set role authenticated");
    expect((await db.query<{ ready: boolean }>("select private.mitsa_mfa_ready() ready")).rows[0].ready).toBe(false);
    await expect(db.exec("update private.businesses set admin_financial_access=true")).rejects.toMatchObject({ code: "42501" });
    await operator(); await trusted();
  });

  it("binds a trusted intent before an Auth row exists and rejects forged or reused intents", async () => {
    await operator();
    const email = "foundation-signup@example.invalid";
    const terms = (await db.query<{ id: string }>("select test_terms_id id from private.release_gates where singleton")).rows[0].id;
    await db.query("insert into private.registration_test_recipients(email,enabled) values($1,true)", [email]);
    await db.exec("set role service_role");
    const nonce = "a".repeat(64);
    await expect(db.query("select api.mitsa_signed_registration_intent($1,'Synthetic signup',$2,encode(sha256(convert_to($3,'UTF8')),'hex'),false,repeat('c',64),statement_timestamp())", [email, terms, nonce])).rejects.toMatchObject({ code: "22023" });
    await db.query("select api.mitsa_signed_registration_intent($1,'Synthetic signup',$2,encode(sha256(convert_to($3,'UTF8')),'hex'),true,repeat('c',64),statement_timestamp())", [email, terms, nonce]);
    await operator();
    await db.exec("set role supabase_auth_admin");
    const event = { user: { id: "33333333-3333-4333-8333-333333333333", email, is_anonymous: false, user_metadata: { registration_nonce: nonce, role: "owner" } } };
    const hook = (payload: unknown) => db.query<{ result: { error?: { http_code: number } } }>("select private.mitsa_before_user_created($1::jsonb) result", [JSON.stringify(payload)]);
    expect((await hook({ user: { ...event.user, email: "foundation-mismatch@example.invalid" } })).rows[0].result.error?.http_code).toBe(403);
    expect((await hook(event)).rows[0].result).toEqual({});
    expect((await hook({ user: { ...event.user, id: "44444444-4444-4444-8444-444444444444" } })).rows[0].result.error?.http_code).toBe(403);
    await operator();
    expect((await db.query<{ count: number }>("select count(*)::int count from auth.users where id=$1", [event.user.id])).rows[0].count).toBe(0);
    await trusted();
    await expect(hook(event)).rejects.toMatchObject({ code: "42501" });
    await expect(db.query("select api.mitsa_registration_intent($1,'Forged',$2,repeat('b',64),true)", [email, terms])).rejects.toMatchObject({ code: "42501" });
  });

  it("exposes only policy text to anonymous users, never accounts or business records", async () => {
    await operator(); await db.exec("set role anon");
    expect((await db.query<{policy:{status:string;publicRegistration:boolean}}>("select api.mitsa_registration_policy() policy")).rows[0].policy).toMatchObject({status:"test",publicRegistration:false});
    await expect(db.exec("select api.mitsa_account_profile()")).rejects.toMatchObject({code:"42501"});
    await expect(db.exec("select * from private.memberships")).rejects.toMatchObject({code:"42501"});
    await expect(db.exec("select private.mitsa_auth_context()")).rejects.toMatchObject({code:"42501"});
    await operator(); await trusted();
  });
  it("updates only the caller's profile and requires Owner authority for business settings", async () => {
    await db.exec("select api.mitsa_account_profile_save('Synthetic Owner')");
    expect((await db.query<{profile:{fullName:string}}>("select api.mitsa_account_profile() profile")).rows[0].profile.fullName).toBe("Synthetic Owner");
    await operator(); const bid=(await db.query<{id:string}>("select id from private.businesses limit 1")).rows[0].id; await trusted();
    await db.query("select api.mitsa_workspace_profile_save($1,'Synthetic renamed')",[bid]);
    expect((await db.query<{locations:unknown[]}>("select api.mitsa_locations($1) locations",[bid])).rows[0].locations).toHaveLength(1);
    await expect(db.query("select api.mitsa_workspace_profile_save($1,'Cross tenant')",[crypto.randomUUID()])).rejects.toMatchObject({code:"42501"});
    const staff=crypto.randomUUID(),sid=crypto.randomUUID();
    await operator();
    await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'foundation-ui-staff@example.invalid',now())",[staff]);
    await db.query("insert into auth.sessions(id,user_id,aal) values($1,$2,'aal1')",[sid,staff]);
    await db.query("insert into private.memberships(business_id,user_id,role) values($1,$2,'staff')",[bid,staff]);
    await trusted(); const payload=JSON.parse(claims()); payload.sub=staff;payload.session_id=sid;payload.aal="aal1";
    await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(payload)]);
    await db.exec("select api.mitsa_account_profile_save('Synthetic Staff')");
    await expect(db.query("select api.mitsa_workspace_profile_save($1,'Staff escalation')",[bid])).rejects.toMatchObject({code:"42501"});
    await expect(db.query("select api.mitsa_locations($1)",[bid])).rejects.toMatchObject({code:"42501"});
    await trusted();
    expect((await db.query<{profile:{fullName:string}}>("select api.mitsa_account_profile() profile")).rows[0].profile.fullName).toBe("Synthetic Owner");
  });
  it("rotates invitation tokens on resend and shares the hourly issuance limit", async () => {
    await operator();const bid=(await db.query<{id:string}>("select id from private.businesses limit 1")).rows[0].id;await trusted();
    const invitation=(await db.query<{result:{id:string}}>("select api.mitsa_invite_issue($1,'foundation-new-staff@example.invalid','staff','{}',repeat('a',64)) result",[bid])).rows[0].result;
    await expect(db.query("select api.mitsa_invite_resend($1,$2,repeat('a',64))",[bid,invitation.id])).rejects.toMatchObject({code:"22023"});
    await db.query("select api.mitsa_invite_resend($1,$2,repeat('b',64))",[bid,invitation.id]);
    for(let index=0;index<28;index++) await db.query("select api.mitsa_invite_resend($1,$2,lpad(to_hex($3::int),64,'0'))",[bid,invitation.id,index+100]);
    await expect(db.query("select api.mitsa_invite_resend($1,$2,repeat('c',64))",[bid,invitation.id])).rejects.toMatchObject({code:"54000"});
    await operator();
    expect((await db.query<{valid:boolean}>("select expires_at=issued_at+interval '7 days' valid from private.workspace_invitations where id=$1",[invitation.id])).rows[0].valid).toBe(true);
    expect((await db.query<{n:number}>("select count(*)::int n from private.workspace_invitations where token_hash=repeat('a',64) or token_hash=repeat('b',64)")).rows[0].n).toBe(0);
    await trusted();
  });
  it("captures invitations atomically, replays once, rotates resend links and fails closed", async () => {
    await operator();await db.exec("update private.isolated_mail_config set public_key='-----BEGIN PGP PUBLIC KEY BLOCK-----test',enabled=true");
    await db.exec("insert into private.registration_test_recipients(email,enabled) values('foundation-captured@example.invalid',true)");await trusted();
    const business=(await db.query<{result:{id:string}}>("select api.mitsa_create_workspace('Synthetic captures','Shop','shop',$1) result",[crypto.randomUUID()])).rows[0].result.id;
    const key=crypto.randomUUID();
    const send=()=>db.query<{result:{id:string;delivery:string}}>("select api.mitsa_invite_send($1,'foundation-captured@example.invalid','staff','{}',null,$2) result",[business,key]);
    const issued=(await send()).rows[0].result;expect(issued.delivery).toBe("captured");expect((await send()).rows[0].result).toEqual(issued);
    await expect(db.query("select api.mitsa_invite_send($1,'foundation-captured@example.invalid','admin','{}',null,$2)",[business,key])).rejects.toMatchObject({code:"23505"});
    await operator();
    const before=(await db.query<{token_hash:string}>("select token_hash from private.workspace_invitations where id=$1",[issued.id])).rows[0].token_hash;
    expect((await db.query<{n:number}>("select count(*)::int n from private.invitation_deliveries where business_id=$1",[business])).rows[0].n).toBe(1);
    await trusted();await db.query("select api.mitsa_invite_send($1,null,null,'{}',$2,$3)",[business,issued.id,crypto.randomUUID()]);
    await operator();expect((await db.query<{token_hash:string}>("select token_hash from private.workspace_invitations where id=$1",[issued.id])).rows[0].token_hash).not.toBe(before);
    await db.exec("update private.isolated_mail_config set enabled=false");await trusted();
    await expect(db.query("select api.mitsa_invite_send($1,'foundation-captured@example.invalid','staff','{}',null,$2)",[business,crypto.randomUUID()])).rejects.toMatchObject({code:"42501"});
    await operator();expect((await db.query<{n:number}>("select count(*)::int n from private.invitation_deliveries where business_id=$1",[business])).rows[0].n).toBe(2);
    await db.exec("update private.isolated_mail_config set enabled=true");await trusted();
    await expect(db.query("select api.mitsa_invite_send($1,'foundation-unlisted@example.invalid','staff','{}',null,$2)",[business,crypto.randomUUID()])).rejects.toMatchObject({code:"42501"});
    await expect(db.query("select api.mitsa_invite_send($1,'foundation-captured@example.invalid','staff','{}',null,$2)",[crypto.randomUUID(),crypto.randomUUID()])).rejects.toMatchObject({code:"42501"});
  });
  it("requires independent scoped review and completes access only after creating the subject's export", async () => {
    await operator();
    const subject=(await db.query<{id:string}>("select id from auth.users where email='foundation-ui-staff@example.invalid'")).rows[0].id;
    const sid=(await db.query<{id:string}>("select id from auth.sessions where user_id=$1",[subject])).rows[0].id;
    await trusted();const subjectClaims=JSON.parse(claims());subjectClaims.sub=subject;subjectClaims.session_id=sid;subjectClaims.aal='aal1';
    await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(subjectClaims)]);
    const key=crypto.randomUUID();
    const request=(await db.query<{id:string}>("select api.mitsa_request_create('access',null,'{}',$1) id",[key])).rows[0].id;
    expect((await db.query<{id:string}>("select api.mitsa_request_create('access',null,'{}',$1) id",[key])).rows[0].id).toBe(request);
    await expect(db.query("select api.mitsa_request_execute($1)",[request])).rejects.toMatchObject({code:'42501'});
    await trusted();await expect(db.query("select api.mitsa_request_review($1,'under-review','Synthetic review started',null)",[request])).rejects.toMatchObject({code:'42501'});
    await operator();await db.query("insert into private.operator_principals(user_id,active,scopes) values($1,true,array['privacy-review','privacy-execute','mfa-recovery-review'])",[actor]);await trusted();
    await expect(db.query("select api.mitsa_request_review($1,'approved','Synthetic evidence checked','Independent synthetic fixture evidence')",[request])).rejects.toMatchObject({code:'22023'});
    await db.query("select api.mitsa_request_review($1,'under-review','Synthetic independent review',null)",[request]);
    await db.query("select api.mitsa_request_review($1,'approved','Synthetic verification complete','Independent synthetic fixture evidence')",[request]);
    await expect(db.query("select api.mitsa_request_execute($1)",[request])).rejects.toMatchObject({code:'42501'});
    await operator();
    await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'foundation-executor@example.invalid',now())",[executor]);
    await db.query("insert into auth.sessions(id,user_id,factor_id,aal) values($1,$2,$3,'aal2')",[executorSession,executor,executorFactor]);
    await db.query("insert into private.operator_principals(user_id,active,scopes) values($1,true,array['privacy-execute'])",[executor]);
    await trustedExecutor();
    const permit=(await db.query<{permit:string}>("select api.mitsa_prepare_enrollment() permit")).rows[0].permit;
    await operator();await db.query("insert into auth.mfa_factors values($1,$2,'verified','totp')",[executorFactor,executor]);await trustedExecutor();
    await db.query("select api.mitsa_bind_factor($1,$2)",[executorFactor,permit]);
    await db.query("select api.mitsa_request_execute($1)",[request]);
    await expect(db.query("select api.mitsa_request_export($1)",[request])).rejects.toMatchObject({code:'42501'});
    await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(subjectClaims)]);
    const data=(await db.query<{payload:{userId:string;profile:{fullName:string};memberships:unknown[]}}>("select api.mitsa_request_export($1) payload",[request])).rows[0].payload;
    expect(data.userId).toBe(subject);expect(data.profile.fullName).toBe('Synthetic Staff');expect(data.memberships).toHaveLength(1);
    expect((await db.query<{items:{status:string;exportAvailable:boolean}[]}>("select api.mitsa_account_requests() items")).rows[0].items[0]).toMatchObject({status:'completed',exportAvailable:true});
    await trusted();
    const own=(await db.query<{id:string}>("select api.mitsa_request_create('access',null,'{}',$1) id",[crypto.randomUUID()])).rows[0].id;
    await expect(db.query("select api.mitsa_request_review($1,'under-review','Self review is forbidden',null)",[own])).rejects.toMatchObject({code:'42501'});
  });
  it("executes reviewed corrections while keeping disposal and MFA reset fail closed", async () => {
    await operator();const subject=(await db.query<{id:string}>("select id from auth.users where email='foundation-ui-staff@example.invalid'")).rows[0].id;
    const sid=(await db.query<{id:string}>("select id from auth.sessions where user_id=$1",[subject])).rows[0].id;await trusted();
    const subjectClaims=JSON.parse(claims());subjectClaims.sub=subject;subjectClaims.session_id=sid;subjectClaims.aal='aal1';
    for(const kind of ['correction','deletion','mfa-recovery']) {
      await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(subjectClaims)]);
      const details=kind==='correction'?JSON.stringify({fullName:'Synthetic corrected Staff'}):'{}';
      const request=(await db.query<{id:string}>("select api.mitsa_request_create($1,null,$2,$3) id",[kind,details,crypto.randomUUID()])).rows[0].id;await trusted();
      await db.query("select api.mitsa_request_review($1,'under-review','Synthetic independent review',null)",[request]);await db.query("select api.mitsa_request_review($1,'approved','Synthetic verification complete','Independent synthetic fixture evidence')",[request]);
      if(kind==='correction') {
        await trustedExecutor();
        await operator();await db.query("update private.operator_principals set active=false where user_id=$1",[executor]);await trustedExecutor();await expect(db.query("select api.mitsa_request_execute($1)",[request])).rejects.toMatchObject({code:'42501'});
        await operator();await db.query("update private.operator_principals set active=true where user_id=$1",[executor]);await trustedExecutor();
        expect((await db.query<{result:{profileUpdated:boolean}}>("select api.mitsa_request_execute($1) result",[request])).rows[0].result.profileUpdated).toBe(true);
        await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(subjectClaims)]);expect((await db.query<{profile:{fullName:string}}>("select api.mitsa_account_profile() profile")).rows[0].profile.fullName).toBe('Synthetic corrected Staff');await trusted();
      } else {
        await trustedExecutor();
        await expect(db.query("select api.mitsa_request_execute($1)",[request])).rejects.toMatchObject({code:'42501'});
        if(kind==='deletion')expect((await db.query<{result:{eligible:boolean;disposalGateOpen:boolean}}>("select api.mitsa_disposal_preview($1) result",[request])).rows[0].result).toMatchObject({eligible:false,disposalGateOpen:false});
        await operator();expect((await db.query<{status:string}>("select status from private.account_requests where id=$1",[request])).rows[0].status).toBe('approved');await trusted();
      }
    }
  });
  it("authorizes only one explicitly approved developer email while preserving intents, hooks, capture and limits",async()=>{
    const email="developer@example.com",uid=crypto.randomUUID(),nonce="e".repeat(64);
    await operator();const terms=(await db.query<{id:string}>("select test_terms_id id from private.release_gates where singleton")).rows[0].id;
    await db.exec("set role service_role");
    const issue=()=>db.query<{id:string}>("select api.mitsa_signed_registration_intent($1,'Synthetic developer',$2,encode(sha256(convert_to($3,'UTF8')),'hex'),true,encode(sha256(convert_to($4,'UTF8')),'hex'),statement_timestamp()) id",[email,terms,nonce,crypto.randomUUID()]);
    await expect(issue()).rejects.toMatchObject({code:"42501"});
    await operator();await db.query("insert into private.developer_registration_recipients(email,enabled,approved_at,approval_reference) values($1,false,now(),'mitsa-developer-registration-isolated-v1')",[email]);await db.exec("set role service_role");await expect(issue()).rejects.toMatchObject({code:"42501"});
    await operator();await db.query("update private.developer_registration_recipients set enabled=true where email=$1",[email]);await db.exec("set role service_role");const intent=(await issue()).rows[0].id;
    await expect(db.exec("select * from private.developer_registration_recipients")).rejects.toMatchObject({code:"42501"});
    await operator();await db.exec("set role supabase_auth_admin");
    const event={user:{id:uid,email,is_anonymous:false,user_metadata:{registration_nonce:nonce,role:"owner"}}};
    expect((await db.query<{result:unknown}>("select private.mitsa_before_user_created($1::jsonb) result",[JSON.stringify(event)])).rows[0].result).toEqual({});
    const mail={user:{id:uid,email},email_data:{email_action_type:"signup",token_hash:"pkce_"+"a".repeat(64),redirect_to:"http://127.0.0.1:3000/auth/email"}};
    expect((await db.query<{result:unknown}>("select private.mitsa_isolated_send_email($1::jsonb) result",[JSON.stringify(mail)])).rows[0].result).toEqual({});
    expect((await db.query<{result:{error:{http_code:number}}}>("select private.mitsa_isolated_send_email($1::jsonb) result",[JSON.stringify({...mail,user:{id:uid,email:"other@example.com"}})])).rows[0].result.error.http_code).toBe(403);
    await operator();expect((await db.query<{n:number}>("select count(*)::int n from private.memberships where user_id=$1",[uid])).rows[0].n).toBe(0);expect((await db.query<{n:number}>("select count(*)::int n from private.legal_acceptances where user_id=$1",[uid])).rows[0].n).toBe(0);
    await expect(db.exec("insert into private.developer_registration_recipients(email,enabled,approved_at,approval_reference) values('second@example.com',true,now(),'mitsa-developer-registration-isolated-v1')")).rejects.toMatchObject({code:"23505"});
    await db.exec("update private.release_gates set external_mail_enabled=true");await db.exec("set role service_role");await expect(issue()).rejects.toMatchObject({code:"42501"});await operator();await db.exec("update private.release_gates set external_mail_enabled=false");
    for(const n of ["f","9"]){await db.exec("set role service_role");await db.query("select api.mitsa_signed_registration_intent($1,'Synthetic developer',$2,repeat($3,64),true,encode(sha256(convert_to($4,'UTF8')),'hex'),statement_timestamp())",[email,terms,n,crypto.randomUUID()]);await operator();}
    await db.exec("set role service_role");await expect(issue()).rejects.toMatchObject({code:"54000"});await operator();await db.query("update private.developer_registration_recipients set enabled=false where email=$1",[email]);await db.exec("set role supabase_auth_admin");expect((await db.query<{result:{error:{http_code:number}}}>("select private.mitsa_before_user_created($1::jsonb) result",[JSON.stringify(event)])).rows[0].result.error.http_code).toBe(403);
    await operator();await trusted();await expect(db.exec("select * from private.developer_registration_recipients")).rejects.toMatchObject({code:"42501"});
    expect(Boolean(intent)).toBe(true);
  });
  it("immediately denies a stale AAL2 session after provider factor removal", async () => {
    await operator();
    await db.query("delete from auth.mfa_factors where id=$1", [factor]);
    await trusted();
    expect((await db.query<{ ready: boolean }>("select private.mitsa_mfa_ready() ready")).rows[0].ready).toBe(false);
    await expect(db.query("select api.mitsa_create_workspace('Blocked','Shop','shop',$1)", [crypto.randomUUID()])).rejects.toMatchObject({ code: "42501" });
  });

  it("completes an authorized provider removal before permitting safe reenrollment", async () => {
    await expect(db.exec("select api.mitsa_prepare_enrollment()")).rejects.toMatchObject({ code: "42501" });
    await operator();
    await db.query("insert into auth.mfa_factors values($1,$2,'verified','totp')", [factor, actor]);
    await trusted();
    const permit = (await db.query<{ permit: string }>("select api.mitsa_begin_factor_removal($1,true) permit", [factor])).rows[0].permit;
    await expect(db.query("select api.mitsa_finish_factor_removal($1)", [permit])).rejects.toMatchObject({ code: "42501" });
    await operator(); await db.query("delete from auth.mfa_factors where id=$1", [factor]); await trusted();
    await db.query("select api.mitsa_finish_factor_removal($1)", [permit]);
    expect((await db.query<{ status: { ready: boolean; initialized: boolean } }>("select api.mitsa_security_status() status")).rows[0].status).toMatchObject({ ready: false, initialized: false });
    expect((await db.query<{ permit: string }>("select api.mitsa_prepare_enrollment() permit")).rows[0].permit).toBeTruthy();
    const olderSession = crypto.randomUUID();
    await operator(); await db.query("insert into auth.sessions(id,user_id,aal) values($1,$2,'aal1')", [olderSession,actor]); await trusted();
    const oldClaims = JSON.parse(claims()); oldClaims.session_id=olderSession; oldClaims.aal="aal1";
    oldClaims.amr=[{method:"password",timestamp:Math.floor(Date.now()/1000)-60}];
    await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify(oldClaims)]);
    await expect(db.exec("select api.mitsa_prepare_enrollment()")).rejects.toMatchObject({code:"42501"});
    oldClaims.amr=[{method:"password",timestamp:Math.floor(Date.now()/1000)+1}];
    await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify(oldClaims)]);
    const newPermit=(await db.query<{permit:string}>("select api.mitsa_prepare_enrollment() permit")).rows[0].permit;
    const oldPermit=(await db.query<{permit:string}>("select api.mitsa_prepare_enrollment() permit")).rows[0].permit;
    const nextFactor=crypto.randomUUID();
    await operator();
    await db.query("update private.security_permits set issued_at=now()-interval '1 minute' where id=$1",[oldPermit]);
    await db.query("insert into auth.mfa_factors values($1,$2,'verified','totp')",[nextFactor,actor]);
    await db.query("update auth.sessions set factor_id=$1,aal='aal2' where id=$2",[nextFactor,olderSession]);
    await trusted(); oldClaims.aal="aal2"; oldClaims.amr.push({method:"totp",timestamp:Date.now()/1000});
    await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify(oldClaims)]);
    await expect(db.query("select api.mitsa_bind_factor($1,$2)",[nextFactor,oldPermit])).rejects.toMatchObject({code:"42501"});
    await db.query("select api.mitsa_bind_factor($1,$2)",[nextFactor,newPermit]);
    expect((await db.query<{ready:boolean}>("select private.mitsa_mfa_ready() ready")).rows[0].ready).toBe(true);
  });
  it("prepared local pilot removes per-email approval only inside a bounded signed window, without opening public or recovery mail",async()=>{
    await operator();
    await db.exec(readFileSync('supabase/migrations/20261014094354_mitsa_capture_verification_codes.sql','utf8'));
    await db.exec(readFileSync('supabase/prepared/20261014_mitsa_controlled_pilot_relay.sql','utf8'));
    const terms=(await db.query<{id:string}>('select test_terms_id id from private.release_gates where singleton')).rows[0].id;
    const address='unapproved-pilot@gmail.com',nonce='7'.repeat(64),uid=crypto.randomUUID();
    const issue=()=>db.query<{id:string}>("select api.mitsa_signed_registration_intent($1,'Synthetic local pilot',$2,encode(sha256(convert_to($3,'UTF8')),'hex'),true,$4,statement_timestamp()) id",[address,terms,nonce,crypto.randomUUID().replaceAll('-','').repeat(2)]);
    await db.exec('set role service_role');await expect(issue()).rejects.toMatchObject({code:'42501'});await operator();
    await db.exec("update private.pilot_registration_window set enabled=true,smtp_enabled=true,approved_at=statement_timestamp()-interval '1 minute',expires_at=statement_timestamp()+interval '1 hour',provider_otp_expiry_seconds=3600,approved_sender_sha256=repeat('a',64)");
    await db.exec('set role service_role');expect((await issue()).rows[0].id).toBeTruthy();await operator();
    const event={user:{id:uid,email:address,is_anonymous:false,user_metadata:{registration_nonce:nonce}},email_data:{email_action_type:'signup',token:'12345678',token_hash:'c'.repeat(64),redirect_to:'http://127.0.0.1:3000/auth/email'}};
    const hook=async(value:unknown)=>(await db.query<{result:{error?:unknown}}>('select private.mitsa_before_user_created($1::jsonb) result',[JSON.stringify(value)])).rows[0].result;
    const mail=async(value:unknown)=>(await db.query<{result:{error?:unknown}}>('select private.mitsa_isolated_send_email($1::jsonb) result',[JSON.stringify(value)])).rows[0].result;
    await db.exec('set role supabase_auth_admin');
    expect(await hook({...event,user:{...event.user,user_metadata:{}}})).toHaveProperty('error');
    expect(await hook(event)).toEqual({});expect(await hook({...event,user:{...event.user,id:crypto.randomUUID()}})).toHaveProperty('error');
    await operator();await db.exec("update private.isolated_mail_config set enabled=true,public_key='-----BEGIN PGP PUBLIC KEY BLOCK-----unit-only'");await db.exec('set role supabase_auth_admin');
    expect(await mail(event)).toEqual({});
    expect(await mail({...event,email_data:{...event.email_data,email_action_type:'recovery'}})).toHaveProperty('error');
    expect(await mail({...event,email_data:{...event.email_data,redirect_to:'https://attacker.example/auth/email'}})).toHaveProperty('error');
    await operator();await db.exec('set role anon');
    const policy=(await db.query<{result:{publicRegistration:boolean;pilotRegistration:boolean}}>('select api.mitsa_registration_policy() result')).rows[0].result;
    expect(policy).toMatchObject({publicRegistration:false,pilotRegistration:true});
    for(const table of ['pilot_registration_window','pilot_mail_deliveries'])await expect(db.exec(`select * from private.${table}`)).rejects.toMatchObject({code:'42501'});
    await operator();await db.exec("update private.pilot_registration_window set expires_at=statement_timestamp()-interval '1 second'");
    await db.exec('set role supabase_auth_admin');expect(await hook(event)).toHaveProperty('error');expect(await mail(event)).toHaveProperty('error');
    await operator();expect((await db.query('select 1 from private.registration_test_recipients where email=$1',[address])).rows).toHaveLength(0);
    expect((await db.query('select 1 from private.memberships where user_id=$1',[uid])).rows).toHaveLength(0);
    expect((await db.query('select registration_enabled,external_mail_enabled,legal_publication_enabled from private.release_gates')).rows[0]).toEqual({registration_enabled:false,external_mail_enabled:false,legal_publication_enabled:false});
  });
  it('claims pilot SMTP events durably, suppresses replay and enforces recipient/global limits in PostgreSQL',async()=>{
    await operator();await db.exec("update private.pilot_registration_window set approved_at=statement_timestamp()-interval '1 minute',expires_at=statement_timestamp()+interval '1 hour'");
    const uid=crypto.randomUUID(),email='claim-unit@example.com',captureId=crypto.randomUUID(),recipientHash='d'.repeat(64);
    const terms=(await db.query<{id:string}>('select test_terms_id id from private.release_gates')).rows[0].id;
    await db.query('insert into auth.users(id,email) values($1,$2)',[uid,email]);
    await db.query("insert into private.registration_intents(email,full_name,nonce_hash,terms_id,provider_user_id) values($1,'Synthetic claim test',$2,$3,$4)",[email,crypto.randomUUID().replaceAll('-','').repeat(2),terms,uid]);
    const capture=(await db.query<{created_at:Date}>("insert into private.isolated_auth_mail(id,recipient_hash,action,encrypted_payload) values($1,$2,'signup','\\x00') returning created_at",[captureId,recipientHash])).rows[0];
    const input={captureId,recipientHash,recipient:email,userId:uid,captureCreatedAt:capture.created_at,senderHash:'a'.repeat(64),expirySeconds:3600};
    expect(await claimPilotMailDelivery(db,input)).toBe(true);expect(await claimPilotMailDelivery(db,input)).toBe(false);
    // Age only the offline claim to isolate deduplication from the minute cap.
    await db.exec("update private.pilot_mail_deliveries set created_at=statement_timestamp()-interval '2 minutes'");expect(await claimPilotMailDelivery(db,input)).toBe(false);
    await expect(claimPilotMailDelivery(db,{...input,senderHash:'b'.repeat(64)})).rejects.toThrow('Pilot delivery authorization unavailable');
    await expect(claimPilotMailDelivery(db,{...input,userId:crypto.randomUUID()})).rejects.toThrow('Pilot delivery authorization unavailable');
    const scopeWindow=(await db.query<{approved_at:Date;expires_at:Date}>('select approved_at,expires_at from private.pilot_registration_window where singleton')).rows[0];
    const approvedScope={recipientHash,maxAttempts:3 as const,approvedAtMs:scopeWindow.approved_at.getTime(),expiresAtMs:scopeWindow.expires_at.getTime()};
    await expect(claimPilotMailDelivery(db,{...input,approvedScope:{...approvedScope,recipientHash:'f'.repeat(64)}})).rejects.toThrow('Pilot delivery authorization unavailable');
    await expect(claimPilotMailDelivery(db,{...input,approvedScope:{...approvedScope,expiresAtMs:approvedScope.expiresAtMs-1}})).rejects.toThrow('Pilot delivery authorization unavailable');
    await expect(claimPilotMailDelivery(db,{...input,approvedScope:{...approvedScope,approvedAtMs:approvedScope.approvedAtMs+1}})).rejects.toThrow('Pilot delivery authorization unavailable');
    // The first real-mail approval is narrower than the general hourly caps:
    // three durable attempts in the approved window, including uncertainty.
    for(let i=0;i<3;i++){
      const id=crypto.randomUUID();await db.query("insert into private.isolated_auth_mail(id,recipient_hash,action,encrypted_payload) values($1,$2,'signup','\\x00')",[id,recipientHash]);
      await db.query("insert into private.pilot_mail_deliveries(capture_id,recipient_hash) values($1,$2)",[id,recipientHash]);
    }
    const scopedId=crypto.randomUUID(),scopedCapture=(await db.query<{created_at:Date}>("insert into private.isolated_auth_mail(id,recipient_hash,action,encrypted_payload) values($1,$2,'signup','\\x00') returning created_at",[scopedId,recipientHash])).rows[0];
    expect(await claimPilotMailDelivery(db,{...input,captureId:scopedId,captureCreatedAt:scopedCapture.created_at,approvedScope})).toBe(false);
    for(let i=0;i<9;i++){
      const id=crypto.randomUUID();await db.query("insert into private.isolated_auth_mail(id,recipient_hash,action,encrypted_payload) values($1,$2,'signup','\\x00')",[id,'e'.repeat(64)]);
      await db.query("insert into private.pilot_mail_deliveries(capture_id,recipient_hash,created_at) values($1,$2,statement_timestamp()-interval '2 minutes')",[id,'e'.repeat(64)]);
    }
    const newer=crypto.randomUUID(),newCapture=(await db.query<{created_at:Date}>("insert into private.isolated_auth_mail(id,recipient_hash,action,encrypted_payload) values($1,$2,'signup','\\x00') returning created_at",[newer,recipientHash])).rows[0];
    expect(await claimPilotMailDelivery(db,{...input,captureId:newer,captureCreatedAt:newCapture.created_at})).toBe(false);
    await expect(claimPilotMailDelivery(db,input)).rejects.toThrow('Pilot delivery authorization unavailable');
    await db.exec("update private.pilot_registration_window set enabled=false,smtp_enabled=false");
    await expect(claimPilotMailDelivery(db,{...input,captureId:newer,captureCreatedAt:newCapture.created_at})).rejects.toThrow('Pilot delivery authorization unavailable');
  });
  it('uses native microsecond ordering without mistaking the candidate or an older same-millisecond capture for a newer message',async()=>{
    await operator();await db.exec("update private.pilot_registration_window set enabled=true,smtp_enabled=true,approved_at=statement_timestamp()-interval '1 minute',expires_at=statement_timestamp()+interval '1 hour'");
    // Earlier cases deliberately filled the offline hourly cap. Preserve the
    // guard and move only this in-memory fixture history outside its window.
    await db.exec("update private.pilot_mail_deliveries set created_at=statement_timestamp()-interval '25 hours'");
    const uid=crypto.randomUUID(),email='microsecond-claim-unit@example.com',captureId=crypto.randomUUID(),recipientHash='7'.repeat(64);
    const terms=(await db.query<{id:string}>('select test_terms_id id from private.release_gates')).rows[0].id;
    await db.query('insert into auth.users(id,email) values($1,$2)',[uid,email]);
    await db.query("insert into private.registration_intents(email,full_name,nonce_hash,terms_id,provider_user_id) values($1,'Synthetic microsecond claim',$2,$3,$4)",[email,crypto.randomUUID().replaceAll('-','').repeat(2),terms,uid]);
    const capture=(await db.query<{created_at:Date}>("insert into private.isolated_auth_mail(id,recipient_hash,action,encrypted_payload,created_at) values($1,$2,'signup','\\x00',date_trunc('milliseconds',statement_timestamp())+interval '123 microseconds') returning created_at",[captureId,recipientHash])).rows[0];
    const input={captureId,recipientHash,recipient:email,userId:uid,captureCreatedAt:capture.created_at,senderHash:'a'.repeat(64),expirySeconds:3600};
    expect((await db.query<{rounded_comparison:boolean}>('select created_at>$2 rounded_comparison from private.isolated_auth_mail where id=$1',[captureId,capture.created_at])).rows[0].rounded_comparison).toBe(true);
    await db.query("insert into private.isolated_auth_mail(id,recipient_hash,action,encrypted_payload,created_at) select $1,recipient_hash,'signup','\\x00',created_at-interval '1 microsecond' from private.isolated_auth_mail where id=$2",[crypto.randomUUID(),captureId]);
    expect(await claimPilotMailDelivery(db,input)).toBe(true);
    const newerId=crypto.randomUUID();await db.query("insert into private.isolated_auth_mail(id,recipient_hash,action,encrypted_payload,created_at) select $1,recipient_hash,'signup','\\x00',created_at+interval '1 microsecond' from private.isolated_auth_mail where id=$2",[newerId,captureId]);
    await expect(claimPilotMailDelivery(db,input)).rejects.toThrow('latest-message');
    const newer=(await db.query<{created_at:Date}>('select created_at from private.isolated_auth_mail where id=$1',[newerId])).rows[0];
    expect(await claimPilotMailDelivery(db,{...input,captureId:newerId,captureCreatedAt:newer.created_at})).toBe(false); // Existing minute cap remains enforced.
    await db.exec('update private.pilot_registration_window set enabled=false,smtp_enabled=false');
  });

  it('prepared recovery extension requires a verified active account with a finalized signed intent and preserves hook privileges',async()=>{
    await operator();await db.exec('update private.pilot_registration_window set enabled=false,smtp_enabled=false');
    // Hosted Auth already owns auth.users. Reproduce that SELECT capability in
    // this lightweight local schema; the candidate grants no table privilege.
    await db.exec('grant usage on schema auth to supabase_auth_admin; grant select on auth.users to supabase_auth_admin');
    const before=(await db.query("select proowner,proacl::text,prosecdef,proconfig from pg_proc where oid='private.mitsa_isolated_send_email(jsonb)'::regprocedure")).rows[0];
    const restore=(await db.query<{definition:string}>("select pg_get_functiondef('private.mitsa_isolated_send_email(jsonb)'::regprocedure) definition")).rows[0].definition;
    await db.exec(readFileSync('supabase/prepared/20261015052446_mitsa_development_recovery_eligibility.sql','utf8'));
    expect((await db.query("select proowner,proacl::text,prosecdef,proconfig from pg_proc where oid='private.mitsa_isolated_send_email(jsonb)'::regprocedure")).rows[0]).toEqual(before);
    for(const role of ['anon','authenticated','service_role','app_workspace'])expect((await db.query<{allowed:boolean}>("select has_function_privilege($1,'private.mitsa_development_recovery_allowed(uuid,text)','EXECUTE') allowed",[role])).rows[0].allowed).toBe(false);
    const uid=crypto.randomUUID(),email='new-recovery-user@example.com',terms=(await db.query<{id:string}>('select test_terms_id id from private.release_gates')).rows[0].id;
    await db.query('insert into auth.users(id,email) values($1,$2)',[uid,email]);
    const intent=(await db.query<{id:string}>("insert into private.registration_intents(email,full_name,nonce_hash,terms_id,provider_user_id) values($1,'Synthetic recovery',repeat('8',64),$2,$3) returning id",[email,terms,uid])).rows[0].id;
    const permitted=async(id=uid,address=email)=>{await db.exec('set role supabase_auth_admin');const result=(await db.query<{allowed:boolean}>('select private.mitsa_development_recovery_allowed($1,$2) allowed',[id,address])).rows[0].allowed;await operator();return result;};
    expect(await permitted()).toBe(false);
    await db.exec("update private.pilot_registration_window set enabled=true,smtp_enabled=true,approved_at=statement_timestamp()-interval '1 minute',expires_at=statement_timestamp()+interval '30 minutes'");
    expect(await permitted()).toBe(false);await db.query('update auth.users set email_confirmed_at=statement_timestamp() where id=$1',[uid]);expect(await permitted()).toBe(false);
    await db.query('update private.registration_intents set finalized_at=statement_timestamp() where id=$1',[intent]);expect(await permitted()).toBe(true);
    expect(await permitted(crypto.randomUUID())).toBe(false);expect(await permitted(uid,'other@example.com')).toBe(false);
    for(const change of ['is_anonymous=true',"deleted_at=statement_timestamp()","banned_until=statement_timestamp()+interval '1 day'"]){
      await db.exec('begin');await db.query(`update auth.users set ${change} where id=$1`,[uid]);expect(await permitted()).toBe(false);await db.exec('rollback');
    }
    const event={user:{id:uid,email},email_data:{email_action_type:'recovery',token_hash:'c'.repeat(64),redirect_to:'http://127.0.0.1:3000/auth/email'}};
    const hook=async(value:unknown)=>{await db.exec('set role supabase_auth_admin');const result=(await db.query<{result:{error?:unknown}}>('select private.mitsa_isolated_send_email($1::jsonb) result',[JSON.stringify(value)])).rows[0].result;await operator();return result;};
    expect(await hook(event)).toEqual({});
    expect(await hook({...event,user:{...event.user,id:crypto.randomUUID()}})).toHaveProperty('error');
    expect(await hook({...event,email_data:{...event.email_data,redirect_to:'https://attacker.example/auth/email'}})).toHaveProperty('error');
    await db.exec('update private.pilot_registration_window set enabled=false,smtp_enabled=false');expect(await permitted()).toBe(false);expect(await hook(event)).toHaveProperty('error');
    expect((await db.query('select 1 from private.memberships where user_id=$1',[uid])).rows).toHaveLength(0);
    // Exercise restoration in offline PostgreSQL and roll the rehearsal back.
    // No deployed provider hook is modified by this unit test.
    await db.exec('begin');await db.exec(restore);await db.exec('drop function private.mitsa_development_recovery_allowed(uuid,text)');
    expect((await db.query("select proowner,proacl::text,prosecdef,proconfig from pg_proc where oid='private.mitsa_isolated_send_email(jsonb)'::regprocedure")).rows[0]).toEqual(before);
    expect((await db.query<{definition:string}>("select pg_get_functiondef('private.mitsa_isolated_send_email(jsonb)'::regprocedure) definition")).rows[0].definition).toBe(restore);
    await db.exec('rollback');
    expect((await db.query<{present:boolean}>("select to_regprocedure('private.mitsa_development_recovery_allowed(uuid,text)') is not null present")).rows[0].present).toBe(true);
  });
  it.each([2,4] as const)('claims development signup and recovery only within the exact lease, recipient scope and original account intent (budget %i)',async(maxAttempts)=>{
    await operator();await db.exec("update private.pilot_mail_deliveries set created_at=statement_timestamp()-interval '25 hours'");
    const start=Date.now()-5*60000,end=Date.now()+20*60000,uid=crypto.randomUUID(),email='development-claim@example.com',hash='f'.repeat(64);
    await db.query("update private.pilot_registration_window set enabled=true,smtp_enabled=true,approved_at=$1,expires_at=$2 where singleton",[new Date(start),new Date(Date.now()+60000)]);
    const terms=(await db.query<{id:string}>('select test_terms_id id from private.release_gates')).rows[0].id;
    await db.query('insert into auth.users(id,email) values($1,$2)',[uid,email]);
    const intent=(await db.query<{id:string}>("insert into private.registration_intents(email,full_name,nonce_hash,terms_id,provider_user_id,created_at) values($1,'Synthetic development claim',$4,$2,$3,statement_timestamp()-interval '10 minutes') returning id",[email,terms,uid,crypto.randomUUID().replaceAll('-','').repeat(2)])).rows[0].id;
    const capture=async(action:string)=>{const id=crypto.randomUUID();const row=(await db.query<{created_at:Date}>("insert into private.isolated_auth_mail(id,recipient_hash,action,encrypted_payload) values($1,$2,$3,'\\x00') returning created_at",[id,hash,action])).rows[0];return {captureId:id,captureCreatedAt:row.created_at};};
    const developmentScope={phase:'controlled' as const,approvedAtMs:start,runExpiresAtMs:end,recipientHash:hash,maxAttempts};
    const input={...await capture('signup'),recipientHash:hash,recipient:email,userId:uid,senderHash:'a'.repeat(64),expirySeconds:3600,developmentScope};
    await expect(claimPilotMailDelivery(db,{...input,developmentScope:{...developmentScope,recipientHash:'a'.repeat(64)}})).rejects.toThrow('approved-test-scope');
    const resumed={...input,developmentScope:{...developmentScope,existingIdentity:{userId:uid,intentId:intent}}};
    await expect(claimPilotMailDelivery(db,{...resumed,developmentScope:{...resumed.developmentScope,existingIdentity:{userId:crypto.randomUUID(),intentId:intent}}})).rejects.toThrow('approved-test-scope');
    await expect(claimPilotMailDelivery(db,{...resumed,developmentScope:{...resumed.developmentScope,existingIdentity:{userId:uid,intentId:crypto.randomUUID()}}})).rejects.toThrow('intent');
    expect(await claimPilotMailDelivery(db,resumed)).toBe(true);expect(await claimPilotMailDelivery(db,input)).toBe(false);
    await db.query("update private.pilot_mail_deliveries set created_at=statement_timestamp()-interval '2 minutes' where capture_id=$1",[input.captureId]);
    const recovery={...input,...await capture('recovery'),action:'recovery' as const};
    await expect(claimPilotMailDelivery(db,recovery)).rejects.toThrow('intent');
    await db.query('update auth.users set email_confirmed_at=statement_timestamp() where id=$1',[uid]);await db.query('update private.registration_intents set finalized_at=statement_timestamp() where id=$1',[intent]);
    expect(await claimPilotMailDelivery(db,recovery)).toBe(true);
    await db.query("update private.pilot_mail_deliveries set created_at=statement_timestamp()-interval '2 minutes' where capture_id in ($1,$2)",[input.captureId,recovery.captureId]);
    const third={...recovery,...await capture('recovery')};
    expect(await claimPilotMailDelivery(db,third)).toBe(maxAttempts===4);
    await db.exec('update private.pilot_registration_window set enabled=false,smtp_enabled=false');
    await expect(claimPilotMailDelivery(db,recovery)).rejects.toThrow('window');
  });
  it('does not renew a revoked or expired development mail lease, even if a worker remains alive',async()=>{
    await operator();const start=new Date(Date.now()-1000).toISOString(),end=new Date(Date.now()+20*60000).toISOString();
    await db.query("update private.pilot_registration_window set enabled=true,smtp_enabled=true,approved_at=$1,expires_at=statement_timestamp()+interval '60 seconds'",[start]);
    expect(await renewDevelopmentMailLease(db,{approvedAt:start,expiresAt:end},true)).toBe(true);
    expect(await renewDevelopmentMailLease(db,{approvedAt:start,expiresAt:end},false)).toBe(true);
    // Capacity pauses can resume while their lease is valid; explicit stop
    // expires the lease and cannot be undone by the worker's next heartbeat.
    expect(await renewDevelopmentMailLease(db,{approvedAt:start,expiresAt:end},true)).toBe(true);
    await db.exec('update private.pilot_registration_window set enabled=false,smtp_enabled=false,expires_at=statement_timestamp()');
    expect(await renewDevelopmentMailLease(db,{approvedAt:start,expiresAt:end},true)).toBe(false);
    expect((await db.query<{open:boolean}>('select private.mitsa_pilot_registration_open() open')).rows[0].open).toBe(false);
  });
  it('requires explicit exact pending-identity resume scope and a fresh capture without relaxing role, factor, expiry or intent binding',async()=>{
    await operator();await db.exec("update private.pilot_registration_window set enabled=true,smtp_enabled=true,approved_at=date_trunc('milliseconds',statement_timestamp())-interval '1 minute',expires_at=date_trunc('milliseconds',statement_timestamp())+interval '1 hour'");
    const uid=crypto.randomUUID(),email='resume-claim-unit@example.com',captureId=crypto.randomUUID(),recipientHash='8'.repeat(64),intentId=crypto.randomUUID();
    const terms=(await db.query<{id:string}>('select test_terms_id id from private.release_gates')).rows[0].id;
    await db.query('insert into auth.users(id,email) values($1,$2)',[uid,email]);
    await db.query("insert into private.registration_intents(id,email,full_name,nonce_hash,terms_id,provider_user_id,created_at) values($1,$2,'Synthetic resume claim',$3,$4,$5,statement_timestamp()-interval '1 hour')",[intentId,email,crypto.randomUUID().replaceAll('-','').repeat(2),terms,uid]);
    const capture=(await db.query<{created_at:Date}>("insert into private.isolated_auth_mail(id,recipient_hash,action,encrypted_payload) values($1,$2,'signup','\\x00') returning created_at",[captureId,recipientHash])).rows[0];
    const window=(await db.query<{approved_at:Date;expires_at:Date}>('select approved_at,expires_at from private.pilot_registration_window')).rows[0];
    const input={captureId,recipientHash,recipient:email,userId:uid,captureCreatedAt:capture.created_at,senderHash:'a'.repeat(64),expirySeconds:3600};
    const approvedScope={recipientHash,maxAttempts:3 as const,approvedAtMs:window.approved_at.getTime(),expiresAtMs:window.expires_at.getTime(),existingIdentity:{userId:uid,intentId}};
    await expect(claimPilotMailDelivery(db,input)).rejects.toThrow('intent');
    for(const identity of [{userId:crypto.randomUUID(),intentId},{userId:uid,intentId:crypto.randomUUID()}])await expect(claimPilotMailDelivery(db,{...input,approvedScope:{...approvedScope,existingIdentity:identity}})).rejects.toThrow('intent');
    const oldId=crypto.randomUUID();await db.query("insert into private.isolated_auth_mail(id,recipient_hash,action,encrypted_payload,created_at) values($1,$2,'signup','\\x00',statement_timestamp()-interval '1 hour')",[oldId,recipientHash]);
    await expect(claimPilotMailDelivery(db,{...input,captureId:oldId,approvedScope})).rejects.toThrow('intent');
    const factorId=crypto.randomUUID();await db.query("insert into auth.mfa_factors(id,user_id,status,factor_type) values($1,$2,'verified','totp')",[factorId,uid]);
    await expect(claimPilotMailDelivery(db,{...input,approvedScope})).rejects.toThrow('intent');await db.query('delete from auth.mfa_factors where id=$1',[factorId]); // Offline fixture only.
    await db.query("update private.registration_intents set expires_at=statement_timestamp()-interval '1 second' where id=$1",[intentId]);await expect(claimPilotMailDelivery(db,{...input,approvedScope})).rejects.toThrow('intent');
    await db.query("update private.registration_intents set expires_at=statement_timestamp()+interval '1 hour' where id=$1",[intentId]);
    // Offline completion fixture: exactly one received earlier claim may be
    // retained, and the new window is allowed only one additional claim.
    await db.query("insert into private.pilot_mail_deliveries(capture_id,recipient_hash,state,created_at) values($1,$2,'smtp-accepted',statement_timestamp()-interval '1 hour')",[oldId,recipientHash]);
    const completion={...approvedScope,remainingAttempts:1 as const,previousCaptureId:oldId};
    // Prior tests retain their history. Completion must reject unrelated rows.
    await expect(claimPilotMailDelivery(db,{...input,approvedScope:completion})).rejects.toThrow('approved-test-scope');
    await db.query('delete from private.pilot_mail_deliveries where capture_id<>$1',[oldId]); // In-memory fixture only.
    await expect(claimPilotMailDelivery(db,{...input,approvedScope:{...completion,previousCaptureId:crypto.randomUUID()}})).rejects.toThrow('approved-test-scope');
    await db.query("update private.pilot_mail_deliveries set state='unconfirmed' where capture_id=$1",[oldId]);
    await expect(claimPilotMailDelivery(db,{...input,approvedScope:completion})).rejects.toThrow('approved-test-scope');
    await db.query("update private.pilot_mail_deliveries set state='smtp-accepted' where capture_id=$1",[oldId]);
    expect(await claimPilotMailDelivery(db,{...input,approvedScope:completion})).toBe(true);
    await db.exec("update private.pilot_registration_window set approved_at=approved_at-interval '2 minutes'");
    const agedCompletion={...completion,approvedAtMs:completion.approvedAtMs-120000};
    await db.query("update private.pilot_mail_deliveries set created_at=statement_timestamp()-interval '2 minutes' where capture_id=$1",[captureId]);
    const further=crypto.randomUUID();const furtherCapture=(await db.query<{created_at:Date}>("insert into private.isolated_auth_mail(id,recipient_hash,action,encrypted_payload) values($1,$2,'signup','\\x00') returning created_at",[further,recipientHash])).rows[0];
    expect(await claimPilotMailDelivery(db,{...input,captureId:further,captureCreatedAt:furtherCapture.created_at,approvedScope:agedCompletion})).toBe(false);
    await db.exec('update private.pilot_registration_window set enabled=false,smtp_enabled=false');
  });
});

