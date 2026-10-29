import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {routeClient,runtimeConfig} from '@/lib/supabase/server';
import {authFlowOptions,openAuthFlow,sealAuthFlow,signupCodeCookie} from '@/lib/security/auth-flow';
import {registrationCommand,usesPersistentRegistration} from '@/lib/auth/registration-service';
import {submissionResult} from '@/lib/auth/persistent-registration';
import {verifySignupChallenge} from '@/lib/auth/signup-challenge';
export async function POST(request:NextRequest) {
 const {finish}=routeClient(request),env=runtimeConfig(),key=process.env.AUTH_FLOW_KEY??'';
 const failure=()=>finish(NextResponse.redirect(new URL('/verify-email/renew?error=unavailable',env.origin),303));
 if(request.headers.get('origin')!==env.origin||request.headers.get('sec-fetch-site')==='cross-site')return finish(NextResponse.json({error:'Request origin rejected'},{status:403}));
 if(!usesPersistentRegistration())return failure();
 const flow=openAuthFlow(request.cookies.get(signupCodeCookie)?.value,key);
 if(flow?.purpose!=='signup-code'||!flow.intentId||flow.passwordProvenAt===undefined||Date.now()-flow.passwordProvenAt>=600000)return failure();
 const form=await request.formData(),input=z.object({termsVersion:z.uuid(),privacyVersion:z.uuid(),accepted:z.literal('on'),captchaToken:z.string().min(1).max(2048)}).strict().safeParse(Object.fromEntries(form));
 if(!input.success||!await verifySignupChallenge(input.data.captchaToken,env.origin))return failure();
 const result=submissionResult.safeParse(await registrationCommand('renew-verification',{email:flow.email,intentId:flow.intentId,termsId:input.data.termsVersion,privacyId:input.data.privacyVersion,accepted:true,passwordProven:true}));
 if(!result.success||result.data.state==='expired')return failure();
 const response=finish(NextResponse.redirect(new URL('/verify-email',env.origin),303));
 response.cookies.set(signupCodeCookie,sealAuthFlow({...flow,expiresAt:Math.min(flow.issuedAt+86400000,Date.parse(result.data.expiresAt))},key),{...authFlowOptions(),maxAge:86400});return response;
}
