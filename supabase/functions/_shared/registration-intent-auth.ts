// Authenticates the Next server, not an end user. Never expose this credential
// through NEXT_PUBLIC_, a browser bundle, a response, or a log.
const audience = "mitsa-registration-intent:v1:unconfiguredpreviewx";
const hex = (bytes: Uint8Array) => Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
export const randomNonce = () => hex(crypto.getRandomValues(new Uint8Array(32)));
export const validSigningKey = (value: string) => /^[0-9a-f]{64}$/.test(value);
export async function hash(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
}
async function key(secret: string) {
  if (!validSigningKey(secret)) throw new Error("Registration signing unavailable");
  const bytes = Uint8Array.from(secret.match(/../g)!, pair => parseInt(pair, 16));
  return crypto.subtle.importKey("raw", bytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
async function message(body: Uint8Array, timestamp: string, nonce: string) {
  // Logical audience stays stable across Supabase gateway URL rewriting.
  return new TextEncoder().encode(`${audience}\nPOST\n${timestamp}\n${nonce}\n${await hash(body)}`);
}
export async function signIntentRequest(secret: string, body: string, timestamp = Math.floor(Date.now() / 1000), nonce = randomNonce()) {
  const time = String(timestamp);
  if (!/^\d{10}$/.test(time) || !/^[0-9a-f]{64}$/.test(nonce)) throw new Error("Invalid signing context");
  const signature = await crypto.subtle.sign("HMAC", await key(secret), await message(new TextEncoder().encode(body), time, nonce));
  return { "x-mitsa-time": time, "x-mitsa-nonce": nonce, "x-mitsa-signature": hex(new Uint8Array(signature)) };
}
export async function verifyIntentRequest(secret: string, headers: Headers, body: Uint8Array, now = Date.now()) {
  const timestamp = headers.get("x-mitsa-time") ?? "";
  const nonce = headers.get("x-mitsa-nonce") ?? "";
  const signature = headers.get("x-mitsa-signature") ?? "";
  if (!validSigningKey(secret) || !/^\d{10}$/.test(timestamp) || !/^[0-9a-f]{64}$/.test(nonce) || !/^[0-9a-f]{64}$/.test(signature)
    || Math.abs(now / 1000 - Number(timestamp)) > 60) return null;
  const bytes = Uint8Array.from(signature.match(/../g)!, pair => parseInt(pair, 16));
  // WebCrypto verifies the MAC; never compare signature strings.
  if (!await crypto.subtle.verify("HMAC", await key(secret), bytes, await message(body, timestamp, nonce))) return null;
  return { requestHash: await hash(nonce), signedAt: new Date(Number(timestamp) * 1000).toISOString() };
}
