import {it,expect} from 'vitest';import {writeFileSync} from 'node:fs';
import {createSyntheticUser,database,hostedConfig,publicClient} from '../support/hosted';
it('compares getUser and supported local logout after native refresh-family revocation',async()=>{
 const user=await createSyntheticUser('revocation-alternatives');let current=user.session;
 const second=await publicClient().auth.signInWithPassword({email:user.email,password:user.password});expect(Boolean(!second.error&&second.data.session)).toBe(true);
 for(let i=0;i<3;i++){const r=await publicClient().auth.refreshSession({refresh_token:current.refresh_token});expect(Boolean(!r.error&&r.data.session)).toBe(true);current=r.data.session!;}
 await new Promise(resolve=>setTimeout(resolve,12000));
 const replay=await publicClient().auth.refreshSession({refresh_token:user.session.refresh_token});expect(replay.error?.code==='refresh_token_already_used'&&!replay.data.session).toBe(true);
 const identity=await publicClient().auth.getUser(current.access_token);
 const apiBefore=await publicClient(current.access_token).schema('api').rpc('mitsa_identity');
 // This is the supported /logout API with THIS synthetic user's own bearer,
 // not a service credential, fabricated token or managed-table write.
 const logout=await publicClient().auth.admin.signOut(current.access_token,'local');
 const apiAfter=await publicClient(current.access_token).schema('api').rpc('mitsa_identity');
 const refreshAfter=await publicClient().auth.refreshSession({refresh_token:current.refresh_token});
 const other=await publicClient(second.data.session!.access_token).schema('api').rpc('mitsa_identity');
 const sid=(await publicClient().auth.getClaims(current.access_token)).data?.claims.session_id;
 const db=await database();try{
  const state=(await db.query('select count(*)::int sessions,(select count(*)::int from auth.refresh_tokens where session_id=$1) refresh_records from auth.sessions where id=$1 and user_id=$2',[sid,user.id])).rows[0];
  const report={checkedAt:new Date().toISOString(),project:hostedConfig().projectRef,staleReuseExplicitlyRejected:true,getUserAcceptedAfterFamilyRevocation:!identity.error&&identity.data.user?.id===user.id,getUserHttpErrorStatus:identity.error?.status??null,applicationIdentityAcceptedBeforeExplicitLogout:!apiBefore.error,supportedLocalLogoutSucceeded:!logout.error,formerBearerDeniedAfterExplicitLogout:apiAfter.error?.code==='42501',refreshDeniedAfterExplicitLogout:['refresh_token_not_found','session_not_found','session_expired'].includes(refreshAfter.error?.code??'')&&!refreshAfter.data.session,sessionRowRemoved:state.sessions===0,refreshRecordsRemoved:state.refresh_records===0,independentSessionPreserved:!other.error,automaticReuseDetectionNotProvidedByLogoutApi:true,fixtureOnly:true,externalEmailsSent:0,privateValuesPrinted:false};
  writeFileSync('artifacts/refresh-revocation-alternatives.json',JSON.stringify(report,null,2)+'\n');
  expect(report.supportedLocalLogoutSucceeded&&report.formerBearerDeniedAfterExplicitLogout&&report.refreshDeniedAfterExplicitLogout&&report.sessionRowRemoved&&report.refreshRecordsRemoved&&report.independentSessionPreserved).toBe(true);
 }finally{await db.end();}
},60000);
