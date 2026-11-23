import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { registrationIntentHandler } from "../../supabase/functions/_shared/registration-intent";
import { signIntentRequest } from "../../supabase/functions/_shared/registration-intent-auth";

describe("registration intent database boundary", () => {
  let db: PGlite;
  let terms: string;
  const email = "foundation-intent@example.invalid";
  const randomHash = () => crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
  const call = (overrides: Partial<{ email: string; terms: string; accepted: boolean; request: string; signedAt: string; name: string }> = {}) => db.query<{ id: string }>("select api.mitsa_signed_registration_intent($1,$2,$3,$4,$5,$6,$7) id", [overrides.email ?? email, overrides.name ?? "Synthetic Person", overrides.terms ?? terms, randomHash(), overrides.accepted ?? true, overrides.request ?? randomHash(), overrides.signedAt ?? new Date().toISOString()]);
  const operator = () => db.exec("reset role");
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
    for (const file of ["20261012053948_foundation_security_proof.sql", "20261012054416_foundation_identity.sql", "20261012060403_foundation_membership_lock_policy.sql", "20261012060628_foundation_current_session_policy.sql", "20261012070606_foundation_verified_actor_adapter.sql", "20261013181012_mitsa_workspace_foundation.sql", "20261013181135_mitsa_membership_commands.sql", "20261013185440_mitsa_account_security_terms.sql"]) {
      if (file.includes("foundation_verified_actor_adapter")) await db.exec("revoke usage on schema auth from app_authz,app_command");
      await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
    }
    await db.exec(readFileSync("supabase/migrations/20261013223908_mitsa_registration_boundary.sql", "utf8"));
    terms = (await db.query<{ id: string }>("insert into private.legal_versions(kind,version,content,content_hash,status) values('terms','intent-synthetic-v1','Synthetic agreement',encode(sha256(convert_to('Synthetic agreement','UTF8')),'hex'),'test') returning id")).rows[0].id;
    await db.query("update private.release_gates set test_terms_id=$1 where singleton", [terms]);
    await db.query("insert into private.registration_test_recipients(email,enabled) values($1,true)", [email]);
    await db.exec("set role service_role");
  }, 60000);
  afterAll(async () => { if (db) await db.close(); });
  it("requires the privileged boundary and denies direct clients and the legacy route", async () => {
    await expect(db.query("select api.mitsa_registration_intent($1,'Synthetic',$2,$3,true)", [email,terms,randomHash()])).rejects.toMatchObject({ code: "42501" });
    for (const role of ["anon", "authenticated"]) {
      await operator(); await db.exec(`set role ${role}`);
      await expect(call()).rejects.toMatchObject({ code: "42501" });
      await expect(db.exec("select * from private.registration_requests")).rejects.toMatchObject({ code: "42501" });
    }
    await operator(); await db.exec("set role service_role");
  });
  it("rejects unchecked or incorrect Terms, unknown recipients, invalid names and expired requests atomically", async () => {
    await expect(call({ accepted: false })).rejects.toMatchObject({ code: "22023" });
    await expect(call({ terms: crypto.randomUUID() })).rejects.toMatchObject({ code: "42501" });
    await expect(call({ email: "foundation-unapproved@example.invalid" })).rejects.toMatchObject({ code: "42501" });
    await expect(call({ email: "real-person@example.com" })).rejects.toMatchObject({ code: "42501" });
    await expect(call({ name: " " })).rejects.toMatchObject({ code: "22023" });
    await expect(call({ signedAt: new Date(Date.now()-61000).toISOString() })).rejects.toMatchObject({ code: "42501" });
    await expect(call({ signedAt: new Date(Date.now()+61000).toISOString() })).rejects.toMatchObject({ code: "42501" });
    await operator();
    expect((await db.query<{ n: number }>("select count(*)::int n from private.registration_requests")).rows[0].n).toBe(0);
    expect((await db.query<{ n: number }>("select count(*)::int n from private.registration_intents")).rows[0].n).toBe(0);
    await db.exec("set role service_role");
  });
  it("permits exactly one simultaneous request per signed nonce and enforces the email limit", async () => {
    const request = randomHash();
    const results = await Promise.allSettled([call({ request }),call({ request }),call({ request })]);
    expect(results.filter(result => result.status==="fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status==="rejected").map(result => (result as PromiseRejectedResult).reason.code)).toEqual(["23505","23505"]);
    await call(); await call();
    await expect(call()).rejects.toMatchObject({ code: "54000" });
    await operator();
    expect((await db.query<{ n: number }>("select count(*)::int n from private.registration_requests")).rows[0].n).toBe(3);
    expect((await db.query<{ n: number }>("select count(*)::int n from private.registration_intents")).rows[0].n).toBe(3);
    expect((await db.query<{ n: number }>("select count(*)::int n from private.memberships")).rows[0].n).toBe(0);
    await db.exec("set role service_role");
  });
  it("enforces global minute and hour limits across different recipients", async () => {
    await operator();
    await db.exec("begin");
    await db.exec("insert into private.registration_requests(request_hash,signed_at) select lpad(to_hex(n),64,'0'),now() from generate_series(1,27) n");
    await db.exec("set local role service_role");
    await expect(call({ email: "foundation-global@example.invalid" })).rejects.toMatchObject({ code: "54000" });
    await db.exec("rollback");
    await db.exec("begin");
    await db.exec("insert into private.registration_requests(request_hash,signed_at,received_at) select lpad(to_hex(n),64,'0'),now()-interval '2 minutes',now()-interval '2 minutes' from generate_series(1,97) n");
    await db.exec("set local role service_role");
    await expect(call()).rejects.toMatchObject({ code: "54000" });
    await db.exec("rollback");
    await db.exec("set role service_role");
  });
  it("rejects captured signed HTTP requests through the real atomic database boundary", async () => {
    const address = "foundation-endpoint@example.invalid", origin = "http://127.0.0.1:3000", secret = "ab".repeat(32);
    await operator(); await db.query("insert into private.registration_test_recipients(email,enabled) values($1,true)", [address]); await db.exec("set role service_role");
    const handler = registrationIntentHandler({ signingKey: secret, origins: [origin], authorizeApiKey: key => key === "synthetic-public", async createIntent(value) {
      return (await db.query<{ id: string }>("select api.mitsa_signed_registration_intent($1,$2,$3,$4,$5,$6,$7) id", [value.email,value.name,value.terms,value.nonceHash,value.accepted,value.requestHash,value.signedAt])).rows[0].id;
    } });
    const body = JSON.stringify({ email: address, fullName: "Synthetic HTTP signup", termsVersion: terms, accepted: true });
    const signed = await signIntentRequest(secret,body);
    const request = () => new Request("https://isolated.example/functions/v1/mitsa-registration-intent", { method: "POST", headers: { origin, apikey: "synthetic-public", "content-type": "application/json", ...signed }, body });
    const results = await Promise.all([handler(request()),handler(request()),handler(request())]);
    expect(results.map(result => result.status).sort()).toEqual([201,403,403]);
    await operator();
    expect((await db.query<{ n: number }>("select count(*)::int n from private.registration_intents where email=$1", [address])).rows[0].n).toBe(1);
    await db.exec("set role service_role");
  });
  it("rejects expired, wrong-email, missing and already-bound provider tokens", async () => {
    await operator();
    const nonce = "c".repeat(64), uid = crypto.randomUUID();
    const intent = (await db.query<{ id: string }>("insert into private.registration_intents(email,full_name,nonce_hash,terms_id,expires_at) values($1,'Synthetic',encode(sha256(convert_to($2,'UTF8')),'hex'),$3,now()-interval '1 second') returning id", [email,nonce,terms])).rows[0].id;
    await db.exec("set role supabase_auth_admin");
    const event = (value: string = nonce, address: string = email, id: string = uid) => JSON.stringify({ user: { id, email: address, is_anonymous: false, user_metadata: { registration_nonce: value, role: "owner" } } });
    const hook = (payload: string) => db.query<{ result: { error?: { http_code: number } } }>("select private.mitsa_before_user_created($1::jsonb) result", [payload]);
    expect((await hook(event())).rows[0].result.error?.http_code).toBe(403);
    await operator(); await db.query("update private.registration_intents set expires_at=now()+interval '1 hour' where id=$1", [intent]); await db.exec("set role supabase_auth_admin");
    expect((await hook(event("wrong"))).rows[0].result.error?.http_code).toBe(403);
    expect((await hook(event(nonce,"foundation-other@example.invalid"))).rows[0].result.error?.http_code).toBe(403);
    expect((await hook(event())).rows[0].result).toEqual({});
    expect((await hook(event(nonce,email,crypto.randomUUID()))).rows[0].result.error?.http_code).toBe(403);
    await operator();
    expect((await db.query<{ n: number }>("select count(*)::int n from private.memberships")).rows[0].n).toBe(0);
  });
  it("accepts an unallowlisted public email only with every published-policy gate, preserving provider binding", async () => {
    // Local PostgreSQL only. Never flips gates or delivers mail in Supabase.
    await operator(); await db.exec("begin");
    try {
      const published=(await db.query<{id:string}>("insert into private.legal_versions(kind,version,content,content_hash,status,approved_at,effective_at) values('terms','public-unit-only','Unit test only',encode(sha256(convert_to('Unit test only','UTF8')),'hex'),'published',now(),now()) returning id")).rows[0].id;
      const address="previously-unapproved@gmail.com",nonce=randomHash(),uid=crypto.randomUUID();
      await db.query("update private.release_gates set test_terms_id=$1 where singleton",[published]);
      const intent=()=>db.query<{id:string}>("select api.mitsa_signed_registration_intent($1,'Synthetic public unit test',$2,encode(sha256(convert_to($3,'UTF8')),'hex'),true,$4,$5) id",[address,published,nonce,randomHash(),new Date().toISOString()]);
      for(const gate of ['registration_enabled','eligibility_approved','legal_publication_enabled']) {
        await db.exec(`update private.release_gates set registration_enabled=true,eligibility_approved=true,legal_publication_enabled=true; update private.release_gates set ${gate}=false`);
        await db.exec("savepoint denied; set local role service_role");
        await expect(intent()).rejects.toMatchObject({code:"42501"});
        await db.exec("rollback to savepoint denied; reset role");
      }
      await db.exec("update private.release_gates set registration_enabled=true,eligibility_approved=true,legal_publication_enabled=true; set local role service_role");
      expect((await intent()).rows[0].id).toBeTruthy();
      await db.exec("reset role; set local role supabase_auth_admin");
      const hook=(id:string,value:string)=>db.query<{result:{error?:unknown}}>("select private.mitsa_before_user_created($1::jsonb) result",[JSON.stringify({user:{id,email:address,is_anonymous:false,user_metadata:{registration_nonce:value}}})]);
      expect((await hook(uid,randomHash())).rows[0].result.error).toBeTruthy();
      expect((await hook(uid,nonce)).rows[0].result).toEqual({});
      expect((await hook(crypto.randomUUID(),nonce)).rows[0].result.error).toBeTruthy();
      await db.exec("reset role");
      expect((await db.query<{n:number}>("select count(*)::int n from private.registration_test_recipients where email=$1",[address])).rows[0].n).toBe(0);
      expect((await db.query<{n:number}>("select count(*)::int n from private.memberships where user_id=$1",[uid])).rows[0].n).toBe(0);
    } finally {await db.exec("rollback");await db.exec("set role service_role");}
  });
});
