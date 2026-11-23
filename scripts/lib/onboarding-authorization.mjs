// Ordinary, fixture-only direct API probes. These intentionally bypass the
// harness's runtime credential fence so a local refusal cannot prove RLS.
import assert from 'node:assert/strict';
import {countedOnboardingFetch} from './onboarding-counted-fetch.mjs';
const base='https://mjtejwafxriwntweussc.supabase.co';
export async function probeOnboardingAuthorization(d){
 const checks=await d.observers.crossTenantDenials();assert(checks.length===6&&checks.every(c=>c.denied));
 const before=await d.protectedMembershipSnapshot();
 const call=async(label,name,body,anonymous=false)=>{const state=d.privateState(label),request=countedOnboardingFetch({fixture:label,scope:d.scope,fetcher:d.fetcher,signal:d.signal});
  const r=await request(base+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:d.publicKey,authorization:'Bearer '+(anonymous?d.publicKey:state.accessToken),'content-type':'application/json','content-profile':'api','accept-profile':'api'},body:JSON.stringify(body)});let value;try{value=await r.json();}catch{throw Error('Authorization probe response unavailable');}return {status:r.status,value};};
 const denied=r=>[401,403].includes(r.status)&&r.value?.code==='42501';let owners=true,anonymous=true,roles=true,direct=true;
 const readiness=await call('e-a','mitsa_persistent_registration_policy',{},true);assert(readiness.status===200&&readiness.value?.version===1,'Anonymous positive API witness unavailable');
 for(const label of ['e-a','e-b']){
  const own=await d.observers.inspectSession(label);owners&&=own.mfaReady&&own.aal==='aal2'&&own.role==='owner'&&own.membershipCount===1&&!own.platformOperator;
  const peer=d.privateState(label==='e-a'?'e-b':'e-a');assert(peer.workspaceIds.length===1);const business=peer.workspaceIds[0],slug='workspace-'+business;
  for(const [name,body] of [['mitsa_workspace',{p_slug:slug}],['mitsa_members',{p_business:business}],['mitsa_locations',{p_business:business}]])anonymous&&=denied(await call(label,name,body,true));
  const state=d.privateState(label);roles&&=denied(await call(label,'mitsa_member_update',{p_business:business,p_user:state.userId,p_role:'owner',p_active:true,p_locations:[]}));
  const transport=countedOnboardingFetch({fixture:label,scope:d.scope,fetcher:d.fetcher,signal:d.signal}),raw=await transport(base+'/rest/v1/businesses?select=id&id=eq.'+business,{headers:{apikey:d.publicKey,authorization:'Bearer '+state.accessToken,'accept-profile':'private'}});let data;try{data=await raw.json();}catch{throw Error('Direct table response unavailable');}
  direct&&=denied({status:raw.status,value:data})||raw.status===406&&data?.code==='PGRST106'||raw.status===200&&Array.isArray(data)&&data.length===0;
 }
 assert(owners&&anonymous&&roles&&direct,'Direct authorization acceptance failed');assert(JSON.stringify(before)===JSON.stringify(await d.protectedMembershipSnapshot()),'Negative authorization probe changed membership/ownership');
 return {crossTenantResources:true,anonymousResources:true,aal1WorkspaceDenied:d.aal1EvidenceComplete()===true,roleEscalationDenied:true,trustedOwnership:true,directApiAuthorization:true};
}
