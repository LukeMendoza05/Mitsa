import {NextRequest,NextResponse} from 'next/server';
import {runtimeConfig} from '@/lib/supabase/server';
import {challengeDiagnosticAllowed} from '@/lib/auth/challenge-diagnostic';
import {signupChallengeConfig,checkSignupChallenge,inspectSignupChallenge} from '@/lib/auth/signup-challenge';
// Human-verification diagnostic only. Never issues an intent, account or role.
export async function POST(request:NextRequest) {
 if(process.env.NODE_ENV!=='development')return new NextResponse(null,{status:404});
 const {origin}=runtimeConfig();
 if(!challengeDiagnosticAllowed(process.env,origin))return new NextResponse(null,{status:404});
 if(request.headers.get('origin')!==origin)return NextResponse.json({verified:false},{status:403});
 const config=signupChallengeConfig();
 if(!config)return NextResponse.json({verified:false},{status:503});
 const length=Number(request.headers.get('content-length'));
 if(Number.isFinite(length)&&length>8192)return NextResponse.json({verified:false},{status:413});
 try{
  const form=await request.formData(),token=form.get('captchaToken');
  const mode=form.get('check')??'verification';
  if([...form.keys()].some(key=>!['captchaToken','check'].includes(key))||form.getAll('captchaToken').length!==1||form.getAll('check').length>1||!['verification','expiry'].includes(String(mode)))return NextResponse.json({verified:false},{status:400});
  const headers={'Cache-Control':'private, no-store'};
  if(mode==='expiry'){
   const result=await inspectSignupChallenge(token,origin,config);
   const expiredRejected=result.kind==='expired-or-duplicate';
   // Only predefined classifications are exposed. No token, key, raw response,
   // user identity or request body is logged or stored.
   console.info('Mitsa expiry diagnostic',{result:result.reason});
   return NextResponse.json({verified:false,expiredRejected,reason:result.reason},{status:expiredRejected?200:result.kind==='unavailable'?503:403,headers});
  }
  const result=await checkSignupChallenge(token,origin,config);
  if(result.kind!=='verified')return NextResponse.json({verified:false},{status:result.kind==='unavailable'?503:403,headers});
  // The same proof must now receive the explicit provider duplicate result;
  // network errors and outages cannot masquerade as replay protection.
  const replay=await checkSignupChallenge(token,origin,config),replayRejected=replay.kind==='expired-or-duplicate';
  return NextResponse.json({verified:replayRejected,replayRejected},{status:replayRejected?200:503,headers});
 }catch{return NextResponse.json({verified:false},{status:400});}
}
