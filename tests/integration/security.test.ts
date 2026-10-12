import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { database } from "../support/hosted";
import type { Client } from "pg";

describe("hosted foundation security", () => {
  let db: Client;
  beforeAll(async () => { db = await database(); });
  afterAll(async () => { if (db) await db.end(); });

  it("provides the managed Auth schema access required by private roles", async () => {
    const { rows } = await db.query("select rolname, has_schema_privilege(rolname,'auth','usage') as auth_usage from pg_roles where rolname in ('app_authz','app_command') order by rolname");
    expect(rows).toEqual([
      { rolname: "app_authz", auth_usage: true },
      { rolname: "app_command", auth_usage: true },
    ]);
  });

  it("uses non-login non-bypass command/helper roles that do not own tables", async () => {
    const { rows } = await db.query("select rolname, rolcanlogin, rolbypassrls, rolsuper from pg_roles where rolname in ('app_command','app_authz') order by rolname");
    expect(rows).toEqual([
      { rolname: "app_authz", rolcanlogin: false, rolbypassrls: false, rolsuper: false },
      { rolname: "app_command", rolcanlogin: false, rolbypassrls: false, rolsuper: false },
    ]);
    const ownership = await db.query("select count(*)::int as count from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_roles r on r.oid=c.relowner where n.nspname in ('private','foundation_probe') and c.relkind='r' and r.rolname in ('app_command','app_authz')");
    expect(ownership.rows[0].count).toBe(0);
  });

  it("forces RLS on all private/probe tables and blocks anonymous commands", async () => {
    const { rows } = await db.query("select bool_and(c.relrowsecurity and c.relforcerowsecurity) as enforced, count(*)::int as count from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('private','foundation_probe') and c.relkind='r'");
    expect(rows[0].enforced).toBe(true);
    expect(rows[0].count).toBeGreaterThan(5);
    const grants = await db.query("select has_function_privilege('anon','api.foundation_increment(uuid,uuid,integer,uuid)','execute') as anonymous, has_table_privilege('authenticated','foundation_probe.resources','update') as direct_update, pg_has_role('authenticated','app_command','member') as command_membership");
    expect(grants.rows[0]).toEqual({ anonymous: false, direct_update: false, command_membership: false });
  });

  it("allows scoped membership locks without allowing membership updates", async () => {
    const { rows } = await db.query("select cmd,roles::text[] as roles,with_check from pg_policies where schemaname='private' and tablename='memberships' and policyname='command_membership_lock'");
    expect(rows).toEqual([{cmd:"UPDATE",roles:["app_command"],with_check:"false"}]);
  });

  it("provides only a scoped SELECT policy for the non-bypass session helper", async () => {
    const {rows}=await db.query("select cmd,roles::text[] as roles,qual from pg_policies where schemaname='auth' and tablename='sessions' and policyname='foundation_current_session'");
    expect(rows).toHaveLength(1);
    expect(rows[0].cmd).toBe("SELECT"); expect(rows[0].roles).toEqual(["app_authz"]);
    expect(rows[0].qual).toContain("auth.uid()"); expect(rows[0].qual).toContain("session_id");
    const flags=await db.query("select relrowsecurity,pg_get_userbyid(relowner) as owner from pg_class where oid='auth.sessions'::regclass");
    expect(flags.rows[0]).toEqual({relrowsecurity:true,owner:"supabase_auth_admin"});
  });
});
