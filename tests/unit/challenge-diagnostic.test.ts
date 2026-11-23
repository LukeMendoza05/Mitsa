import {it,expect,beforeEach,afterEach,vi} from 'vitest';
import {NextRequest} from 'next/server';
import {challengeDiagnosticAllowed} from '../../src/lib/auth/challenge-diagnostic';
const mocks=vi.hoisted(()=>({config:vi.fn(),verify:vi.fn(),inspect:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/supabase/server',()=>({runtimeConfig:()=>({origin:'http://127.0.0.1:3000'})}));
vi.mock('@/lib/auth/signup-challenge',()=>({signupChallengeConfig:mocks.config,checkSignupChallenge:mocks.verify,inspectSignupChallenge:mocks.inspect}));
import {POST} from '../../src/app/testing/registration/challenge/route';
const dev={NODE_ENV:'development',MITSA_REGISTRATION_MODE:'isolated-test',MITSA_AUTH_MAIL_MODE:'isolated-capture'};
beforeEach(()=>{vi.resetAllMocks();Object.entries(dev).forEach(([key,value])=>vi.stubEnv(key,value));mocks.config.mockReturnValue({siteKey:'synthetic-key',secret:'synthetic-server-secret'});mocks.verify.mockResolvedValueOnce({kind:'verified'}).mockResolvedValue({kind:'expired-or-duplicate'});});
afterEach(()=>vi.unstubAllEnvs());
function request(origin='http://127.0.0.1:3000',extra=false){const body=new FormData();body.set('captchaToken','synthetic-proof');if(extra)body.set('email','synthetic@example.invalid');return new NextRequest('http://127.0.0.1:3000/testing/registration/challenge',{method:'POST',headers:{origin},body});}
it('is inaccessible in production, public/pilot modes and noncanonical origins',async()=>{
 for(const change of [{NODE_ENV:'production'},{MITSA_REGISTRATION_MODE:'public'},{MITSA_REGISTRATION_MODE:'controlled-pilot'},{MITSA_AUTH_MAIL_MODE:'external'}])expect(challengeDiagnosticAllowed({...dev,...change},'http://127.0.0.1:3000')).toBe(false);
 expect(challengeDiagnosticAllowed(dev,'http://127.0.0.1:3001')).toBe(false);vi.stubEnv('NODE_ENV','production');expect((await POST(request())).status).toBe(404);expect(mocks.verify).not.toHaveBeenCalled();
});
it('fails closed without keys, on cross-origin requests and unexpected account input',async()=>{
 expect((await POST(request('https://attacker.invalid'))).status).toBe(403);expect((await POST(request(undefined,true))).status).toBe(400);
 mocks.config.mockReturnValue(null);expect((await POST(request())).status).toBe(503);expect(mocks.verify).not.toHaveBeenCalled();
});
it('returns only a boolean diagnostic, clears no auth state and exposes no configuration',async()=>{
 const response=await POST(request());expect(response.status).toBe(200);expect(await response.json()).toEqual({verified:true,replayRejected:true});expect(response.headers.get('set-cookie')).toBeNull();expect(response.headers.get('cache-control')).toContain('no-store');
 expect(mocks.verify).toHaveBeenCalledTimes(2);expect(mocks.verify.mock.calls[0]).toEqual(mocks.verify.mock.calls[1]);
 mocks.verify.mockResolvedValue({kind:'rejected'});expect((await POST(request())).status).toBe(403);
});
it('never counts an outage or unrelated error as successful replay rejection',async()=>{
 for(const kind of ['unavailable','rejected','verified']){
  mocks.verify.mockReset().mockResolvedValueOnce({kind:'verified'}).mockResolvedValueOnce({kind});
  const response=await POST(request());expect(response.status).toBe(503);expect(await response.json()).toEqual({verified:false,replayRejected:false});
 }
});
it('checks an expired proof without authorizing an account and refuses ambiguous modes',async()=>{
 const expiry=new NextRequest('http://127.0.0.1:3000/testing/registration/challenge',{method:'POST',headers:{origin:'http://127.0.0.1:3000'},body:new URLSearchParams({captchaToken:'synthetic-expired-proof',check:'expiry'})});
 mocks.inspect.mockResolvedValue({kind:'expired-or-duplicate',reason:'provider-expired-or-duplicate'});
 const response=await POST(expiry);expect(response.status).toBe(200);expect(await response.json()).toEqual({verified:false,expiredRejected:true,reason:'provider-expired-or-duplicate'});expect(response.headers.get('set-cookie')).toBeNull();
 const invalid=new NextRequest('http://127.0.0.1:3000/testing/registration/challenge',{method:'POST',headers:{origin:'http://127.0.0.1:3000'},body:new URLSearchParams({captchaToken:'synthetic-proof',check:'signup'})});
 expect((await POST(invalid)).status).toBe(400);
});
it('does not count generic invalidity, locally rejected stale proofs or network failure as explicit provider expiry',async()=>{
 for(const result of [{kind:'rejected',reason:'provider-invalid-token'},{kind:'rejected',reason:'server-expired'},{kind:'unavailable',reason:'provider-network'},{kind:'verified',reason:'verified'}]){
  mocks.inspect.mockResolvedValue(result);
  const request=new NextRequest('http://127.0.0.1:3000/testing/registration/challenge',{method:'POST',headers:{origin:'http://127.0.0.1:3000'},body:new URLSearchParams({captchaToken:'synthetic-held-proof',check:'expiry'})});
  const response=await POST(request);expect(response.status).toBe(result.kind==='unavailable'?503:403);expect(await response.json()).toEqual({verified:false,expiredRejected:false,reason:result.reason});
 }
});
