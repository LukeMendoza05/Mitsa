export function parseRuntimeConfig(env: Record<string, string | undefined>, expectedRef: string): { url: string; key: string; origin: string } {
  for (const key of ["TEST_AUTH_ADMIN_KEY", "TEST_DATABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY", "DATABASE_URL"]) {
    if (env[key]) throw new Error("administrative credentials are forbidden in the ordinary runtime");
  }
  if (env.SUPABASE_URL !== `https://${expectedRef}.supabase.co`) throw new Error("runtime must use the approved project");
  if (!env.SUPABASE_PUBLISHABLE_KEY?.startsWith("sb_publishable_")) throw new Error("publishable Supabase key required");
  const origin = new URL(env.APP_ORIGIN ?? "");
  if (origin.href !== `${origin.origin}/` || origin.username || origin.password) throw new Error("APP_ORIGIN must be an origin without path or credentials");
  if (origin.protocol !== "https:" && !(origin.protocol === "http:" && ["localhost", "127.0.0.1"].includes(origin.hostname))) throw new Error("HTTPS required outside loopback development");
  return { url: env.SUPABASE_URL, key: env.SUPABASE_PUBLISHABLE_KEY, origin: origin.origin };
}
