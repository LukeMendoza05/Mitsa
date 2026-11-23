import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { signIntentRequest } from "../../supabase/functions/_shared/registration-intent-auth";
import pinnedTarget from "../../config/test-target.json";

const mocks=vi.hoisted(()=>({ createClient:vi.fn(),rpc:vi.fn() }));
vi.mock("@supabase/supabase-js",()=>({createClient:mocks.createClient}));
// The Edge config is pinned to the deployed project; follow the pin instead of
// hardcoding a dev URL so offline fixtures match the configured target.
const config={SUPABASE_URL:`https://${pinnedTarget.projectRef}.supabase.co`,SUPABASE_SERVICE_ROLE_KEY:"synthetic-service",MITSA_PUBLISHABLE_KEY:"synthetic-public",MITSA_APP_ORIGIN:"http://127.0.0.1:3000",MITSA_REGISTRATION_INTENT_KEY:"e1".repeat(32)};
const modulePath="../../supabase/functions/mitsa-registration-intent/index.ts";
async function entry(env:Record<string,string|undefined>) {
  const serve=vi.fn();
  vi.stubGlobal("Deno",{env:{get:(name:string)=>env[name]},serve});
  await import(/* @vite-ignore */ modulePath);
  expect(serve).toHaveBeenCalledTimes(1);
  return serve.mock.calls[0][0] as (request:Request)=>Promise<Response>;
}
beforeEach(()=>{ vi.resetModules(); vi.clearAllMocks(); mocks.createClient.mockReturnValue({schema:()=>({rpc:mocks.rpc})}); });
afterEach(()=>{vi.unstubAllGlobals();});
describe("Edge entrypoint with the Deno environment contract",()=>{
  it.each([["54000","rate_limited"],["23505","request_expired"],["42501","testing_access"],["22023","input"],["XX000","unavailable"]])("returns only a safe diagnostic for %s without leaking private database details",async(code,expected)=>{
    const handler=await entry(config),body=JSON.stringify({email:"foundation-diagnostic@example.invalid",fullName:"Synthetic diagnostic",termsVersion:crypto.randomUUID(),accepted:true});
    mocks.rpc.mockResolvedValueOnce({data:null,error:{code,message:"Private database detail foundation-diagnostic@example.invalid"}});
    const response=await handler(new Request("https://isolated.example",{method:"POST",headers:{origin:config.MITSA_APP_ORIGIN,apikey:config.MITSA_PUBLISHABLE_KEY,"content-type":"application/json",...await signIntentRequest(config.MITSA_REGISTRATION_INTENT_KEY,body)},body}));
    expect(response.status).toBe(403);expect(await response.json()).toEqual({error:"Registration unavailable",code:expected});
  });
  it.each(Object.keys(config))("fails closed without %s before creating an admin client",async missing=>{
    const handler=await entry({...config,[missing]:undefined});
    const response=await handler(new Request("https://isolated.example",{method:"POST"}));
    expect(response.status).toBe(503); expect(mocks.createClient).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("refuses a different project",async()=>{
    const handler=await entry({...config,SUPABASE_URL:"https://other-project.supabase.co"});
    expect((await handler(new Request("https://isolated.example",{method:"POST"}))).status).toBe(503);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("requires signed server authorization and uses only the atomic RPC",async()=>{
    const handler=await entry(config);
    const body=JSON.stringify({email:"foundation-deno@example.invalid",fullName:"Synthetic Deno",termsVersion:crypto.randomUUID(),accepted:true});
    const base={origin:config.MITSA_APP_ORIGIN,apikey:config.MITSA_PUBLISHABLE_KEY,"content-type":"application/json"};
    expect((await handler(new Request("https://isolated.example",{method:"POST",headers:base,body}))).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValueOnce({data:crypto.randomUUID(),error:null});
    const response=await handler(new Request("https://isolated.example",{method:"POST",headers:{...base,...await signIntentRequest(config.MITSA_REGISTRATION_INTENT_KEY,body)},body}));
    expect(response.status).toBe(201); expect(mocks.rpc.mock.calls[0][0]).toBe("mitsa_signed_registration_intent");
    const returned=JSON.stringify(await response.json());
    expect(returned).not.toContain(config.SUPABASE_SERVICE_ROLE_KEY); expect(returned).not.toContain(config.MITSA_REGISTRATION_INTENT_KEY);
  });
});
