import {NextRequest,NextResponse} from 'next/server';
import {openAuthFlow,signupCodeCookie} from '@/lib/security/auth-flow';
import {registrationCommand,safeMailStatus,usesPersistentRegistration} from '@/lib/auth/registration-service';
export async function GET(request:NextRequest) {
 const flow=openAuthFlow(request.cookies.get(signupCodeCookie)?.value,process.env.AUTH_FLOW_KEY??'');
 const unavailable=()=>NextResponse.json({state:'unavailable'},{headers:{'cache-control':'private, no-store'}});
 if(!usesPersistentRegistration()||flow?.purpose!=='signup-code'||!flow.mailRequestId)return unavailable();
 const result=safeMailStatus.safeParse(await registrationCommand('mail-status',{email:flow.email,requestId:flow.mailRequestId}));
 return result.success?NextResponse.json(result.data,{headers:{'cache-control':'private, no-store'}}):unavailable();
}
