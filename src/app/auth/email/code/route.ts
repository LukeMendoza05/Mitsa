import {NextRequest,NextResponse} from "next/server";
import {routeClient,runtimeConfig} from "@/lib/supabase/server";
import {authFlowCookie,authFlowOptions,invitationCookie,openAuthFlow,sealAuthFlow,signupCodeCookie,signupAttemptCookie} from "@/lib/security/auth-flow";
import {emailActionLimit,resendCooldownMs,verificationCode,verificationFailure} from "@/lib/auth/email-verification";
import {registrationContext} from "@/lib/auth/registration";
import {readDevelopmentDeliveryState,developmentRecipientAllowed} from '@/lib/auth/development-registration';
import {registrationCommand,usesPersistentRegistration} from '@/lib/auth/registration-service';
import {mailRequestResult,correlatedEmailRedirect} from '@/lib/auth/persistent-registration';
import {z} from 'zod';

export async function POST(request:NextRequest) {
 const {client,finish}=routeClient(request),env=runtimeConfig(),key=process.env.AUTH_FLOW_KEY??"";
 const destination=(path:string)=>finish(NextResponse.redirect(new URL(path,env.origin),303));
 const failure=(code:string)=>destination(`/verify-email?error=${code}`);
 // Defense in depth for direct route use; proxy applies the same origin policy.
 if(request.headers.get("origin")!==env.origin||request.headers.get("sec-fetch-site")==="cross-site")return finish(NextResponse.json({error:"Request origin rejected"},{status:403}));
 if((await client.auth.getUser()).data.user)return destination("/workspaces");
 const flow=openAuthFlow(request.cookies.get(signupCodeCookie)?.value,key);
 if(flow?.purpose!=="signup-code")return failure("expired");
 // The encrypted context is issued only after the signed registration intent
 // and native password signup. Never accept a browser-supplied recipient/type.
 const form=await request.formData(),action=form.get("action");
 if(action==="resend") {
  if(usesPersistentRegistration()) {
   if(!flow.intentId)return failure('expired');
   const readiness=await registrationContext(client);
   if(!readiness.emailDeliveryEnabled)return failure(readiness.persistent?.delivery==='closed'?'delivery_closed':'delivery_paused');
   const requestKey=z.uuid().safeParse(form.get('requestKey'));if(!requestKey.success)return failure('input');
   if(Date.now()<flow.resendAt||!emailActionLimit(flow.email,'resend'))return failure('cooldown');
   const authorized=await registrationCommand('authorize-mail',{email:flow.email,intentId:flow.intentId,action:'signup',requestKey:requestKey.data});
   if(z.object({error:z.literal('rate_limited')}).safeParse(authorized).success)return failure('rate_limited');
   if(z.object({error:z.literal('verification-expired')}).safeParse(authorized).success)return failure('registration_expired');
   const allowed=mailRequestResult.safeParse(authorized);
   if(!allowed.success)return failure('delivery_paused');
   const next={...flow,mailRequestId:allowed.data.requestId,resendAt:Math.min(flow.expiresAt,Date.now()+resendCooldownMs)};
   let failed=false;
   if(allowed.data.sendAllowed){try{const result=await client.auth.resend({type:'signup',email:flow.email,options:{emailRedirectTo:correlatedEmailRedirect(env.origin,allowed.data.requestId)}});failed=Boolean(result.error);}catch{failed=true;}}
   const response=failed?failure('delivery'):destination('/verify-email?resent=1');
   response.cookies.set(signupCodeCookie,sealAuthFlow(next,key),{...authFlowOptions(),maxAge:Math.max(0,Math.floor((next.expiresAt-Date.now())/1000))});return response;
  }
  const context=await registrationContext(client);
  if(!(context.emailDeliveryEnabled??context.enabled)||!context.policy){
   const state=await readDevelopmentDeliveryState(flow.email);
   return failure(state==='closed'?'testing_closed':state==='paused'?'delivery_paused':'unavailable');
  }
  if(context.isDevelopmentOpen&&(!context.developmentRuntime||!developmentRecipientAllowed(context.developmentRuntime,flow.email)))return failure('delivery_paused');
  if(Date.now()<flow.resendAt)return failure("cooldown");
  if(!emailActionLimit(flow.email,"resend"))return failure("cooldown");
  const next={...flow,resendAt:Math.min(flow.expiresAt,Date.now()+resendCooldownMs)};
  const result=await client.auth.resend({type:"signup",email:flow.email,options:{emailRedirectTo:`${env.origin}/auth/email`}});
  const response=result.error?failure(verificationFailure(result.error.code,result.error.status)==="rate_limited"?"rate_limited":"delivery"):destination("/verify-email?resent=1");
  response.cookies.set(signupCodeCookie,sealAuthFlow(next,key),{...authFlowOptions(),maxAge:Math.max(0,Math.floor((next.expiresAt-Date.now())/1000))});return response;
 }
 if(action!=="verify")return failure("input");
 // Closing NEW registrations or exhausting mail capacity must not strand a
 // delivered code. The sealed recipient context, provider verification and
 // original signed-intent finalization remain mandatory below.
 const code=verificationCode.safeParse(form.get("code"));if(!code.success)return failure("input");
 if(!emailActionLimit(flow.email,"verify"))return failure("rate_limited");
 const result=await client.auth.verifyOtp({type:"signup",email:flow.email,token:code.data});
 if(result.error||!result.data.user||!result.data.session)return failure(verificationFailure(result.error?.code,result.error?.status));
 if(result.data.user.email?.toLowerCase()!==flow.email){await client.auth.signOut({scope:"local"});return failure("registration");}
 const finalized=await client.schema("api").rpc("mitsa_finalize_registration");
 if(finalized.error||finalized.data!==true){await client.auth.signOut({scope:"local"});return failure("registration");}
 const invitation=openAuthFlow(request.cookies.get(invitationCookie)?.value,key);
 const response=destination(invitation?.purpose==="invitation"?"/invitations/accept":"/settings/account/security?updated=email-verified");
 response.cookies.set(signupCodeCookie,"",{...authFlowOptions(),maxAge:0});
 response.cookies.set(signupAttemptCookie,'',{...authFlowOptions(),maxAge:0});
 response.cookies.set(authFlowCookie,"",{...authFlowOptions(),maxAge:0});return response;
}
