import {beforeEach,describe,it,expect,vi} from "vitest";
import {NextRequest} from "next/server";
import {randomBytes} from "node:crypto";
import {sealAuthFlow,signupCodeCookie} from "../../src/lib/security/auth-flow";
import {emailVerificationCodeLength} from "../../src/lib/auth/email-code-settings";
const mocks=vi.hoisted(()=>({verify:vi.fn(),resend:vi.fn(),rpc:vi.fn(),user:vi.fn(),signout:vi.fn(),context:vi.fn(),delivery:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/auth/registration",()=>({registrationContext:mocks.context}));
vi.mock('@/lib/auth/development-registration',async importOriginal=>({...await importOriginal<typeof import('../../src/lib/auth/development-registration')>(),readDevelopmentDeliveryState:mocks.delivery}));
vi.mock("@/lib/supabase/server",()=>({runtimeConfig:()=>({origin:"http://127.0.0.1:3000"}),routeClient:()=>({finish:(response:Response)=>response,client:{auth:{getUser:mocks.user,verifyOtp:mocks.verify,resend:mocks.resend,signOut:mocks.signout},schema:()=>({rpc:mocks.rpc})}})}));
import {POST} from "../../src/app/auth/email/code/route";
const origin="http://127.0.0.1:3000",key=randomBytes(32).toString("base64url");
function request(action:string,options:{cookie?:string;origin?:string;resendAt?:number;code?:string;email?:string}={}) {
 const now=Date.now(),flow={purpose:"signup-code" as const,email:options.email??`foundation-route-${crypto.randomUUID()}@example.invalid`,issuedAt:now-120000,resendAt:options.resendAt??now-60000,expiresAt:now+3600000};
 const cookie=options.cookie??sealAuthFlow(flow,key);return new NextRequest(`${origin}/auth/email/code`,{method:"POST",headers:{origin:options.origin??origin,cookie:`${signupCodeCookie}=${cookie}`},body:new URLSearchParams({action,code:options.code??"1".repeat(emailVerificationCodeLength),email:"attacker@example.invalid",type:"recovery"})});
}
beforeEach(()=>{vi.clearAllMocks();process.env.AUTH_FLOW_KEY=key;mocks.delivery.mockResolvedValue('unmanaged');mocks.user.mockResolvedValue({data:{user:null}});mocks.context.mockResolvedValue({enabled:true,policy:{id:crypto.randomUUID()}});mocks.resend.mockResolvedValue({error:null});mocks.verify.mockResolvedValue({error:{code:"otp_expired",status:403},data:{user:null,session:null}});});
describe("Server-only signup verification route",()=>{
 it("rejects the alternate email length before contacting Supabase",async()=>{expect((await POST(request("verify",{code:"1".repeat(emailVerificationCodeLength===6?8:6)}))).headers.get("location")).toContain("error=input");expect(mocks.verify).not.toHaveBeenCalled();});
 it("rejects forged/missing contexts and cross-origin forms before provider actions",async()=>{expect((await POST(request("resend",{cookie:"forged"}))).headers.get("location")).toContain("error=expired");expect((await POST(request("verify",{origin:"https://attacker.invalid"}))).status).toBe(403);expect(mocks.verify).not.toHaveBeenCalled();expect(mocks.resend).not.toHaveBeenCalled();});
 it("fails closed when registration configuration is unavailable",async()=>{mocks.context.mockResolvedValue({enabled:false});expect((await POST(request("resend"))).headers.get("location")).toContain("error=unavailable");expect(mocks.resend).not.toHaveBeenCalled();});
 it('allows a previously delivered code to reach provider verification after NEW signup closes, without authorizing resend',async()=>{
  mocks.context.mockResolvedValue({enabled:false});
  expect((await POST(request('verify'))).headers.get('location')).toContain('error=code');expect(mocks.verify).toHaveBeenCalledOnce();
  expect((await POST(request('resend'))).headers.get('location')).toContain('error=unavailable');expect(mocks.resend).not.toHaveBeenCalled();
 });
 it.each([['closed','testing_closed'],['paused','delivery_paused']])('explains %s delivery without disabling provider code verification',async(state,code)=>{
  mocks.context.mockResolvedValue({enabled:false,emailDeliveryEnabled:false});mocks.delivery.mockResolvedValue(state);
  expect((await POST(request('resend'))).headers.get('location')).toContain(`error=${code}`);expect(mocks.resend).not.toHaveBeenCalled();
  expect((await POST(request('verify'))).headers.get('location')).toContain('error=code');expect(mocks.verify).toHaveBeenCalledOnce();expect(mocks.context).toHaveBeenCalledOnce();
 });
 it('permits only the existing sealed-context resend when a delivery-only continuation is ready and new signup remains closed',async()=>{
  mocks.context.mockResolvedValue({enabled:false,emailDeliveryEnabled:true,policy:{id:crypto.randomUUID()}});
  expect((await POST(request('resend'))).headers.get('location')).toContain('resent=1');expect(mocks.resend).toHaveBeenCalledOnce();expect(mocks.verify).not.toHaveBeenCalled();
 });
 it('refuses another recipient’s sealed continuation during a controlled delivery-only window',async()=>{
  mocks.context.mockResolvedValue({enabled:false,emailDeliveryEnabled:true,isDevelopmentOpen:true,developmentRuntime:{phase:'controlled',recipientHash:'0'.repeat(64)},policy:{id:crypto.randomUUID()}});
  expect((await POST(request('resend'))).headers.get('location')).toContain('error=delivery_paused');expect(mocks.resend).not.toHaveBeenCalled();
 });
 it("enforces cooldown and hardcodes signup purpose/recipient despite injected fields",async()=>{expect((await POST(request("resend",{resendAt:Date.now()+30000}))).headers.get("location")).toContain("error=cooldown");expect(mocks.resend).not.toHaveBeenCalled();const email="foundation-bound@example.invalid";expect((await POST(request("resend",{email}))).headers.get("location")).toContain("resent=1");expect(mocks.resend).toHaveBeenCalledWith({type:"signup",email,options:{emailRedirectTo:`${origin}/auth/email`}});});
 it("maps invalid codes and delivery/rate failures without exposing raw details",async()=>{expect((await POST(request("verify"))).headers.get("location")).toContain("error=code");mocks.resend.mockResolvedValue({error:{code:"hook_failed",status:500,message:"Private recipient detail"}});expect((await POST(request("resend"))).headers.get("location")).toContain("error=delivery");mocks.resend.mockResolvedValue({error:{status:429}});expect((await POST(request("resend"))).headers.get("location")).toContain("error=rate_limited");});
 it("does not replace an already signed-in identity or grant a role",async()=>{mocks.user.mockResolvedValue({data:{user:{id:crypto.randomUUID()}}});expect((await POST(request("verify"))).headers.get("location")).toBe(`${origin}/workspaces`);expect(mocks.verify).not.toHaveBeenCalled();expect(mocks.rpc).not.toHaveBeenCalled();});
 it("requires provider confirmation and Terms finalization before continuing to MFA",async()=>{const email=`foundation-confirm-${crypto.randomUUID()}@example.invalid`;mocks.verify.mockResolvedValue({error:null,data:{user:{id:crypto.randomUUID(),email},session:{}}});mocks.rpc.mockResolvedValue({error:null,data:true});const response=await POST(request("verify",{email}));expect(response.headers.get("location")).toBe(`${origin}/settings/account/security?updated=email-verified`);expect(mocks.rpc).toHaveBeenCalledWith("mitsa_finalize_registration");expect(response.headers.get("set-cookie")).toContain("Max-Age=0");});
 it("rejects a provider identity mismatch and failed finalization without ownership",async()=>{mocks.verify.mockResolvedValue({error:null,data:{user:{id:crypto.randomUUID(),email:"wrong@example.invalid"},session:{}}});expect((await POST(request("verify"))).headers.get("location")).toContain("error=registration");expect(mocks.signout).toHaveBeenCalledWith({scope:"local"});expect(mocks.rpc).not.toHaveBeenCalled();});
});
