// Read-only preflight and private recovery snapshot. No Auth secrets are exported.
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse } from "dotenv";
import pg from "pg";
import { assertTestTarget } from "./test-target.mjs";
import { testDatabaseConfig } from "./postgres-config.mjs";

const approved = JSON.parse(readFileSync("config/test-target.json", "utf8"));
const env = parse(readFileSync(".secrets/operator.env"));
const target = assertTestTarget({ projectRef: env.TEST_PROJECT_REF, url: env.TEST_SUPABASE_URL, databaseUrl: env.TEST_DATABASE_URL }, approved);
const db = new pg.Client(testDatabaseConfig(env.TEST_DATABASE_URL, approved));
try {
  await db.connect();
  await db.query("begin isolation level repeatable read read only");
  const marker = (await db.query("select marker from foundation_probe.environment_identity where singleton")).rows[0]?.marker;
  if (marker !== target.databaseMarker) throw new Error("test marker mismatch");
  const developerInstalled=Boolean((await db.query("select to_regclass('private.developer_registration_recipients') present")).rows[0]?.present);
  // Only the separately reviewed, singleton developer exception is recognized.
  // Revocation closes signup, not the historical classification of its records.
  const knownDeveloper=developerInstalled?"exists(select 1 from private.developer_registration_recipients d where d.email=u.email and d.approved_at<=now() and d.approval_reference='mitsa-developer-registration-isolated-v1')":"false";
  const unexpected = (await db.query(`select count(*)::int count from auth.users u where (u.email is null or u.email !~ '^foundation-[a-zA-Z0-9-]+@example\\.invalid$') and not (${knownDeveloper})`)).rows[0].count;
  const approvedDeveloperUsers=developerInstalled?(await db.query(`select count(*)::int count from auth.users u where ${knownDeveloper}`)).rows[0].count:0;
  if(approvedDeveloperUsers>1)throw Error("unexpected developer-account count");
  const unknownBusinesses = (await db.query(`select count(*)::int count from private.businesses b where b.name !~ '^Synthetic ' or exists(select 1 from private.memberships m join auth.users u on u.id=m.user_id where m.business_id=b.id and (u.email is null or u.email !~ '^foundation-[a-zA-Z0-9-]+@example\\.invalid$') and not (${knownDeveloper}))`)).rows[0].count;
  const objects = (await db.query("select count(*)::int count from storage.objects")).rows[0].count;
  if (unexpected || unknownBusinesses || objects) throw new Error("unexpected data; operator review required before migration");
  const snapshot = { project: target.projectRef, marker, createdAt: new Date().toISOString(), tables: {}, functions: [], migrationHistory: [] };
  const tables = (await db.query("select schemaname,tablename from pg_tables where schemaname in ('private','foundation_probe') order by schemaname,tablename")).rows;
  const identifier = value => `"${value.replaceAll('"','""')}"`;
  for (const row of tables) {
    const table = `${row.schemaname}.${row.tablename}`;
    const qualified = `${identifier(row.schemaname)}.${identifier(row.tablename)}`;
    snapshot.tables[table] = (await db.query(`select to_jsonb(t) row from ${qualified} t order by to_jsonb(t)::text`)).rows.map(r => r.row);
  }
  snapshot.functions = (await db.query("select n.nspname schema,p.proname name,pg_get_functiondef(p.oid) definition,pg_get_userbyid(p.proowner) owner,p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('api','private') order by n.nspname,p.proname")).rows;
  snapshot.migrationHistory = (await db.query("select version,name from supabase_migrations.schema_migrations order by version")).rows;
  await db.query("commit");
  const content = JSON.stringify(snapshot);
  const path = `.secrets/recovery/workspace-before-${Date.now()}.json`;
  mkdirSync(".secrets/recovery", { recursive: true });
  writeFileSync(path, content, { flag: "wx" });
  console.log(JSON.stringify({ project: target.projectRef, markerVerified: true, unexpectedUsers: unexpected, approvedDeveloperUsers, unexpectedBusinesses: unknownBusinesses, storageObjects: objects, recoverySnapshot: path, sha256: createHash("sha256").update(content).digest("hex"), counts: Object.fromEntries(Object.entries(snapshot.tables).map(([table, rows]) => [table, rows.length])) }));
} catch (error) {
  try { await db.query("rollback"); } catch { /* No retry or migration on uncertainty. */ }
  console.error(JSON.stringify({ status: "preflight failed; no mutation", code: typeof error?.code === "string" ? error.code : "verification-failed" }));
  process.exitCode = 1;
} finally { await db.end(); }
