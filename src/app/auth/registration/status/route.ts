import {NextRequest,NextResponse} from 'next/server';
import {authFlowOptions,openAuthFlow,sealAuthFlow,signupAttemptCookie,signupCodeCookie} from '@/lib/security/auth-flow';
import {registrationCommand,persistentRegistrationReadiness,usesPersistentRegistration} from '@/lib/auth/registration-service';
import {submissionResult} from '@/lib/auth/persistent-registration';
export async function GET(request:NextRequest) {
 const answer=(body:unknown)=>NextResponse.json(body,{headers:{'cache-control':'private, no-store'}});
 if(!usesPersistentRegistration())return answer({availability:'closed'});
 const key=process.env.AUTH_FLOW_KEY??'',flow=openAuthFlow(request.cookies.get(signupAttemptCookie)?.value,key);
 if(flow?.purpose!=='signup-attempt')return answer({availability:(await persistentRegistrationReadiness()).admission});
 const parsed=submissionResult.safeParse(await registrationCommand('submission-status',{email:flow.email,submissionId:flow.submissionId}));
 if(!parsed.success)return answer({state:'unavailable'});
 const state=parsed.data.state;
 if(state==='verified')return answer({state:'sign-in',redirect:'/login'});
 if(state==='pending-verification') {
  const now=Date.now(),response=answer({state:'verify-email',redirect:'/verify-email'});
  response.cookies.set(signupCodeCookie,sealAuthFlow({purpose:'signup-code',email:flow.email,submissionId:flow.submissionId,intentId:parsed.data.intentId,
   issuedAt:now,resendAt:now+60000,expiresAt:Math.min(flow.expiresAt,Date.parse(parsed.data.expiresAt))},key),{...authFlowOptions(),maxAge:86400});return response;
 }
 return answer({state:state==='expired'?'expired':'checking',...(state==='expired'?{restartAllowed:parsed.data.restartAllowed===true}:{})});
}
