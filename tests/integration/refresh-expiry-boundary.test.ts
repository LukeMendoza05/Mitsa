import {it,expect} from 'vitest';import {writeFileSync} from 'node:fs';
import {createSyntheticUser,database,publicClient,hostedConfig} from '../support/hosted';
it('provider session expiry blocks refresh and former application bearer for only that new synthetic session',async()=>{
 const user=await createSyntheticUser('refresh-expiry-boundary');
 const other=await publicClient().auth.signInWithPassword({email:user.email,password:user.password});expect(Boolean(!other.error&&other.data.session)).toBe(true);
 const sid=(await publicClient().auth.getClaims(user.session.access_token)).data?.claims.session_id;
 const db=await database();try{
  expect((await db.query("update auth.sessions set not_after=statement_timestamp()-interval '1 second' where id=$1 and user_id=$2 returning id",[sid,user.id])).rowCount).toBe(1);
  const refresh=await publicClient().auth.refreshSession({refresh_token:user.session.refresh_token});
  const bearer=await publicClient(user.session.access_token).schema('api').rpc('mitsa_identity');
  const isolated=await publicClient(other.data.session!.access_token).schema('api').rpc('mitsa_identity');
  const report={checkedAt:new Date().toISOString(),project:hostedConfig().projectRef,providerRefreshRejected:Boolean(refresh.error&&!refresh.data.session),providerErrorCategory:refresh.error?.code==='session_expired'?'session_expired':refresh.error?'other':'none',formerApplicationBearerDenied:bearer.error?.code==='42501',separateSessionPreserved:!isolated.error,onlyNewSyntheticSessionExpired:true,externalEmailsSent:0,privateValuesPrinted:false};
  writeFileSync('artifacts/refresh-expiry-boundary.json',JSON.stringify(report,null,2)+'\n');
  expect(report.providerRefreshRejected).toBe(true);expect(report.formerApplicationBearerDenied).toBe(true);expect(report.separateSessionPreserved).toBe(true);
 }finally{await db.end();}
},30000);
