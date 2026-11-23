import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { openEnrollment, sealEnrollment } from "../../src/lib/security/enrollment-cookie";

describe("encrypted enrollment context", () => {
  const key = randomBytes(32).toString("base64url");
  const now = Date.now();
  const context = { userId: crypto.randomUUID(), sessionId: crypto.randomUUID(), factorId: crypto.randomUUID(), permitId: crypto.randomUUID(), secret: "GEZDGNBVGY3TQOJQ", uri: "otpauth://totp/Mitsa:synthetic?secret=GEZDGNBVGY3TQOJQ&issuer=Mitsa", expiresAt: now + 300000 };
  it("keeps the secret out of the cookie plaintext and binds identity/session/expiry", () => {
    const value = sealEnrollment(context, key);
    expect(value.includes(context.secret)).toBe(false);
    expect(openEnrollment(value, key, context.userId, context.sessionId, now)).toEqual(context);
    expect(openEnrollment(value, key, crypto.randomUUID(), context.sessionId, now)).toBeNull();
    expect(openEnrollment(value, key, context.userId, crypto.randomUUID(), now)).toBeNull();
    expect(openEnrollment(value, key, context.userId, context.sessionId, now + 300000)).toBeNull();
  });
  it("rejects tampering, another key, malformed and oversized cookies", () => {
    const value = sealEnrollment(context, key);
    const bytes = Buffer.from(value, "base64url"); bytes[bytes.length - 1] ^= 1;
    for (const invalid of [bytes.toString("base64url"), "not-a-cookie", "x".repeat(3501)]) expect(openEnrollment(invalid, key, context.userId, context.sessionId, now)).toBeNull();
    expect(openEnrollment(value, randomBytes(32).toString("base64url"), context.userId, context.sessionId, now)).toBeNull();
  });
});
