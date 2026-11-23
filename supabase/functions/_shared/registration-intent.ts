import { z } from "zod";
import { hash, randomNonce, validSigningKey, verifyIntentRequest } from "./registration-intent-auth.ts";

export type IntentInput = { email: string; name: string; terms: string; nonceHash: string; accepted: true; requestHash: string; signedAt: string };
export type IntentFailure={code:"testing_access"|"rate_limited"|"request_expired"|"input"|"unavailable"};
type Dependencies = { signingKey: string; origins: readonly string[]; authorizeApiKey(key: string): boolean; createIntent(input: IntentInput): Promise<string | null | IntentFailure> };
const inputSchema = z.object({ email: z.email().max(254).transform(value => value.trim().toLowerCase()), fullName: z.string().trim().min(1).max(120), termsVersion: z.uuid(), accepted: z.literal(true) }).strict();

export function registrationIntentHandler(deps: Dependencies) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get("origin") ?? "";
    const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
    const response = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
    if (!validSigningKey(deps.signingKey) || !deps.origins.length) return response(503, { error: "Registration unavailable" });
    if (request.method !== "POST") return response(405, { error: "Method not allowed" });
    // Routing / CSRF hints only. Private-server authentication is mandatory.
    if (!deps.origins.includes(origin)) return response(403, { error: "Registration unavailable" });
    if (!deps.authorizeApiKey(request.headers.get("apikey") ?? "")) return response(401, { error: "Registration unavailable" });
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) return response(415, { error: "Invalid registration input" });
    const reader = request.body?.getReader();
    if (!reader) return response(422, { error: "Invalid registration input" });
    let bytes: Uint8Array;
    try {
      const chunks: Uint8Array[] = []; let length = 0;
      while (true) {
        const next = await reader.read(); if (next.done) break;
        length += next.value.byteLength;
        if (length > 4096) { await reader.cancel(); return response(413, { error: "Invalid registration input" }); }
        chunks.push(next.value);
      }
      bytes = new Uint8Array(length); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    } catch { return response(422, { error: "Invalid registration input" }); }
    finally { reader.releaseLock(); }
    const authorization = await verifyIntentRequest(deps.signingKey, request.headers, bytes);
    if (!authorization) return response(401, { error: "Registration unavailable" });
    let parsed: ReturnType<typeof inputSchema.safeParse>;
    try { parsed = inputSchema.safeParse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))); }
    catch { return response(422, { error: "Invalid registration input" }); }
    if (!parsed.success) return response(422, { error: "Invalid registration input" });
    try {
      const nonce = randomNonce();
      // SQL consumes the request nonce and creates the intent atomically.
      const intentId = await deps.createIntent({ email: parsed.data.email, name: parsed.data.fullName, terms: parsed.data.termsVersion, nonceHash: await hash(nonce), accepted: true, ...authorization });
      if (!intentId) return response(403, { error: "Registration unavailable" });
      if(typeof intentId!=="string")return response(403,{error:"Registration unavailable",code:intentId.code});
      // A short-lived email-bound credential, never an administrative token.
      return response(201, { intentId, nonce, termsVersion: parsed.data.termsVersion });
    } catch { return response(403, { error: "Registration unavailable" }); }
  };
}
