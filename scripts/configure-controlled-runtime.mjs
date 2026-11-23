import assert from "node:assert/strict";
import {readFileSync,appendFileSync} from "node:fs";
import {parse} from "dotenv";
import pg from "pg";
import {assertTestTarget} from "./test-target.mjs";
import {testDatabaseConfig} from "./postgres-config.mjs";
const approved=JSON.parse(readFileSync("config/test-target.json","utf8")),operator=parse(readFileSync(".secrets/operator.env")),local=parse(readFileSync(".env.local"));
const target=assertTestTarget({projectRef:operator.TEST_PROJECT_REF,url:operator.TEST_SUPABASE_URL,databaseUrl:operator.TEST_DATABASE_URL},approved);
const proof=JSON.parse(readFileSync("artifacts/controlled-signup-smoke.json","utf8"));
assert.equal(proof.project,target.projectRef);assert.equal(proof.passed,true);assert.equal(proof.publicGatesClosed,true);
const db=new pg.Client(testDatabaseConfig(operator.TEST_DATABASE_URL,approved));
try {
  await db.connect();
  assert.equal((await db.query("select marker from foundation_probe.environment_identity where singleton")).rows[0]?.marker,target.databaseMarker);
  assert.equal((await db.query("select enabled from private.isolated_mail_config where singleton")).rows[0]?.enabled,true);
  for(const [key,value] of Object.entries({MITSA_REGISTRATION_MODE:"isolated-test",MITSA_AUTH_MAIL_MODE:"isolated-capture"})) {
    assert(!local[key]||local[key]===value,`Refusing to overwrite ${key}`);
    if(!local[key])appendFileSync(".env.local",`\n${key}=${value}\n`);
  }
  console.log("Approved local synthetic registration and captured recovery enabled. No secrets printed or provider settings changed.");
} finally {await db.end();}
