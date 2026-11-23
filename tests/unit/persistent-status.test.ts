import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {randomBytes} from 'node:crypto';
import {NextRequest} from 'next/server';
const mocks=vi.hoisted(()=>({command:vi.fn(),readiness:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/auth/registration-service',()=>({usesPersistentRegistration:()=>true,registrationCommand:mocks.command,persistentRegistrationReadiness:mocks.readiness,
 safeMailStatus:{safeParse:(value:unknown)=>({success:Boolean(value&&typeof value==='object'&&'state'in value&&value.state==='sent'),data:value})}}));
import {GET as registrationStatus} from '../../src/app/auth/registration/status/route';
import {GET as emailStatus} from '../../src/app/auth/email/status/route';
import {sealAuthFlow,openAuthFlow,signupAttemptCookie,signupCodeCookie} from '../../src/lib/security/auth-flow';
const email='synthetic-status@example.invalid',submissionId=crypto.randomUUID(),intentId=crypto.randomUUID();
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('AUTH_FLOW_KEY',randomBytes(32).toString('base64url'));mocks.readiness.mockResolvedValue({admission:'closed'});});
afterEach(()=>vi.unstubAllEnvs());
function request(cookie?:string){return new NextRequest('http://127.0.0.1:3000/auth/registration/status',{headers:cookie?{cookie}:{}});}
function attempt(){const now=Date.now();return `${signupAttemptCookie}=${sealAuthFlow({purpose:'signup-attempt',email,submissionId,issuedAt:now,expiresAt:now+86400000},process.env.AUTH_FLOW_KEY!)}`;}
it('reveals only coarse availability without a valid sealed attempt',async()=>{
 for(const cookie of [undefined,`${signupAttemptCookie}=forged`])expect(await(await registrationStatus(request(cookie))).json()).toEqual({availability:'closed'});
 expect(mocks.command).not.toHaveBeenCalled();
});
it('resumes pending verification during closed admission without signup or sending mail',async()=>{
 mocks.command.mockResolvedValue({submissionId,intentId,state:'pending-verification',creationDeadline:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()});
 const response=await registrationStatus(request(attempt()));expect(await response.json()).toEqual({state:'verify-email',redirect:'/verify-email'});
 expect(openAuthFlow(response.cookies.get(signupCodeCookie)?.value,process.env.AUTH_FLOW_KEY!)?.purpose).toBe('signup-code');
 expect(mocks.command).toHaveBeenCalledWith('submission-status',{email,submissionId});
});
it('allows a fresh request only when the private result establishes expired, unbound creation',async()=>{
 mocks.command.mockResolvedValue({submissionId,intentId,state:'expired',creationDeadline:new Date(Date.now()-1000).toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString(),restartAllowed:true});
 expect(await(await registrationStatus(request(attempt()))).json()).toEqual({state:'expired',restartAllowed:true});
});
it('does not return addresses or internal intent identifiers in browser status',async()=>{
 mocks.command.mockResolvedValue({submissionId,intentId,state:'uncertain',creationDeadline:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()});
 const text=await(await registrationStatus(request(attempt()))).text();expect(text).toBe('{"state":"checking"}');expect(text).not.toContain(email);expect(text).not.toContain(intentId);
});
it('requires the own-flow sealed context before checking email status',async()=>{
 expect(await(await emailStatus(request())).json()).toEqual({state:'unavailable'});expect(mocks.command).not.toHaveBeenCalled();
 const now=Date.now(),requestId=crypto.randomUUID(),cookie=sealAuthFlow({purpose:'signup-code',email,intentId,mailRequestId:requestId,issuedAt:now,resendAt:now,expiresAt:now+3600000},process.env.AUTH_FLOW_KEY!);
 mocks.command.mockResolvedValue({state:'sent'});expect(await(await emailStatus(request(`${signupCodeCookie}=${cookie}`))).json()).toEqual({state:'sent'});
 expect(mocks.command).toHaveBeenCalledWith('mail-status',{email,requestId});
});
