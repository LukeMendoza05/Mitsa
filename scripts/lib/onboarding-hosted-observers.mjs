// Inactive real adapters; no database/client/network is constructed on import.
import assert from 'node:assert/strict';
import {onboardingProbeSql as sql} from './onboarding-probe-sql.mjs';
import {countedOnboardingFetch} from './onboarding-counted-fetch.mjs';
const labels=['e-a','e-b'],base='https://mjtejwafxriwntweussc.supabase.co';
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
function claims(token){try{assert(typeof token==='string'&&token.length<16384);const c=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());assert(uuid(c.sub)&&uuid(c.session_id)&&Number.isFinite(c.exp));return c;}catch{throw Error('Fixture session claims unavailable');}}
/** Claim decoding selects a probe only; ordinary RPC verifies the actual token.
 * All identities are bound to the approved fixture and private observed state.
 */
export function createOnboardingObservers(d){
 assert(d.publicKey?.startsWith('sb_publishable_'));assert(Buffer.isBuffer(d.comparisonKey)&&d.comparisonKey.length===32);
 const countedQuery=d.scope.wrapSql(d.db.query.bind(d.db),{readOnlySql:new Set(Object.values(sql))}),logouts=new Map(),logoutResults=new Map(),recovery=new Map();
 const query=async(text,args)=>{try{return await countedQuery(text,args);}catch{throw Error('Private observer database probe failed; details suppressed');}};
 const ready=async label=>{assert(labels.includes(label),'Unapproved observer fixture');await d.assertExecutionReady(label);d.scope.active();const f=d.fixture(label);assert(f&&d.scope.assertRecipient(label,f.email));return f;};
 const bound=async label=>{const f=await ready(label),state=await d.privateState(label);assert(uuid(state?.userId),'Observed fixture identity missing');const row=(await query(sql.registration,[f.email,d.generation])).rows[0];assert(row&&row.id===state.userId&&!row.super_admin&&!row.is_anonymous&&!row.platform_operator&&row.active,'Fixture binding unavailable');return {f,state,row};};
 const json=async(label,path,body,accessToken)=>{
  const send=countedOnboardingFetch({fixture:label,scope:d.scope,fetcher:d.fetcher});
  const response=await send(base+path,{method:'POST',headers:{apikey:d.publicKey,authorization:'Bearer '+accessToken,'content-type':'application/json','content-profile':'api','accept-profile':'api'},body:JSON.stringify(body)});
  let value;try{value=await response.json();}catch{throw Error('Observer response unavailable');}return {status:response.status,value};
 };
 const current=async label=>{const b=await bound(label),c=claims(b.state.accessToken);assert(c.sub===b.state.userId,'Wrong fixture credential');const session=(await query(sql.session,[c.session_id,c.sub])).rows[0];assert(session?.live&&c.exp>Number(session.database_seconds)+30,'Fixture session not currently usable');return {...b,c,session};};
 const snapshot=async(label,b)=>{const mfa=(await query(sql.mfa,[b.state.userId,d.comparisonKey])).rows[0].factors,workspaces=(await query(sql.workspace,[b.state.userId,b.f.locationName,d.comparisonKey])).rows[0].workspaces;return {mfa,workspaces};};
 const deny=r=>[401,403].includes(r.status)&&r.value?.code==='42501';
 return {
  async assertFixtureAbsent(label){const f=await ready(label);return (await query(sql.absent,[f.email])).rows.length===0;},
  async inspectRegistration(label){const b=await bound(label),network=await d.privateState(label);return {providerUserCreated:true,serverTurnstileVerified:network.signupServerChallenge===true,
   signedIntentBound:b.row.intent_bound===true&&b.row.generation_bound===true&&b.row.profile_bound===true&&network.intentId===b.row.intent_id,
   consentMatches:b.row.terms_id===d.notices.termsId&&b.row.privacy_id===d.notices.privacyId&&b.row.session_policy==='strict'&&!b.row.emergency_blocked,
   noDeveloperAllowlist:network.usedDeveloperAllowlist===false};},
  async inspectSession(label){const b=await current(label),identity=await json(label,'/rest/v1/rpc/mitsa_identity',{},b.state.accessToken);assert(identity.status===200&&identity.value?.userId===b.state.userId,'Ordinary actor identity unconfirmed');const s=await snapshot(label,b),trusted=s.mfa.filter(f=>f.type==='totp'&&f.status==='verified'&&f.trusted),w=s.workspaces[0];
   return {fixtureMatches:true,emailConfirmed:b.row.email_confirmed===true,aal:b.session.aal,mfaReady:identity.value.mfaReady===true&&b.session.aal==='aal2'&&trusted.length===1,
    membershipCount:b.row.memberships,platformOperator:b.row.platform_operator,role:w?.active&&w?.primaryOwner?w.role:undefined,workspaceSlug:w?.slug,locationMatches:w?.locationMatches===true};},
  async identifyExactSession(label){const b=await current(label);assert(typeof b.state.refreshToken==='string'&&b.state.refreshToken.length>0);const before={userId:b.state.userId,sessionId:b.c.session_id,accessToken:b.state.accessToken,refreshToken:b.state.refreshToken,exp:b.c.exp};logouts.set(label,before);logoutResults.delete(label);await d.persistPrivate({kind:'logout-witness',label,before});},
  async verifyExactLogout(label){await ready(label);const before=logouts.get(label);assert(before,'Logout witness missing');const s=(await query(sql.session,[before.sessionId,before.userId])).rows[0];assert(before.exp>Number(s.database_seconds)+30,'Former bearer expired before logout proof');
   if(logoutResults.has(label))return {...logoutResults.get(label),sessionRevoked:s.live===false};
   const actor=await json(label,'/rest/v1/rpc/mitsa_identity',{},before.accessToken);
   const refresh=await json(label,'/auth/v1/token?grant_type=refresh_token',{refresh_token:before.refreshToken},d.publicKey);
   if(refresh.status===200)await d.persistPrivate({kind:'unexpected-refresh-session',label,response:refresh.value});
   const result={sessionRevoked:s.live===false,formerBearerDenied:deny(actor),refreshDenied:[400,401].includes(refresh.status)&&['refresh_token_not_found','refresh_token_already_used','session_not_found'].includes(refresh.value?.error_code??refresh.value?.code)&&!refresh.value?.access_token};
   logoutResults.set(label,result);await d.persistPrivate({kind:'logout-result',label,result});return result;},
  async workspaceDeniedAtAal1(label){const b=await current(label);assert(b.session.aal==='aal1');const identity=await json(label,'/rest/v1/rpc/mitsa_identity',{},b.state.accessToken);assert(identity.status===200&&identity.value.userId===b.state.userId&&identity.value.mfaReady===false,'AAL1 identity not proven');const slug=await d.expectedWorkspaceSlug(label);assert(typeof slug==='string'&&/^workspace-[a-f0-9-]+$/.test(slug),'Known synthetic workspace required for AAL1 denial');return deny(await json(label,'/rest/v1/rpc/mitsa_workspace',{p_slug:slug},b.state.accessToken));},
  async snapshotRecoveryInvariants(label){const b=await current(label);recovery.set(label,await snapshot(label,b));await d.persistPrivate({kind:'recovery-invariants',label,...recovery.get(label)});},
  async recoveryTokenUnusedBeforePost(label){await ready(label);const state=await d.privateState(label);return /^(pkce_)?[a-f0-9]{32,256}$/.test(state.lastRecoveryTokenHash??'')&&state.recoveryVerifyAttempts===0;},
  async inspectRecoveryEffects(label){const f=await ready(label),state=await d.privateState(label),prior=recovery.get(label);assert(prior,'Recovery invariant snapshot missing');const row=(await query(sql.registration,[f.email,d.generation])).rows[0];assert(row?.id===state.userId);const next=await snapshot(label,{f,state,row});
   assert(/^(pkce_)?[a-f0-9]{32,256}$/.test(state.lastRecoveryTokenHash??''),'Observed provider recovery proof missing');
   const replay=await json(label,'/auth/v1/verify',{type:'recovery',token_hash:state.lastRecoveryTokenHash},d.publicKey);
   if(replay.status===200)await d.persistPrivate({kind:'unexpected-recovery-replay-session',label,response:replay.value});
   const logout=await this.verifyExactLogout(label);
   return {passwordChanged:state.passwordUpdateAccepted===true,factorBindingsUnchanged:JSON.stringify(prior.mfa)===JSON.stringify(next.mfa),workspaceOwnershipUnchanged:JSON.stringify(prior.workspaces)===JSON.stringify(next.workspaces),
    tokenReplayDenied:replay.status===403&&replay.value?.error_code==='otp_expired'&&!replay.value?.access_token,priorSessionDenied:logout.sessionRevoked&&logout.formerBearerDenied&&logout.refreshDenied};},
  async crossTenantDenials(){const result=[];for(const label of labels){const own=await current(label),ownWork=(await snapshot(label,own)).workspaces,peerLabel=label==='e-a'?'e-b':'e-a',peer=await bound(peerLabel),work=(await snapshot(peerLabel,peer)).workspaces;assert(ownWork.length===1&&work.length===1&&work[0].id!==ownWork[0].id,'Distinct synthetic workspaces required');
   const witness=await json(label,'/rest/v1/rpc/mitsa_identity',{},own.state.accessToken);assert(witness.status===200&&witness.value.userId===own.state.userId&&witness.value.mfaReady===true,'Positive tenant witness missing');
   for(const [path,body] of [['mitsa_workspace',{p_slug:work[0].slug}],['mitsa_members',{p_business:work[0].id}],['mitsa_locations',{p_business:work[0].id}]]){
    const positive=await json(label,'/rest/v1/rpc/'+path,path==='mitsa_workspace'?{p_slug:ownWork[0].slug}:{p_business:ownWork[0].id},own.state.accessToken);assert(positive.status===200,'Positive workspace authorization witness missing');
    const response=await json(label,'/rest/v1/rpc/'+path,body,own.state.accessToken);result.push({fixture:label,category:path,denied:deny(response)});
   }
  }assert(result.every(r=>r.denied),'Cross-tenant denial unconfirmed');return result;},
  privateState(){return {logoutWitnesses:[...logouts],recoverySnapshots:[...recovery]};}
 };
}
