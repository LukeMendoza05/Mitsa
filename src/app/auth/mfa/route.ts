import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { routeClient, runtimeConfig } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const { client, finish } = routeClient(request);
  const form = await request.formData();
  const parsed = z.object({ factorId: z.uuid(), code: z.string().regex(/^[0-9]{6}$/) }).safeParse(Object.fromEntries(form));
  const destination = (path: string) => finish(NextResponse.redirect(new URL(path, runtimeConfig().origin), 303));
  if (!parsed.success) return destination("/settings/account/security?error=invalid");
  const user = await client.auth.getUser();
  if (user.error || !user.data.user) return destination("/login");
  const verified = await client.auth.mfa.challengeAndVerify(parsed.data);
  if (verified.error) {
    console.warn("MFA challenge-verify failed", { code: verified.error.code, status: verified.error.status });
    return destination(`/settings/account/security?error=${verified.error.status === 429 ? "rate_limited" : "invalid"}`);
  }
  const identity = await client.schema("api").rpc("mitsa_identity");
  if (identity.error || !identity.data?.mfaReady) return destination("/settings/account/security?error=untrusted");
  return destination("/workspaces");
}
