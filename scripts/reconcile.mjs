import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import pg from "pg";
import { assertTestTarget } from "./test-target.mjs";

const env=parse(readFileSync(".secrets/operator.env"));
const approved=JSON.parse(readFileSync("config/test-target.json","utf8"));
const target=assertTestTarget({projectRef:env.TEST_PROJECT_REF,url:env.TEST_SUPABASE_URL,databaseUrl:env.TEST_DATABASE_URL},approved);
const url=new URL(env.TEST_DATABASE_URL);
for(const key of ["sslmode","sslrootcert","sslcert","sslkey"]) url.searchParams.delete(key);
const db=new pg.Client({connectionString:url.toString(),ssl:{rejectUnauthorized:true},connectionTimeoutMillis:15000});
try {
  await db.connect();
  await db.query("begin isolation level repeatable read read only");
  const marker=await db.query("select marker from foundation_probe.environment_identity where singleton");
  if(marker.rows[0]?.marker!==target.databaseMarker) throw new Error("test database identity mismatch");
  const result=await db.query("select r.id from foundation_probe.resources r left join foundation_probe.events e on e.resource_id=r.id group by r.id having r.value<>r.initial_value+coalesce(sum(e.delta),0)");
  const unmatched=await db.query("select r.command_key from foundation_probe.command_results r left join foundation_probe.events e using(actor_id,command_key) where e.command_key is null");
  if(result.rowCount||unmatched.rowCount) throw new Error("synthetic projection/command history reconciliation failed");
  console.log(JSON.stringify({project:target.projectRef,proofProjectionMismatches:0,commandsWithoutEvents:0,scope:"synthetic security probes only; no business ledgers implemented"}));
  await db.query("commit");
} catch(error) { console.error(error instanceof Error ? error.message : "reconciliation failed"); process.exitCode=1; }
finally { await db.end(); }
