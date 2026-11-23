import 'server-only';
import {z} from 'zod';
type ChallengeConfig={siteKey:string;secret:string};
export function signupChallengeConfig(env:Record<string,string|undefined>=process.env):ChallengeConfig|null {
 const siteKey=env.MITSA_TURNSTILE_SITE_KEY??'',secret=env.MITSA_TURNSTILE_SECRET_KEY??'';
 // Published always-pass/fail test keys must never authorize public signup.
 if(env.MITSA_PUBLIC_CAPTCHA_PROVIDER!=='turnstile'||siteKey===secret||siteKey.length<20||siteKey.length>256||secret.length<20||secret.length>512||
  [siteKey,secret].some(v=>/\s/.test(v)||/^[123]x0{15,}/.test(v)))return null;
 return {siteKey,secret};
}
export function requiresSignupChallenge(policy:{status?:string;publicRegistration?:boolean}|null|undefined) {
 return policy?.status==='published'&&policy.publicRegistration===true;
}
type ChallengeResult={kind:'verified'|'rejected'|'expired-or-duplicate'|'unavailable'};
type ChallengeInspection=ChallengeResult&{reason:'verified'|'local-input'|'provider-http'|'provider-network'|'provider-response'|'provider-invalid-token'|'provider-secret'|'provider-internal'|'provider-other'|'provider-expired-or-duplicate'|'hostname'|'action'|'timestamp'|'server-expired'};
// Only bounded classifications leave this function. Tokens, keys and raw
// provider responses are never returned or logged, including diagnostics.
export async function inspectSignupChallenge(token:unknown,origin:string,config=signupChallengeConfig(),now=Date.now(),expectedAction:'signup'|'recovery'='signup'):Promise<ChallengeInspection> {
 if(!config||typeof token!=='string'||!token||token.length>2048)return {kind:'rejected',reason:'local-input'};
 try{
  const hostname=new URL(origin).hostname;
  const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
   method:'POST',body:new URLSearchParams({secret:config.secret,response:token}),cache:'no-store',signal:AbortSignal.timeout(8000)
  });
  if(!response.ok)return {kind:'unavailable',reason:'provider-http'};
  let body:unknown;try{body=await response.json();}catch{return {kind:'unavailable',reason:'provider-response'};}
  const failure=z.object({success:z.literal(false),'error-codes':z.array(z.string()).optional()}).safeParse(body);
  if(failure.success){
   const codes=failure.data['error-codes']??[];
   if(codes.includes('timeout-or-duplicate'))return {kind:'expired-or-duplicate',reason:'provider-expired-or-duplicate'};
   if(codes.some(code=>['missing-input-secret','invalid-input-secret'].includes(code)))return {kind:'unavailable',reason:'provider-secret'};
   if(codes.includes('internal-error'))return {kind:'unavailable',reason:'provider-internal'};
   return {kind:'rejected',reason:codes.includes('invalid-input-response')?'provider-invalid-token':'provider-other'};
  }
  const parsed=z.object({success:z.literal(true),hostname:z.string(),action:z.string(),challenge_ts:z.string()}).safeParse(body);
  if(!parsed.success)return {kind:'rejected',reason:'provider-response'};
  if(parsed.data.hostname!==hostname)return {kind:'rejected',reason:'hostname'};
  if(parsed.data.action!==expectedAction)return {kind:'rejected',reason:'action'};
  const issuedAt=Date.parse(parsed.data.challenge_ts);
  if(!Number.isFinite(issuedAt)||issuedAt>now+5000)return {kind:'rejected',reason:'timestamp'};
  if(now-issuedAt>=300000)return {kind:'rejected',reason:'server-expired'};
  return {kind:'verified',reason:'verified'};
 }catch{return {kind:'unavailable',reason:'provider-network'};} // No private values or raw error logging.
}
export async function checkSignupChallenge(token:unknown,origin:string,config=signupChallengeConfig(),now=Date.now()):Promise<ChallengeResult> {
 return {kind:(await inspectSignupChallenge(token,origin,config,now)).kind};
}
export async function verifySignupChallenge(token:unknown,origin:string,config=signupChallengeConfig(),now=Date.now()) {
 return (await checkSignupChallenge(token,origin,config,now)).kind==='verified';
}
export async function verifyRecoveryChallenge(token:unknown,origin:string,config=signupChallengeConfig(),now=Date.now()) {
 return (await inspectSignupChallenge(token,origin,config,now,'recovery')).kind==='verified';
}
