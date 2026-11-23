import assert from "node:assert/strict";
import { existsSync,mkdirSync,readFileSync,writeFileSync } from "node:fs";
import { createHash,randomUUID } from "node:crypto";
import { parse } from "dotenv";
import pg from "pg";
import { decrypt,readMessage,readPrivateKey,readKey } from "openpgp";
import { assertTestTarget } from "./test-target.mjs";
import { testDatabaseConfig } from "./postgres-config.mjs";
import {renderAccountMessage} from "../src/lib/mail/messages.ts";
const approved=JSON.parse(readFileSync("config/test-target.json","utf8")),env=parse(readFileSync(".secrets/operator.env"));
const target=assertTestTarget({projectRef:env.TEST_PROJECT_REF,url:env.TEST_SUPABASE_URL,databaseUrl:env.TEST_DATABASE_URL},approved);
const db=new pg.Client(testDatabaseConfig(env.TEST_DATABASE_URL,approved));
try {
  await db.connect();
  assert.equal((await db.query("select marker from foundation_probe.environment_identity where singleton")).rows[0]?.marker,target.databaseMarker);
  const gates=(await db.query("select registration_enabled or external_mail_enabled or legal_publication_enabled or eligibility_approved or disposal_enabled opened from private.release_gates where singleton")).rows[0];
  assert.equal(gates?.opened,false,"Release gates must remain closed");
  const command=process.argv[2],path=".secrets/signup-access.json";
  if(command==="configure-approved") {
    const key=readFileSync(".secrets/auth-mail/public.asc","utf8");
    await readKey({armoredKey:key});
    await db.query("update private.isolated_mail_config set public_key=$1,enabled=true where singleton",[key]);
    console.log(JSON.stringify({project:target.projectRef,encryptedCapture:true,privateKeyUploaded:false,providerSettingsChanged:false}));
  } else if(command==="prepare-identities") {
    const users=existsSync(path)?JSON.parse(readFileSync(path,"utf8")):Object.fromEntries(["owner","admin","staff"].map(label=>[label,{email:`foundation-journey-${label}-${randomUUID()}@example.invalid`,password:`M1!${randomUUID()}`,fullName:`Synthetic journey ${label}`} ]));
    for(const user of Object.values(users)) {
      assert(/^foundation-[a-zA-Z0-9-]+@example\.invalid$/.test(user.email));
      await db.query("insert into private.registration_test_recipients(email,enabled) values($1,true) on conflict(email) do update set enabled=true",[user.email]);
    }
    if(!existsSync(path))writeFileSync(path,JSON.stringify(users),{flag:"wx",mode:0o600});
    console.log(JSON.stringify({project:target.projectRef,allowlistedSyntheticIdentities:Object.keys(users),accountsCreated:false,credentialsPrinted:false}));
  } else if(command==="read") {
    const label=process.argv[3],users=JSON.parse(readFileSync(path,"utf8"));
    assert(["owner","admin","staff"].includes(label));
    const user=users[label],hash=createHash("sha256").update(user.email).digest("hex");
    const rows=(await db.query("select id,encrypted_payload from (select id,encrypted_payload,created_at from private.isolated_auth_mail where recipient_hash=$1 union all select id,encrypted_payload,created_at from private.invitation_deliveries where recipient_hash=$1) messages order by created_at desc limit 20",[hash])).rows;
    const privateKey=await readPrivateKey({armoredKey:readFileSync(".secrets/auth-mail/private.asc","utf8")});
    mkdirSync(".secrets/auth-mail/messages",{recursive:true});
    for(const row of rows) {
      const decrypted=await decrypt({message:await readMessage({binaryMessage:row.encrypted_payload}),decryptionKeys:privateKey});
      const mail=JSON.parse(decrypted.data);
      assert.equal(mail.email,user.email);assert.equal(mail.origin,"http://127.0.0.1:3000");
      assert(["signup","recovery","invitation"].includes(mail.type));
      const link=new URL(mail.type==="invitation"?"/invitations/open":"/auth/email",mail.origin);
      if(mail.type==="invitation") {assert(/^[a-f0-9]{64}$/.test(mail.token));link.searchParams.set("token",mail.token);}
      else {assert(/^(pkce_)?[a-f0-9]{32,256}$/.test(mail.tokenHash));link.searchParams.set("type",mail.type);link.searchParams.set("token_hash",mail.tokenHash);}
      const destination=`.secrets/auth-mail/messages/${row.id}.json`;
      const linkOnly={...mail};delete linkOnly.code;
      if(!existsSync(destination))writeFileSync(destination,JSON.stringify({...linkOnly,url:link.href}),{flag:"wx",mode:0o600});
      const preview=`.secrets/auth-mail/messages/${row.id}.html`;
      if(!existsSync(preview))writeFileSync(preview,renderAccountMessage({kind:mail.type,recipient:mail.email,url:link.href,...(mail.businessName?{workspaceName:mail.businessName}:{})},mail.origin).html,{flag:"wx",mode:0o600});
    }
    console.log(JSON.stringify({project:target.projectRef,capturedMessages:rows.length,privateFilesOnly:true,tokensPrinted:false}));
  } else throw new Error("Expected configure-approved, prepare-identities or read <label>");
} finally {await db.end();}
