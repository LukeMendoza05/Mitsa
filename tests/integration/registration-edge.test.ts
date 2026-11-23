import {beforeAll,afterAll,describe,expect,it} from "vitest";
import {existsSync,readFileSync,mkdirSync,writeFileSync} from "node:fs";
import {parse} from "dotenv";
import {database,hostedConfig,publicClient} from "../support/hosted";
import {hash,signIntentRequest} from "../../supabase/functions/_shared/registration-intent-auth";

// Explicit deployment smoke test: private key remains in ignored files and is
// never loaded into process.env, browser code, logs or report artifacts.
describe("deployed isolated registration-intent function",()=>{
  if (!existsSync(".secrets/registration-intent.env")) throw new Error("Deployed Edge smoke tests require the approved isolated .secrets/registration-intent.env configuration. Do not deploy or configure another project to make tests pass.");
  const settings=parse(readFileSync(".secrets/registration-intent.env"));
  const endpoint="https://mjtejwafxriwntweussc.supabase.co/functions/v1/mitsa-registration-intent";
  const email=`foundation-edge-smoke-${crypto.randomUUID()}@example.invalid`;
  const results:Array<{check:string;status:number}>=[];
  let terms:string;
  let successfulIntent:string;
  let successfulNonceHash:string;
  let noProviderUserCreated=false;
  let releaseGatesClosed=false;
  const input=()=>({email,fullName:"Synthetic deployed smoke",termsVersion:terms,accepted:true});
  async function envelope(options:{input?:unknown;body?:string;signBody?:string;secret?:string;timestamp?:number;unsigned?:boolean;origin?:string;key?:string}={}){
    const body=options.body??JSON.stringify(options.input??input());
    const signed=options.unsigned?{}:await signIntentRequest(options.secret??settings.MITSA_REGISTRATION_INTENT_KEY,options.signBody??body,options.timestamp);
    return {body,headers:{origin:options.origin??settings.MITSA_APP_ORIGIN,apikey:options.key??settings.MITSA_PUBLISHABLE_KEY,"content-type":"application/json",...signed}};
  }
  async function send(check:string,request:Awaited<ReturnType<typeof envelope>>){
    const response=await fetch(endpoint,{method:"POST",...request,signal:AbortSignal.timeout(20000)});
    results.push({check,status:response.status});
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    return response;
  }
  beforeAll(async()=>{
    const cfg=hostedConfig(); expect(cfg.projectRef).toBe("mjtejwafxriwntweussc");
    expect(settings.MITSA_PUBLISHABLE_KEY===cfg.publishableKey).toBe(true);
    expect(/^[0-9a-f]{64}$/.test(settings.MITSA_REGISTRATION_INTENT_KEY)).toBe(true);
    const local=parse(readFileSync(".env.local"));
    expect(local.MITSA_REGISTRATION_INTENT_KEY===settings.MITSA_REGISTRATION_INTENT_KEY).toBe(true);
    const db=await database();
    try{
      const state=(await db.query("select g.*,v.status terms_status from private.release_gates g join private.legal_versions v on v.id=g.test_terms_id where g.singleton")).rows[0];
      expect([state.registration_enabled,state.external_mail_enabled,state.legal_publication_enabled,state.eligibility_approved,state.disposal_enabled]).toEqual([false,false,false,false,false]);
      expect(state.terms_status).toBe("test"); terms=state.test_terms_id;
      await db.query("insert into private.registration_test_recipients(email,enabled) values($1,true)",[email]);
    }finally{await db.end();}
  },120000);
  afterAll(async()=>{
    const db=await database();
    let syntheticRecipientDisabled=false;
    try{syntheticRecipientDisabled=(await db.query("update private.registration_test_recipients set enabled=false where email=$1 returning email",[email])).rowCount===1;}
    finally{await db.end();}
    mkdirSync("artifacts",{recursive:true});
    writeFileSync("artifacts/registration-edge-smoke.json",JSON.stringify({project:"mjtejwafxriwntweussc",function:"mitsa-registration-intent",executedAt:new Date().toISOString(),checks:results,syntheticRecipientDisabled,noProviderUserCreated,releaseGatesClosed},null,2));
  },60000);
  it("rejects unsigned, forged and time-expired requests at the live gateway",async()=>{
    for(const [label,options] of [
      ["unsigned correct API key and Origin",{unsigned:true}],
      ["wrong signing key",{secret:"fa".repeat(32)}],
      ["expired signature",{timestamp:Math.floor(Date.now()/1000)-61}],
      // Keep this beyond the clock window even after preceding live requests.
      // Exact 60-second boundaries are covered by deterministic local tests.
      ["future signature",{timestamp:Math.floor(Date.now()/1000)+300}],
      ["wrong public key",{key:"invalid"}],
    ] as const) expect((await send(label,await envelope(options))).status).toBe(401);
    expect((await send("wrong Origin",await envelope({origin:"https://attacker.example"}))).status).toBe(403);
  },90000);
  it("rejects body tampering, unchecked Terms, role injection and malformed/oversized input",async()=>{
    expect((await send("tampered recipient",await envelope({input:{...input(),email:"foundation-tampered@example.invalid"},signBody:JSON.stringify(input())}))).status).toBe(401);
    for(const [label,value] of [
      ["unchecked Terms",{...input(),accepted:false}],
      ["role injection",{...input(),role:"owner"}],
      ["invalid email",{...input(),email:"invalid"}],
    ] as const) expect((await send(label,await envelope({input:value}))).status).toBe(422);
    expect((await send("invalid JSON",await envelope({body:"{invalid"}))).status).toBe(422);
    expect((await send("oversized input",await envelope({input:{...input(),fullName:"x".repeat(5000)}}))).status).toBe(413);
  },90000);
  it("denies unapproved recipients and a noncurrent Terms version",async()=>{
    expect((await send("unknown recipient",await envelope({input:{...input(),email:"unapproved@example.com"}}))).status).toBe(403);
    expect((await send("wrong Terms version",await envelope({input:{...input(),termsVersion:crypto.randomUUID()}}))).status).toBe(403);
  });
  it("creates exactly one intent for concurrent replays of a signed HTTP request",async()=>{
    const request=await envelope();
    const responses=await Promise.all([send("original signed request",request),send("concurrent replay 1",request),send("concurrent replay 2",request)]);
    expect(responses.map(response=>response.status).sort()).toEqual([201,403,403]);
    const result=await responses.find(response=>response.status===201)!.json();
    expect(typeof result.intentId).toBe("string"); expect(typeof result.nonce).toBe("string");
    expect(/^[0-9a-f]{64}$/.test(result.nonce)).toBe(true);
    successfulIntent=result.intentId; successfulNonceHash=await hash(result.nonce);
    expect((await send("later replay",request)).status).toBe(403);
  },90000);
  it("enforces the three-intents-per-hour email limit on the live endpoint",async()=>{
    expect((await send("second email intent",await envelope())).status).toBe(201);
    expect((await send("third email intent",await envelope())).status).toBe(201);
    expect((await send("email rate limit",await envelope())).status).toBe(403);
  },90000);
  it("stores hashed credentials without creating an account, workspace or membership",async()=>{
    const db=await database();
    try{
      const row=(await db.query("select nonce_hash,email,terms_id,provider_user_id,finalized_at,expires_at>now() unexpired from private.registration_intents where id=$1",[successfulIntent])).rows[0];
      expect(row.nonce_hash===successfulNonceHash).toBe(true); expect(row.email).toBe(email); expect(row.terms_id).toBe(terms);
      expect(row.provider_user_id).toBeNull(); expect(row.finalized_at).toBeNull(); expect(row.unexpired).toBe(true);
      expect((await db.query("select count(*)::int n from private.registration_intents where email=$1",[email])).rows[0].n).toBe(3);
      expect((await db.query("select count(*)::int n from auth.users where email=$1",[email])).rows[0].n).toBe(0);
      noProviderUserCreated=true;
    }finally{await db.end();}
    const denied=await publicClient().schema("api").rpc("mitsa_signed_registration_intent",{p_email:email,p_name:"Synthetic",p_terms:terms,p_nonce_hash:"ab".repeat(32),p_accepted:true,p_request_hash:"cd".repeat(32),p_signed_at:new Date().toISOString()});
    expect(denied.error?.code).toBe("42501");
  });
  it("keeps every release gate closed after live smoke tests",async()=>{
    const db=await database();
    try{
      const gate=(await db.query("select registration_enabled or external_mail_enabled or legal_publication_enabled or eligibility_approved or disposal_enabled open from private.release_gates where singleton")).rows[0];
      expect(gate.open).toBe(false);
      releaseGatesClosed=true;
    }finally{await db.end();}
  });
});
