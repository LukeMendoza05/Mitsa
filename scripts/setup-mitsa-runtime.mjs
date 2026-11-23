import { existsSync, readFileSync, appendFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { parse } from "dotenv";

// Local application encryption only. Not a Supabase administrative credential.
const path = ".env.local";
if (!existsSync(path)) throw new Error("Configure the existing isolated application environment first");
const env = parse(readFileSync(path));
if (!env.MFA_ENROLLMENT_KEY) {
  appendFileSync(path, `\n# Encrypts five-minute HttpOnly MFA enrollment context; never expose publicly.\nMFA_ENROLLMENT_KEY=${randomBytes(32).toString("base64url")}\n`);
  console.log("Local MFA enrollment encryption configured; value not printed.");
} else {
  if (Buffer.from(env.MFA_ENROLLMENT_KEY, "base64url").length !== 32) throw new Error("Invalid MFA enrollment key");
  console.log("Existing MFA enrollment encryption preserved.");
}
if (!env.AUTH_FLOW_KEY) {
  appendFileSync(path, `\n# Encrypts short-lived authentication link context; separate from MFA keys.\nAUTH_FLOW_KEY=${randomBytes(32).toString("base64url")}\n`);
  console.log("Local authentication-flow encryption configured; value not printed.");
} else if (Buffer.from(env.AUTH_FLOW_KEY,"base64url").length !== 32 || env.AUTH_FLOW_KEY === env.MFA_ENROLLMENT_KEY) {
  throw new Error("Authentication-flow key must be a separate 32-byte key");
}
