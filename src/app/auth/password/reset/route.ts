import { NextRequest, NextResponse } from "next/server";
import {z} from "zod";
import { routeClient, runtimeConfig } from "@/lib/supabase/server";
import { resetPasswordSchema } from "@/lib/auth/forms";
import { authFlowCookie, authFlowOptions, openAuthFlow } from "@/lib/security/auth-flow";
import { enrollmentCookieName } from "@/lib/security/enrollment-cookie";
export async function POST(request:NextRequest) {
  const {client,finish} = routeClient(request), env = runtimeConfig();
  const destination = (path:string) => finish(NextResponse.redirect(new URL(path,env.origin),303));
  const flow = openAuthFlow(request.cookies.get(authFlowCookie)?.value,process.env.AUTH_FLOW_KEY ?? "");
  const input = resetPasswordSchema.safeParse(Object.fromEntries(await request.formData()));
  const user = await client.auth.getUser(), claims = await client.auth.getClaims();
  if (!input.success || flow?.purpose !== "recovery" || flow.userId !== user.data.user?.id || flow.sessionId !== claims.data?.claims.session_id) return destination("/reset-password?error=invalid");
  const [provider,security]=await Promise.all([client.auth.mfa.listFactors(),client.schema("api").rpc("mitsa_security_status")]);
  const state=z.object({initialized:z.boolean(),ready:z.boolean()}).safeParse(security.data);
  if(provider.error||security.error||!state.success||((state.data.initialized||provider.data.totp.some(f=>f.status==="verified"))&&!state.data.ready))return destination("/reset-password?error=authenticator");
  const updated = await client.auth.updateUser({password:input.data.password});
  if (updated.error) return destination("/reset-password?error=unavailable");
  const signedOut = await client.auth.signOut({scope:"global"});
  if (signedOut.error) return destination("/reset-password?error=unavailable");
  const response = destination("/login?updated=password");
  for (const name of [authFlowCookie,enrollmentCookieName]) response.cookies.set(name,"",{...authFlowOptions(),maxAge:0});
  return response;
}
