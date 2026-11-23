import {createHash} from 'node:crypto';
export const recipientHash=value=>createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
export function controlledSenderAliasAllowed(sender,recipient) {
 if(typeof sender!=='string'||typeof recipient!=='string'||!sender.endsWith('@gmail.com')||!recipient.endsWith('@gmail.com'))return false;
 const base=sender.split('@')[0].split('+')[0],prefix=`${base}+onboarding-`;
 return recipient.startsWith(prefix)&&/^[a-f0-9]{12}$/.test(recipient.slice(prefix.length,-'@gmail.com'.length));
}
export function developmentMailCapacity(counts,phase) {
 return Number.isInteger(counts.hourly)&&Number.isInteger(counts.daily)&&Number.isInteger(counts.run)&&
  counts.hourly>=0&&counts.daily>=0&&counts.run>=0&&counts.hourly<10&&counts.daily<20&&counts.run<(phase==='controlled'?4:20);
}
/** @param {Record<string, unknown> | null} [decision] */
export function requireRegistrationEvidence(turnstile,security,phase,onboarding,decision=null) {
 // A provider-generic rejection must NEVER silently become an expiry-specific
 // pass. A changed operator evidence criterion requires a separate, explicit
 // human decision; no such file is created by this helper or the service.
 const qualifiedRejection=decision?.version===1&&decision.project==='mjtejwafxriwntweussc'&&decision.approvedByUser===true&&
  decision.scope==='isolated-development-only'&&decision.acceptedEvidence==='held-unusable-proof-rejection-and-server-freshness-regressions'&&
  turnstile?.heldUnusableProofRejected===true&&turnstile.expiryTestProviderCode==='invalid-input-response'&&
  security?.signupEndpointLifecycleTestsPassed===true&&security.originalProofRetentionRegressionsPassed===true;
 if(turnstile?.project!=='mjtejwafxriwntweussc'||turnstile.serverVerificationPassed!==true||turnstile.replayRejected!==true||(turnstile.expirationRejected!==true&&!qualifiedRejection)||
  security?.project!=='mjtejwafxriwntweussc'||security.localSecurityTestsPassed!==true||security.preservationPassed!==true||security.directApiBypassRejected!==true)
  throw Error('Registration readiness evidence incomplete');
 if(phase==='general'&&(onboarding?.project!=='mjtejwafxriwntweussc'||onboarding.newUnallowlistedAccount!==true||
  ['captcha','realInboxReceipt','emailVerification','resend','mfa','workspaceOwner','initialLocation','signOut','returningSignIn','workspacePersistence','tenantIsolation','recovery'].some(key=>onboarding[key]!==true)))
  throw Error('Controlled onboarding evidence incomplete');
 if(phase==='general'&&['sessionSpecificLogoutPassed','rotatedRefreshReplayProtected','authenticatedTenantIsolationPassed'].some(key=>security?.[key]!==true))
  throw Error('Authentication security sign-off incomplete');
 return {expiryQualification:turnstile.expirationRejected===true?'provider-specific-expiry':'explicitly-approved-rejection-and-server-freshness-evidence'};
}
