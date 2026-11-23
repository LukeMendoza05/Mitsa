// Operator-local only. Never import this into Next.js or print private values.
import assert from "node:assert/strict";
import {readFileSync,writeFileSync,mkdirSync,appendFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {parse} from "dotenv";
import {z} from "zod";
import pg from "pg";
import {readPrivateKey,readMessage,decrypt} from "openpgp";
import {assertTestTarget} from "./test-target.mjs";
import {testDatabaseConfig} from "./postgres-config.mjs";
import {renderAccountMessage} from "../src/lib/mail/messages.ts";
const approved=JSON.parse(readFileSync("config/test-target.json","utf8")),operator=parse(readFileSync(".secrets/operator.env"));
const target=assertTestTarget({projectRef:operator.TEST_PROJECT_REF,url:operator.TEST_SUPABASE_URL,databaseUrl:operator.TEST_DATABASE_URL},approved);
const command=process.argv[2]??"status",reference="mitsa-developer-registration-isolated-v1",origin="http://127.0.0.1:3000";
const db=new pg.Client(testDatabaseConfig(operator.TEST_DATABASE_URL,approved));
try {
  const configured=z.object({email:z.string().trim().toLowerCase().pipe(z.email().max(254))}).passthrough().safeParse(JSON.parse(readFileSync(".secrets/developer-registration.json","utf8")));
  assert(configured.success,"Private developer email is missing or invalid");const email=configured.data.email;
  await db.connect();assert.equal((await db.query("select marker from foundation_probe.environment_identity where singleton")).rows[0]?.marker,target.databaseMarker);
  const gates=(await db.query("select registration_enabled or external_mail_enabled or legal_publication_enabled or eligibility_approved or disposal_enabled opened from private.release_gates where singleton")).rows[0];assert.equal(gates?.opened,false);
  assert.equal((await db.query("select enabled from private.isolated_mail_config where singleton")).rows[0]?.enabled,true);
  const provider=await fetch(`${target.url}/auth/v1/settings`,{headers:{apikey:operator.TEST_PUBLISHABLE_KEY},signal:AbortSignal.timeout(15000)}).then(r=>r.json());assert.equal(provider.disable_signup,false);assert.equal(provider.mailer_autoconfirm,false);assert.equal(provider.external.anonymous_users,false);
  const installed=Boolean((await db.query("select to_regclass('private.developer_registration_recipients') installed")).rows[0]?.installed);
  if(command==="status") {
    const allowed=installed?Boolean((await db.query("select enabled from private.developer_registration_recipients where email=$1 and approval_reference=$2",[email,reference])).rows[0]?.enabled):false;
    const account=(await db.query("select email_confirmed_at is not null verified from auth.users where email=$1",[email])).rows[0];
    console.log(JSON.stringify({project:target.projectRef,privateEmailValid:true,migrationInstalled:installed,developerAuthorized:allowed,accountExists:Boolean(account),emailVerified:Boolean(account?.verified),publicRegistrationOpen:false,externalMailEnabled:false,privateEmailPrinted:false}));
  }else if(command==="authorize-reviewed") {
    assert(process.argv[3]==="--approved-isolated-activation","Explicit reviewed activation flag required");assert(installed,"Reviewed migration is not installed");
    const definitions=(await db.query("select pg_get_functiondef('private.mitsa_before_user_created(jsonb)'::regprocedure) signup,pg_get_functiondef('private.mitsa_isolated_send_email(jsonb)'::regprocedure) mail")).rows[0];assert(definitions.signup.includes("mitsa_test_recipient_allowed")&&definitions.mail.includes("mitsa_test_recipient_allowed"));
    const hash=createHash("sha256").update(email).digest("hex"),local=parse(readFileSync(".env.local"));assert(!local.MITSA_DEVELOPER_EMAIL_SHA256||local.MITSA_DEVELOPER_EMAIL_SHA256===hash,"A different local developer authorization is configured");
    await db.query("begin");try {
      await db.query("lock table private.developer_registration_recipients in exclusive mode");
      const existing=(await db.query("select email from private.developer_registration_recipients")).rows[0];assert(!existing||existing.email===email,"A different developer identity is already authorized; refusing replacement");
      await db.query("insert into private.developer_registration_recipients(email,enabled,approved_at,approval_reference) values($1,true,now(),$2) on conflict(email) do update set enabled=true",[email,reference]);
      await db.query("insert into private.access_audit(event,detail) values('registration.developer-authorized',$1)",[JSON.stringify({approval:reference,emailHash:createHash("sha256").update(email).digest("hex"),externalMail:false})]);
      await db.query("commit");
    }catch(error){await db.query("rollback");throw error;}
    if(!local.MITSA_DEVELOPER_EMAIL_SHA256)appendFileSync(".env.local",`\n# Private developer-email format hint; database authorization remains authoritative.\nMITSA_DEVELOPER_EMAIL_SHA256=${hash}\n`);
    console.log(JSON.stringify({project:target.projectRef,developerAuthorized:true,accountsCreated:0,membershipsGranted:0,emailVerificationRequired:true,externalMailEnabled:false,privateEmailPrinted:false}));
  }else if(command==="inbox") {
    assert(installed,"Reviewed migration is not installed");assert.equal((await db.query("select enabled from private.developer_registration_recipients where email=$1 and approval_reference=$2",[email,reference])).rows[0]?.enabled,true);
    const rows=(await db.query("select id,encrypted_payload from private.isolated_auth_mail where recipient_hash=$1 order by created_at desc limit 10",[createHash("sha256").update(email).digest("hex")])).rows;
    const key=await readPrivateKey({armoredKey:readFileSync(".secrets/auth-mail/private.asc","utf8")});mkdirSync(".secrets/developer-mail",{recursive:true});
    for(const [index,row] of rows.entries()) {
      const message=JSON.parse(String((await decrypt({message:await readMessage({binaryMessage:row.encrypted_payload}),decryptionKeys:key})).data));
      assert.equal(message.email,email);assert.equal(message.origin,origin);assert(["signup","recovery"].includes(message.type));assert(/^(pkce_)?[a-f0-9]{32,256}$/.test(message.tokenHash));
      const url=new URL("/auth/email",origin);url.searchParams.set("type",message.type);url.searchParams.set("token_hash",message.tokenHash);
      // Preserve the existing private link workflow without exporting the new
      // numeric code to a plaintext file. Tests decrypt codes in memory only.
      const linkOnly={...message};delete linkOnly.code;
      const json=JSON.stringify({...linkOnly,url:url.href}),html=renderAccountMessage({kind:message.type,recipient:email,url:url.href},origin).html;
      for(const label of [row.id,...(index===0?["latest"]:[])]){writeFileSync(`.secrets/developer-mail/${label}.json`,json,{mode:0o600});writeFileSync(`.secrets/developer-mail/${label}.html`,html,{mode:0o600});}
    }
    console.log(JSON.stringify({project:target.projectRef,capturedMessages:rows.length,latestPrivateMessage:rows.length?".secrets/developer-mail/latest.json":null,externalMailSent:false,tokensPrinted:false}));
  }else throw Error("Use status, inbox, or the explicitly approved operator activation command");
}catch(error){console.error(JSON.stringify({status:"Developer workflow stopped; no security bypass",kind:error instanceof assert.AssertionError?"precondition":typeof error?.code==="string"?error.code:"configuration",privateDetailsPrinted:false}));process.exitCode=1;}
finally{await db.end();}
