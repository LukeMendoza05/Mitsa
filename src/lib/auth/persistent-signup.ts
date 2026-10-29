import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {routeClient,runtimeConfig} from '@/lib/supabase/server';
import {registrationCommand} from './registration-service';
import {correlatedEmailRedirect,mailRequestResult,submissionResult,type SubmissionInput} from './persistent-registration';
import {authFlowOptions,sealAuthFlow,signupAttemptCookie,signupCodeCookie} from '@/lib/security/auth-flow';
import {providerRegistrationFailure,registrationErrorCode} from './feedback';
import {resendCooldownMs} from './email-verification';

export async function submitPersistentSignup(request:NextRequest,input:SubmissionInput&{password:string},connection:ReturnType<typeof routeClient>) {
 const {client,finish}=connection,env=runtimeConfig(),key=process.env.AUTH_FLOW_KEY??'',now=Date.now();
 const {password,...submission}=input;
 const reply=(path:string)=>{
  const target=new URL(path,env.origin);
  if(target.pathname==='/signup'&&request.headers.get('x-mitsa-form')==='1'){
   const parsed=registrationErrorCode.safeParse(target.searchParams.get('error'));
   return finish(NextResponse.json({error:{code:parsed.success?parsed.data:'unavailable'}},{status:parsed.success&&parsed.data==='rate_limited'?429:503}));
  }
  return finish(NextResponse.redirect(target,303));
 };
 let attempt:string;
 try{attempt=sealAuthFlow({purpose:'signup-attempt',email:input.email,submissionId:input.submissionId,issuedAt:now,expiresAt:now+86400000},key);}catch{return reply('/signup?error=unavailable');}
 const withAttempt=(response:NextResponse)=>{response.cookies.set(signupAttemptCookie,attempt,{...authFlowOptions(),maxAge:86400});return response;};
 const prepared=await registrationCommand('prepare',submission);
 if(z.object({error:z.literal('rate_limited')}).safeParse(prepared).success)return withAttempt(reply('/signup?error=rate_limited'));
 const parsed=submissionResult.extend({nonce:z.string().regex(/^[a-f0-9]{64}$/)}).strict().safeParse(prepared);
 if(!parsed.success)return withAttempt(reply('/signup?error=unavailable'));
 const value=parsed.data;
 if(value.state==='verified')return withAttempt(reply('/login'));
 const verification=(mailRequestId?:string)=>{
  const response=reply('/verify-email');
  response.cookies.set(signupCodeCookie,sealAuthFlow({purpose:'signup-code',email:input.email,intentId:value.intentId,submissionId:input.submissionId,
   ...(mailRequestId?{mailRequestId}:{}),issuedAt:now,resendAt:now+resendCooldownMs,expiresAt:Math.min(now+86400000,Date.parse(value.expiresAt))},key),{...authFlowOptions(),maxAge:86400});
  return withAttempt(response);
 };
 if(value.state==='expired')return withAttempt(reply(`/signup?error=${value.restartAllowed?'submission_empty_expired':'request_expired'}`));
 if(value.state==='pending-verification')return verification();
 // Only the durable atomic claim may call provider signup. A timeout or retry
 // cannot create another account or automatically issue a second message.
 const permit=await registrationCommand('authorize-mail',{email:input.email,intentId:value.intentId,action:'signup',requestKey:input.submissionId});
 if(z.object({error:z.literal('rate_limited')}).safeParse(permit).success)return withAttempt(reply('/signup?error=rate_limited'));
 const authorized=mailRequestResult.safeParse(permit);
 if(!authorized.success)return withAttempt(reply('/signup?error=mail_unavailable'));
 // Signup's atomic provider claim is the single-send authority. Reusing its
 // still-reserved permit before the first claim is safe after interruption.
 const claim=await registrationCommand('claim-signup',{submissionId:input.submissionId,email:input.email});
 if(!z.object({claimed:z.literal(true)}).strict().safeParse(claim).success)return withAttempt(reply('/signup?error=submission_pending'));
 try {
  const result=await client.auth.signUp({email:input.email,password,options:{emailRedirectTo:correlatedEmailRedirect(env.origin,authorized.data.requestId),data:{full_name:input.fullName,registration_nonce:value.nonce}}});
  if(result.data.session){await client.auth.signOut({scope:'local'});return withAttempt(reply('/signup?error=unavailable'));}
  if(result.error){
   const code=providerRegistrationFailure(result.error.code,result.error.status);
   const response=withAttempt(reply(`/signup?error=${code==='password'?'password':'submission_pending'}`));
   if(code==='password')response.cookies.set(signupAttemptCookie,'',{...authFlowOptions(),maxAge:0});
   return response;
  }
  return verification(authorized.data.requestId);
 }catch{return withAttempt(reply('/signup?error=submission_pending'));}
}
