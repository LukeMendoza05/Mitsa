import {beforeEach,afterEach,describe,it,expect,vi} from "vitest";
import {NextRequest} from "next/server";
import {randomBytes} from "node:crypto";
import {registrationPolicyMode} from "../../src/lib/auth/registration-policy";
const mocks=vi.hoisted(()=>({context:vi.fn(),intent:vi.fn(),signup:vi.fn(),user:vi.fn(),signout:vi.fn(),localEmail:vi.fn(),challenge:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/auth/registration",()=>({registrationContext:mocks.context,createRegistrationIntent:mocks.intent}));
vi.mock("@/lib/auth/developer-access",()=>({isLocalTestingEmail:mocks.localEmail}));
vi.mock('@/lib/auth/signup-challenge',async(importOriginal)=>({...await importOriginal<typeof import('../../src/lib/auth/signup-challenge')>(),verifySignupChallenge:mocks.challenge}));
vi.mock("@/lib/supabase/server",()=>({runtimeConfig:()=>({origin:"http://127.0.0.1:3000"}),routeClient:()=>({finish:(r:Response)=>r,client:{auth:{getUser:mocks.user,signUp:mocks.signup,signOut:mocks.signout}}})}));
import {POST} from "../../src/app/auth/register/route";
const terms=crypto.randomUUID();
function request(overrides:Record<string,string>={}) {
 return new NextRequest("http://127.0.0.1:3000/auth/register",{method:"POST",headers:{origin:"http://127.0.0.1:3000","x-mitsa-form":"1"},body:new URLSearchParams({fullName:"Synthetic route test",email:"previously-unapproved@gmail.com",password:"Synthetic-only-password-001",confirmPassword:"Synthetic-only-password-001",termsVersion:terms,accepted:"on",captchaToken:'synthetic-proof',...overrides})});
}
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv("AUTH_FLOW_KEY",randomBytes(32).toString("base64url"));mocks.context.mockResolvedValue({enabled:true,isTest:false,policy:{id:terms,status:"published",publicRegistration:true}});mocks.user.mockResolvedValue({data:{user:null}});mocks.localEmail.mockReturnValue(false);mocks.intent.mockResolvedValue({ok:true,intent:{intentId:crypto.randomUUID(),nonce:"a".repeat(64),termsVersion:terms}});mocks.signup.mockResolvedValue({data:{user:{},session:null},error:null});mocks.challenge.mockResolvedValue(true);});
afterEach(()=>vi.unstubAllEnvs());
describe("Unreleased public-registration path (mocked providers; no email sent)",()=>{
 it('refuses failed/absent/replayed human verification before issuing any signed intent',async()=>{mocks.challenge.mockResolvedValue(false);const response=await POST(request());expect(response.status).toBe(403);expect(await response.json()).toEqual({error:{code:'challenge'}});expect(mocks.intent).not.toHaveBeenCalled();expect(mocks.signup).not.toHaveBeenCalled();});
 it("requires exact public mode and published database authorization",()=>{
  expect(registrationPolicyMode("public",{status:"published",publicRegistration:true})).toMatchObject({isTest:false,allowed:true});
  for(const mode of ["disabled","isolated-test","unknown"])expect(registrationPolicyMode(mode,{status:"published",publicRegistration:true}).allowed).toBe(false);
  for(const policy of [null,{status:"test" as const,publicRegistration:true},{status:"published" as const,publicRegistration:false}])expect(registrationPolicyMode("public",policy).allowed).toBe(false);
  expect(registrationPolicyMode("isolated-test",{status:"test",publicRegistration:false})).toMatchObject({isTest:true,allowed:true});
  const pilot={status:"test" as const,publicRegistration:false,pilotRegistration:true};
  expect(registrationPolicyMode("controlled-pilot",pilot,"http://127.0.0.1:3000").allowed).toBe(true);
  for(const origin of [undefined,"https://mitsa.vercel.app","http://127.0.0.1:3001"])expect(registrationPolicyMode("controlled-pilot",pilot,origin).allowed).toBe(false);
  expect(registrationPolicyMode("controlled-pilot",{...pilot,pilotRegistration:false},"http://127.0.0.1:3000").allowed).toBe(false);
 });
 it.each(["previously-unapproved@gmail.com","person@another-business.example"])("accepts valid %s without a per-email allowlist only in approved public mode",async email=>{
  const response=await POST(request({email}));expect(response.status).toBe(303);expect(response.headers.get("location")).toContain("/verify-email?sent=1");
  expect(mocks.localEmail).not.toHaveBeenCalled();expect(mocks.intent).toHaveBeenCalledWith({email,fullName:"Synthetic route test",termsVersion:terms});
  expect(mocks.challenge).toHaveBeenCalledWith('synthetic-proof','http://127.0.0.1:3000');
  expect(mocks.signup.mock.calls[0][0].options.data).toEqual({full_name:"Synthetic route test",registration_nonce:"a".repeat(64)});
  expect(response.headers.get("set-cookie")).toContain("HttpOnly");
 });
 it("keeps isolated mode restricted and refuses closed public policy",async()=>{
  mocks.context.mockResolvedValueOnce({enabled:true,isTest:true,policy:{id:terms}});expect((await POST(request())).status).toBe(403);expect(mocks.signup).not.toHaveBeenCalled();
  mocks.context.mockResolvedValueOnce({enabled:false,isTest:false,policy:null});expect((await POST(request())).status).toBe(503);expect(mocks.intent).not.toHaveBeenCalled();
 });
 it("rejects missing Terms, injected privileges and stale agreements before issuing an intent",async()=>{
  const invalidInputs:Record<string,string>[]=[{accepted:""},{role:"owner"},{termsVersion:crypto.randomUUID()}];
  for(const input of invalidInputs)expect((await POST(request(input))).status).toBeGreaterThanOrEqual(400);
  expect(mocks.intent).not.toHaveBeenCalled();expect(mocks.signup).not.toHaveBeenCalled();
 });
 it("does not bypass signed intent rejection or rate limits",async()=>{
  mocks.intent.mockResolvedValue({ok:false,code:"rate_limited"});expect((await POST(request())).status).toBe(429);expect(mocks.signup).not.toHaveBeenCalled();
 });
 it("fails closed if provider unexpectedly skips mandatory email verification",async()=>{
  mocks.signup.mockResolvedValue({data:{session:{},user:{}},error:null});expect((await POST(request())).status).toBe(503);expect(mocks.signout).toHaveBeenCalledWith({scope:"local"});
 });
 it('requires the exact loopback development target and an open database lease for unallowlisted development signup',()=>{
  const policy={status:'test' as const,publicRegistration:false,pilotRegistration:true};
  expect(registrationPolicyMode('development-open',policy,'http://127.0.0.1:3000',true)).toMatchObject({allowed:true,isTest:false,isDevelopmentOpen:true});
  for(const [origin,development] of [['http://127.0.0.1:3000',false],['http://localhost:3000',true],['https://mitsa.vercel.app',true]] as const)
   expect(registrationPolicyMode('development-open',policy,origin,development).allowed).toBe(false);
  expect(registrationPolicyMode('development-open',{...policy,pilotRegistration:false},'http://127.0.0.1:3000',true).allowed).toBe(false);
 });
 it('enforces CAPTCHA in development-open mode even though its agreement remains a test version',async()=>{
  mocks.context.mockResolvedValue({enabled:true,isTest:false,isDevelopmentOpen:true,requiresChallenge:true,developmentRuntime:{phase:'general'},policy:{id:terms,status:'test',publicRegistration:false}});
  mocks.challenge.mockResolvedValue(false);expect((await POST(request())).status).toBe(403);expect(mocks.intent).not.toHaveBeenCalled();
  mocks.challenge.mockResolvedValue(true);expect((await POST(request())).status).toBe(303);expect(mocks.localEmail).not.toHaveBeenCalled();
 });
 it('rejects a different controlled recipient before issuing an intent, while general mode has no email allowlist',async()=>{
  mocks.context.mockResolvedValue({enabled:true,isTest:false,isDevelopmentOpen:true,requiresChallenge:true,developmentRuntime:{phase:'controlled',recipientHash:'a'.repeat(64)},policy:{id:terms,status:'test'}});
  expect((await POST(request())).status).toBe(403);expect(mocks.challenge).not.toHaveBeenCalled();expect(mocks.intent).not.toHaveBeenCalled();
 });
});
