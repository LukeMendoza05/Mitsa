// Fixture-only regression core. No networking, account creation or approval on
// import. Ports must be supplied by a separately reviewed/approved hosted run.
import assert from 'node:assert/strict';
export const revocationSurfaces=Object.freeze(['app-resource','direct-rpc','direct-rls','auth-user-read','auth-user-update','factor-list','factor-enroll','factor-challenge','factor-verify','factor-unenroll','stale-recovery-session']);
export const compatibilityChecks=Object.freeze(['independentSession','parentRetryOutsideGrace','concurrentRefresh','returningPasswordTotp','freshRecoveryRequiresMfa','oldRecoveryReplayDenied','retainedAccountsPreserved']);
const authSessionCodes=new Set(['session_not_found','session_expired']);
const refreshCodes=new Set([...authSessionCodes,'refresh_token_already_used','refresh_token_not_found']);
export function isSessionRevocationDenial(surface,response){
 if(!response||response.noSideEffect!==true||response.sameAffectedSession!==true)return false;
 if(surface==='direct-rls')return response.status===200&&response.rows===0&&response.positiveBaseline===true&&response.ownedRecordStillExists===true;
 if(surface==='direct-rpc'||surface==='app-resource')return [401,403].includes(response.status)&&response.code==='42501'&&response.positiveBaseline===true;
 return [401,403].includes(response.status)&&authSessionCodes.has(response.code)&&response.validFixtureInput===true;
}
/** Internal ports return private credentials only within the owned test process.
 * Public results contain no credential, identity, factor or raw response body.
 * This runner NEVER emits an automatically approved strict-security artifact.
 */
export async function runStrictRevocationRegression(d){
 for(const key of ['assertAuthority','baseline','rotate','reuse','sessionState','probe','compatibility','cleanup','persistPrivate'])assert(typeof d[key]==='function','Explicit reviewed regression port required');
 assert(['HOSTED','OFFLINE'].includes(d.evidenceMode));assert(d.reuseIntervalSeconds===10,'Existing reuse policy must remain unchanged');
 assert(d.evidenceMode==='OFFLINE'||(!d.now&&!d.sleep),'Hosted evidence cannot substitute time');
 const now=d.now??Date.now,sleep=d.sleep??(ms=>new Promise(resolve=>setTimeout(resolve,ms))),checks={},observations=[];let phase='authority',failed=false,baseline,current,terminalAt,cleanupPassed=false;
 await d.assertAuthority();
 try{
  phase='baseline';baseline=await d.baseline();assert(baseline.fixtureOnly&&baseline.signatureVerified&&baseline.aal===2&&baseline.positiveRpc&&baseline.positiveRls&&baseline.ownedRecordExists&&baseline.alternativeCutoffsExcluded,'Independent valid-session/resource baseline required');assert(/^[a-f0-9]{64}$/.test(baseline.sessionTag));assert(baseline.expiresAt>now()+60000);current=baseline;
  const retained=[baseline.refreshToken];assert(typeof retained[0]==='string'&&retained[0].length>16);
  phase='rotate-three-times';for(let i=0;i<3;i++){current=await d.rotate(current.refreshToken);assert(current.sessionTag===baseline.sessionTag&&current.signatureVerified&&current.expiresAt>now()+60000,'Rotation changed the tested session or lost bearer proof');assert(!retained.includes(current.refreshToken),'Rotation did not produce distinct credentials');retained.push(current.refreshToken);}
  const bearer=current.accessToken,expiresAt=current.expiresAt;
  phase='outside-exceptions';await sleep(12000);
  phase='terminal-reuse';const terminal=await d.reuse(retained[0]);terminalAt=now();assert(terminal.status===400&&terminal.code==='refresh_token_already_used'&&!terminal.issuedSession,'Terminal non-parent reuse not explicitly rejected');checks.ancestorRejected=true;
  // Preserve BOTH timeline points. Zero unrevoked records immediately after
  // R0 never substitutes for denial of a subsequent request using R3.
  phase='initial-terminal-state';const initial=await d.sessionState();assert(initial.sessionTag===baseline.sessionTag,'Wrong session state witness');checks.sessionTerminated=initial.sessionExists===false&&initial.liveRefresh===0;
  phase='immediate-current-refresh';const replacement=await d.reuse(retained[3]);const elapsed=now()-terminalAt;checks.immediateWindow=elapsed>=0&&elapsed<5000&&now()<expiresAt;
  checks.currentRefreshDenied=!replacement.issuedSession&&refreshCodes.has(replacement.code)&&[400,401,403].includes(replacement.status);
  const subsequent=await d.sessionState();assert(subsequent.sessionTag===baseline.sessionTag,'Wrong subsequent session witness');checks.noFamilyRestoration=subsequent.sessionExists===false&&subsequent.liveRefresh===0;
  phase='remaining-retained-refresh';checks.allRetainedRefreshDenied=true;for(const token of retained){const r=await d.reuse(token);checks.allRetainedRefreshDenied&&=!r.issuedSession&&[400,401,403].includes(r.status)&&refreshCodes.has(r.code);}
  phase='former-bearer-surfaces';for(const surface of revocationSurfaces){assert(now()<expiresAt,'JWT expired before the revocation probe');const start=now(),response=await d.probe(surface,bearer);const result={surface,startedAfterTerminal:start>=terminalAt,beforeJwtExpiry:now()<expiresAt,denial:isSessionRevocationDenial(surface,response)};observations.push(result);}
  checks.allSurfaces=observations.every(o=>o.startedAfterTerminal&&o.beforeJwtExpiry&&o.denial);
  phase='legitimate-compatibility';const compatibility=await d.compatibility();for(const name of compatibilityChecks)checks[name]=compatibility?.[name]===true;
  await d.persistPrivate({kind:'strict-revocation-observations',initial,subsequent,checks,observations,evidenceMode:d.evidenceMode});
 }catch{failed=true;}
 finally{try{phase=failed?phase:'cleanup';const c=await d.cleanup();cleanupPassed=c?.fixturesSignedOut===true&&c?.preservationExact===true&&c?.controlsDisabled===true&&c?.resourcesClosed===true;}catch{cleanupPassed=false;}}
 const complete=!failed&&cleanupPassed&&Object.values(checks).every(Boolean)&&checks.allSurfaces===true&&compatibilityChecks.every(k=>checks[k]);
 return {status:complete?(d.evidenceMode==='OFFLINE'?'PASSED_OFFLINE_REGRESSION_CORE':'READY_FOR_HUMAN_SECURITY_REVIEW'):'FAILED_OR_INCOMPLETE',evidenceMode:d.evidenceMode,checks,observations,cleanupPassed,failurePhase:complete?null:phase,strictOptionAApproved:false,hostedSecurityPassed:false};
}

// Concrete raw HTTP adapter. Credential/target authorization happens before
// reservation; the durable caller counts BEFORE fetch. No SDK auto-refresh,
// retries, redirects, admin endpoints or unapproved destinations are allowed.
export function strictFixtureHttp({publishableKey,fetcher,reserve,assertAuthority,knownBearer,knownRefresh,knownFactor,knownPassword,knownChallenge,fixture}){
 assert(['strict-a','strict-b'].includes(fixture),'Only approved disposable fixture labels');
 const base='https://mjtejwafxriwntweussc.supabase.co';
 /** @param {{kind:string,bearer?:string,refresh?:string,factor?:string,body?:any}} request */
 const request=async({kind,bearer,refresh,factor,body})=>{
  await assertAuthority();let path,method='POST',headers={apikey:publishableKey,'content-type':'application/json'},payload=body;
  if(kind==='refresh'){assert(knownRefresh(refresh),'Unknown refresh credential');path='/auth/v1/token?grant_type=refresh_token';payload={refresh_token:refresh};}
  else{
   assert(knownBearer(bearer),'Unknown bearer credential');headers.Authorization='Bearer '+bearer;
   if(kind==='identity'){path='/rest/v1/rpc/mitsa_identity';headers['content-profile']='api';}
   else if(['user-read','user-update','factor-list','stale-recovery-session'].includes(kind)){path='/auth/v1/user';method=kind==='user-read'||kind==='factor-list'?'GET':'PUT';if(method==='PUT'){assert(body&&Object.keys(body).every(k=>['password','current_password'].includes(k))&&knownPassword(body.password)&&knownPassword(body.current_password),'Unapproved password operation');}}
   else if(kind==='factor-enroll'){path='/auth/v1/factors';assert(body?.factor_type==='totp'&&Object.keys(body).every(k=>['factor_type','friendly_name','issuer'].includes(k)));}
   else{assert(knownFactor(factor),'Unknown fixture factor');assert(/^[a-f0-9-]{36}$/.test(factor));if(kind==='factor-challenge'){path=`/auth/v1/factors/${factor}/challenge`;assert(!body||Object.keys(body).length===0);}else if(kind==='factor-verify'){path=`/auth/v1/factors/${factor}/verify`;assert(body&&knownChallenge(factor,body.challenge_id)&&/^\d{6}$/.test(body.code)&&Object.keys(body).every(k=>['challenge_id','code'].includes(k)),'Unbound factor challenge');}else{assert(kind==='factor-unenroll','Unreviewed Auth operation');path=`/auth/v1/factors/${factor}`;method='DELETE';}}
  }
  reserve(kind==='identity'?'resourceRequests':'authRequests',{fixture});
  const response=await fetcher(base+path,{method,headers,body:['GET','DELETE'].includes(method)?undefined:JSON.stringify(payload??{}),redirect:'error',signal:AbortSignal.timeout(10000)});
  // Body is returned only to the private fixture process, never a public log.
  return {status:response.status,body:await response.json()};
 };
 return request;
}
