import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
import {createHash} from 'node:crypto';
const mocks=vi.hoisted(()=>({context:vi.fn(),intent:vi.fn(),signup:vi.fn(),user:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/auth/registration',()=>({registrationContext:mocks.context,createRegistrationIntent:mocks.intent}));
vi.mock('@/lib/supabase/server',()=>({runtimeConfig:()=>({origin:'http://127.0.0.1:3000'}),routeClient:()=>({finish:(response:Response)=>response,client:{auth:{getUser:mocks.user,signUp:mocks.signup}}})}));
// Use the REAL signup route and REAL validator together. Only provider HTTP,
// policy lookup and the downstream intent/Auth side effects are replaced.
import {POST} from '../../src/app/auth/register/route';
const origin='http://127.0.0.1:3000',terms=crypto.randomUUID(),now=Date.now();
const valid={success:true,hostname:'127.0.0.1',action:'signup',challenge_ts:new Date(now-1000).toISOString()};
function request(token:string|null='synthetic-provider-proof',native=false){
 const form=new URLSearchParams({fullName:'Synthetic CAPTCHA boundary',email:'synthetic-new-user@example.com',password:'Synthetic!Password1',confirmPassword:'Synthetic!Password1',termsVersion:terms,accepted:'on'});
 if(token!==null)form.set('captchaToken',token);
 return new NextRequest(`${origin}/auth/register`,{method:'POST',headers:{origin,...(native?{}:{'x-mitsa-form':'1'})},body:form});
}
beforeEach(()=>{
 vi.clearAllMocks();vi.useFakeTimers();vi.setSystemTime(now);
 vi.stubEnv('MITSA_PUBLIC_CAPTCHA_PROVIDER','turnstile');vi.stubEnv('MITSA_TURNSTILE_SITE_KEY','synthetic-real-shaped-sitekey');vi.stubEnv('MITSA_TURNSTILE_SECRET_KEY','synthetic-server-secret-kept-private');
 mocks.context.mockResolvedValue({enabled:true,isTest:false,isDevelopmentOpen:true,requiresChallenge:true,developmentRuntime:{phase:'general'},policy:{id:terms,status:'test',publicRegistration:false}});
 mocks.user.mockResolvedValue({data:{user:null}});mocks.intent.mockResolvedValue({ok:false,code:'unavailable'});
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();vi.unstubAllGlobals();});
it.each(['invalid-input-response','timeout-or-duplicate'])('refuses provider %s at actual signup before any signed intent or Auth operation',async code=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({success:false,'error-codes':[code]}))));
 const response=await POST(request());expect(response.status).toBe(403);expect(await response.json()).toEqual({error:{code:'challenge'}});
 expect(mocks.intent).not.toHaveBeenCalled();expect(mocks.signup).not.toHaveBeenCalled();expect(response.headers.get('set-cookie')).toBeNull();
});
it.each([300000,300001,301000])('refuses a provider-success proof aged %d milliseconds at actual signup',async age=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({...valid,challenge_ts:new Date(now-age).toISOString()}))));
 expect((await POST(request())).status).toBe(403);expect(mocks.intent).not.toHaveBeenCalled();expect(mocks.signup).not.toHaveBeenCalled();
});
it('requires the proof and fails closed for provider/network/malformed response failures',async()=>{
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
 for(const token of [null,'','x'.repeat(2049)])expect((await POST(request(token))).status).toBeGreaterThanOrEqual(400);
 expect(fetch).not.toHaveBeenCalled();
 fetch.mockRejectedValue(Error('private provider detail'));expect((await POST(request())).status).toBe(403);
 fetch.mockResolvedValue(new Response('not-json'));expect((await POST(request())).status).toBe(403);
 expect(mocks.intent).not.toHaveBeenCalled();expect(mocks.signup).not.toHaveBeenCalled();
});
it('rejects the native POST through the same validator and accepts only a fresh matched proof up to the signed-intent boundary',async()=>{
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
 fetch.mockResolvedValue(new Response(JSON.stringify({...valid,hostname:'wrong.example'})));
 expect((await POST(request('synthetic-proof',true))).headers.get('location')).toContain('/signup?error=challenge');expect(mocks.intent).not.toHaveBeenCalled();
 fetch.mockResolvedValue(new Response(JSON.stringify({...valid,challenge_ts:new Date(now-299999).toISOString()})));
 expect((await POST(request())).status).toBe(503);expect(mocks.intent).toHaveBeenCalledOnce();expect(mocks.signup).not.toHaveBeenCalled();
});
it('accepts an unallowlisted controlled alias up to the signed-intent boundary after real validator success',async()=>{
 const email='synthetic-new-user@example.com';
 mocks.context.mockResolvedValue({enabled:true,isTest:false,isDevelopmentOpen:true,requiresChallenge:true,developmentRuntime:{phase:'controlled',recipientHash:createHash('sha256').update(email).digest('hex')},policy:{id:terms,status:'test',publicRegistration:false}});
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify(valid))));
 expect((await POST(request())).status).toBe(503);
 expect(mocks.intent).toHaveBeenCalledWith({email,fullName:'Synthetic CAPTCHA boundary',termsVersion:terms});expect(mocks.signup).not.toHaveBeenCalled();
});
it('distinguishes a controlled recipient mismatch from developer allowlist rejection without consuming CAPTCHA',async()=>{
 mocks.context.mockResolvedValue({enabled:true,isTest:false,isDevelopmentOpen:true,requiresChallenge:true,developmentRuntime:{phase:'controlled',recipientHash:createHash('sha256').update('different@example.com').digest('hex')},policy:{id:terms,status:'test',publicRegistration:false}});
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
 const response=await POST(request());expect(response.status).toBe(403);expect(await response.json()).toEqual({error:{code:'controlled_recipient'}});
 expect(fetch).not.toHaveBeenCalled();expect(mocks.intent).not.toHaveBeenCalled();expect(mocks.signup).not.toHaveBeenCalled();
});
it('preserves native POST feedback and records only a bounded failure stage',async()=>{
 mocks.context.mockResolvedValue({enabled:true,isTest:false,isDevelopmentOpen:true,developmentRuntime:{phase:'controlled',recipientHash:'0'.repeat(64)},policy:{id:terms}});
 const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
 try {
  const response=await POST(request('synthetic-proof',true));expect(response.headers.get('location')).toContain('/signup?error=controlled_recipient');
  expect(warn).toHaveBeenCalledWith('Mitsa registration refused',expect.any(String));
  expect(JSON.parse(warn.mock.calls[0][1])).toMatchObject({stage:'controlled-recipient',code:'controlled_recipient'});
  expect(JSON.stringify(warn.mock.calls)).not.toMatch(/synthetic-new-user|Synthetic!Password|synthetic-proof/);
 }finally{warn.mockRestore();}
});
it.each([false,true])('refuses an existing browser session without treating it as signup success (native=%s)',async native=>{
 mocks.user.mockResolvedValue({data:{user:{id:'synthetic-existing-account'}}});
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
 const response=await POST(request('synthetic-proof',native));
 if(native){expect(response.status).toBe(303);expect(response.headers.get('location')).toContain('/signup?error=already_signed_in');}
 else{expect(response.status).toBe(409);expect(await response.json()).toEqual({error:{code:'already_signed_in'}});}
 expect(mocks.context).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();expect(mocks.intent).not.toHaveBeenCalled();expect(mocks.signup).not.toHaveBeenCalled();expect(response.headers.get('set-cookie')).toBeNull();
});
