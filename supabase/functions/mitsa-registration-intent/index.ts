import { createClient } from "@supabase/supabase-js";
import { registrationIntentHandler } from "../_shared/registration-intent.ts";
import { registrationConfigured } from "../_shared/registration-intent-config.ts";

// Administrative credentials exist only in the isolated Edge runtime.
const url = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const publishableKey = Deno.env.get("MITSA_PUBLISHABLE_KEY") ?? "";
const origin = Deno.env.get("MITSA_APP_ORIGIN") ?? "";
const signingKey = Deno.env.get("MITSA_REGISTRATION_INTENT_KEY") ?? "";
const configured = registrationConfigured({ SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: serviceKey, MITSA_PUBLISHABLE_KEY: publishableKey, MITSA_APP_ORIGIN: origin, MITSA_REGISTRATION_INTENT_KEY: signingKey });
const service = configured ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
const handler = registrationIntentHandler({
  signingKey,
  origins: configured ? [origin] : [],
  authorizeApiKey: key => Boolean(publishableKey) && key === publishableKey,
  async createIntent(input) {
    if (!service) return null;
    const result = await service.schema("api").rpc("mitsa_signed_registration_intent", { p_email: input.email, p_name: input.name, p_terms: input.terms, p_nonce_hash: input.nonceHash, p_accepted: input.accepted, p_request_hash: input.requestHash, p_signed_at: input.signedAt });
    if(!result.error&&typeof result.data==="string")return result.data;
    // Optional bounded diagnostic code; existing failure status/message and all
    // signature/replay controls remain compatible. No account-existence result,
    // SQL detail, user input or provider error text is returned.
    const code=result.error?.code;
    return {code:code==="54000"?"rate_limited" as const:code==="23505"?"request_expired" as const:code==="42501"?"testing_access" as const:code==="22023"?"input" as const:"unavailable" as const};
  },
});
Deno.serve((request: Request) => configured ? handler(request) : new Response(JSON.stringify({ error: "Registration unavailable" }), { status: 503, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }));
