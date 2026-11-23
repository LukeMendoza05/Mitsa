import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { parse } from "dotenv";
import pg from "pg";
import { assertTestTarget } from "./test-target.mjs";
import { testDatabaseConfig } from "./postgres-config.mjs";

const name = process.argv[2];
assert(/^workspace-before-[0-9]+\.json$/.test(name ?? ""), "explicit recovery snapshot basename required");
const snapshot = JSON.parse(readFileSync(`.secrets/recovery/${name}`, "utf8"));
const approved = JSON.parse(readFileSync("config/test-target.json", "utf8"));
const env = parse(readFileSync(".secrets/operator.env"));
const target = assertTestTarget({ projectRef: env.TEST_PROJECT_REF, url: env.TEST_SUPABASE_URL, databaseUrl: env.TEST_DATABASE_URL }, approved);
assert.equal(snapshot.project, target.projectRef);
const db = new pg.Client(testDatabaseConfig(env.TEST_DATABASE_URL, approved));
try {
  await db.connect();
  await db.query("begin isolation level repeatable read read only");
  assert.equal((await db.query("select marker from foundation_probe.environment_identity where singleton")).rows[0]?.marker, target.databaseMarker);
  let preserved = 0;
  const tables = Object.keys(snapshot.tables);
  for (const table of tables) {
    assert(/^(private|foundation_probe)\.[a-z_]+$/.test(table), "unexpected snapshot relation");
    const original = snapshot.tables[table];
    const current = (await db.query(`select to_jsonb(t) row from ${table} t`)).rows.map(r => r.row);
    for (const before of original) {
      const expected = { ...before };
      if (table === "private.memberships") expected.role = ({ manager: "admin", cashier: "staff" })[before.role] ?? before.role;
      if (table === "private.release_gates" && expected.test_terms_id === null && current[0]?.test_terms_id) {
        // Test fixtures may initialize only the synthetic agreement pointer.
        const policy = (await db.query("select status,version from private.legal_versions where id=$1", [current[0].test_terms_id])).rows[0];
        assert.deepEqual(policy, { status: "test", version: "isolated-synthetic-v1" });
        expected.test_terms_id = current[0].test_terms_id;
      }
      const matches = current.some(row => Object.entries(expected).every(([key, value]) => JSON.stringify(row[key]) === JSON.stringify(value)));
      assert(matches, `original record or relationship changed in ${table}`);
      preserved++;
    }
  }
  const state = (await db.query(`select jsonb_build_object(
    'forcedRls',(select bool_and(c.relrowsecurity and c.relforcerowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('private','foundation_probe') and c.relkind='r'),
    'invalidOwners',(select count(*) from private.businesses b where b.status='active' and ((select count(*) from private.memberships m where m.business_id=b.id and m.active and m.role='owner')<>1 or not exists(select 1 from private.memberships m where m.business_id=b.id and m.user_id=b.primary_owner_id and m.active and m.role='owner'))),
    'legacyRoles',(select count(*) from private.memberships where role not in ('owner','admin','staff')),
    'unsafeRoles',(select count(*) from pg_roles where rolname in ('app_authz','app_command','app_workspace') and (rolbypassrls or rolsuper or rolcanlogin or has_schema_privilege(rolname,'auth','usage') or has_schema_privilege(rolname,'private','create') or pg_has_role('authenticated',rolname,'member'))),
    'openReleaseGates',(select registration_enabled or external_mail_enabled or legal_publication_enabled or disposal_enabled or eligibility_approved from private.release_gates where singleton)
  ) state`)).rows[0].state;
  assert.deepEqual(state, { forcedRls: true, invalidOwners: 0, legacyRoles: 0, unsafeRoles: 0, openReleaseGates: false });
  await db.query("commit");
  console.log(JSON.stringify({ project: target.projectRef, originalRecordsPreserved: preserved, ...state }));
} catch (error) {
  try { await db.query("rollback"); } catch { /* Read-only, no retry. */ }
  console.error(error instanceof assert.AssertionError ? error.message : "postflight failed");
  process.exitCode = 1;
} finally { await db.end(); }
