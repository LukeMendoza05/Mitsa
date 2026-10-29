import {NextRequest,NextResponse} from "next/server";
import {runtimeConfig} from "@/lib/supabase/server";
import {authFlowOptions,invitationCookie,sealAuthFlow} from "@/lib/security/auth-flow";
export async function GET(request:NextRequest) {
  const token=request.nextUrl.searchParams.get("token"),response=NextResponse.redirect(new URL("/invitations/accept",runtimeConfig().origin),303);
  response.headers.set("Referrer-Policy","no-referrer");
  response.cookies.set(invitationCookie,"",{...authFlowOptions(),maxAge:0});
  if(token&&/^[a-f0-9]{64}$/.test(token)) {
    try {response.cookies.set(invitationCookie,sealAuthFlow({purpose:"invitation",token,expiresAt:Date.now()+3600000},process.env.AUTH_FLOW_KEY??""),{...authFlowOptions(),sameSite:"lax",maxAge:3600});}
    catch {/* Missing encryption configuration never exposes a raw token. */}
  }
  return response;
}
