// One-time operator tool for the specifically approved Task 3 repair.
// No credentials enter process.env or application runtime. Never a general migrator.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { parse } from "dotenv";
import pg from "pg";
import { assertTestTarget } from "./test-target.mjs";
import { testDatabaseConfig } from "./postgres-config.mjs";

const version = "20261012070606";
const name = "foundation_verified_actor_adapter";
const reviewedHash = "E4408BCED96D469EDD7012188650C14C60F383294FA6CE9BFC198041A870CDC3";
const mode = process.argv[2];
assert(["--rollback-proof", "--apply"].includes(mode), "explicit operator mode required");
const sql = readFileSync(`supabase/migrations/${version}_${name}.sql`, "utf8");
assert.equal(createHash("sha256").update(sql).digest("hex").toUpperCase(), reviewedHash, "reviewed migration changed");
const approved = JSON.parse(readFileSync("config/test-target.json", "utf8"));
assert.equal(approved.projectRef, "mjtejwafxriwntweussc");
assert.equal(approved.databaseMarker, "fireworks-foundation-proof-01a12e38");
const env = parse(readFileSync(".secrets/operator.env"));
const target = assertTestTarget({ projectRef: env.TEST_PROJECT_REF, url: env.TEST_SUPABASE_URL, databaseUrl: env.TEST_DATABASE_URL }, approved);
const db = new pg.Client(testDatabaseConfig(env.TEST_DATABASE_URL, approved));
const tables = ["private.businesses", "private.shops", "private.memberships", "private.shop_assignments", "foundation_probe.environment_identity", "foundation_probe.resources", "foundation_probe.command_results", "foundation_probe.events"];

async function dataSnapshot() {
  const result = {};
  // Fixed allowlisted identifiers, never externally supplied. Digests stay in memory.
  for (const table of tables) {
    result[table] = (await db.query(`select count(*)::text as count, md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) as digest from ${table} t`)).rows[0];
  }
  for (const table of ["auth.users", "auth.sessions"]) {
    result[table] = (await db.query(`select count(*)::text as count, md5(coalesce(string_agg(id::text,'' order by id),'')) as identity_digest from ${table}`)).rows[0];
  }
  return result;
}

async function securitySnapshot() {
  return (await db.query(`select jsonb_build_object(
    'roles',(select jsonb_agg(jsonb_build_array(rolname,rolcanlogin,rolbypassrls,rolsuper,rolinherit) order by rolname) from pg_roles where rolname in ('app_authz','app_command')),
    'tables',(select jsonb_agg(jsonb_build_array(n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relowner) order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where (n.nspname in ('private','foundation_probe') and c.relkind='r') or c.oid in ('auth.users'::regclass,'auth.sessions'::regclass)),
    'authUsage',jsonb_build_array(has_schema_privilege('app_authz','auth','usage'),has_schema_privilege('app_command','auth','usage')),
    'roleAssumption',jsonb_build_array(pg_has_role('authenticated','app_command','member'),pg_has_role('authenticated','app_authz','member'))
  ) as state`)).rows[0].state;
}

let commitSent = false;
try {
  await db.connect();
  await db.query("begin isolation level repeatable read");
  await db.query("select pg_advisory_xact_lock(20261012,70606)");
  const identity = (await db.query("select current_user,session_user,(select marker from foundation_probe.environment_identity where singleton) as marker,txid_current()::text as tx")).rows[0];
  assert.equal(identity.current_user, "postgres");
  assert.equal(identity.session_user, "postgres");
  assert.equal(identity.marker, target.databaseMarker);
  const history = (await db.query("select version from supabase_migrations.schema_migrations order by version")).rows.map(r => r.version);
  assert.deepEqual(history, ["20261012053948", "20261012054416", "20261012060403", "20261012060628", "20261012060908"]);
  assert.equal((await db.query("select to_regprocedure('private.current_actor()') as adapter")).rows[0].adapter, null);
  const dataBefore = await dataSnapshot();
  const securityBefore = await securitySnapshot();
  await db.query(sql);
  await db.query("insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3::text[])", [version, name, [sql]]);
  assert.equal((await db.query("select txid_current()::text as tx")).rows[0].tx, identity.tx, "transaction changed during migration");
  assert.deepEqual(await dataSnapshot(), dataBefore, "records changed during migration");
  assert.deepEqual(await securitySnapshot(), securityBefore, "role/RLS/ownership safeguards changed");
  await db.query(readFileSync("supabase/tests/security_catalog.sql", "utf8"));
  if (mode === "--rollback-proof") {
    await db.query("rollback");
    assert.equal((await db.query("select to_regprocedure('private.current_actor()') as adapter")).rows[0].adapter, null);
    assert.equal((await db.query("select count(*)::int as count from supabase_migrations.schema_migrations where version=$1", [version])).rows[0].count, 0);
    assert.equal((await db.query("select count(*)::int as count from pg_policies where schemaname='auth' and tablename='sessions' and policyname='foundation_current_session'")).rows[0].count, 1);
    assert.equal((await db.query("select has_column_privilege('app_authz','auth.sessions','id','select') as allowed")).rows[0].allowed, true);
    assert.deepEqual(await dataSnapshot(), dataBefore);
    assert.deepEqual(await securitySnapshot(), securityBefore);
    console.log(JSON.stringify({ mode, project: target.projectRef, reviewedHash, singleTransaction: true, schemaAndHistoryRolledBack: true, recordsPreserved: true, safeguardsPreserved: true }));
  } else {
    commitSent = true;
    await db.query("commit");
    const stored = (await db.query("select name,statements from supabase_migrations.schema_migrations where version=$1", [version])).rows;
    assert.deepEqual(stored, [{ name, statements: [sql] }]);
    console.log(JSON.stringify({ mode, project: target.projectRef, reviewedHash, singleTransaction: true, commitAcknowledged: true, historyVerified: true, recordsPreserved: true, safeguardsPreserved: true }));
  }
} catch (error) {
  try { await db.query("rollback"); } catch { /* Connection may be lost. Never retry the migration automatically. */ }
  console.error(JSON.stringify({ status: commitSent ? "commit outcome must be checked; do not retry" : "migration not committed", code: typeof error?.code === "string" ? error.code : "operator-verification-failed" }));
  process.exitCode = 1;
} finally {
  await db.end();
}
