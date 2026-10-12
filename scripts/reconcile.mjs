import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import pg from "pg";
import { assertTestTarget } from "./test-target.mjs";
import {testDatabaseConfig} from "./postgres-config.mjs";

const env=parse(readFileSync(".secrets/operator.env"));
const approved=JSON.parse(readFileSync("config/test-target.json","utf8"));
const target=assertTestTarget({projectRef:env.TEST_PROJECT_REF,url:env.TEST_SUPABASE_URL,databaseUrl:env.TEST_DATABASE_URL},approved);
const db=new pg.Client(testDatabaseConfig(env.TEST_DATABASE_URL,approved));
try {
  await db.connect();
  await db.query("begin isolation level repeatable read read only");
  const marker=await db.query("select marker from foundation_probe.environment_identity where singleton");
  if(marker.rows[0]?.marker!==target.databaseMarker) throw new Error("test database identity mismatch");
  const counts=(await db.query("select (select count(*)::int from foundation_probe.events) as events, (select count(*)::int from foundation_probe.command_results) as commands")).rows[0];
  if(counts.events===0||counts.commands===0) throw new Error("synthetic reconciliation requires actual committed command events");
  const result=await db.query("select r.id from foundation_probe.resources r left join foundation_probe.events e on e.resource_id=r.id group by r.id having r.value<>r.initial_value+coalesce(sum(e.delta),0)");
  const unmatched=await db.query("select r.command_key from foundation_probe.command_results r left join foundation_probe.events e using(actor_id,command_key) where e.command_key is null");
  const inconsistent=await db.query("select e.command_key from foundation_probe.events e join foundation_probe.command_results r using(actor_id,command_key) where (e.business_id,e.shop_id,e.resource_id,e.resulting_value) is distinct from (r.business_id,r.shop_id,r.resource_id,r.resulting_value)");
  if(result.rowCount||unmatched.rowCount||inconsistent.rowCount) throw new Error("synthetic projection/command history reconciliation failed");
  console.log(JSON.stringify({project:target.projectRef,committedEvents:counts.events,committedCommands:counts.commands,proofProjectionMismatches:0,commandsWithoutEvents:0,eventResultMismatches:0,scope:"synthetic security probes only; no business ledgers implemented"}));
  await db.query("commit");
} catch(error) { console.error(error instanceof Error ? error.message : "reconciliation failed"); process.exitCode=1; }
finally { await db.end(); }
