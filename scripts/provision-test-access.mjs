import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { parse } from "dotenv";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { assertTestTarget } from "./test-target.mjs";
import { testDatabaseConfig } from "./postgres-config.mjs";
import { totp } from "../tests/support/totp.ts";

// Explicit operator-only synthetic access setup. Never imported by Next.
// Credentials stay in an ignored local file; no tokens or credentials logged.
const approved = JSON.parse(readFileSync("config/test-target.json", "utf8"));
const operator = parse(readFileSync(".secrets/operator.env"));
const target = assertTestTarget({ projectRef: operator.TEST_PROJECT_REF, url: operator.TEST_SUPABASE_URL, databaseUrl: operator.TEST_DATABASE_URL }, approved);
assert.equal(target.projectRef, "mjtejwafxriwntweussc");
const runtime = parse(readFileSync(".env.local"));
assert.equal(runtime.SUPABASE_URL, target.url);
assert.equal(runtime.APP_ORIGIN, "http://127.0.0.1:3000");
const file = ".secrets/development-access.json";
const save = value => { mkdirSync(".secrets", { recursive: true }); writeFileSync(file, JSON.stringify(value, null, 2), { mode: 0o600 }); };
const access = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {
  project: target.projectRef, email: `foundation-developer-${randomUUID()}@example.invalid`,
  password: `M1!${randomBytes(24).toString("base64url")}`, workspaceKey: randomUUID(),
};
assert.equal(access.project, target.projectRef);
assert(/^foundation-developer-[a-z0-9-]+@example\.invalid$/.test(access.email));
assert(typeof access.password === "string" && access.password.length >= 24);
const db = new pg.Client(testDatabaseConfig(operator.TEST_DATABASE_URL, approved));
let client;
try {
  await db.connect();
  assert.equal((await db.query("select marker from foundation_probe.environment_identity where singleton")).rows[0]?.marker, target.databaseMarker);
  const gate = (await db.query("select registration_enabled or external_mail_enabled or legal_publication_enabled or disposal_enabled or eligibility_approved open from private.release_gates where singleton")).rows[0];
  assert.equal(gate.open, false, "release gates must remain closed");
  assert(operator.TEST_AUTH_ADMIN_KEY && operator.TEST_PUBLISHABLE_KEY, "isolated test credentials required");
  save(access); // Preserve planned credentials before a possible network retry.
  const admin = createClient(target.url, operator.TEST_AUTH_ADMIN_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  if (!access.userId) {
    // Recover only this exact planned synthetic identity after an interrupted
    // setup. Never reset another user's password or change existing factors.
    const existing = (await db.query("select id from auth.users where email=$1", [access.email])).rows[0];
    if (existing) access.userId = existing.id;
    else {
      const created = await admin.auth.admin.createUser({ email: access.email, password: access.password, email_confirm: true, user_metadata: { full_name: "Synthetic development owner" } });
      if (created.error || !created.data.user) throw new Error(`Synthetic account creation failed: ${created.error?.code ?? "unavailable"}`);
      access.userId = created.data.user.id;
    }
    save(access);
  }
  client = createClient(target.url, operator.TEST_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const login = await client.auth.signInWithPassword({ email: access.email, password: access.password });
  if (login.error) throw new Error(`Synthetic sign-in failed: ${login.error.code}; existing credentials were preserved`);
  if (!access.authenticator) {
    const permit = await client.schema("api").rpc("mitsa_prepare_enrollment");
    if (permit.error || typeof permit.data !== "string") throw new Error("Trusted test enrollment authorization unavailable");
    const factor = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "Development authenticator", issuer: "Mitsa" });
    if (factor.error || !factor.data.totp) throw new Error("Provider test enrollment failed");
    access.authenticator = { id: factor.data.id, secret: factor.data.totp.secret, permit: permit.data };
    save(access);
  }
  const challenge = await client.auth.mfa.challengeAndVerify({ factorId: access.authenticator.id, code: totp(access.authenticator.secret) });
  if (challenge.error) throw new Error(`Synthetic MFA verification failed: ${challenge.error.code}`);
  const identity = await client.schema("api").rpc("mitsa_identity");
  if (identity.error) throw new Error("Synthetic identity verification failed");
  if (!identity.data.mfaReady) {
    const bound = await client.schema("api").rpc("mitsa_bind_factor", { p_factor: access.authenticator.id, p_permit: access.authenticator.permit });
    if (bound.error) throw new Error("Trusted enrollment expired or refused; no reset/bypass attempted");
  }
  const terms = await client.schema("api").rpc("mitsa_current_terms");
  if (terms.error || terms.data?.status !== "test") throw new Error("Only the current synthetic test agreement may be accepted");
  if (!terms.data.accepted && (await client.schema("api").rpc("mitsa_accept_terms", { p_version: terms.data.id })).error) throw new Error("Synthetic agreement acceptance failed");
  if (!access.workspace) {
    const workspace = await client.schema("api").rpc("mitsa_create_workspace", { p_name: "Synthetic Mitsa development", p_location: "Main shop", p_kind: "shop", p_key: access.workspaceKey });
    if (workspace.error) throw new Error("Atomic synthetic workspace creation failed");
    access.workspace = workspace.data;
    save(access);
  }
  const workspace = await client.schema("api").rpc("mitsa_workspace", { p_slug: access.workspace.slug });
  if (workspace.error || workspace.data.role !== "owner" || workspace.data.id !== access.workspace.id) throw new Error("Synthetic workspace authorization failed");
  delete access.authenticator.permit;
  save(access);
  console.log(JSON.stringify({ project: target.projectRef, loginUrl: `${runtime.APP_ORIGIN}/login`, workspaceUrl: `${runtime.APP_ORIGIN}/w/${access.workspace.slug}`, role: "owner", mfaRequired: true, privateAccessFile: file, credentialsPrinted: false }));
} catch (error) {
  console.error(error instanceof assert.AssertionError ? "Synthetic setup target/security assertion failed; no bypass attempted" : error.message);
  process.exitCode = 1;
} finally {
  if (client) await client.auth.signOut({ scope: "local" });
  await db.end();
}
