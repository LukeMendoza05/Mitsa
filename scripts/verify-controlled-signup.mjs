import assert from "node:assert/strict";
import { readFileSync,writeFileSync } from "node:fs";
import { randomUUID,createHash } from "node:crypto";
import { parse } from "dotenv";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { decrypt,readMessage,readPrivateKey } from "openpgp";
import { signIntentRequest } from "../supabase/functions/_shared/registration-intent-auth.ts";
import { assertTestTarget } from "./test-target.mjs";
import { testDatabaseConfig } from "./postgres-config.mjs";
import { totp } from "../tests/support/totp.ts";
const approved=JSON.parse(readFileSync("config/test-target.json","utf8")),env=parse(readFileSync(".secrets/operator.env")),local=parse(readFileSync(".env.local"));
const target=assertTestTarget({projectRef:env.TEST_PROJECT_REF,url:env.TEST_SUPABASE_URL,databaseUrl:env.TEST_DATABASE_URL},approved);
const db=new pg.Client(testDatabaseConfig(env.TEST_DATABASE_URL,approved)),checks=[];
const client=()=>createClient(target.url,env.TEST_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const mark=name=>{checks.push(name);console.log(JSON.stringify({check:name,status:"passed"}));};
const email=`foundation-provider-proof-${randomUUID()}@example.invalid`,password=`M1!${randomUUID()}`;
const newPassword=`M2!${randomUUID()}`;
const privateKey=await readPrivateKey({armoredKey:readFileSync(".secrets/auth-mail/private.asc","utf8")});
async function captured(type) {
  const hash=createHash("sha256").update(email).digest("hex");
  const row=(await db.query("select encrypted_payload from private.isolated_auth_mail where recipient_hash=$1 and action=$2 order by created_at desc limit 1",[hash,type])).rows[0];
  assert(row,"Captured mail missing");
  const mail=JSON.parse((await decrypt({message:await readMessage({binaryMessage:row.encrypted_payload}),decryptionKeys:privateKey})).data);
  assert.equal(mail.email,email);assert.equal(mail.type,type);return mail;
}
try {
  await db.connect();
  assert.equal((await db.query("select marker from foundation_probe.environment_identity where singleton")).rows[0]?.marker,target.databaseMarker);
  const settings=await fetch(`${target.url}/auth/v1/settings`,{headers:{apikey:env.TEST_PUBLISHABLE_KEY}}).then(r=>r.json());
  assert.equal(settings.disable_signup,false);assert.equal(settings.mailer_autoconfirm,false);assert.equal(settings.external.anonymous_users,false);
  for(const metadata of [{},{registration_nonce:"0".repeat(64),role:"owner"}]) {
    const deniedEmail=`foundation-unauthorized-${randomUUID()}@example.invalid`;
    const result=await client().auth.signUp({email:deniedEmail,password,options:{data:metadata,emailRedirectTo:"http://127.0.0.1:3000/auth/email"}});
    assert(result.error,"Direct unauthorized signup unexpectedly succeeded");assert.equal(result.data.session,null);
    assert.equal((await db.query("select count(*)::int n from auth.users where email=$1",[deniedEmail])).rows[0].n,0);
  }
  mark("direct-provider-unauthorized-signup-denied");
  await db.query("insert into private.registration_test_recipients(email,enabled) values($1,true)",[email]);
  const terms=(await client().schema("api").rpc("mitsa_registration_policy")).data;
  assert.equal(terms.status,"test");assert.equal(terms.publicRegistration,false);
  const body=JSON.stringify({email,fullName:"Synthetic provider proof",termsVersion:terms.id,accepted:true});
  const issueIntent=async()=>{
    const response=await fetch(`${target.url}/functions/v1/mitsa-registration-intent`,{method:"POST",body,headers:{apikey:env.TEST_PUBLISHABLE_KEY,origin:"http://127.0.0.1:3000","content-type":"application/json",...await signIntentRequest(local.MITSA_REGISTRATION_INTENT_KEY,body)}});
    assert.equal(response.status,201);return response.json();
  };
  let intent=await issueIntent();
  const signup=()=>client().auth.signUp({email,password,options:{data:{registration_nonce:intent.nonce,full_name:"Synthetic provider proof",role:"owner"},emailRedirectTo:"http://127.0.0.1:3000/auth/email"}});
  await db.query("update private.isolated_mail_config set enabled=false where singleton");
  try {
    const denied=await signup();assert(denied.error,"Missing capture must reject signup");assert.equal(denied.data.session,null);
    assert.equal((await db.query("select count(*)::int n from auth.users where email=$1",[email])).rows[0].n,0);
    mark("missing-mail-configuration-fails-closed-and-rolls-back-user");
  } finally {await db.query("update private.isolated_mail_config set enabled=true where singleton");}
  // Managed hooks use their own DB transaction: a failed mail hook rolls back
  // the Auth user but deliberately leaves that nonce bound to its prior UUID.
  // Never recycle it for a new user. The app issues a fresh intent per POST.
  intent=await issueIntent();
  const registered=await signup();
  if(registered.error)writeFileSync(".secrets/controlled-signup-error.json",JSON.stringify({name:registered.error.name,status:registered.error.status,code:registered.error.code,message:registered.error.message},null,2),{mode:0o600});
  assert(!registered.error,`Native signup failed: ${registered.error?.code}`);assert(registered.data.user);assert.equal(registered.data.session,null);
  assert.equal((await db.query("select email_confirmed_at from auth.users where id=$1",[registered.data.user.id])).rows[0].email_confirmed_at,null);
  assert((await client().auth.signInWithPassword({email,password})).error);
  mark("native-signup-captured-email-required-no-session");
  const signupMail=await captured("signup"),confirmed=client();
  const verified=await confirmed.auth.verifyOtp({token_hash:signupMail.tokenHash,type:"signup"});assert(!verified.error);assert(verified.data.session);
  assert.equal((await confirmed.schema("api").rpc("mitsa_finalize_registration")).data,true);
  assert.equal((await db.query("select count(*)::int n from private.legal_acceptances where user_id=$1 and version_id=$2 and source='registration'",[registered.data.user.id,terms.id])).rows[0].n,1);
  assert.equal((await db.query("select count(*)::int n from private.memberships where user_id=$1",[registered.data.user.id])).rows[0].n,0);
  assert((await client().auth.verifyOtp({token_hash:signupMail.tokenHash,type:"signup"})).error);
  mark("email-verification-finalizes-terms-once-without-role-grant");
  const missingMfa=await confirmed.schema("api").rpc("mitsa_create_workspace",{p_name:"Synthetic denied",p_location:"Shop",p_kind:"shop",p_key:randomUUID()});assert(missingMfa.error);
  mark("workspace-creation-denied-without-mfa");
  const reset=await client().auth.resetPasswordForEmail(email,{redirectTo:"http://127.0.0.1:3000/auth/email"});assert(!reset.error,`Recovery request failed: ${reset.error?.code}`);
  const recoveryMail=await captured("recovery"),recovered=client();
  assert(!(await recovered.auth.verifyOtp({token_hash:recoveryMail.tokenHash,type:"recovery"})).error);
  assert(!(await recovered.auth.updateUser({password:newPassword})).error);
  assert(!(await recovered.auth.signOut({scope:"global"})).error);
  assert((await client().auth.signInWithPassword({email,password})).error);
  assert((await client().auth.verifyOtp({token_hash:recoveryMail.tokenHash,type:"recovery"})).error);
  const owner=client();assert(!(await owner.auth.signInWithPassword({email,password:newPassword})).error);
  const oldAccess=await confirmed.schema("api").rpc("mitsa_identity");assert(oldAccess.error,"Global logout must revoke app access");
  mark("captured-password-recovery-replay-denial-and-old-session-revocation");
  const permit=await owner.schema("api").rpc("mitsa_prepare_enrollment");assert(!permit.error);
  const enrollment=await owner.auth.mfa.enroll({factorType:"totp",friendlyName:"Synthetic provider proof",issuer:"Mitsa"});assert(!enrollment.error&&enrollment.data.totp);
  assert(!(await owner.auth.mfa.challengeAndVerify({factorId:enrollment.data.id,code:totp(enrollment.data.totp.secret)})).error);
  assert(!(await owner.schema("api").rpc("mitsa_bind_factor",{p_factor:enrollment.data.id,p_permit:permit.data})).error);
  const command={p_name:"Synthetic registered provider proof",p_location:"Main shop",p_kind:"shop",p_key:randomUUID()};
  const workspace=await owner.schema("api").rpc("mitsa_create_workspace",command);assert(!workspace.error,`Workspace creation failed: ${workspace.error?.code}`);
  assert.deepEqual((await owner.schema("api").rpc("mitsa_create_workspace",command)).data,workspace.data);
  const detail=await owner.schema("api").rpc("mitsa_workspace",{p_slug:workspace.data.slug});assert.equal(detail.data.role,"owner");
  assert.equal((await db.query("select count(*)::int n from private.memberships where business_id=$1 and role='owner' and active",[workspace.data.id])).rows[0].n,1);
  assert(!(await owner.auth.signOut({scope:"global"})).error);
  mark("native-mfa-enrollment-atomic-owner-workspace-and-logout");
  const state=(await db.query("select registration_enabled or external_mail_enabled or legal_publication_enabled or eligibility_approved or disposal_enabled opened from private.release_gates where singleton")).rows[0];assert.equal(state.opened,false);
  writeFileSync("artifacts/controlled-signup-smoke.json",JSON.stringify({project:target.projectRef,checks,publicGatesClosed:true,externalMailSent:false,credentialsPrinted:false,passed:true},null,2));
} catch(error) {
  console.error(JSON.stringify({status:"controlled signup verification failed",message:error instanceof assert.AssertionError?error.message:error?.code??"unexpected-error",checksPassed:checks}));process.exitCode=1;
} finally {await db.end();}
