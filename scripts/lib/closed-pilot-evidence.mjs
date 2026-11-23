import assert from 'node:assert/strict';
import {verifyRegistrationRehearsalScope} from './registration-rehearsal.mjs';
// Read-only audit of retained approval timestamps; never authorizes sending.
export function assertClosedPilotEvidence(window, report, senderHash) {
 assert(window&&window.enabled===false&&window.smtp_enabled===false&&window.open===false);
 if(!report){assert(window.approved_at===null&&window.expires_at===null&&window.provider_otp_expiry_seconds===null&&window.approved_sender_sha256===null);return;}
 assert.equal(report.project,'mjtejwafxriwntweussc');assert(report.scope==='dedicated-sender-self-test'||['dedicated-sender-self-test-resume','dedicated-sender-self-test-finish'].includes(report.scope)&&report.resumedExistingSyntheticAccount===true);assert.equal(report.windowClosed,true);
 if(report.scope==='dedicated-sender-self-test-finish'){assert.equal(report.priorAttempts,1);assert.equal(report.maximumNewAttempts,1);assert(Number.isInteger(report.attempts)&&report.attempts>=1&&report.attempts<=2);}
 const start=Date.parse(report.windowStartedAt),end=Date.parse(report.windowExpiresAt);
 assert(Number.isFinite(start)&&Number.isFinite(end)&&end>start&&end-start<=30*60000);
 assert.equal(new Date(window.approved_at).getTime(),start);assert.equal(new Date(window.expires_at).getTime(),end);
 assert.equal(window.provider_otp_expiry_seconds,3600);assert.equal(window.approved_sender_sha256,senderHash);assert(/^[a-f0-9]{64}$/.test(senderHash));
 assert.equal(report.publicRegistrationEnabled,false);assert.equal(report.supabaseSmtpSettingsChanged,false);assert.equal(report.personalAccountModified,false);
 assert(Number.isInteger(report.attempts)&&report.attempts>=0&&report.attempts<=3);
}

// Later approved onboarding has its own lease and recipient. Keep the original
// self-test report immutable; reconcile both histories rather than dropping an
// authorized claim or comparing today's row with the first run's timestamps.
export function assertClosedOnboardingEvidence(window,selfTest,onboarding,approval,runtime,senderHash,deliveries,now=Date.now()) {
 assert(window?.enabled===false&&window.smtp_enabled===false&&window.open===false);
 for(const record of [selfTest,onboarding,approval,runtime])assert.equal(record?.project,'mjtejwafxriwntweussc');
 assert.equal(approval.approvedByUser,true);assert.equal(approval.scope,'existing-pending-onboarding-only');assert(approval.usedAt);
 assert.equal(approval.windowMinutes,30);assert.equal(approval.maxAuthenticationEmailAttempts,4);
 assert.equal(approval.newRegistrationAllowed,false);assert.equal(approval.oldCaptureMayBeAutomaticallyReplayed,false);
 assert.equal(runtime.phase,'controlled');assert.equal(runtime.registrationAllowed,false);
 assert.equal(runtime.approvedAt,approval.windowApprovedAt);assert.equal(runtime.expiresAt,approval.windowExpiresAt);
 const start=Date.parse(runtime.approvedAt),deadline=Date.parse(runtime.expiresAt),closed=new Date(window.expires_at).getTime();
 assert(Number.isFinite(start)&&deadline>start&&deadline-start<=30*60000);
 assert.equal(new Date(window.approved_at).getTime(),start);assert(closed>=start&&closed<=deadline&&closed<=now);
 assert.equal(window.provider_otp_expiry_seconds,3600);assert.equal(window.approved_sender_sha256,senderHash);
 assert(/^[a-f0-9]{64}$/.test(senderHash)&&/^[a-f0-9]{64}$/.test(runtime.recipientHash)&&senderHash!==runtime.recipientHash);
 assert.equal(onboarding.deliveryWindowClosed,true);assert.equal(onboarding.workerExitAfterExplicitLeaseRevocation,true);assert.equal(onboarding.generalRegistrationActivated,false);
 assert(Number.isInteger(onboarding.smtpClaimsThisContinuation)&&onboarding.smtpClaimsThisContinuation>=0&&onboarding.smtpClaimsThisContinuation<=4);
 assert.equal(onboarding.smtpAcceptedThisContinuation,onboarding.smtpClaimsThisContinuation);
 assert.equal(selfTest.windowClosed,true);assert.equal(selfTest.scope,'dedicated-sender-self-test-finish');assert.equal(selfTest.priorAttempts,1);assert.equal(selfTest.maximumNewAttempts,1);assert.equal(selfTest.attempts,2);
 assert.equal(selfTest.publicRegistrationEnabled,false);assert.equal(selfTest.supabaseSmtpSettingsChanged,false);assert.equal(selfTest.personalAccountModified,false);
 assert.equal(deliveries.length,selfTest.attempts+onboarding.smtpClaimsThisContinuation);
 const selfRows=deliveries.filter(row=>row.recipient_hash===senderHash),newRows=deliveries.filter(row=>row.recipient_hash===runtime.recipientHash);
 assert.equal(selfRows.length,selfTest.attempts);assert.equal(newRows.length,onboarding.smtpClaimsThisContinuation);
 for(const row of deliveries)assert.equal(row.state,'smtp-accepted');
 for(const row of selfRows){const time=new Date(row.created_at).getTime();assert([[selfTest.priorWindowStartedAt,selfTest.priorWindowExpiresAt],[selfTest.windowStartedAt,selfTest.windowExpiresAt]].some(([a,b])=>time>=Date.parse(a)&&time<=Date.parse(b)));}
 for(const row of newRows){const time=new Date(row.created_at).getTime();assert(time>=start&&time<=closed);}
}
export function assertClosedRehearsalEvidence(window,approval,runtime,prior,selfTest,onboarding,oldApproval,senderHash,deliveries,now=Date.now()) {
 verifyRegistrationRehearsalScope(approval,runtime?.recipientHash);
 assert(approval.usedAt&&Number.isFinite(Date.parse(approval.usedAt)));
 assert.equal(runtime.project,'mjtejwafxriwntweussc');assert.equal(runtime.phase,'controlled');assert.equal(runtime.registrationAllowed,undefined);
 assert.equal(runtime.approvedAt,approval.windowApprovedAt);assert.equal(runtime.expiresAt,approval.windowExpiresAt);
 assert.equal(prior.project,runtime.project);assert.notEqual(runtime.recipientHash,prior.runtime.recipientHash);assert.notEqual(runtime.recipientHash,senderHash);
 const start=Date.parse(runtime.approvedAt),end=Date.parse(runtime.expiresAt),closed=new Date(window.expires_at).getTime();
 // A shutdown timestamp may be later than the deadline. That never widens the
 // authorized claim horizon: every new claim must precede BOTH boundaries.
 assert(Number.isFinite(start)&&end>start&&end-start<=30*60000&&closed>=start&&closed<=now);
 assert(window.enabled===false&&window.smtp_enabled===false&&window.open===false);assert.equal(new Date(window.approved_at).getTime(),start);
 assert.equal(window.approved_sender_sha256,senderHash);assert.equal(window.provider_otp_expiry_seconds,3600);
 assert(new Date(prior.window.expires_at).getTime()<=start);
 const current=deliveries.filter(row=>row.recipient_hash===runtime.recipientHash),historical=deliveries.filter(row=>row.recipient_hash!==runtime.recipientHash);
 assertClosedOnboardingEvidence(prior.window,selfTest,onboarding,oldApproval,prior.runtime,senderHash,historical,now);
 assert(current.length<=2);
 for(const row of current){assert(['claimed','smtp-accepted','unconfirmed'].includes(row.state));assert.equal(row.action,'signup');const time=new Date(row.created_at).getTime();assert(time>=start&&time<=Math.min(closed,end));}
}
