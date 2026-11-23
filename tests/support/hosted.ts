import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import { assertTestTarget } from "../../scripts/test-target.mjs";
import { testDatabaseConfig } from "../../scripts/postgres-config.mjs";
import { totp } from "./totp";

// Never mutate process.env: Playwright may load tests before starting Next.js.
// Operator credentials must not be inherited by the application process.
const operatorEnv = parse(readFileSync(".secrets/operator.env"));
const approved = JSON.parse(readFileSync("config/test-target.json", "utf8"));

function required(name: string): string {
  const value = operatorEnv[name];
  if (!value || value.startsWith("REPLACE_")) throw new Error(`Hosted proof requires ${name} in .secrets/operator.env; tests cannot be skipped`);
  return value;
}

export function hostedConfig() {
  const input = { projectRef: required("TEST_PROJECT_REF"), url: required("TEST_SUPABASE_URL"), databaseUrl: required("TEST_DATABASE_URL") };
  const target = assertTestTarget(input, approved);
  return { ...target, databaseUrl: input.databaseUrl, publishableKey: required("TEST_PUBLISHABLE_KEY"), adminKey: required("TEST_AUTH_ADMIN_KEY") };
}

export async function database(requireMarker = true) {
  const target = hostedConfig();
  const client = new Client(testDatabaseConfig(target.databaseUrl,approved));
  await client.connect();
  if (requireMarker) {
    const { rows } = await client.query("select marker from foundation_probe.environment_identity where singleton = true");
    if (rows[0]?.marker !== target.databaseMarker) { await client.end(); throw new Error("database ownership marker mismatch; refusing test writes"); }
  }
  return client;
}

export function publicClient(accessToken?: string) {
  const target = hostedConfig();
  return createClient(target.url, target.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(accessToken ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } } : {}),
  });
}

export async function createSyntheticUser(label: string) {
  const target = hostedConfig();
  const db = await database();
  await db.end();
  const email = `foundation-${label}-${crypto.randomUUID()}@example.invalid`;
  const password = `F1!${crypto.randomUUID()}`;
  const admin = createClient(target.url, target.adminKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`Synthetic Auth user creation failed: ${error?.code ?? "no user"}`);
  const signedIn = await publicClient().auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session) throw new Error(`Synthetic Auth login failed: ${signedIn.error?.code ?? "no session"}`);
  return { id: data.user.id, email, password, session: signedIn.data.session };
}

export async function enrollSyntheticMfa(user: Awaited<ReturnType<typeof createSyntheticUser>>) {
  const client = publicClient();
  const established = await client.auth.setSession({ access_token: user.session.access_token, refresh_token: user.session.refresh_token });
  if (established.error) throw new Error(`Synthetic session failed: ${established.error.code}`);
  const permit = await client.schema("api").rpc("mitsa_prepare_enrollment");
  if (permit.error || !permit.data) throw new Error(`Synthetic enrollment permit failed: ${permit.error?.code}`);
  const enrolled = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "Synthetic test authenticator", issuer: "Mitsa" });
  if (enrolled.error || !enrolled.data.totp) throw new Error(`Synthetic MFA enroll failed: ${enrolled.error?.code}`);
  const verified = await client.auth.mfa.challengeAndVerify({ factorId: enrolled.data.id, code: totp(enrolled.data.totp.secret) });
  if (verified.error) throw new Error(`Synthetic MFA verification failed: ${verified.error.code}`);
  const bound = await client.schema("api").rpc("mitsa_bind_factor", { p_factor: enrolled.data.id, p_permit: permit.data });
  if (bound.error) throw new Error(`Synthetic MFA binding failed: ${bound.error.code}`);
  const current = await client.auth.getSession();
  if (!current.data.session) throw new Error("Synthetic AAL2 session missing");
  return { ...user, session: current.data.session, factorId: enrolled.data.id, totpSecret: enrolled.data.totp.secret };
}

export async function syntheticTermsVersion() {
  const db = await database();
  let version: string;
  try {
    const content = "Mitsa synthetic test agreement. For isolated automated testing only. This is not published legal policy and does not authorize real business data or external delivery.";
    await db.query("insert into private.legal_versions(kind,version,content,content_hash,status) values('terms','isolated-synthetic-v1',$1,encode(sha256(convert_to($1,'UTF8')),'hex'),'test') on conflict(kind,version) do nothing", [content]);
    await db.query("update private.release_gates set test_terms_id=coalesce(test_terms_id,(select id from private.legal_versions where kind='terms' and version='isolated-synthetic-v1')) where singleton");
    version = (await db.query("select test_terms_id from private.release_gates where singleton")).rows[0].test_terms_id;
  } finally { await db.end(); }
  return version;
}

export async function acceptSyntheticTerms(user: Awaited<ReturnType<typeof createSyntheticUser>>) {
  const version = await syntheticTermsVersion();
  const accepted = await publicClient(user.session.access_token).schema("api").rpc("mitsa_accept_terms", { p_version: version });
  if (accepted.error) throw new Error(`Synthetic Terms acceptance failed: ${accepted.error.code}`);
}

export async function asUser(client: Client, accessToken: string) {
  const payload = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString("utf8"));
  await client.query("begin");
  await client.query("set local role authenticated");
  await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(payload)]);
}
