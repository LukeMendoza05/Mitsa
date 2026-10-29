import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {routeClient,runtimeConfig} from "@/lib/supabase/server";
import {authFlowCookie,authFlowOptions,openAuthFlow,sealAuthFlow} from "@/lib/security/auth-flow";
export async function POST(request:NextRequest) {
  const {client,finish}=routeClient(request),key=process.env.AUTH_FLOW_KEY??"";
  const destination=(path:string)=>finish(NextResponse.redirect(new URL(path,runtimeConfig().origin),303));
  const flow=openAuthFlow(request.cookies.get(authFlowCookie)?.value,key),form=await request.formData();
  const input=z.object({factorId:z.uuid(),code:z.string().regex(/^[0-9]{6}$/)}).safeParse({factorId:form.get("factorId"),code:form.get("code")});
  const [user,claims]=await Promise.all([client.auth.getUser(),client.auth.getClaims()]);
  if(!input.success||flow?.purpose!=="recovery"||flow.userId!==user.data.user?.id||flow.sessionId!==claims.data?.claims.session_id)return destination("/reset-password?error=invalid");
  const [provider,security]=await Promise.all([client.auth.mfa.listFactors(),client.schema("api").rpc("mitsa_security_status")]);
  const bindings=z.array(z.object({id:z.uuid(),active:z.boolean()})).safeParse(security.data?.factors);
  if(provider.error||security.error||!bindings.success||!provider.data.totp.some(f=>f.id===input.data.factorId&&f.status==="verified"&&bindings.data.some(b=>b.id===f.id&&b.active)))return destination("/reset-password?error=authenticator");
  const verified=await client.auth.mfa.challengeAndVerify({factorId:input.data.factorId,code:input.data.code});
  const identity=await client.schema("api").rpc("mitsa_identity");
  if(verified.error||identity.error||identity.data?.mfaReady!==true)return destination("/reset-password?error=authenticator");
  const renewed=await client.auth.getClaims(),sessionId=renewed.data?.claims.session_id;
  if(renewed.error||typeof sessionId!=="string"||Date.now()>=flow.expiresAt)return destination("/reset-password?error=expired");
  const response=destination("/reset-password");response.cookies.set(authFlowCookie,sealAuthFlow({...flow,sessionId},key),{...authFlowOptions(),maxAge:Math.ceil((flow.expiresAt-Date.now())/1000)});return response;
}
