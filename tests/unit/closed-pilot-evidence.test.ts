import {it,expect} from 'vitest';
import {assertClosedPilotEvidence,assertClosedOnboardingEvidence,assertClosedRehearsalEvidence} from '../../scripts/lib/closed-pilot-evidence.mjs';
const sender='a'.repeat(64),start=new Date('2026-10-14T15:00:00Z'),end=new Date(start.getTime()+30*60000);
const report={project:'mjtejwafxriwntweussc',scope:'dedicated-sender-self-test',windowClosed:true,windowStartedAt:start.toISOString(),windowExpiresAt:end.toISOString(),attempts:1,publicRegistrationEnabled:false,supabaseSmtpSettingsChanged:false,personalAccountModified:false};
const closed={enabled:false,smtp_enabled:false,open:false,approved_at:start,expires_at:end,provider_otp_expiry_seconds:3600,approved_sender_sha256:sender};
it('accepts retained evidence only for a closed, exactly matching approved window',()=>{expect(()=>assertClosedPilotEvidence(closed,report,sender)).not.toThrow();});
it('completion evidence preserves the prior attempt and cannot claim extra sends',()=>{
 const completion={...report,scope:'dedicated-sender-self-test-finish',resumedExistingSyntheticAccount:true,priorAttempts:1,maximumNewAttempts:1,attempts:2};
 expect(()=>assertClosedPilotEvidence(closed,completion,sender)).not.toThrow();
 for(const change of [{priorAttempts:0},{maximumNewAttempts:2},{attempts:3}])expect(()=>assertClosedPilotEvidence(closed,{...completion,...change},sender)).toThrow();
});
it('recognizes only an explicitly labeled existing-synthetic resume',()=>{expect(()=>assertClosedPilotEvidence(closed,{...report,scope:'dedicated-sender-self-test-resume'},sender)).toThrow();expect(()=>assertClosedPilotEvidence(closed,{...report,scope:'dedicated-sender-self-test-resume',resumedExistingSyntheticAccount:true},sender)).not.toThrow();});
it('rejects open flags, changed timestamps, recipient binding, widened scopes and attempts',()=>{
 for(const change of [{enabled:true},{smtp_enabled:true},{open:true},{expires_at:new Date(end.getTime()+1)},{approved_sender_sha256:'b'.repeat(64)},{provider_otp_expiry_seconds:60}])expect(()=>assertClosedPilotEvidence({...closed,...change},report,sender)).toThrow();
 for(const change of [{project:'other'},{windowClosed:false},{attempts:4},{publicRegistrationEnabled:true},{supabaseSmtpSettingsChanged:true},{personalAccountModified:true}])expect(()=>assertClosedPilotEvidence(closed,{...report,...change},sender)).toThrow();
});
it('still requires a pristine unused row when no approved execution evidence exists',()=>{
 expect(()=>assertClosedPilotEvidence(closed,null,null)).toThrow();expect(()=>assertClosedPilotEvidence({...closed,approved_at:null,expires_at:null,provider_otp_expiry_seconds:null,approved_sender_sha256:null},null,null)).not.toThrow();
});
it('reconciles the original two self-test claims and a distinct later approved continuation',()=>{
 const laterStart=new Date(end.getTime()+60000),deadline=new Date(laterStart.getTime()+30*60000),closedAt=new Date(laterStart.getTime()+10*60000),recipient='b'.repeat(64);
 const self={...report,scope:'dedicated-sender-self-test-finish',priorAttempts:1,maximumNewAttempts:1,attempts:2,priorWindowStartedAt:start.toISOString(),priorWindowExpiresAt:end.toISOString()};
 const onboarding={project:report.project,deliveryWindowClosed:true,workerExitAfterExplicitLeaseRevocation:true,generalRegistrationActivated:false,smtpClaimsThisContinuation:1,smtpAcceptedThisContinuation:1};
 const approval={project:report.project,approvedByUser:true,scope:'existing-pending-onboarding-only',usedAt:laterStart.toISOString(),windowMinutes:30,maxAuthenticationEmailAttempts:4,newRegistrationAllowed:false,oldCaptureMayBeAutomaticallyReplayed:false,windowApprovedAt:laterStart.toISOString(),windowExpiresAt:deadline.toISOString()};
 const runtime={project:report.project,phase:'controlled',registrationAllowed:false,approvedAt:laterStart.toISOString(),expiresAt:deadline.toISOString(),recipientHash:recipient};
 const current={...closed,approved_at:laterStart,expires_at:closedAt},rows=[{recipient_hash:sender,state:'smtp-accepted',action:'signup',created_at:start},{recipient_hash:sender,state:'smtp-accepted',action:'signup',created_at:end},{recipient_hash:recipient,state:'smtp-accepted',action:'signup',created_at:laterStart}];
 const check=(w=current,o=onboarding,a=approval,r=runtime,d=rows)=>assertClosedOnboardingEvidence(w,self,o,a,r,sender,d,deadline.getTime());
 expect(()=>check()).not.toThrow();
 for(const bad of [{...current,smtp_enabled:true},{...current,approved_at:start},{...current,expires_at:new Date(deadline.getTime()+1)}])expect(()=>check(bad)).toThrow();
 expect(()=>check(current,{...onboarding,smtpClaimsThisContinuation:2})).toThrow();
 expect(()=>check(current,onboarding,{...approval,approvedByUser:false})).toThrow();
 expect(()=>check(current,onboarding,approval,{...runtime,recipientHash:sender})).toThrow();
 expect(()=>check(current,onboarding,approval,runtime,[...rows,{...rows[2],recipient_hash:'c'.repeat(64)}])).toThrow();
 const nextStart=new Date(deadline.getTime()+60000),nextEnd=new Date(nextStart.getTime()+30*60000),nextHash='c'.repeat(64);
 const nextApproval={version:1,project:report.project,scope:'unallowlisted-synthetic-registration-only',approvedByUser:true,unresolvedRefreshReuseAcceptedForSyntheticRehearsalOnly:true,generalRegistrationAllowed:false,existingAccountChangesAllowed:false,providerOrHookChangesAllowed:false,windowMinutes:30,maxAuthenticationEmailAttempts:2,recipientHash:nextHash,usedAt:nextStart.toISOString(),windowApprovedAt:nextStart.toISOString(),windowExpiresAt:nextEnd.toISOString()};
 const nextRuntime={project:report.project,phase:'controlled',approvedAt:nextStart.toISOString(),expiresAt:nextEnd.toISOString(),recipientHash:nextHash},nextWindow={...current,approved_at:nextStart,expires_at:nextEnd},prior={project:report.project,window:current,runtime};
 const nextRow={recipient_hash:nextHash,state:'smtp-accepted',action:'signup',created_at:nextStart},all=[...rows,nextRow,nextRow];
 const future=(a=nextApproval,r=nextRuntime,d=all)=>assertClosedRehearsalEvidence(nextWindow,a,r,prior,self,onboarding,approval,sender,d,nextEnd.getTime());
 expect(()=>future()).not.toThrow();expect(()=>future(nextApproval,nextRuntime,[...all,nextRow])).toThrow();
 expect(()=>future(nextApproval,nextRuntime,[...rows,{...nextRow,action:'recovery'}])).toThrow();
 expect(()=>future(nextApproval,{...nextRuntime,recipientHash:recipient})).toThrow();expect(()=>future({...nextApproval,generalRegistrationAllowed:true})).toThrow();
 const late={...nextWindow,expires_at:new Date(nextEnd.getTime()+1000)};
 expect(()=>assertClosedRehearsalEvidence(late,nextApproval,nextRuntime,prior,self,onboarding,approval,sender,all,nextEnd.getTime()+2000)).not.toThrow();
 expect(()=>assertClosedRehearsalEvidence(late,nextApproval,nextRuntime,prior,self,onboarding,approval,sender,[...rows,{...nextRow,created_at:new Date(nextEnd.getTime()+1)}],nextEnd.getTime()+2000)).toThrow();
});
