// Run only after explicit approval of the two scoped isolated test principals.
import assert from "node:assert/strict";
import {existsSync,readFileSync,writeFileSync} from "node:fs";
import {randomUUID} from "node:crypto";
import {parse} from "dotenv";
import pg from "pg";
import {createClient} from "@supabase/supabase-js";
import {assertTestTarget} from "./test-target.mjs";
import {testDatabaseConfig} from "./postgres-config.mjs";
import {signIntentRequest} from "../supabase/functions/_shared/registration-intent-auth.ts";
import {totp} from "../tests/support/totp.ts";
const approved=JSON.parse(readFileSync("config/test-target.json","utf8")),env=parse(readFileSync(".secrets/operator.env")),local=parse(readFileSync(".env.local"));
const target=assertTestTarget({projectRef:env.TEST_PROJECT_REF,url:env.TEST_SUPABASE_URL,databaseUrl:env.TEST_DATABASE_URL},approved);
const path=".secrets/support-access.json",scopes={reviewer:["privacy-review","mfa-recovery-review"],executor:["privacy-execute"]};
const state=existsSync(path)?JSON.parse(readFileSync(path,"utf8")):{project:target.projectRef,ready:false,users:Object.fromEntries(Object.keys(scopes).map(label=>[label,{email:`foundation-support-${label}-${randomUUID()}@example.invalid`,password:`M1!${randomUUID()}`,fullName:`Synthetic support ${label}`}]))};
const save=()=>writeFileSync(path,JSON.stringify(state,null,2),{mode:0o600});
assert.equal(state.project,"mjtejwafxriwntweussc");
const db=new pg.Client(testDatabaseConfig(env.TEST_DATABASE_URL,approved));
try {
  await db.connect();assert.equal((await db.query("select marker from foundation_probe.environment_identity where singleton")).rows[0]?.marker,target.databaseMarker);
  assert.equal((await db.query("select registration_enabled or external_mail_enabled or legal_publication_enabled or eligibility_approved or disposal_enabled opened from private.release_gates where singleton")).rows[0]?.opened,false);
  if(state.ready) {
    for(const [label,user] of Object.entries(state.users)) {
      const existing=(await db.query("select p.active,p.scopes,p.revoked_at,u.email from private.operator_principals p join auth.users u on u.id=p.user_id where p.user_id=$1",[user.userId])).rows[0];
      assert(existing?.active&&existing.revoked_at===null&&existing.email===user.email);assert.deepEqual(existing.scopes,scopes[label]);
    }
    console.log("Existing scoped synthetic support access verified and preserved; no new permissions assigned.");
  } else {
    save();
    const admin=createClient(target.url,env.TEST_AUTH_ADMIN_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    for(const user of Object.values(state.users)) {
      assert(/^foundation-support-(reviewer|executor)-[a-f0-9-]+@example\.invalid$/.test(user.email));
      await db.query("insert into private.registration_test_recipients(email,enabled) values($1,true) on conflict(email) do nothing",[user.email]);
      const client=createClient(target.url,env.TEST_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
      const terms=(await client.schema("api").rpc("mitsa_registration_policy")).data;assert.equal(terms.status,"test");
      if(!user.userId) {
        const existing=(await db.query("select id from auth.users where email=$1",[user.email])).rows[0];
        if(existing)user.userId=existing.id;
        else {
          const body=JSON.stringify({email:user.email,fullName:user.fullName,termsVersion:terms.id,accepted:true});
          const response=await fetch(`${target.url}/functions/v1/mitsa-registration-intent`,{method:"POST",body,headers:{apikey:env.TEST_PUBLISHABLE_KEY,origin:"http://127.0.0.1:3000","content-type":"application/json",...await signIntentRequest(local.MITSA_REGISTRATION_INTENT_KEY,body)}});assert.equal(response.status,201);
          const intent=await response.json();
          const created=await admin.auth.admin.createUser({email:user.email,password:user.password,email_confirm:true,user_metadata:{full_name:user.fullName,registration_nonce:intent.nonce}});assert(!created.error&&created.data.user,"Synthetic support account creation failed");user.userId=created.data.user.id;
        }save();
      }
      try {
        const login=await client.auth.signInWithPassword({email:user.email,password:user.password});assert(!login.error&&login.data.user?.id===user.userId,"Synthetic support credentials could not be verified");
        assert(!(await client.schema("api").rpc("mitsa_accept_terms",{p_version:terms.id})).error);assert(!(await client.schema("api").rpc("mitsa_account_profile_save",{p_name:user.fullName})).error);
        if(!user.factorId) {
          const permit=await client.schema("api").rpc("mitsa_prepare_enrollment");assert(!permit.error&&permit.data);
          const factor=await client.auth.mfa.enroll({factorType:"totp",friendlyName:"Synthetic support authenticator",issuer:"Mitsa"});assert(!factor.error&&factor.data.totp);
          user.factorId=factor.data.id;user.totpSecret=factor.data.totp.secret;user.permit=permit.data;save();
        }
        assert(!(await client.auth.mfa.challengeAndVerify({factorId:user.factorId,code:totp(user.totpSecret)})).error);
        if(!(await client.schema("api").rpc("mitsa_identity")).data?.mfaReady){assert(user.permit,"Missing original enrollment permit; no recovery bypass attempted");assert(!(await client.schema("api").rpc("mitsa_bind_factor",{p_factor:user.factorId,p_permit:user.permit})).error);}
        assert.equal((await client.schema("api").rpc("mitsa_identity")).data?.mfaReady,true);delete user.permit;save();
      }finally{await client.auth.signOut({scope:"local"});}
    }
    await db.query("begin");
    try {
      for(const [label,user] of Object.entries(state.users)) {
        const granted=await db.query("insert into private.operator_principals(user_id,active,scopes) values($1,true,$2) on conflict(user_id) do nothing",[user.userId,scopes[label]]);
        if(granted.rowCount===1)await db.query("insert into private.access_audit(event,target_id,detail) values('support.principal-provisioned',$1,$2)",[user.userId,JSON.stringify({scopes:scopes[label],approval:'reviewed-requests-approval',syntheticOnly:true})]);
        const record=(await db.query("select active,scopes,revoked_at from private.operator_principals where user_id=$1",[user.userId])).rows[0];assert(record?.active&&record.revoked_at===null);assert.deepEqual(record.scopes,scopes[label]);
        assert.equal((await db.query("select count(*)::int n from private.memberships where user_id=$1",[user.userId])).rows[0].n,0);
      }
      await db.query("commit");
    }catch(error){await db.query("rollback");throw error;}
    state.ready=true;save();
    console.log(JSON.stringify({project:target.projectRef,syntheticSupportPrincipals:2,scopes,workspaceMembershipsGranted:0,mfaResetAuthorized:false,disposalAuthorized:false,privateAccessFile:path,credentialsPrinted:false}));
  }
}catch(error){console.error(JSON.stringify({status:"support fixture provisioning stopped; changes preserved",code:error instanceof assert.AssertionError?"security-precondition":error?.code??"unavailable"}));process.exitCode=1;}
finally{await db.end();}
