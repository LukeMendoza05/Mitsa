// Pure evidence analysis. Never authenticates, refreshes or changes a session.
export const strictSurfaces=Object.freeze(['app-resource','direct-rpc','direct-rls','auth-refresh','auth-user-update','factor-list','factor-enroll','factor-challenge','factor-verify','factor-unenroll']);
export function assessStrictSessionTrace(trace){
 const missing=[];
 const require=(condition,key)=>{if(!condition)missing.push(key);};
 require(trace?.format==='mitsa-strict-session-trace-v1','trace-format');
 require(trace?.environment==='HOSTED_SYNTHETIC','hosted-synthetic-evidence');
 require(trace?.policy==='Strict Option A','strict-policy');
 require(trace?.prohibitedAncestorOutsideExceptions===true,'prohibited-nonparent-outside-grace');
 require(trace?.terminalReuseRejected===true,'terminal-reuse-rejected');
 require(trace?.terminalSessionInvalidated===true,'terminal-session-invalidated');
 require(trace?.formerlyCurrentRefreshDeniedImmediately===true,'no-immediate-replacement');
 require(trace?.allRetainedRefreshTokensDenied===true,'all-retained-refresh-denied');
 require(trace?.formerJwtOtherwiseUnexpired===true,'otherwise-valid-bearer');
 require(trace?.independentSessionStillWorks===true,'independent-session-preserved');
 require(trace?.legitimateParentRetryWorks===true,'parent-retry-compatibility');
 require(trace?.concurrentRefreshWorks===true,'concurrent-refresh-compatibility');
 require(trace?.mfaRecoveryCompatible===true,'mfa-recovery-compatibility');
 require(trace?.retainedAccountsPreserved===true,'retained-account-preservation');
 const rows=Array.isArray(trace?.observations)?trace.observations:[];
 require(rows.length===strictSurfaces.length,'exact-surface-count');
 for(const surface of strictSurfaces){
  const hits=rows.filter(r=>r?.surface===surface),o=hits[0];
  require(hits.length===1,`${surface}:unique-observation`);
  require(o?.identityCorrelated===true&&o?.sameAffectedSession===true,`${surface}:exact-session`);
  require(o?.startedAfterTerminalResponse===true&&o?.beforeAnyExpiryOrCutoff===true,`${surface}:immediate-window`);
  // An arbitrary 400/404 or factor-level validation failure is NOT revocation.
  require(o?.outcome==='SESSION_REVOKED'&&o?.authorizationDecision==='DENY'&&o?.noSideEffect===true,`${surface}:revocation-not-generic-error`);
 }
 const complete=missing.length===0;
 return {status:complete?'READY_FOR_HUMAN_SECURITY_REVIEW':'INCOMPLETE_OR_FAILED',policy:'Strict Option A',missing,
  // This analyzer cannot authenticate provenance; it must never mint C-B's
  // strict-proven authorization or claim the provider is fixed from booleans.
  securityApprovalGranted:false,hostedRequests:0};
}
