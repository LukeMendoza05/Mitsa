import { NextRequest, NextResponse } from "next/server";
import { routeClient, runtimeConfig } from "@/lib/supabase/server";
import { signupSchema } from "@/lib/auth/forms";
import { createRegistrationIntent, registrationContext } from "@/lib/auth/registration";
import {providerRegistrationFailure,signupFieldErrors,type RegistrationErrorCode,type SignupErrors} from "@/lib/auth/feedback";
import {isLocalTestingEmail} from "@/lib/auth/developer-access";
import {authFlowOptions,sealAuthFlow,signupCodeCookie} from "@/lib/security/auth-flow";
import {resendCooldownMs} from "@/lib/auth/email-verification";
import {requiresSignupChallenge,verifySignupChallenge} from '@/lib/auth/signup-challenge';
import {developmentRecipientAllowed} from '@/lib/auth/development-registration';
import {submitPersistentSignup} from '@/lib/auth/persistent-signup';

export async function POST(request: NextRequest) {
  const { client, finish } = routeClient(request);
  const destination = (path: string) => finish(NextResponse.redirect(new URL(path, runtimeConfig().origin), 303));
  const diagnostic=crypto.randomUUID();
  const failure=(code:RegistrationErrorCode,status=400,fields?:SignupErrors,stage:'validation'|'existing-session'|'isolated-test-eligibility'|'controlled-recipient'|'signed-intent'='validation')=>{
    // Next's persisted development log can reduce object arguments to {}.
    // Serialize only this bounded diagnostic, never the submitted form.
    console.warn("Mitsa registration refused",JSON.stringify({diagnostic,code,status,stage}));
    return request.headers.get("x-mitsa-form")==="1"?finish(NextResponse.json({error:{code,...(fields?{fields}:{})}},{status})):destination(`/signup?error=${code}`);
  };
  if(request.headers.get('origin')!==runtimeConfig().origin||request.headers.get('sec-fetch-site')==='cross-site')return failure('input',403);
  // Never turn a registration submission into apparently successful access to
  // a different, already-authenticated account. Preserve that session and ask
  // the user to deliberately choose a signed-out browser instead.
  if ((await client.auth.getUser()).data.user) return failure('already_signed_in',409,undefined,'existing-session');
  const input=Object.fromEntries(await request.formData()),parsed = signupSchema.safeParse(input);
  if (!parsed.success) return failure("input",422,signupFieldErrors(input));
  const context = await registrationContext(client);
  if (!context.enabled || !context.policy) return failure(context.availability==='closed'?'registration_closed':context.availability==='paused'?'delivery_paused':"unavailable",503);
  if(parsed.data.termsVersion!==context.policy.id)return failure("agreement_updated",409);
  if(context.isTest&&!isLocalTestingEmail(parsed.data.email))return failure("testing_access",403,undefined,'isolated-test-eligibility');
  if(context.isDevelopmentOpen&&(!context.developmentRuntime||!developmentRecipientAllowed(context.developmentRuntime,parsed.data.email)))return failure('controlled_recipient',403,undefined,'controlled-recipient');
  if((context.requiresChallenge||requiresSignupChallenge(context.policy))&&!await verifySignupChallenge(parsed.data.captchaToken,runtimeConfig().origin))return failure('challenge',403);
  if(context.persistent) {
    if(!parsed.data.submissionId||!parsed.data.privacyVersion||parsed.data.privacyVersion!==context.persistent.policy?.privacyId)return failure('agreement_updated',409);
    return submitPersistentSignup(request,{submissionId:parsed.data.submissionId,email:parsed.data.email,fullName:parsed.data.fullName,
      password:parsed.data.password,termsId:parsed.data.termsVersion,privacyId:parsed.data.privacyVersion,accepted:true},{client,finish});
  }
  // Exact test/developer authorization belongs to the signed intent, provider
  // hook and mail hook. Email format is validation, never that authorization.
  const prepared = await createRegistrationIntent({ email: parsed.data.email, fullName: parsed.data.fullName, termsVersion: context.policy.id });
  if (!prepared.ok) return failure(prepared.code,prepared.code==="rate_limited"?429:prepared.code==="testing_access"?403:503,undefined,'signed-intent');
  const intent=prepared.intent;
  const now=Date.now();let verificationContext:string;
  try{verificationContext=sealAuthFlow({purpose:"signup-code",email:parsed.data.email,intentId:intent.intentId,issuedAt:now,resendAt:now+resendCooldownMs,expiresAt:now+86400000},process.env.AUTH_FLOW_KEY??"");}
  catch{return failure("unavailable",503);}
  const signup = await client.auth.signUp({ email: parsed.data.email, password: parsed.data.password,
    options: { emailRedirectTo: `${runtimeConfig().origin}/auth/email`, data: { full_name: parsed.data.fullName, registration_nonce: intent.nonce } } });
  if (signup.data.session) {
    await client.auth.signOut({ scope: "local" });
    return failure("unavailable",503);
  }
  if (signup.error&&!['user_already_exists','email_exists'].includes(signup.error.code??"")) {
    const code=providerRegistrationFailure(signup.error.code,signup.error.status);console.warn("Mitsa registration provider unavailable",{diagnostic,code:signup.error.code??"unknown",status:signup.error.status});return failure(code,code==="rate_limited"?429:code==="password"?422:503);
  }
  // No role or workspace is assigned. Email confirmation must happen first.
  const response=destination("/verify-email?sent=1");
  response.cookies.set(signupCodeCookie,verificationContext,{...authFlowOptions(),maxAge:86400});
  return response;
}
