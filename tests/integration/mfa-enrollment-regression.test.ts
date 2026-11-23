import {it,expect} from "vitest";
import {createClient} from "@supabase/supabase-js";
import {incompleteSyntheticMfa} from "../support/mfa-fixtures";
import {database,hostedConfig,publicClient} from "../support/hosted";
it("reproduces expired password/provider-verified mismatch and verifies supported isolated recovery on a synthetic account",async()=>{
  const {user,client,factorId}=await incompleteSyntheticMfa();
  expect((await client.auth.mfa.listFactors()).data?.totp.filter(f=>f.status==="verified")).toHaveLength(1);
  expect((await client.schema("api").rpc("mitsa_identity")).data?.mfaReady).toBe(false);
  expect((await client.auth.signInWithPassword({email:user.email,password:user.password})).error?.code).toBeUndefined();
  const state=await client.schema("api").rpc("mitsa_security_status");expect(state.data.initialized).toBe(false);expect(state.data.factors).toHaveLength(0);
  expect((await client.schema("api").rpc("mitsa_prepare_enrollment")).error?.code).toBe("42501");
  // Supported administrative deletion is tested only for this newly generated
  // synthetic orphan. The real developer factor requires separate approval.
  const cfg=hostedConfig();expect(cfg.projectRef).toBe("mjtejwafxriwntweussc");
  const admin=createClient(cfg.url,cfg.adminKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const session=(await client.auth.getSession()).data.session;if(!session)throw Error("Synthetic session unavailable");
  // Hosted behavior did not revoke all AAL1 sessions when deleting the factor,
  // despite the SDK comment. Explicitly revoke only this fixture's sessions
  // before deletion, and verify database session provenance rejects old JWTs.
  const revoke=await database();try{await revoke.query("delete from auth.sessions where user_id=$1",[user.id]);}finally{await revoke.end();}
  const removed=await admin.auth.admin.mfa.deleteFactor({userId:user.id,id:factorId});expect(removed.error?.code).toBeUndefined();
  const db=await database();try{
    expect((await db.query("select count(*)::int n from auth.mfa_factors where user_id=$1",[user.id])).rows[0].n).toBe(0);
    expect((await db.query("select count(*)::int n from auth.sessions where user_id=$1",[user.id])).rows[0].n).toBe(0);
  }finally{await db.end();}
  expect((await publicClient(session.access_token).schema("api").rpc("mitsa_identity")).error?.code).toBe("42501");
},120000);
