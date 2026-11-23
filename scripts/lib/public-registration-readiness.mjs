// Advisory local preflight only; not imported by Auth, RLS or release controls.
import {isIP} from 'node:net';
const isolatedProject='mjtejwafxriwntweussc';
export const publicAcceptance=Object.freeze(['signup','turnstile','real-provider-otp','otp-negative-cases','mfa','workspace-owner',
 'returning-login','password-recovery','tenant-direct-api','worker-stability','emergency-shutdown']);
export function assessPublicRegistration({target,acceptance,operations,strict,approvals}){
 const blockers=[];const check=(ok,key)=>{if(!ok)blockers.push(key);};
 let origin;try{origin=new URL(target?.origin);}catch{}
 check(Boolean(origin&&origin.protocol==='https:'&&origin.origin===target.origin&&!origin.username&&!origin.password&&
  origin.hostname!=='localhost'&&!isIP(origin.hostname.replace(/^\[|\]$/g,''))&&!['.localhost','.local','.invalid','.test'].some(s=>origin.hostname.endsWith(s))),'approved-https-origin');
 check(/^[a-z]{20}$/.test(target?.projectRef??'')&&target.projectRef!==isolatedProject,'separate-public-supabase-project');
 check(target?.databaseMarker&&target?.environment==='production'&&target?.approvedByHuman===true,'approved-public-target');
 for(const name of publicAcceptance){const e=acceptance?.[name];check(e?.status==='PASSED'&&e?.execution==='HOSTED'&&
   e?.projectRef===target?.projectRef&&e?.origin===target?.origin&&e?.scope==='PUBLIC_RELEASE_CANDIDATE'&&/^[a-f0-9]{64}$/.test(e?.evidenceSha256??''),`hosted:${name}`);}
 check(strict?.status==='PASSED'&&strict?.policy==='Strict Option A'&&strict?.humanReviewed===true&&strict?.directAuthAndFactors===true&&strict?.projectRef===target?.projectRef,'proven-strict-option-a');
 for(const key of ['publishedApplicableLegal','verifiedSenderDomain','deliveryCapacity','supervisedWorker','secretRotation','alerting','rollback','passwordProtectionDecision','approvedCommercialHosting',
  'persistentAdmission','noDeveloperAllowlist','noRecurringSignupLease','pendingVerificationIndependentOfAdmission','versionedConsent'])check(operations?.[key]===true,`operational:${key}`);
 check(approvals?.publicDeployment===true,'public-deployment-approval');check(approvals?.finalActivation===true,'final-activation-approval');
 return {status:blockers.length?'NOT_READY_FOR_PUBLIC_REGISTRATION':'READY_FOR_FINAL_REVIEW',blockers,activationAuthorized:false,hostedRequests:0};
}
