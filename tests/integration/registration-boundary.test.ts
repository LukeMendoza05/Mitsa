import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { randomBytes, createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { database, hostedConfig, publicClient, syntheticTermsVersion } from "../support/hosted";
import { registrationIntentHandler, type IntentInput } from "../../supabase/functions/_shared/registration-intent";
import { signIntentRequest } from "../../supabase/functions/_shared/registration-intent-auth";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
describe("isolated registration boundary (local handler, hosted database)", () => {
  const email = `foundation-boundary-${crypto.randomUUID()}@example.invalid`;
  const origin = "http://127.0.0.1:3000", secret = randomBytes(32).toString("hex");
  let terms: string;
  let calls = 0;
  let service: ReturnType<typeof publicClient>;
  const args = (value: IntentInput) => ({ p_email: value.email, p_name: value.name, p_terms: value.terms, p_nonce_hash: value.nonceHash, p_accepted: value.accepted, p_request_hash: value.requestHash, p_signed_at: value.signedAt });
  const handler = registrationIntentHandler({ signingKey: secret, origins: [origin], authorizeApiKey: key => key === "synthetic-public", async createIntent(value) {
    calls++;
    const result = await service.schema("api").rpc("mitsa_signed_registration_intent", args(value));
    return result.error ? null : result.data;
  } });
  async function request(options: { body?: unknown; signedBody?: unknown; secret?: string; timestamp?: number; unsigned?: boolean } = {}) {
    const body = JSON.stringify(options.body ?? { email, fullName: "Synthetic boundary", termsVersion: terms, accepted: true });
    const signed = options.unsigned ? {} : await signIntentRequest(options.secret ?? secret, options.signedBody ? JSON.stringify(options.signedBody) : body, options.timestamp);
    return new Request("https://isolated.example/functions/v1/mitsa-registration-intent", { method: "POST", headers: { origin, apikey: "synthetic-public", "content-type": "application/json", ...signed }, body });
  }
  beforeAll(async () => {
    const cfg = hostedConfig();
    expect(cfg.projectRef).toBe("mjtejwafxriwntweussc");
    terms = await syntheticTermsVersion();
    const db = await database();
    try {
      const gates = (await db.query("select registration_enabled,external_mail_enabled,legal_publication_enabled,eligibility_approved from private.release_gates where singleton")).rows[0];
      expect(gates).toEqual({ registration_enabled: false, external_mail_enabled: false, legal_publication_enabled: false, eligibility_approved: false });
      await db.query("insert into private.registration_test_recipients(email,enabled) values($1,true)", [email]);
    } finally { await db.end(); }
    service = createClient(cfg.url,cfg.adminKey,{ auth: { persistSession: false, autoRefreshToken: false } });
  },120000);
  afterAll(async () => {
    const db = await database();
    try { await db.query("update private.registration_test_recipients set enabled=false where email=$1",[email]); }
    finally { await db.end(); }
  },60000);
  it("rejects direct forged requests before touching the privileged API", async () => {
    const before = calls;
    for (const options of [{ unsigned: true },{ secret: "11".repeat(32) },{ timestamp: Math.floor(Date.now()/1000)-61 },{ timestamp: Math.floor(Date.now()/1000)+62 }]) expect((await handler(await request(options))).status).toBe(401);
    expect((await handler(await request({ body: { email,fullName:"Synthetic",termsVersion:terms,accepted:false } }))).status).toBe(422);
    expect(calls).toBe(before);
  });
  it("atomically rejects concurrent HTTP replay and enforces the email rate limit", async () => {
    const signed = await request();
    const results = await Promise.all([handler(signed.clone()),handler(signed.clone()),handler(signed.clone())]);
    expect(results.map(result => result.status).sort()).toEqual([201,403,403]);
    expect((await handler(await request())).status).toBe(201);
    expect((await handler(await request())).status).toBe(201);
    expect((await handler(await request())).status).toBe(403);
    const db = await database();
    try {
      expect((await db.query("select count(*)::int n from private.registration_intents where email=$1",[email])).rows[0].n).toBe(3);
      expect((await db.query("select count(*)::int n from auth.users where email=$1",[email])).rows[0].n).toBe(0);
      expect((await db.query("select count(*)::int n from private.account_profiles p join auth.users u on u.id=p.user_id where u.email=$1",[email])).rows[0].n).toBe(0);
    } finally { await db.end(); }
  });
  it("denies anonymous direct RPC calls and bypass of the legacy service API", async () => {
    const value = { p_email: email,p_name:"Synthetic",p_terms:terms,p_nonce_hash:digest(crypto.randomUUID()),p_accepted:true,p_request_hash:digest(crypto.randomUUID()),p_signed_at:new Date().toISOString() };
    const direct = await publicClient().schema("api").rpc("mitsa_signed_registration_intent",value);
    expect(direct.error?.code).toBe("42501");
    const { p_request_hash: _hash,p_signed_at: _time,...legacy } = value;
    expect((await service.schema("api").rpc("mitsa_registration_intent",legacy)).error?.code).toBe("42501");
    expect((await handler(await request({body:{email:"unapproved@example.com",fullName:"Synthetic",termsVersion:terms,accepted:true}}))).status).toBe(403);
    expect((await handler(await request({body:{email,fullName:"Synthetic",termsVersion:crypto.randomUUID(),accepted:true}}))).status).toBe(403);
  });
  it("enforces the shared global minute limit without retaining fixture records", async () => {
    // Operator setup is rolled back; do not fill the shared test project's
    // minute budget or delete existing replay/audit history to make tests pass.
    const db = await database();
    try {
      await db.query("begin");
      await db.query("select pg_advisory_xact_lock(8416,1)");
      const count = (await db.query("select count(*)::int n from private.registration_requests where received_at>statement_timestamp()-interval '1 minute'")).rows[0].n;
      await db.query("insert into private.registration_requests(request_hash,signed_at) select encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex'),now() from generate_series(1,$1::int)",[Math.max(0,30-count)]);
      await db.query("savepoint denial");
      await db.query("set local role service_role");
      await expect(db.query("select api.mitsa_signed_registration_intent($1,'Synthetic',$2,$3,true,$4,statement_timestamp())",[email,terms,digest(crypto.randomUUID()),digest(crypto.randomUUID())])).rejects.toMatchObject({code:"54000"});
      await db.query("rollback to savepoint denial");
    } finally { await db.query("rollback"); await db.end(); }
  });
});
