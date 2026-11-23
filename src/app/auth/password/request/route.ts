import { NextRequest, NextResponse } from "next/server";
import { routeClient, runtimeConfig } from "@/lib/supabase/server";
import { emailSchema } from "@/lib/auth/forms";
import {isLocalTestingEmail} from "@/lib/auth/developer-access";
import {developmentRegistrationRuntime,developmentRecipientAllowed} from '@/lib/auth/development-registration';
import {emailActionLimit} from '@/lib/auth/email-verification';
import {registrationCommand,usesPersistentRegistration} from '@/lib/auth/registration-service';
import {mailRequestResult,correlatedEmailRedirect} from '@/lib/auth/persistent-registration';
import {verifyRecoveryChallenge} from '@/lib/auth/signup-challenge';
import {z} from 'zod';
export async function POST(request:NextRequest) {
  const {client,finish} = routeClient(request), env = runtimeConfig();
  const form=await request.formData(),input = emailSchema.safeParse(form.get("email"));
  const destination = (query:string) => finish(NextResponse.redirect(new URL(`/forgot-password?${query}`,env.origin),303));
  if(request.headers.get('origin')!==env.origin||request.headers.get('sec-fetch-site')==='cross-site')return finish(NextResponse.json({error:'Request origin rejected'},{status:403}));
  if(usesPersistentRegistration()) {
    const requestKey=z.uuid().safeParse(form.get('requestKey'));
    if(!input.success||!requestKey.success)return destination('error=input');
    if(!await verifyRecoveryChallenge(form.get('captchaToken'),env.origin))return destination('error=challenge');
    if(!emailActionLimit(input.data,'resend'))return destination('sent=1');
    // Eligibility is private and identical public feedback is used for every
    // address. The durable permit is bound to action+identity+request, not Origin.
    const permitted=mailRequestResult.safeParse(await registrationCommand('authorize-mail',{email:input.data,action:'recovery',requestKey:requestKey.data}));
    if(permitted.success&&permitted.data.sendAllowed){
      try{await client.auth.resetPasswordForEmail(input.data,{redirectTo:correlatedEmailRedirect(env.origin,permitted.data.requestId)});}catch{/* Generic response; never retry an uncertain provider call. */}
    }
    return destination('sent=1');
  }
  if (!input.success) return destination('error=input');
  const publicMode=process.env.MITSA_REGISTRATION_MODE==='public';
  if(publicMode){
    if(!await verifyRecoveryChallenge(form.get('captchaToken'),env.origin))return destination('error=challenge');
    if(emailActionLimit(input.data,'resend')){
      try{await client.auth.resetPasswordForEmail(input.data,{redirectTo:`${env.origin}/auth/email`});}catch{/* Generic response; never retry an uncertain provider call. */}
    }
    return destination('sent=1');
  }
  if (process.env.MITSA_AUTH_MAIL_MODE !== "isolated-capture") return destination('error=unavailable');
  // Never reveal existence. The test hook independently enforces its explicit
  // recipient allowlist and captures mail; a regex is not authorization.
  const runtime=await developmentRegistrationRuntime(env.origin);
  if((isLocalTestingEmail(input.data)||(runtime&&developmentRecipientAllowed(runtime,input.data)))&&emailActionLimit(input.data,'resend'))await client.auth.resetPasswordForEmail(input.data,{redirectTo:`${env.origin}/auth/email`});
  return destination("sent=1");
}
