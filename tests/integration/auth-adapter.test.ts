import { beforeAll, describe, expect, it } from "vitest";
import { database, hostedConfig, publicClient } from "../support/hosted";
import { resource, securityFixture } from "../support/fixtures";

describe("verified request authentication adapter",()=>{
  let f:Awaited<ReturnType<typeof securityFixture>>;
  beforeAll(async()=>{f=await securityFixture();},120000);
  const command=(id:string,key=crypto.randomUUID())=>publicClient(f.cashier.session.access_token).schema("api").rpc("foundation_increment",{p_business:f.business,p_resource:id,p_delta:1,p_key:key});

  it("returns only the current identity through the approved wrapper and hides Auth internals",async()=>{
    const client=publicClient(f.cashier.session.access_token);
    const result=await client.schema("api").rpc("foundation_identity");
    expect(result.error).toBeNull();
    expect(result.data).toEqual({userId:f.cashier.id,memberships:[{businessId:f.business,role:"staff"}]});
    expect((await client.schema("api").rpc("current_actor")).error?.code).toBe("PGRST202");
    expect((await client.schema("private").rpc("current_actor")).error?.code).toBe("PGRST106");
    expect((await client.schema("auth").from("sessions").select("*")).error?.code).toBe("PGRST106");
    expect((await client.schema("api").rpc("set_config",{setting_name:"request.jwt.claims",new_value:"{}",is_local:true})).error?.code).toBe("PGRST202");
  });

  it("ignores caller identity headers and rejects extra actor parameters",async()=>{
    const cfg=hostedConfig();
    const response=await fetch(`${cfg.url}/rest/v1/rpc/foundation_identity`,{method:"POST",headers:{apikey:cfg.publishableKey,Authorization:`Bearer ${f.cashier.session.access_token}`,"Content-Type":"application/json","Content-Profile":"api","x-user-id":f.owner.id,"request.jwt.claims":JSON.stringify({sub:f.owner.id,role:"authenticated"})},body:"{}"});
    expect(response.status).toBe(200); expect((await response.json()).userId).toBe(f.cashier.id);
    const id=await resource(f.business,f.shop);
    expect((await publicClient(f.cashier.session.access_token).schema("api").rpc("foundation_increment",{p_business:f.business,p_resource:id,p_delta:1,p_key:crypto.randomUUID(),p_actor:f.owner.id})).error?.code).toBe("PGRST202");
    expect((await command(id)).error).toBeNull();
    const db=await database();
    try { expect((await db.query("select actor_id from foundation_probe.events where resource_id=$1",[id])).rows).toEqual([{actor_id:f.cashier.id}]); }
    finally { await db.end(); }
  });

  it("rejects missing, malformed and tampered signed contexts before any mutation",async()=>{
    const id=await resource(f.business,f.shop),cfg=hostedConfig();
    const parts=f.cashier.session.access_token.split(".");
    const claims=JSON.parse(Buffer.from(parts[1],"base64url").toString("utf8"));
    const changed=[{...claims,sub:f.owner.id},{...claims,session_id:undefined},{...claims,session_id:"malformed"},{...claims,exp:1}];
    const tokens=[undefined,"not-a-jwt",...changed.map(c=>`${parts[0]}.${Buffer.from(JSON.stringify(c)).toString("base64url")}.${parts[2]}`)];
    for(const token of tokens) {
      const response=await fetch(`${cfg.url}/rest/v1/rpc/foundation_increment`,{method:"POST",headers:{apikey:cfg.publishableKey,"Content-Type":"application/json","Content-Profile":"api",...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({p_business:f.business,p_resource:id,p_delta:1,p_key:crypto.randomUUID()})});
      expect(response.status).toBe(401);
    }
    const db=await database();
    try { expect((await db.query("select value from foundation_probe.resources where id=$1",[id])).rows[0].value).toBe(0); }
    finally { await db.end(); }
  });

  it("rejects an expired managed session while its original signed JWT remains valid",async()=>{
    const id=await resource(f.business,f.shop),db=await database();
    const sessionId=JSON.parse(Buffer.from(f.cashier.session.access_token.split(".")[1],"base64url").toString("utf8")).session_id;
    const prior=(await db.query("select not_after from auth.sessions where id=$1 and user_id=$2",[sessionId,f.cashier.id])).rows[0];
    expect(prior).toBeDefined();
    try {
      expect((await command(id)).error).toBeNull();
      await db.query("update auth.sessions set not_after=now()-interval '1 minute' where id=$1 and user_id=$2",[sessionId,f.cashier.id]);
      expect((await command(id)).error?.code).toBe("42501");
      expect((await db.query("select value from foundation_probe.resources where id=$1",[id])).rows[0].value).toBe(1);
    } finally { await db.query("update auth.sessions set not_after=$3 where id=$1 and user_id=$2",[sessionId,f.cashier.id,prior.not_after]); await db.end(); }
  });

  it("rejects anonymous, banned and deleted Auth users despite a previously issued JWT",async()=>{
    const id=await resource(f.business,f.shop),db=await database();
    const prior=(await db.query("select is_anonymous,banned_until,deleted_at from auth.users where id=$1",[f.cashier.id])).rows[0];
    try {
      expect((await command(id)).error).toBeNull();
      for(const flags of [[true,null,null],[false,new Date(Date.now()+600000),null],[false,null,new Date()]] as const) {
        await db.query("update auth.users set is_anonymous=$2,banned_until=$3,deleted_at=$4 where id=$1",[f.cashier.id,...flags]);
        expect((await command(id)).error?.code).toBe("42501");
        await db.query("update auth.users set is_anonymous=$2,banned_until=$3,deleted_at=$4 where id=$1",[f.cashier.id,prior.is_anonymous,prior.banned_until,prior.deleted_at]);
      }
      expect((await db.query("select value from foundation_probe.resources where id=$1",[id])).rows[0].value).toBe(1);
    } finally { await db.query("update auth.users set is_anonymous=$2,banned_until=$3,deleted_at=$4 where id=$1",[f.cashier.id,prior.is_anonymous,prior.banned_until,prior.deleted_at]); await db.end(); }
  });

  it("rejects new protected commands after real Auth sign-out",async()=>{
    const id=await resource(f.business,f.shop);
    expect((await command(id)).error).toBeNull();
    const auth=publicClient();
    expect((await auth.auth.setSession({access_token:f.cashier.session.access_token,refresh_token:f.cashier.session.refresh_token})).error).toBeNull();
    expect((await auth.auth.signOut({scope:"global"})).error).toBeNull();
    expect((await command(id)).error?.code).toBe("42501");
    const db=await database();
    try { expect((await db.query("select value from foundation_probe.resources where id=$1",[id])).rows[0].value).toBe(1); }
    finally { await db.end(); }
  });
});
