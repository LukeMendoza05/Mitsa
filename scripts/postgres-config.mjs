import {readFileSync} from "node:fs";
import {assertTestTarget} from "./test-target.mjs";

/** Operator/test only. Never use this module from the application runtime. */
export function testDatabaseConfig(databaseUrl,approved) {
  if(!databaseUrl) throw new Error("Isolated database URL required");
  assertTestTarget({projectRef:approved.projectRef,url:`https://${approved.projectRef}.supabase.co`,databaseUrl},approved);
  const url=new URL(databaseUrl);
  // Explicit fields avoid pg-connection-string query-option overrides.
  return {
    host:url.hostname,port:5432,database:"postgres",
    user:decodeURIComponent(url.username),password:decodeURIComponent(url.password),
    ssl:{ca:readFileSync(new URL("../config/supabase-ca.crt",import.meta.url),"utf8"),rejectUnauthorized:true},
    connectionTimeoutMillis:15000,
  };
}
