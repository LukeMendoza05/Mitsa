import {beforeEach,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
const mocks=vi.hoisted(()=>({command:vi.fn(),challenge:vi.fn(),reset:vi.fn(),limit:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/supabase/server',()=>({runtimeConfig:()=>({origin:'http://127.0.0.1:3000'}),routeClient:()=>({client:{auth:{resetPasswordForEmail:mocks.reset}},finish:(r:unknown)=>r})}));
vi.mock('@/lib/auth/registration-service',()=>({usesPersistentRegistration:()=>true,registrationCommand:mocks.command}));
vi.mock('@/lib/auth/signup-challenge',()=>({verifyRecoveryChallenge:mocks.challenge}));
vi.mock('@/lib/auth/email-verification',()=>({emailActionLimit:mocks.limit}));
vi.mock('@/lib/auth/developer-access',()=>({isLocalTestingEmail:()=>false}));
import {POST} from '../../src/app/auth/password/request/route';
beforeEach(()=>{vi.clearAllMocks();mocks.challenge.mockResolvedValue(true);mocks.limit.mockReturnValue(true);mocks.reset.mockResolvedValue({error:null});});
const request=(changes:Record<string,string>={},origin='http://127.0.0.1:3000')=>{const form=new FormData();for(const [key,value] of Object.entries({email:'synthetic-recovery@example.invalid',requestKey:crypto.randomUUID(),captchaToken:'synthetic-proof',...changes}))form.set(key,value);return new NextRequest('http://127.0.0.1:3000/auth/password/request',{method:'POST',body:form,headers:{origin}});};
it('rejects cross-site requests and invalid human verification before authorizing mail',async()=>{
 expect((await POST(request({},'https://foreign.invalid'))).status).toBe(403);expect(mocks.challenge).not.toHaveBeenCalled();
 mocks.challenge.mockResolvedValue(false);await POST(request({captchaToken:''}));expect(mocks.command).not.toHaveBeenCalled();expect(mocks.reset).not.toHaveBeenCalled();
});
it('keeps unknown and eligible recovery responses indistinguishable',async()=>{
 mocks.command.mockResolvedValueOnce(null);const unknown=await POST(request());
 const id=crypto.randomUUID();mocks.command.mockResolvedValueOnce({requestId:id,expiresAt:new Date(Date.now()+120000).toISOString(),sendAllowed:true});const eligible=await POST(request());
 expect(unknown.status).toBe(eligible.status);expect(unknown.headers.get('location')).toBe(eligible.headers.get('location'));expect(mocks.reset).toHaveBeenCalledWith('synthetic-recovery@example.invalid',{redirectTo:`http://127.0.0.1:3000/auth/email?request=${id}`});
});
it('does not call the provider again for a durable duplicate request',async()=>{
 mocks.command.mockResolvedValueOnce({requestId:crypto.randomUUID(),expiresAt:new Date(Date.now()+120000).toISOString(),sendAllowed:false});await POST(request());expect(mocks.reset).not.toHaveBeenCalled();
});
it('limits attempts without exposing eligibility and never retries an uncertain provider call',async()=>{
 mocks.limit.mockReturnValueOnce(false);const limited=await POST(request());expect(limited.headers.get('location')).toContain('sent=1');expect(mocks.reset).not.toHaveBeenCalled();
 mocks.command.mockResolvedValueOnce({requestId:crypto.randomUUID(),expiresAt:new Date(Date.now()+120000).toISOString(),sendAllowed:true});mocks.reset.mockRejectedValueOnce(Error('Synthetic timeout'));const uncertain=await POST(request());expect(uncertain.headers.get('location')).toContain('sent=1');expect(mocks.reset).toHaveBeenCalledTimes(1);
});
