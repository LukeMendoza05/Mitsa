import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll,beforeAll,describe,expect,it } from "vitest";
describe("Pending isolated mail policy (no provider configuration)",()=>{
  let db:PGlite;
  const uid=crypto.randomUUID(), recipient="foundation-mail-policy@example.invalid";
  const event=(overrides:Record<string,unknown>={})=>({user:{id:uid,email:recipient},email_data:{email_action_type:"signup",token_hash:"a".repeat(64),redirect_to:"http://127.0.0.1:3000/auth/email"},...overrides});
  const call=async(value:unknown=event())=>(await db.query<{result:{error?:unknown}}>("select private.mitsa_isolated_send_email($1::jsonb) result",[JSON.stringify(value)])).rows[0].result;
  const operator=()=>db.exec("reset role; set session authorization postgres");
  const auth=()=>db.exec("set session authorization supabase_auth_admin");
  beforeAll(async()=>{
    db=new PGlite();
    await db.exec(`create role anon nologin;create role authenticated nologin;create role service_role nologin;create role app_workspace nologin;create role supabase_auth_admin nologin;
      create schema private;create schema foundation_probe;create schema extensions;
      create table foundation_probe.environment_identity(singleton boolean,marker text);insert into foundation_probe.environment_identity values(true,'fireworks-foundation-proof-01a12e38');
      create table private.registration_test_recipients(email text,enabled boolean);create table private.registration_intents(provider_user_id uuid,email text,expires_at timestamptz,finalized_at timestamptz);
      grant usage on schema private to anon,authenticated,supabase_auth_admin;grant select on private.registration_test_recipients,private.registration_intents to supabase_auth_admin;
      -- Only policy tests use this stub. Real pgcrypto/OpenPGP interoperability
      -- is verified separately against the approved target in a READ ONLY tx.
      create function extensions.dearmor(text) returns bytea language sql as $$select convert_to($1,'UTF8')$$;
      create function extensions.pgp_pub_encrypt(text,bytea,text) returns bytea language sql as $$select convert_to($1,'UTF8')$$;`);
    // Local diagnostic text only; the real hook always returns a generic error.
    await db.exec(readFileSync("supabase/migrations/20261014015632_mitsa_isolated_auth_mail_capture.sql","utf8").replace("'Test mail unavailable.'","SQLERRM"));
    await db.exec(readFileSync("supabase/migrations/20261014021816_mitsa_capture_pkce_compatibility.sql","utf8"));
    await db.query("insert into private.registration_test_recipients values($1,true)",[recipient]);
    await db.query("insert into private.registration_intents values($1,$2,now()+interval '1 hour',null)",[uid,recipient]);
  },60000);
  afterAll(async()=>{if(db)await db.close();});
  it("fails closed without an enabled capture configuration",async()=>{
    await auth(); expect(await call()).toHaveProperty("error");
    await operator();expect((await db.query("select * from private.isolated_auth_mail")).rows).toHaveLength(0);
    await db.exec("update private.isolated_mail_config set public_key='-----BEGIN PGP PUBLIC KEY BLOCK-----test',enabled=true");
  });
  it("denies direct anonymous/authenticated access and allows only the managed hook role",async()=>{
    for(const role of ["anon","authenticated","service_role","app_workspace"]){
      await operator();await db.exec(`set role ${role}`);
      await expect(call()).rejects.toMatchObject({code:"42501"});
      await expect(db.query("select * from private.isolated_auth_mail")).rejects.toMatchObject({code:"42501"});
    }
    await operator();await auth();expect(await call()).toEqual({});
  });
  it("rejects real recipients, unlisted identities, wrong origins, missing hashes and unbound signup",async()=>{
    await auth();
    for(const value of [event({user:{id:uid,email:"person@example.com"}}),event({user:{id:uid,email:"foundation-unlisted@example.invalid"}}),event({user:{id:crypto.randomUUID(),email:recipient}}),event({email_data:{email_action_type:"signup",token_hash:"a".repeat(64),redirect_to:"https://attacker.example"}}),event({email_data:{email_action_type:"recovery",redirect_to:"http://127.0.0.1:3000/auth/email"}})])expect(await call(value)).toHaveProperty("error");
    await operator();expect((await db.query("select * from private.isolated_auth_mail")).rows).toHaveLength(1);
  });
  it("preserves the provider PKCE prefix without accepting arbitrary formats",async()=>{
    await auth();expect(await call(event({email_data:{email_action_type:"signup",token_hash:"pkce_"+"b".repeat(64),redirect_to:"http://127.0.0.1:3000/auth/email"}}))).toEqual({});
    expect(await call(event({email_data:{email_action_type:"signup",token_hash:"arbitrary_"+"b".repeat(64),redirect_to:"http://127.0.0.1:3000/auth/email"}}))).toHaveProperty("error");
  });
  it("enforces per-recipient limits and preserves closed capture on failure",async()=>{
    await auth();for(let i=2;i<10;i++)expect(await call()).toEqual({});
    expect(await call()).toHaveProperty("error");
    await operator();expect((await db.query("select * from private.isolated_auth_mail")).rows).toHaveLength(10);
    await db.exec("update private.isolated_mail_config set enabled=false");await auth();expect(await call()).toHaveProperty("error");
  });
  it("proposed code capture preserves ciphertext and encrypts only validated signup codes",async()=>{
    await operator();const historical=(await db.query("select id,encrypted_payload from private.isolated_auth_mail order by id")).rows;
    await db.exec("create table private.release_gates(singleton boolean,registration_enabled boolean,external_mail_enabled boolean,eligibility_approved boolean,legal_publication_enabled boolean,disposal_enabled boolean);insert into private.release_gates values(true,false,false,false,false,false);create function private.mitsa_test_recipient_allowed(text) returns boolean language sql as $$select exists(select 1 from private.registration_test_recipients where email=$1 and enabled)$$;grant execute on function private.mitsa_test_recipient_allowed(text) to supabase_auth_admin;");
    const definition=(await db.query<{definition:string}>("select pg_get_functiondef('private.mitsa_isolated_send_email(jsonb)'::regprocedure) definition")).rows[0].definition;
    await db.exec(definition.replace("or uid is null","or not private.mitsa_test_recipient_allowed(recipient) or uid is null"));
    await db.exec(readFileSync("supabase/migrations/20261014094354_mitsa_capture_verification_codes.sql","utf8"));
    expect((await db.query("select id,encrypted_payload from private.isolated_auth_mail order by id")).rows).toEqual(historical);
    const email="foundation-code-policy@example.invalid",id=crypto.randomUUID();await db.query("insert into private.registration_test_recipients values($1,true)",[email]);await db.query("insert into private.registration_intents values($1,$2,now()+interval '1 hour',null)",[id,email]);await db.exec("update private.isolated_mail_config set enabled=true");
    const value={user:{id,email},email_data:{email_action_type:"signup",token_hash:"d".repeat(64),token:"12345678",redirect_to:"http://127.0.0.1:3000/auth/email"}};
    await auth();expect(await call(value)).toEqual({});for(const token of ["","12345","1234x678","12345678901"])expect(await call({...value,email_data:{...value.email_data,token}})).toHaveProperty("error");
    await operator();const payload=(await db.query<{payload:string}>("select convert_from(encrypted_payload,'UTF8') payload from private.isolated_auth_mail where recipient_hash=encode(sha256(convert_to($1,'UTF8')),'hex')",[email])).rows;expect(payload).toHaveLength(1);expect(JSON.parse(payload[0].payload).code).toBe("12345678");
    await auth();expect(await call({...value,email_data:{...value.email_data,token:'123456'}})).toEqual({});await operator();const six=(await db.query<{payload:string}>("select convert_from(encrypted_payload,'UTF8') payload from private.isolated_auth_mail where recipient_hash=encode(sha256(convert_to($1,'UTF8')),'hex') order by created_at desc limit 1",[email])).rows;expect(JSON.parse(six[0].payload).code).toBe('123456');
    // pgcrypto is a policy-only stub here; hosted encryption was already tested.
    // The migration never changes recovery behavior or capture/recipient controls.
    await auth();expect(await call({...value,email_data:{...value.email_data,email_action_type:"recovery"}})).toEqual({});await operator();const recovery=(await db.query<{payload:string}>("select convert_from(encrypted_payload,'UTF8') payload from private.isolated_auth_mail where action='recovery'")).rows;expect(JSON.parse(recovery[0].payload).code).toBeUndefined();
  });
});


