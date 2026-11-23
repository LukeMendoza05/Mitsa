import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {randomBytes} from 'node:crypto';
import {NextRequest} from 'next/server';
const mocks=vi.hoisted(()=>({command:vi.fn(),signUp:vi.fn(),signOut:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/auth/registration-service',()=>({registrationCommand:mocks.command}));
vi.mock('@/lib/supabase/server',()=>({runtimeConfig:()=>({origin:'http://127.0.0.1:3000'})}));
import {submitPersistentSignup} from '../../src/lib/auth/persistent-signup';
import {openAuthFlow,signupAttemptCookie,signupCodeCookie} from '../../src/lib/security/auth-flow';
const input={email:'synthetic-durable@example.invalid',fullName:'Synthetic person',password:'Synthetic-private-password',submissionId:crypto.randomUUID(),termsId:crypto.randomUUID(),privacyId:crypto.randomUUID(),accepted:true as const};
const result={submissionId:input.submissionId,intentId:crypto.randomUUID(),state:'prepared',creationDeadline:new Date(Date.now()+120000).toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString(),nonce:'a'.repeat(64)};
const connection={client:{auth:{signUp:mocks.signUp,signOut:mocks.signOut}},finish:(value:unknown)=>value} as unknown as Parameters<typeof submitPersistentSignup>[2];
const request=()=>new NextRequest('http://127.0.0.1:3000/auth/register',{method:'POST',headers:{'x-mitsa-form':'1',origin:'http://127.0.0.1:3000'}});
beforeEach(()=>{vi.stubEnv('AUTH_FLOW_KEY',randomBytes(32).toString('base64url'));vi.clearAllMocks();mocks.signUp.mockResolvedValue({data:{user:{},session:null},error:null});});
afterEach(()=>vi.unstubAllEnvs());
it('calls provider signup exactly once after the durable claim and mail authorization',async()=>{
 const mail=crypto.randomUUID();mocks.command.mockResolvedValueOnce(result).mockResolvedValueOnce({requestId:mail,expiresAt:new Date(Date.now()+120000).toISOString(),sendAllowed:true}).mockResolvedValueOnce({claimed:true});
 const response=await submitPersistentSignup(request(),input,connection);
 expect(mocks.signUp).toHaveBeenCalledTimes(1);expect(mocks.signUp.mock.calls[0][0].options.emailRedirectTo).toBe(`http://127.0.0.1:3000/auth/email?request=${mail}`);
 const flow=openAuthFlow(response.cookies.get(signupCodeCookie)?.value,process.env.AUTH_FLOW_KEY!);expect(flow).toMatchObject({purpose:'signup-code',submissionId:input.submissionId,mailRequestId:mail});
 expect(JSON.stringify(mocks.command.mock.calls)).not.toContain(input.password);
});
it('does not repeat provider signup after a duplicate or uncertain claim',async()=>{
 mocks.command.mockResolvedValueOnce({...result,state:'uncertain'}).mockResolvedValueOnce({requestId:crypto.randomUUID(),expiresAt:new Date(Date.now()+120000).toISOString(),sendAllowed:false}).mockResolvedValueOnce({claimed:false});
 const response=await submitPersistentSignup(request(),input,connection);expect(await response.json()).toEqual({error:{code:'submission_pending'}});
 expect(mocks.signUp).not.toHaveBeenCalled();expect(openAuthFlow(response.cookies.get(signupAttemptCookie)?.value,process.env.AUTH_FLOW_KEY!)).toMatchObject({purpose:'signup-attempt',submissionId:input.submissionId});
});
it('resumes an existing pending account without signup or an automatic resend',async()=>{
 mocks.command.mockResolvedValueOnce({...result,state:'pending-verification'});
 const response=await submitPersistentSignup(request(),input,connection);expect(response.headers.get('location')).toBe('http://127.0.0.1:3000/verify-email');expect(mocks.command).toHaveBeenCalledTimes(1);expect(mocks.signUp).not.toHaveBeenCalled();
});
it('retains a sealed attempt after provider interruption without claiming success',async()=>{
 mocks.command.mockResolvedValueOnce(result).mockResolvedValueOnce({requestId:crypto.randomUUID(),expiresAt:new Date(Date.now()+120000).toISOString(),sendAllowed:true}).mockResolvedValueOnce({claimed:true});mocks.signUp.mockRejectedValueOnce(Error('Synthetic provider interruption'));
 const response=await submitPersistentSignup(request(),input,connection);expect(await response.json()).toEqual({error:{code:'submission_pending'}});expect(response.cookies.get(signupCodeCookie)).toBeUndefined();expect(response.cookies.get(signupAttemptCookie)).toBeDefined();
});
it('refuses unexpected provider auto-confirmation and removes only that new session',async()=>{
 mocks.command.mockResolvedValueOnce(result).mockResolvedValueOnce({requestId:crypto.randomUUID(),expiresAt:new Date(Date.now()+120000).toISOString(),sendAllowed:true}).mockResolvedValueOnce({claimed:true});mocks.signUp.mockResolvedValueOnce({data:{session:{synthetic:true}},error:null});
 const response=await submitPersistentSignup(request(),input,connection);expect(await response.json()).toEqual({error:{code:'unavailable'}});expect(mocks.signOut).toHaveBeenCalledWith({scope:'local'});
});
