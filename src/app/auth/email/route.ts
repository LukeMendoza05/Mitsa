import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { routeClient, runtimeConfig } from "@/lib/supabase/server";
import { authFlowCookie, invitationCookie, authFlowOptions, openAuthFlow, sealAuthFlow,signupCodeCookie,signupAttemptCookie } from "@/lib/security/auth-flow";

// Link scanners may GET this route. Only an explicit, same-origin POST consumes
// the provider's one-time token. No token is put into the clean destination URL.
export async function GET(request: NextRequest) {
  const input = z.object({ type: z.enum(["signup", "recovery"]), tokenHash: z.string().regex(/^(pkce_)?[a-f0-9]{32,256}$/) }).safeParse({ type: request.nextUrl.searchParams.get("type"), tokenHash: request.nextUrl.searchParams.get("token_hash") });
  const response = NextResponse.redirect(new URL(input.success && input.data.type === "recovery" ? "/reset-password" : "/verify-email", runtimeConfig().origin),303);
  response.headers.set("Referrer-Policy","no-referrer");
  response.cookies.set(authFlowCookie,"",{ ...authFlowOptions(), maxAge:0 });
  if (input.success) {
    try { response.cookies.set(authFlowCookie,sealAuthFlow({ purpose:"email", ...input.data, expiresAt:Date.now()+600000 },process.env.AUTH_FLOW_KEY ?? ""),{...authFlowOptions(),sameSite:"lax"}); }
    catch { return NextResponse.redirect(new URL("/verify-email?error=unavailable",runtimeConfig().origin),303); }
  }
  return response;
}

export async function POST(request: NextRequest) {
  const { client, finish } = routeClient(request), key = process.env.AUTH_FLOW_KEY ?? "";
  const flow = openAuthFlow(request.cookies.get(authFlowCookie)?.value,key);
  if(flow?.purpose==="email"&&flow.type==="signup"&&(await client.auth.getUser()).data.user)return finish(NextResponse.redirect(new URL("/workspaces",runtimeConfig().origin),303));
  const destination = (path:string) => finish(NextResponse.redirect(new URL(path,runtimeConfig().origin),303));
  if (!flow || flow.purpose !== "email") return destination("/verify-email?error=expired");
  const result = await client.auth.verifyOtp({ token_hash:flow.tokenHash, type:flow.type });
  if (result.error || !result.data.user || !result.data.session) return destination(`${flow.type === "recovery" ? "/reset-password" : "/verify-email"}?error=expired`);
  if (flow.type === "recovery") {
    const claims = await client.auth.getClaims();
    const sessionId = claims.data?.claims.session_id;
    if (claims.error || typeof sessionId !== "string") return destination("/reset-password?error=unavailable");
    const response = destination("/reset-password");
    response.cookies.set(authFlowCookie,sealAuthFlow({ purpose:"recovery",userId:result.data.user.id,sessionId,expiresAt:Date.now()+600000 },key),authFlowOptions());
    return response;
  }
  const finalized = await client.schema("api").rpc("mitsa_finalize_registration");
  if (finalized.error || finalized.data !== true) { await client.auth.signOut({scope:"local"}); return destination("/verify-email?error=unavailable"); }
  const invitation = openAuthFlow(request.cookies.get(invitationCookie)?.value,key);
  const response = destination(invitation?.purpose === "invitation" ? "/invitations/accept" : "/onboarding");
  response.cookies.set(authFlowCookie,"",{...authFlowOptions(),maxAge:0});
  response.cookies.set(signupCodeCookie,"",{...authFlowOptions(),maxAge:0});
  response.cookies.set(signupAttemptCookie,'',{...authFlowOptions(),maxAge:0});
  return response;
}
