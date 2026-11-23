import assert from "node:assert/strict";
import { existsSync, readFileSync, appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { randomBytes, createHash } from "node:crypto";
import { parse } from "dotenv";

// Only run after explicit isolated deployment/configuration approval.
// This file contains no Supabase administrative credential.
const target = JSON.parse(readFileSync("config/test-target.json", "utf8"));
const env = parse(readFileSync(".env.local"));
assert.equal(target.projectRef, "mjtejwafxriwntweussc", "unapproved target");
assert.equal(target.purpose, "isolated-development-test");
assert.equal(target.approvedByUser, true);
assert.equal(env.SUPABASE_URL, "https://mjtejwafxriwntweussc.supabase.co");
assert(env.SUPABASE_PUBLISHABLE_KEY?.startsWith("sb_publishable_"));
assert(["http://127.0.0.1:3000", "http://127.0.0.1:3001"].includes(env.APP_ORIGIN), "unexpected application origin");
const path = ".secrets/registration-intent.env";
const existing = existsSync(path) ? parse(readFileSync(path)) : {};
const signingKey = env.MITSA_REGISTRATION_INTENT_KEY ?? existing.MITSA_REGISTRATION_INTENT_KEY ?? randomBytes(32).toString("hex");
assert(/^[0-9a-f]{64}$/.test(signingKey), "invalid signing configuration");
assert(!existing.MITSA_REGISTRATION_INTENT_KEY || existing.MITSA_REGISTRATION_INTENT_KEY === signingKey, "signing configuration mismatch; never silently rotate");
if (!env.MITSA_REGISTRATION_INTENT_KEY) appendFileSync(".env.local", `\n# Private isolated server-to-Edge authentication; never NEXT_PUBLIC_.\nMITSA_REGISTRATION_INTENT_KEY=${signingKey}\n`);
const contents = `MITSA_REGISTRATION_INTENT_KEY=${signingKey}\nMITSA_PUBLISHABLE_KEY=${env.SUPABASE_PUBLISHABLE_KEY}\nMITSA_APP_ORIGIN=${env.APP_ORIGIN}\n`;
mkdirSync(".secrets", { recursive: true });
writeFileSync(path, contents, { mode: 0o600 });
console.log(JSON.stringify({ project: target.projectRef, origin: env.APP_ORIGIN, signingKeyGenerated: !env.MITSA_REGISTRATION_INTENT_KEY && !existing.MITSA_REGISTRATION_INTENT_KEY, privateFile: path, transferDigest: createHash("sha256").update(contents).digest("hex") }));
