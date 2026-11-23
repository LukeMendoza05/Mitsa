import {createSyntheticUser,database,publicClient} from "./hosted";
import {totp} from "./totp";
// Reproduce the actual timing failure with a unique synthetic identity only.
// Provider-issued tokens remain signed; no JWT claims or verification flags
// are forged. Aging only this fixture's password evidence avoids a 5m sleep.
export async function incompleteSyntheticMfa(){
  const user={...await createSyntheticUser("incomplete-mfa"),fullName:"Synthetic incomplete MFA"},client=publicClient();
  if((await client.auth.setSession(user.session)).error)throw Error("Synthetic session unavailable");
  const permit=await client.schema("api").rpc("mitsa_prepare_enrollment");if(permit.error||!permit.data)throw Error("Synthetic permit unavailable");
  const factor=await client.auth.mfa.enroll({factorType:"totp",issuer:"Mitsa",friendlyName:"Synthetic incomplete authenticator"});if(factor.error||!factor.data.totp)throw Error("Synthetic enrollment unavailable");
  const claims=await client.auth.getClaims(),sessionId=claims.data?.claims.session_id;if(typeof sessionId!=="string")throw Error("Synthetic session unavailable");
  const db=await database();try{
    if(!/^foundation-incomplete-mfa-/.test(user.email))throw Error("Unapproved fixture");
    await db.query("update auth.mfa_amr_claims set created_at=now()-interval '6 minutes',updated_at=now()-interval '6 minutes' where session_id=$1 and authentication_method='password' and exists(select 1 from auth.sessions s where s.id=$1 and s.user_id=$2)",[sessionId,user.id]);
  }finally{await db.end();}
  const verified=await client.auth.mfa.challengeAndVerify({factorId:factor.data.id,code:totp(factor.data.totp.secret)});if(verified.error)throw Error("Synthetic provider verification failed");
  const bound=await client.schema("api").rpc("mitsa_bind_factor",{p_factor:factor.data.id,p_permit:permit.data});
  if(bound.error?.code!=="42501")throw Error("Expected expired-password binding denial");
  return {user,client,factorId:factor.data.id,permitId:permit.data};
}
