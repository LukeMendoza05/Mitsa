import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, database, createSyntheticUser } from "../support/hosted";
import type { Client } from "pg";

describe("hosted foundation security", () => {
  let db: Client;
  beforeAll(async () => { db = await database(); });
  afterAll(async () => { if (db) await db.end(); });

  it("keeps managed Auth inaccessible to private business roles", async () => {
    const { rows } = await db.query("select rolname, has_schema_privilege(rolname,'auth','usage') as auth_usage from pg_roles where rolname in ('app_authz','app_command') order by rolname");
    expect(rows).toEqual([
      { rolname: "app_authz", auth_usage: false },
      { rolname: "app_command", auth_usage: false },
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

  it("removes obsolete helper access without changing managed Auth ownership or RLS", async () => {
    const {rows}=await db.query("select policyname from pg_policies where schemaname='auth' and policyname='foundation_current_session'");
    expect(rows).toEqual([]);
    expect((await db.query("select has_column_privilege('app_authz','auth.sessions','id','select') as allowed")).rows[0].allowed).toBe(false);
    const flags=await db.query("select relrowsecurity,pg_get_userbyid(relowner) as owner from pg_class where oid='auth.sessions'::regclass");
    expect(flags.rows[0]).toEqual({relrowsecurity:true,owner:"supabase_auth_admin"});
  });

  it("limits the private no-argument actor adapter to its reviewed boundary", async () => {
    const {rows}=await db.query("select p.pronargs, p.prorettype::regtype::text as returns, p.prosecdef, pg_get_userbyid(p.proowner) as owner, p.proconfig from pg_proc p where p.oid=to_regprocedure('private.current_actor()')");
    expect(rows).toEqual([{pronargs:0,returns:"uuid",prosecdef:true,owner:"postgres",proconfig:['search_path=""','row_security=on']}]);
    const acl=await db.query("select grantee::regrole::text as grantee, privilege_type, is_grantable from pg_proc p, lateral aclexplode(p.proacl) where p.oid='private.current_actor()'::regprocedure order by grantee::regrole::text");
    expect(acl.rows).toEqual(["app_authz","app_command","authenticated","postgres"].map(grantee=>({grantee,privilege_type:"EXECUTE",is_grantable:false})));
    const exposed=await db.query("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='api' order by p.proname");
    expect(exposed.rows.map(r=>r.proname)).toEqual(["foundation_capabilities","foundation_identity","foundation_increment"]);
  });

  it("denies operator-injected claims rather than treating SET ROLE as verified authentication", async () => {
    const user=await createSyntheticUser("context-negative");
    try {
      await asUser(db,user.session.access_token);
      expect((await db.query("select private.current_actor() as actor")).rows[0].actor).toBeNull();
      await db.query("select set_config('request.jwt.claims','not-json',true)");
      expect((await db.query("select private.current_actor() as actor")).rows[0].actor).toBeNull();
    } finally { await db.query("rollback"); }
  },30000);
});
