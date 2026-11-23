import {it,expect} from 'vitest';import {writeFileSync} from 'node:fs';
import {createSyntheticUser,database,publicClient,hostedConfig} from '../support/hosted';

it('preserves concurrent normal refresh, legitimate parent retry and an independent session',async()=>{
 const user=await createSyntheticUser('refresh-compatibility');
 const second=await publicClient().auth.signInWithPassword({email:user.email,password:user.password});expect(Boolean(!second.error&&second.data.session)).toBe(true);
 const sid=(await publicClient().auth.getClaims(user.session.access_token)).data?.claims.session_id;
 const rotations=await Promise.all(Array.from({length:3},()=>publicClient().auth.refreshSession({refresh_token:user.session.refresh_token})));
 expect(rotations.every(r=>!r.error&&r.data.session)).toBe(true);
 // The original token is still the immediate parent of the active replacement.
 // This legitimate retry must work even outside the normal 10-second interval.
 await new Promise(resolve=>setTimeout(resolve,12000));
 const parent=await publicClient().auth.refreshSession({refresh_token:user.session.refresh_token});expect(Boolean(!parent.error&&parent.data.session)).toBe(true);
 const current=await publicClient(parent.data.session!.access_token).schema('api').rpc('mitsa_identity');expect(current.error).toBeNull();
 const other=await publicClient(second.data.session!.access_token).schema('api').rpc('mitsa_identity');expect(other.error).toBeNull();
 const db=await database();try{
  const state=(await db.query("select s.not_after is null active,(select count(*)::int from auth.refresh_tokens r where r.session_id=s.id and not r.revoked) live_refresh from auth.sessions s where s.id=$1 and s.user_id=$2",[sid,user.id])).rows[0];
  expect(state?.active===true&&state.live_refresh===1).toBe(true);
  const installed=(await db.query("select exists(select 1 from pg_trigger where tgrelid='auth.refresh_tokens'::regclass and tgname='mitsa_refresh_family_revocation' and not tgisinternal) installed")).rows[0].installed;
  writeFileSync(`artifacts/refresh-rotation-compatibility-${installed?'guarded':'baseline'}.json`,JSON.stringify({checkedAt:new Date().toISOString(),project:hostedConfig().projectRef,guardInstalled:installed,concurrentNormalRefreshPassed:true,legitimateParentRetryAfterIntervalPassed:true,currentSessionRetainsOneLiveRefresh:true,independentSessionPreserved:true,fixtureOnly:true,externalEmailsSent:0,privateValuesPrinted:false},null,2)+'\n');
 }finally{await db.end();}
},60000);
