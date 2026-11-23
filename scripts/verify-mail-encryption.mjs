import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { parse } from "dotenv";
import pg from "pg";
import { readMessage,readPrivateKey,decrypt } from "openpgp";
import { assertTestTarget } from "./test-target.mjs";
import { testDatabaseConfig } from "./postgres-config.mjs";
const approved=JSON.parse(readFileSync("config/test-target.json","utf8")),env=parse(readFileSync(".secrets/operator.env"));
const target=assertTestTarget({projectRef:env.TEST_PROJECT_REF,url:env.TEST_SUPABASE_URL,databaseUrl:env.TEST_DATABASE_URL},approved);
const db=new pg.Client(testDatabaseConfig(env.TEST_DATABASE_URL,approved));
try {
  await db.connect(); await db.query("begin read only");
  assert.equal((await db.query("select marker from foundation_probe.environment_identity where singleton")).rows[0]?.marker,target.databaseMarker);
  const plaintext=JSON.stringify({purpose:"Synthetic encryption interoperability",nonce:randomBytes(32).toString("hex")});
  const {rows}=await db.query("select extensions.pgp_pub_encrypt($1,extensions.dearmor($2),'cipher-algo=aes256,compress-algo=0,unicode-mode=1') ciphertext",[plaintext,readFileSync(".secrets/auth-mail/public.asc","utf8")]);
  const result=await decrypt({message:await readMessage({binaryMessage:rows[0].ciphertext}),decryptionKeys:await readPrivateKey({armoredKey:readFileSync(".secrets/auth-mail/private.asc","utf8")})});
  assert.equal(result.data,plaintext);
  await db.query("commit");
  console.log(JSON.stringify({project:target.projectRef,readOnly:true,pgcryptoToOpenPGP:true,privateKeyUploaded:false}));
} finally {await db.end();}
