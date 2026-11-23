import { beforeAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { acceptSyntheticTerms, createSyntheticUser, database, enrollSyntheticMfa, hostedConfig, publicClient } from "../support/hosted";
import { totp } from "../support/totp";

describe("Mitsa provider-backed account security", () => {
  let user: Awaited<ReturnType<typeof enrollSyntheticMfa>>;
  let client: ReturnType<typeof publicClient>;
  let backup: { id: string; secret: string };
  let workspace: { id: string; slug: string; locationId: string };
  beforeAll(async () => {
    user = await enrollSyntheticMfa(await createSyntheticUser("account-lifecycle"));
    client = publicClient();
    expect((await client.auth.setSession({ access_token: user.session.access_token, refresh_token: user.session.refresh_token })).error).toBeNull();
  }, 120000);

  it("requires exact current Terms before atomic workspace creation", async () => {
    const args = { p_name: "Synthetic account lifecycle", p_location: "Main", p_kind: "shop", p_key: crypto.randomUUID() };
    expect((await client.schema("api").rpc("mitsa_create_workspace", args)).error?.code).toBe("42501");
    expect((await client.schema("api").rpc("mitsa_accept_terms", { p_version: crypto.randomUUID() })).error?.code).toBe("42501");
    await acceptSyntheticTerms(user);
    const result = await client.schema("api").rpc("mitsa_create_workspace", args);
    expect(result.error).toBeNull(); workspace = result.data;
    const db = await database();
    try {
      expect((await db.query("select count(*)::int n from private.legal_acceptances where user_id=$1", [user.id])).rows[0].n).toBe(1);
      await expect(db.query("update private.legal_versions set content=content||' changed' where id=(select test_terms_id from private.release_gates where singleton)")).rejects.toMatchObject({ code: "55000" });
    } finally { await db.end(); }
  });

  it("verifies a backup before binding it and safely removes the old factor", async () => {
    const permit = await client.schema("api").rpc("mitsa_prepare_enrollment"); expect(permit.error).toBeNull();
    const enrolled = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "Synthetic backup", issuer: "Mitsa" });
    expect(enrolled.error).toBeNull(); backup = { id: enrolled.data!.id, secret: enrolled.data!.totp.secret };
    expect((await client.schema("api").rpc("mitsa_bind_factor", { p_factor: backup.id, p_permit: permit.data })).error?.code).toBe("42501");
    expect((await client.auth.mfa.challengeAndVerify({ factorId: backup.id, code: totp(backup.secret) })).error).toBeNull();
    expect((await client.schema("api").rpc("mitsa_bind_factor", { p_factor: backup.id, p_permit: permit.data })).error).toBeNull();
    const removal = await client.schema("api").rpc("mitsa_begin_factor_removal", { p_factor: user.factorId, p_disable: false }); expect(removal.error).toBeNull();
    expect((await client.schema("api").rpc("mitsa_finish_factor_removal", { p_permit: removal.data })).error?.code).toBe("42501");
    expect((await client.auth.mfa.unenroll({ factorId: user.factorId })).error).toBeNull();
    expect((await client.schema("api").rpc("mitsa_finish_factor_removal", { p_permit: removal.data })).error).toBeNull();
    expect((await client.schema("api").rpc("mitsa_identity")).data.mfaReady).toBe(true);
  }, 120000);

  it("removes the actual provider factor, blocks Owner access and permits approved reenrollment", async () => {
    const older = publicClient();
    expect((await older.auth.signInWithPassword({ email: user.email, password: user.password })).error).toBeNull();
    const removal = await client.schema("api").rpc("mitsa_begin_factor_removal", { p_factor: backup.id, p_disable: true }); expect(removal.error).toBeNull();
    expect((await client.auth.mfa.unenroll({ factorId: backup.id })).error).toBeNull();
    expect((await client.schema("api").rpc("mitsa_finish_factor_removal", { p_permit: removal.data })).error).toBeNull();
    expect((await client.schema("api").rpc("mitsa_finish_factor_removal", { p_permit: removal.data })).error).toBeNull();
    expect((await client.auth.mfa.listFactors()).data?.totp).toHaveLength(0);
    expect((await client.schema("api").rpc("mitsa_workspace", { p_slug: workspace.slug })).error?.code).toBe("42501");
    expect((await client.schema("api").rpc("mitsa_security_status")).data).toMatchObject({ ready: false, initialized: false });
    expect((await client.schema("api").rpc("mitsa_prepare_enrollment")).error).toBeNull();
    expect((await older.schema("api").rpc("mitsa_prepare_enrollment")).error?.code).toBe("42501");
    // AMR timestamps have whole-second precision. A new password sign-in must
    // fall strictly after the reset second rather than reusing an older AMR.
    const db = await database();
    let reset: number;
    try { reset = Number((await db.query("select floor(extract(epoch from reset_at)) epoch from private.account_security where user_id=$1",[user.id])).rows[0].epoch); }
    finally { await db.end(); }
    await new Promise(resolve => setTimeout(resolve,Math.max(0,(reset+1)*1000-Date.now()+100)));
    expect((await older.auth.signInWithPassword({ email: user.email, password: user.password })).error).toBeNull();
    expect((await older.schema("api").rpc("mitsa_prepare_enrollment")).error).toBeNull();
  }, 120000);

  it("keeps Staff location access after securely disabling optional MFA", async () => {
    const staff = await enrollSyntheticMfa(await createSyntheticUser("optional-mfa"));
    await acceptSyntheticTerms(staff);
    const db = await database();
    try {
      await db.query("begin");
      await db.query("insert into private.memberships(business_id,user_id,role) values($1,$2,'staff')", [workspace.id, staff.id]);
      await db.query("insert into private.shop_assignments(business_id,user_id,shop_id) values($1,$2,$3)", [workspace.id, staff.id, workspace.locationId]);
      await db.query("commit");
    } finally { await db.end(); }
    const auth = publicClient(); await auth.auth.setSession({ access_token: staff.session.access_token, refresh_token: staff.session.refresh_token });
    const removal = await auth.schema("api").rpc("mitsa_begin_factor_removal", { p_factor: staff.factorId, p_disable: true }); expect(removal.error).toBeNull();
    expect((await auth.auth.mfa.unenroll({ factorId: staff.factorId })).error).toBeNull();
    expect((await auth.schema("api").rpc("mitsa_finish_factor_removal", { p_permit: removal.data })).error).toBeNull();
    const allowed = await auth.schema("api").rpc("mitsa_workspace", { p_slug: workspace.slug });
    expect(allowed.error).toBeNull(); expect(allowed.data).toMatchObject({ role: "staff", locations: [{ id: workspace.locationId }] });
  }, 120000);

  it("restricts registration intents to the privileged service and a synthetic allowlist", async () => {
    const cfg = hostedConfig();
    const service = createClient(cfg.url, cfg.adminKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const email = `foundation-registration-${crypto.randomUUID()}@example.invalid`;
    const nonce = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
    const db = await database();
    try {
      const terms = (await db.query("select test_terms_id from private.release_gates where singleton")).rows[0].test_terms_id;
      const args = { p_email: email, p_name: "Synthetic registration", p_terms: terms, p_nonce_hash: createHash("sha256").update(nonce).digest("hex"), p_accepted: true, p_request_hash: createHash("sha256").update(crypto.randomUUID()).digest("hex"), p_signed_at: new Date().toISOString() };
      expect((await service.schema("api").rpc("mitsa_signed_registration_intent", args)).error?.code).toBe("42501");
      await db.query("insert into private.registration_test_recipients(email,enabled) values($1,true)", [email]);
      expect((await service.schema("api").rpc("mitsa_signed_registration_intent", args)).error).toBeNull();
      expect((await client.schema("api").rpc("mitsa_signed_registration_intent", { ...args, p_nonce_hash: "b".repeat(64) })).error?.code).toBe("42501");
      const futureUser = crypto.randomUUID();
      const permissions = (await db.query("select has_schema_privilege('supabase_auth_admin','private','usage') schema_usage,has_function_privilege('supabase_auth_admin','private.mitsa_before_user_created(jsonb)','execute') hook_execute,has_table_privilege('supabase_auth_admin','private.registration_intents','select') intent_read,has_column_privilege('supabase_auth_admin','private.registration_intents','provider_user_id','update') intent_bind,has_table_privilege('supabase_auth_admin','private.memberships','select') business_read")).rows[0];
      expect(permissions).toEqual({ schema_usage: true, hook_execute: true, intent_read: true, intent_bind: true, business_read: false });
      // Supabase deliberately prevents the operator from SET ROLE to its
      // managed Auth role. Exercise logic in a rolled-back operator transaction;
      // exact invoker RLS is also executed in disposable PostgreSQL. Actual
      // provider invocation remains a separate controlled-configuration check.
      await db.query("begin");
      const result = await db.query("select private.mitsa_before_user_created($1::jsonb) result", [JSON.stringify({ user: { id: futureUser, email, is_anonymous: false, user_metadata: { registration_nonce: nonce, role: "owner" } } })]);
      expect(result.rows[0].result).toEqual({});
      await db.query("rollback");
      expect((await db.query("select count(*)::int n from auth.users where id=$1", [futureUser])).rows[0].n).toBe(0);
    } finally { await db.query("rollback"); await db.end(); }
  }, 120000);
});
