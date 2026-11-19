import { validSigningKey } from "./registration-intent-auth.ts";

export function registrationConfigured(env: Record<string, string | undefined>): boolean {
  if (env.SUPABASE_URL !== "https://geuttbanjqdapcubjrnn.supabase.co"
    || !env.SUPABASE_SERVICE_ROLE_KEY?.trim() || !env.MITSA_PUBLISHABLE_KEY?.trim()
    || !validSigningKey(env.MITSA_REGISTRATION_INTENT_KEY ?? "")) return false;
  try {
    const origin = new URL(env.MITSA_APP_ORIGIN ?? "");
    return origin.origin === env.MITSA_APP_ORIGIN && (origin.protocol === "https:"
      || origin.protocol === "http:" && origin.hostname === "127.0.0.1" && ["3000", "3001"].includes(origin.port));
  } catch { return false; }
}
