import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";

const schema = z.object({ userId: z.uuid(), sessionId: z.uuid(), factorId: z.uuid(), permitId: z.uuid(), secret: z.string().regex(/^[A-Z2-7]+=*$/), uri: z.string().max(1000).startsWith("otpauth://totp/"), expiresAt: z.number().int() });
export type EnrollmentContext = z.infer<typeof schema>;
const purpose = Buffer.from("Mitsa MFA enrollment v1");
function keyBytes(key: string) {
  const bytes = Buffer.from(key, "base64url");
  if (bytes.length !== 32 || bytes.toString("base64url") !== key) throw new Error("MFA enrollment encryption is not configured");
  return bytes;
}
export function sealEnrollment(context: EnrollmentContext, key: string): string {
  const value = schema.parse(context);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(key), iv);
  cipher.setAAD(purpose);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}
export function openEnrollment(value: string | undefined, key: string, userId: string, sessionId: string, now = Date.now()): EnrollmentContext | null {
  if (!value || value.length > 3500) return null;
  try {
    const bytes = Buffer.from(value, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", keyBytes(key), bytes.subarray(0, 12));
    decipher.setAAD(purpose); decipher.setAuthTag(bytes.subarray(12, 28));
    const decoded = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8"));
    const context = schema.parse(decoded);
    if (context.userId !== userId || context.sessionId !== sessionId || context.expiresAt <= now || context.expiresAt > now + 300000) return null;
    return context;
  } catch { return null; }
}
export const enrollmentCookieName = "mitsa-mfa-enrollment";
