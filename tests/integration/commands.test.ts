import { beforeAll, describe, expect, it } from "vitest";
import { asUser, database, hostedConfig, publicClient } from "../support/hosted";
import { resource, securityFixture } from "../support/fixtures";
import type { Client } from "pg";

describe("real hosted command and authorization proof", () => {
  let f: Awaited<ReturnType<typeof securityFixture>>;
  beforeAll(async () => { f = await securityFixture(); },120000);
  const rpc = (token: string,business: string,id: string,delta: number,key=crypto.randomUUID()) => publicClient(token).schema("api").rpc("foundation_increment",{p_business:business,p_resource:id,p_delta:delta,p_key:key});

  it("restricts actual JWT reads and commands by business and assigned shop", async () => {
    const a=await resource(f.business,f.shop), b=await resource(f.business,f.secondShop), other=await resource(f.otherBusiness,f.otherShop);
    const cashier=publicClient(f.cashier.session.access_token);
    const read=await cashier.schema("api").from("foundation_resources").select("id").in("id",[a,b,other]);
    expect(read.error).toBeNull(); expect(read.data).toEqual([{id:a}]);
    expect((await rpc(f.cashier.session.access_token,f.business,a,1)).error).toBeNull();
    expect((await rpc(f.cashier.session.access_token,f.business,b,1)).error?.code).toBe("42501");
    expect((await rpc(f.cashier.session.access_token,f.otherBusiness,other,1)).error?.code).toBe("42501");
    expect((await rpc(f.owner.session.access_token,f.business,b,1)).error).toBeNull();
    expect((await rpc(f.manager.session.access_token,f.business,b,1)).error?.code).toBe("42501");
    const anonymous=await publicClient().schema("api").rpc("foundation_increment",{p_business:f.business,p_resource:a,p_delta:1,p_key:crypto.randomUUID()});
    expect(anonymous.error).not.toBeNull();
    expect((await cashier.schema("private").from("memberships").select("*")).error).not.toBeNull();
  });

  it("keeps owner-only ordinary prices separate from manager discount approval", async () => {
    for (const [user,price,discount] of [[f.owner,true,true],[f.manager,false,true],[f.cashier,false,false]] as const) {
      const db=await database();
      try { await asUser(db,user.session.access_token);
        const result=await db.query("select private.has_shop_access($1,$2,'ordinary_price') as price, private.has_shop_access($1,$2,'discount') as discount",[f.business,f.shop]);
        expect(result.rows[0]).toEqual({price,discount});
      } finally { await db.query("rollback"); await db.end(); }
    }
  });

  it("ignores user-editable role metadata", async () => {
    const cfg=hostedConfig();
    const response=await fetch(`${cfg.url}/auth/v1/user`,{method:"PUT",headers:{apikey:cfg.publishableKey,Authorization:`Bearer ${f.cashier.session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({data:{role:"owner",shop_id:f.secondShop}})});
    expect(response.status).toBe(200);
    const db=await database();
    try { await asUser(db,f.cashier.session.access_token);
      expect((await db.query("select private.has_shop_access($1,$2,'ordinary_price') as allowed",[f.business,f.shop])).rows[0].allowed).toBe(false);
    } finally { await db.query("rollback"); await db.end(); }
  });

  it("replays a command once and rejects changed payloads", async () => {
    const id=await resource(f.business,f.shop), key=crypto.randomUUID();
    const first=await rpc(f.cashier.session.access_token,f.business,id,1,key);
    const repeated=await rpc(f.cashier.session.access_token,f.business,id,1,key);
    expect(first.error).toBeNull(); expect(repeated.data).toEqual(first.data);
    expect((await rpc(f.cashier.session.access_token,f.business,id,2,key)).error?.code).toBe("23505");
    const db=await database();
    try {
      const state=await db.query("select r.value,(select count(*)::int from foundation_probe.events e where e.resource_id=r.id) as events from foundation_probe.resources r where r.id=$1",[id]);
      expect(state.rows[0]).toEqual({value:1,events:1});
      await expect(db.query("update foundation_probe.events set delta=2 where resource_id=$1",[id])).rejects.toMatchObject({code:"55000"});
    } finally { await db.end(); }
  });

  it("denies direct writes and does not grant authenticated permission to assume custom roles", async () => {
    const id=await resource(f.business,f.shop), db=await database();
    try {
      await asUser(db,f.cashier.session.access_token);
      await expect(db.query("update foundation_probe.resources set value=99 where id=$1",[id])).rejects.toMatchObject({code:"42501"});
      await db.query("rollback"); await asUser(db,f.cashier.session.access_token);
      // SET ROLE on this operator connection is authorized by session_user
      // postgres, so executing it cannot prove authenticated's SET permission.
      const roles=await db.query("select current_user as actor, session_user as operator, pg_has_role('authenticated','app_command','SET') as command, pg_has_role('authenticated','app_authz','SET') as authz");
      expect(roles.rows[0]).toEqual({actor:"authenticated",operator:"postgres",command:false,authz:false});
    } finally { await db.query("rollback"); await db.end(); }
  });

  it("rolls back projection, command result and history when audit insertion fails", async () => {
    const id=await resource(f.business,f.shop), key=crypto.randomUUID(), db=await database();
    try {
      await db.query("create function foundation_probe.test_audit_failure() returns trigger language plpgsql as $$ begin if new.resource_id::text=TG_ARGV[0] then raise exception 'injected audit failure'; end if; return new; end $$");
      await db.query(`create trigger proof_audit_fault before insert on foundation_probe.events for each row execute function foundation_probe.test_audit_failure('${id}')`);
      expect((await rpc(f.cashier.session.access_token,f.business,id,1,key)).error?.code).toBe("P0001");
      expect((await db.query("select value from foundation_probe.resources where id=$1",[id])).rows[0].value).toBe(0);
      expect((await db.query("select count(*)::int as count from foundation_probe.command_results where command_key=$1",[key])).rows[0].count).toBe(0);
    } finally {
      await db.query("drop trigger if exists proof_audit_fault on foundation_probe.events");
      await db.query("drop function if exists foundation_probe.test_audit_failure()"); await db.end();
    }
  });

  async function waitLocked(observer: Client,pid: number) {
    const deadline=Date.now()+10000;
    while(Date.now()<deadline) {
      const {rows}=await observer.query("select wait_event_type from pg_stat_activity where pid=$1",[pid]);
      if(rows[0]?.wait_event_type==="Lock") return;
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    throw new Error("Independent PostgreSQL connection did not reach the expected row/advisory lock");
  }

  async function concurrent(duplicate: boolean) {
    const id=await resource(f.business,f.shop,duplicate?0:1), key=crypto.randomUUID();
    const holder=await database(), a=await database(), b=await database();
    try {
      await holder.query("begin"); await holder.query("select id from foundation_probe.resources where id=$1 for update",[id]);
      const aPid=(await a.query("select pg_backend_pid() as pid")).rows[0].pid;
      const bPid=(await b.query("select pg_backend_pid() as pid")).rows[0].pid;
      await asUser(a,f.cashier.session.access_token); await asUser(b,f.cashier.session.access_token);
      const query="select api.foundation_increment($1,$2,$3,$4) as result";
      const first=a.query(query,[f.business,id,duplicate?1:-1,key]);
      const second=b.query(query,[f.business,id,duplicate?1:-1,duplicate?key:crypto.randomUUID()]);
      // Register rejection handlers immediately while both real connections are blocked.
      const outcomes=Promise.allSettled([first,second]);
      await waitLocked(holder,aPid); await waitLocked(holder,bPid);
      await holder.query("commit");
      first.then(()=>a.query("commit"),()=>a.query("rollback"));
      second.then(()=>b.query("commit"),()=>b.query("rollback"));
      const result=await outcomes;
      await a.query("rollback"); await b.query("rollback");
      if(duplicate) expect(result.every(x=>x.status==="fulfilled")).toBe(true);
      else {
        expect(result.filter(x=>x.status==="fulfilled")).toHaveLength(1);
        expect(result.find(x=>x.status==="rejected")).toMatchObject({reason:{code:"23514"}});
      }
      const state=await holder.query("select r.value,(select count(*)::int from foundation_probe.events e where e.resource_id=r.id) as events from foundation_probe.resources r where r.id=$1",[id]);
      expect(state.rows[0]).toEqual({value:duplicate?1:0,events:1});
    } finally { await holder.query("rollback"); await a.query("rollback"); await b.query("rollback"); await Promise.all([holder.end(),a.end(),b.end()]); }
  }

  it("serializes simultaneous duplicate requests on real PostgreSQL connections",async()=>concurrent(true));
  it("allows exactly one last-unit command without a negative balance",async()=>concurrent(false));

  it("denies revoked membership immediately despite a still-signed JWT",async()=>{
    const id=await resource(f.business,f.shop),db=await database();
    try {
      await db.query("update private.memberships set active=false where business_id=$1 and user_id=$2",[f.business,f.cashier.id]);
      expect((await rpc(f.cashier.session.access_token,f.business,id,1)).error?.code).toBe("42501");
      expect((await publicClient(f.cashier.session.access_token).schema("api").from("foundation_resources").select("id")).data).toEqual([]);
    } finally { await db.query("update private.memberships set active=true where business_id=$1 and user_id=$2",[f.business,f.cashier.id]); await db.end(); }
  });

  it("denies a revoked shop assignment despite a still-signed JWT",async()=>{
    const id=await resource(f.business,f.shop),db=await database();
    try {
      await db.query("delete from private.shop_assignments where business_id=$1 and user_id=$2 and shop_id=$3",[f.business,f.cashier.id,f.shop]);
      expect((await rpc(f.cashier.session.access_token,f.business,id,1)).error?.code).toBe("42501");
      expect((await publicClient(f.cashier.session.access_token).schema("api").from("foundation_resources").select("id")).data).toEqual([]);
    } finally { await db.query("insert into private.shop_assignments values($1,$2,$3) on conflict do nothing",[f.business,f.cashier.id,f.shop]); await db.end(); }
  });

  it("serializes membership revocation after an in-flight command",async()=>{
    const id=await resource(f.business,f.shop),command=await database(),revoker=await database(),observer=await database();
    let revocation: Promise<unknown> | undefined;
    try {
      await asUser(command,f.cashier.session.access_token);
      await command.query("select api.foundation_increment($1,$2,1,$3)",[f.business,id,crypto.randomUUID()]);
      const pid=(await revoker.query("select pg_backend_pid() as pid")).rows[0].pid;
      await revoker.query("begin");
      revocation=revoker.query("update private.memberships set active=false where business_id=$1 and user_id=$2",[f.business,f.cashier.id]);
      // Register a handler immediately; still await the original result below.
      void revocation.catch(()=>{});
      await waitLocked(observer,pid);
      await command.query("commit");
      await revocation; await revoker.query("commit");
      expect((await rpc(f.cashier.session.access_token,f.business,id,1)).error?.code).toBe("42501");
      expect((await observer.query("select value from foundation_probe.resources where id=$1",[id])).rows[0].value).toBe(1);
    } finally {
      await command.query("rollback");
      if(revocation) await Promise.allSettled([revocation]);
      await revoker.query("rollback");
      await observer.query("update private.memberships set active=true where business_id=$1 and user_id=$2",[f.business,f.cashier.id]);
      await Promise.all([command.end(),revoker.end(),observer.end()]);
    }
  });

  it("reconciles every synthetic movement with its current projection",async()=>{
    const db=await database();
    try { const {rows}=await db.query("select r.id from foundation_probe.resources r left join foundation_probe.events e on e.resource_id=r.id group by r.id having r.value<>r.initial_value+coalesce(sum(e.delta),0)"); expect(rows).toEqual([]); }
    finally { await db.end(); }
  });
});
