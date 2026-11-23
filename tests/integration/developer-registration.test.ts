import {it,expect} from "vitest";
import {readFileSync,mkdirSync,writeFileSync} from "node:fs";
import {parse} from "dotenv";
import {z} from "zod";
import {database,hostedConfig,publicClient} from "../support/hosted";
import {signIntentRequest} from "../../supabase/functions/_shared/registration-intent-auth";

it("authorizes only the privately approved developer without creating their account",async()=>{
  const parsed=z.object({email:z.string().trim().toLowerCase().pipe(z.email().max(254))}).safeParse(JSON.parse(readFileSync(".secrets/developer-registration.json","utf8")));
  if(!parsed.success)throw Error("Private developer configuration is invalid; details omitted");
  const email=parsed.data.email,cfg=hostedConfig(),signing=parse(readFileSync(".secrets/registration-intent.env"));expect(cfg.projectRef).toBe("mjtejwafxriwntweussc");
  const db=await database();let terms:string,previousAccounts:number;
  try{
    const state=(await db.query("select enabled,approval_reference='mitsa-developer-registration-isolated-v1' reviewed,private.mitsa_test_recipient_allowed(email) allowed from private.developer_registration_recipients where email=$1",[email])).rows[0];
    expect(state).toEqual({enabled:true,reviewed:true,allowed:true});
    previousAccounts=(await db.query("select count(*)::int n from auth.users where email=$1",[email])).rows[0].n;
    expect((await db.query("select count(*)::int n from private.developer_registration_recipients")).rows[0].n).toBe(1);
    terms=(await db.query("select test_terms_id from private.release_gates where singleton")).rows[0].test_terms_id;
    expect((await db.query("select private.mitsa_test_recipient_allowed('unapproved@example.com') allowed")).rows[0].allowed).toBe(false);
    await db.query("begin");try{
      await db.query("update private.developer_registration_recipients set enabled=false where email=$1",[email]);
      expect((await db.query("select private.mitsa_test_recipient_allowed($1) allowed",[email])).rows[0].allowed).toBe(false);
    }finally{await db.query("rollback");}
  }finally{await db.end();}
  const body=JSON.stringify({email,fullName:"Developer authorization check",termsVersion:terms!,accepted:true});
  const headers={origin:"http://127.0.0.1:3000",apikey:cfg.publishableKey,"content-type":"application/json",...await signIntentRequest(signing.MITSA_REGISTRATION_INTENT_KEY,body)};
  const endpoint=`${cfg.url}/functions/v1/mitsa-registration-intent`;
  // Test explicit acceptance before the one authorized intent. Never submit
  // the developer email to Auth signup or create a password/account for them.
  const unchecked=JSON.stringify({email,fullName:"Developer authorization check",termsVersion:terms!,accepted:false});
  const refused=await fetch(endpoint,{method:"POST",body:unchecked,headers:{...headers,...await signIntentRequest(signing.MITSA_REGISTRATION_INTENT_KEY,unchecked)},signal:AbortSignal.timeout(20000)});expect(refused.status).toBe(422);
  const allowed=await fetch(endpoint,{method:"POST",body,headers,signal:AbortSignal.timeout(20000)});expect(allowed.status).toBe(201);
  const result=await allowed.json();expect(typeof result.intentId==="string"&&typeof result.nonce==="string").toBe(true);
  expect((await fetch(endpoint,{method:"POST",body,headers,signal:AbortSignal.timeout(20000)})).status).toBe(403);
  const direct=await publicClient().schema("api").rpc("mitsa_signed_registration_intent",{p_email:email,p_name:"Developer authorization check",p_terms:terms!,p_nonce_hash:"ab".repeat(32),p_accepted:true,p_request_hash:"cd".repeat(32),p_signed_at:new Date().toISOString()});expect(direct.error?.code).toBe("42501");
  const verify=await database();try{
    expect((await verify.query("select count(*)::int n from auth.users where email=$1",[email])).rows[0].n===previousAccounts!).toBe(true);
    expect((await verify.query("select provider_user_id is null and finalized_at is null and terms_id=$2 bound from private.registration_intents where id=$1",[result.intentId,terms!])).rows[0].bound).toBe(true);
    expect((await verify.query("select registration_enabled or eligibility_approved or external_mail_enabled or legal_publication_enabled or disposal_enabled opened from private.release_gates where singleton")).rows[0].opened).toBe(false);
  }finally{await verify.end();}
  mkdirSync("artifacts",{recursive:true});writeFileSync("artifacts/developer-registration-verification.json",JSON.stringify({project:cfg.projectRef,executedAt:new Date().toISOString(),exactPrivateEmailAuthorized:true,singleton:true,unauthorizedDenied:true,revocationVerifiedWithRollback:true,uncheckedTermsDenied:true,signedIntentAccepted:true,replayDenied:true,directAnonymousRpcDenied:true,developerAccountCreated:false,publicRegistrationOpen:false,externalMailEnabled:false,privateEmailPrinted:false},null,2));
},120000);
