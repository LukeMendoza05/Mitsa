import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";
import {authenticationCookieSecure} from '../auth/deployment-profile';

const schema = z.discriminatedUnion("purpose", [
  z.object({ purpose: z.literal("email"), type: z.enum(["signup", "recovery"]), tokenHash: z.string().regex(/^(pkce_)?[a-f0-9]{32,256}$/), expiresAt: z.number().int() }).strict(),
  z.object({ purpose: z.literal("recovery"), userId: z.uuid(), sessionId: z.uuid(), expiresAt: z.number().int() }).strict(),
  z.object({ purpose: z.literal("invitation"), token: z.string().regex(/^[a-f0-9]{64}$/), expiresAt: z.number().int() }).strict(),
  z.object({ purpose: z.literal("signup-code"), email: z.email().max(254), intentId: z.uuid().optional(), submissionId:z.uuid().optional(),mailRequestId:z.uuid().optional(),passwordProvenAt:z.number().int().optional(), issuedAt: z.number().int(), resendAt: z.number().int(), expiresAt: z.number().int() }).strict(),
  z.object({ purpose:z.literal('signup-attempt'),email:z.email().max(254),submissionId:z.uuid(),issuedAt:z.number().int(),expiresAt:z.number().int() }).strict(),
]);
export type AuthFlow = z.infer<typeof schema>;
const aad = Buffer.from("Mitsa authentication flow v1");
function keyBytes(value: string) {
  const bytes = Buffer.from(value, "base64url");
  if (bytes.length !== 32 || bytes.toString("base64url") !== value) throw new Error("Authentication flow encryption unavailable");
  return bytes;
}
export function sealAuthFlow(value: AuthFlow, key: string) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", keyBytes(key), iv);
  cipher.setAAD(aad);
  const content = Buffer.concat([cipher.update(JSON.stringify(schema.parse(value))), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), content]).toString("base64url");
}
export function openAuthFlow(value: string | undefined, key: string, now = Date.now()): AuthFlow | null {
  if (!value || value.length > 1500) return null;
  try {
    const bytes = Buffer.from(value, "base64url"), decipher = createDecipheriv("aes-256-gcm", keyBytes(key), bytes.subarray(0,12));
    decipher.setAAD(aad); decipher.setAuthTag(bytes.subarray(12,28));
    const result = schema.parse(JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString("utf8")));
    if((result.purpose === "signup-code"||result.purpose==='signup-attempt') && (result.issuedAt>now+5000 || result.expiresAt-result.issuedAt>86400000))return null;
    if(result.purpose==='signup-code'&&(result.resendAt>result.expiresAt||result.resendAt<result.issuedAt))return null;
    if(result.purpose==='signup-code'&&result.passwordProvenAt!==undefined&&(result.passwordProvenAt>now+5000||result.passwordProvenAt<result.issuedAt))return null;
    return result.expiresAt > now && result.expiresAt <= now + (result.purpose === "signup-code"||result.purpose==='signup-attempt' ? 86400000 : result.purpose === "invitation" ? 3600000 : 600000) ? result : null;
  } catch { return null; }
}
export const authFlowCookie = "mitsa-auth-flow";
export const invitationCookie = "mitsa-invitation-context";
export const signupCodeCookie = "mitsa-signup-verification";
export const signupAttemptCookie='mitsa-signup-attempt';
export const authFlowOptions = () => ({ path: "/", httpOnly: true, secure: authenticationCookieSecure(), sameSite: "strict" as const, maxAge: 600 });
