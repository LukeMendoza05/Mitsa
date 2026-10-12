import {afterAll,afterEach,beforeAll,beforeEach,describe,expect,it} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {readFileSync,readdirSync} from "node:fs";

// This executes the unchanged migration function in isolated PostgreSQL/WASM.
// Synthetic trusted contexts test its branches; real JWT verification is hosted.
describe("private actor adapter SQL branches",()=>{
  let db:PGlite;
  const actor="11111111-1111-4111-8111-111111111111";
  const other="22222222-2222-4222-8222-222222222222";
  const session="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const otherSession="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const valid={sub:actor,session_id:session,role:"authenticated",aud:"authenticated",is_anonymous:false,exp:4102444800};
  const current=async()=> (await db.query<{actor:string|null}>("select private.current_actor() as actor")).rows[0].actor;
  const context=async()=>{await db.exec("set session authorization authenticator; set role authenticated");};

  beforeAll(async()=>{
    db=new PGlite();
    await db.exec(`create role authenticator login noinherit;
      create role authenticated nologin; create role anon nologin;
      create role app_authz nologin nobypassrls; create role app_command nologin nobypassrls;
      grant authenticated to authenticator;
      create schema private; create schema auth;
      grant usage on schema private to authenticated,app_authz,app_command;
      create table auth.users(id uuid primary key,is_anonymous boolean not null default false,deleted_at timestamptz,banned_until timestamptz);
      create table auth.sessions(id uuid primary key,user_id uuid references auth.users,not_after timestamptz);
      insert into auth.users(id) values ('${actor}'),('${other}');
      insert into auth.sessions(id,user_id) values ('${session}','${actor}'),('${otherSession}','${other}');`);
    const file=readdirSync("supabase/migrations").find(n=>n.endsWith("_foundation_verified_actor_adapter.sql"));
    if(!file) throw new Error("adapter migration missing");
    const sql=readFileSync(`supabase/migrations/${file}`,"utf8").match(/create function private\.current_actor\(\)[\s\S]*?grant execute on function private\.current_actor\(\) to authenticated, app_authz, app_command;/)?.[0];
    if(!sql) throw new Error("adapter migration definition missing");
    await db.exec(sql);
  },30000);
  beforeEach(async()=>{await db.exec("begin");await context();await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(valid)]);});
  afterEach(async()=>{await db.exec("rollback; reset role; set session authorization postgres");});
  afterAll(async()=>{if(db) await db.close();});

  it("returns one active actor UUID from the exact adapter definition",async()=>{expect(await current()).toBe(actor);});

  it.each([
    ["absent context",""], ["malformed JSON","{"], ["non-object JSON","[]"],
    ["missing session",JSON.stringify({...valid,session_id:undefined})],
    ["malformed session",JSON.stringify({...valid,session_id:"invalid"})],
    ["malformed actor",JSON.stringify({...valid,sub:"invalid"})],
    ["unknown actor",JSON.stringify({...valid,sub:"33333333-3333-4333-8333-333333333333"})],
    ["mismatched actor/session",JSON.stringify({...valid,session_id:otherSession})],
    ["missing audience",JSON.stringify({...valid,aud:undefined})],
    ["wrong audience",JSON.stringify({...valid,aud:"service_role"})],
    ["wrong role",JSON.stringify({...valid,role:"service_role"})],
    ["anonymous claim",JSON.stringify({...valid,is_anonymous:true})],
    ["missing anonymous status",JSON.stringify({...valid,is_anonymous:undefined})],
    ["expired token",JSON.stringify({...valid,exp:1})],
    ["missing expiry",JSON.stringify({...valid,exp:undefined})],
    ["malformed expiry",JSON.stringify({...valid,exp:"tomorrow"})],
    ["future not-before",JSON.stringify({...valid,nbf:4102444800})],
    ["malformed not-before",JSON.stringify({...valid,nbf:"yesterday"})],
  ])("denies %s without leaking Auth data",async(_label,claims)=>{
    await db.query("select set_config('request.jwt.claims',$1,true)",[claims]);
    expect(await current()).toBeNull();
  });

  it("accepts an authenticated audience array",async()=>{
    await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({...valid,aud:["authenticated"]})]);
    expect(await current()).toBe(actor);
  });

  it.each([
    ["missing session row",`delete from auth.sessions where id='${session}'`],
    ["expired session row",`update auth.sessions set not_after='2000-01-01' where id='${session}'`],
    ["anonymous user",`update auth.users set is_anonymous=true where id='${actor}'`],
    ["deleted user",`update auth.users set deleted_at='2000-01-01' where id='${actor}'`],
    ["banned user",`update auth.users set banned_until='2100-01-01' where id='${actor}'`],
  ])("denies %s",async(_label,mutation)=>{
    await db.exec("reset role; set session authorization postgres");
    await db.exec(mutation);await context();
    expect(await current()).toBeNull();
  });

  it("denies direct SQL even with otherwise valid copied claims",async()=>{
    await db.exec("reset role; set session authorization postgres; set role authenticated");
    expect(await current()).toBeNull();
  });
});
