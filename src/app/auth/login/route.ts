import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { routeClient, runtimeConfig } from "@/lib/supabase/server";
import {emailSchema} from "@/lib/auth/forms";
import {registrationContext} from "@/lib/auth/registration";
import {isLocalTestingEmail} from "@/lib/auth/developer-access";
import {authFlowOptions,sealAuthFlow,signupCodeCookie} from "@/lib/security/auth-flow";
import {registrationCommand,usesPersistentRegistration} from '@/lib/auth/registration-service';
import {submissionResult} from '@/lib/auth/persistent-registration';

export async function POST(request: NextRequest) {
  const { client,finish } = routeClient(request);
  const form = await request.formData();
  const failure=(status:number,error:string)=>finish(request.headers.get("accept")?.includes("text/html")?NextResponse.redirect(new URL("/login?error=signin",runtimeConfig().origin),303):NextResponse.json({error},{status}));
  const parsed = z.object({ email:emailSchema, password:z.string().min(1).max(256) }).safeParse({ email:form.get("email"), password:form.get("password") });
  if (!parsed.success) return failure(422,"Invalid sign-in input");
  const { error } = await client.auth.signInWithPassword(parsed.data);
  if(error?.code==="email_not_confirmed") {
    if(usesPersistentRegistration()) {
      const found=submissionResult.safeParse(await registrationCommand('continue-verification',{email:parsed.data.email,passwordProven:true}));
      if(found.success) {
        const now=Date.now();
        try {
          const sealed=sealAuthFlow({purpose:'signup-code',email:parsed.data.email,intentId:found.data.intentId,submissionId:found.data.submissionId,
           passwordProvenAt:now,issuedAt:now,resendAt:now,expiresAt:now+86400000},process.env.AUTH_FLOW_KEY??'');
          const response=finish(NextResponse.redirect(new URL(found.data.state==='expired'?'/verify-email/renew':'/verify-email',runtimeConfig().origin),303));
          response.cookies.set(signupCodeCookie,sealed,{...authFlowOptions(),maxAge:86400});return response;
        }catch{/* No unsealed or browser-supplied continuation. */}
      }
      return failure(error.status===429?429:401,'Sign-in failed');
    }
    const context=await registrationContext(client);
    if(context.enabled&&(!context.isTest||isLocalTestingEmail(parsed.data.email))) {
      const now=Date.now();
      try {
        const sealed=sealAuthFlow({purpose:"signup-code",email:parsed.data.email,issuedAt:now,resendAt:now,expiresAt:now+86400000},process.env.AUTH_FLOW_KEY??"");
        const response=finish(NextResponse.redirect(new URL("/verify-email",runtimeConfig().origin),303));
        response.cookies.set(signupCodeCookie,sealed,{...authFlowOptions(),maxAge:86400});return response;
      }catch{/* Missing encryption configuration grants no continuation. */}
    }
  }
  if (error) return failure(error.status===429?429:401,"Sign-in failed");
  if(usesPersistentRegistration()) {
    const finalized=await client.schema('api').rpc('mitsa_finalize_registration');
    // Existing pre-cohort accounts legitimately have no registration intent.
    if(finalized.error){await client.auth.signOut({scope:'local'});return failure(503,'Sign-in failed');}
  }
  return finish(NextResponse.redirect(new URL("/proof",runtimeConfig().origin),303));
}
