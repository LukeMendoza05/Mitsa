import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import { assertTestTarget } from "../../scripts/test-target.mjs";

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
  const url = new URL(target.databaseUrl);
  for (const key of ["sslmode", "sslrootcert", "sslcert", "sslkey"]) url.searchParams.delete(key);
  const client = new Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 15000 });
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

export async function asUser(client: Client, accessToken: string) {
  const payload = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString("utf8"));
  await client.query("begin");
  await client.query("set local role authenticated");
  await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(payload)]);
}
