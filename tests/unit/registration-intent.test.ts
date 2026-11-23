import { describe, expect, it, vi } from "vitest";
import { createHash, createHmac } from "node:crypto";
import { registrationIntentHandler, type IntentInput } from "../../supabase/functions/_shared/registration-intent";
import { hash, signIntentRequest, verifyIntentRequest } from "../../supabase/functions/_shared/registration-intent-auth";
import { registrationConfigured } from "../../supabase/functions/_shared/registration-intent-config";

const origin = "http://127.0.0.1:3000";
const secret = "42".repeat(32); // Synthetic fixture, never a configured credential.
const input = { email: "foundation-signup@example.invalid", fullName: "Synthetic Person", termsVersion: crypto.randomUUID(), accepted: true };
async function request(body: unknown = input, options: { unsigned?: boolean; secret?: string; timestamp?: number; nonce?: string; altered?: unknown; origin?: string; key?: string } = {}) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  const signed = options.unsigned ? {} : await signIntentRequest(options.secret ?? secret, text, options.timestamp, options.nonce);
  return new Request("https://isolated.example/functions/v1/mitsa-registration-intent", { method: "POST", headers: { origin: options.origin ?? origin, apikey: options.key ?? "synthetic-publishable", "content-type": "application/json", ...signed }, body: options.altered ? JSON.stringify(options.altered) : text });
}
function setup(signingKey = secret) {
  const createIntent = vi.fn<(value: IntentInput) => Promise<string | null>>(async () => crypto.randomUUID());
  const handler = registrationIntentHandler({ signingKey, origins: [origin], authorizeApiKey: key => key === "synthetic-publishable", createIntent });
  return { handler, createIntent };
}

describe("private registration Edge boundary", () => {
  it("rejects every missing required environment value and any other project", () => {
    const config = { SUPABASE_URL: "https://mjtejwafxriwntweussc.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "synthetic-service-key", MITSA_PUBLISHABLE_KEY: "synthetic-public-key", MITSA_APP_ORIGIN: origin, MITSA_REGISTRATION_INTENT_KEY: secret };
    expect(registrationConfigured(config)).toBe(true);
    for (const key of Object.keys(config)) expect(registrationConfigured({ ...config, [key]: "" })).toBe(false);
    expect(registrationConfigured({ ...config, SUPABASE_URL: "https://another-project.supabase.co" })).toBe(false);
    for (const value of ["invalid", "http://example.com", `${origin}/path`, `${origin}/`, "https://user:password@example.com"]) expect(registrationConfigured({ ...config, MITSA_APP_ORIGIN: value })).toBe(false);
  });
  it("matches an independent HMAC implementation and binds body, audience, time and nonce", async () => {
    const body = JSON.stringify(input), timestamp = Math.floor(Date.now() / 1000), nonce = "aa".repeat(32);
    const signed = await signIntentRequest(secret, body, timestamp, nonce);
    const canonical = `mitsa-registration-intent:v1:mjtejwafxriwntweussc\nPOST\n${timestamp}\n${nonce}\n${createHash("sha256").update(body).digest("hex")}`;
    expect(signed["x-mitsa-signature"]).toBe(createHmac("sha256", Buffer.from(secret, "hex")).update(canonical).digest("hex"));
    expect(await verifyIntentRequest(secret, new Headers(signed), new TextEncoder().encode(body))).toEqual({ requestHash: await hash(nonce), signedAt: new Date(timestamp * 1000).toISOString() });
  });
  it("verifies exact clock-window boundaries with a fixed clock", async () => {
    const timestamp=1791938000,body=JSON.stringify(input);
    const headers=new Headers(await signIntentRequest(secret,body,timestamp));
    const bytes=new TextEncoder().encode(body);
    expect(await verifyIntentRequest(secret,headers,bytes,timestamp*1000+60000)).not.toBeNull();
    expect(await verifyIntentRequest(secret,headers,bytes,timestamp*1000-60000)).not.toBeNull();
    expect(await verifyIntentRequest(secret,headers,bytes,timestamp*1000+60001)).toBeNull();
    expect(await verifyIntentRequest(secret,headers,bytes,timestamp*1000-60001)).toBeNull();
  });
  it("stores only nonce hashes and sends no password or role", async () => {
    const { handler, createIntent } = setup();
    const req = await request(); const response = await handler(req); const body = await response.json();
    expect(response.status).toBe(201); expect(body.nonce).toMatch(/^[0-9a-f]{64}$/);
    expect(createIntent.mock.calls[0][0]).toEqual({ email: input.email, name: input.fullName, terms: input.termsVersion, nonceHash: await hash(body.nonce), accepted: true, requestHash: await hash(req.headers.get("x-mitsa-nonce")!), signedAt: new Date(Number(req.headers.get("x-mitsa-time")) * 1000).toISOString() });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });
  it.each([
    ["direct request with correct public key and Origin", { unsigned: true }],
    ["forged signature", { secret: "13".repeat(32) }],
    ["modified accepted Terms", { altered: { ...input, accepted: false } }],
    ["modified recipient", { altered: { ...input, email: "attacker@example.invalid" } }],
    ["expired request", { timestamp: Math.floor(Date.now() / 1000) - 61 }],
    ["future request", { timestamp: Math.floor(Date.now() / 1000) + 300 }],
  ] as const)("denies %s before privileged work", async (_label, options) => {
    const { handler, createIntent } = setup();
    expect((await handler(await request(input, options))).status).toBe(401);
    expect(createIntent).not.toHaveBeenCalled();
  });
  it.each([
    [{ ...input, accepted: false }, 422],
    [{ ...input, role: "owner" }, 422],
    [{ ...input, password: "do not accept credentials" }, 422],
    [{ ...input, termsVersion: "invalid" }, 422],
    [{ ...input, fullName: " " }, 422],
    [{ ...input, email: "invalid" }, 422],
    [{ ...input, fullName: "x".repeat(5000) }, 413],
    ["{invalid-json", 422],
  ])("rejects invalid signed input %#", async (body, status) => {
    const { handler, createIntent } = setup();
    expect((await handler(await request(body))).status).toBe(status);
    expect(createIntent).not.toHaveBeenCalled();
  });
  it("rejects invalid routing hints even with a valid signature", async () => {
    const { handler, createIntent } = setup();
    expect((await handler(await request(input, { origin: "https://attacker.example" }))).status).toBe(403);
    expect((await handler(await request(input, { key: "wrong" }))).status).toBe(401);
    expect((await handler(new Request("https://isolated.example", { method: "OPTIONS" }))).status).toBe(405);
    expect(createIntent).not.toHaveBeenCalled();
  });
  it.each(["", "short", "0".repeat(63), "g".repeat(64)])("fails closed for missing or malformed configuration %#", async signingKey => {
    const { handler, createIntent } = setup(signingKey);
    expect((await handler(await request())).status).toBe(503);
    expect(createIntent).not.toHaveBeenCalled();
  });
  it("fails closed if database gates, replay checks or rate limits refuse the request", async () => {
    const { handler, createIntent } = setup();
    createIntent.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("replay/rate/gate"));
    expect((await handler(await request())).status).toBe(403);
    expect((await handler(await request())).status).toBe(403);
  });
  it("fails closed if Origin configuration is missing", async () => {
    const createIntent = vi.fn(async () => crypto.randomUUID());
    const handler = registrationIntentHandler({ signingKey: secret, origins: [], authorizeApiKey: () => true, createIntent });
    expect((await handler(await request())).status).toBe(503);
    expect(createIntent).not.toHaveBeenCalled();
  });
});
