import {beforeEach,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';

// Actual login route; synthetic provider responses only. No live credentials.
const mocks=vi.hoisted(()=>({signin:vi.fn(),context:vi.fn(),command:vi.fn(),rpc:vi.fn(),signout:vi.fn(),persistent:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/supabase/server',()=>({runtimeConfig:()=>({origin:'http://127.0.0.1:3000'}),routeClient:()=>({client:{auth:{signInWithPassword:mocks.signin,signOut:mocks.signout},schema:()=>({rpc:mocks.rpc})},finish:(response:unknown)=>response})}));
vi.mock('@/lib/auth/registration',()=>({registrationContext:mocks.context}));
vi.mock('@/lib/auth/registration-service',()=>({usesPersistentRegistration:mocks.persistent,registrationCommand:mocks.command}));
vi.mock('@/lib/auth/developer-access',()=>({isLocalTestingEmail:()=>false}));
import {POST} from '../../src/app/auth/login/route';

const origin='http://127.0.0.1:3000';
function request(options:{email?:string;password?:string;html?:boolean}={}){
 const data=new URLSearchParams({email:options.email??'existing-fixture@example.invalid',password:options.password??'Synthetic-existing-password-123!'});
 return new NextRequest(origin+'/auth/login',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',accept:options.html?'text/html':'application/json'},body:data});
}
beforeEach(()=>{
 vi.clearAllMocks();mocks.persistent.mockReturnValue(false);mocks.signin.mockResolvedValue({error:null});
 mocks.context.mockResolvedValue({enabled:false});mocks.command.mockResolvedValue(null);mocks.rpc.mockResolvedValue({error:null,data:false});
});

it('allows existing-account password sign-in through the legacy path while signup is closed and persistent RPCs are absent',async()=>{
 const response=await POST(request());expect(response.status).toBe(303);expect(response.headers.get('location')).toBe(origin+'/proof');
 expect(mocks.signin).toHaveBeenCalledTimes(1);expect(mocks.context).not.toHaveBeenCalled();expect(mocks.command).not.toHaveBeenCalled();expect(mocks.rpc).not.toHaveBeenCalled();
 // /proof and workspace guards remain responsible for actual MFA/authorization.
});
it('does not turn a verified pre-cohort account into a new registration when the installed persistent finalizer returns false',async()=>{
 mocks.persistent.mockReturnValue(true);
 const response=await POST(request());expect(response.headers.get('location')).toBe(origin+'/proof');
 expect(mocks.rpc).toHaveBeenCalledWith('mitsa_finalize_registration');expect(mocks.command).not.toHaveBeenCalled();expect(mocks.signout).not.toHaveBeenCalled();
});
it('fails closed if the persistent engine is selected prematurely and its required finalizer is unavailable',async()=>{
 mocks.persistent.mockReturnValue(true);mocks.rpc.mockResolvedValue({error:{code:'schema_unavailable',message:'Synthetic private detail'}});
 const response=await POST(request());expect(response.status).toBe(503);expect(await response.json()).toEqual({error:'Sign-in failed'});expect(mocks.signout).toHaveBeenCalledWith({scope:'local'});
});
it.each([[401,401],[429,429]])('preserves provider failure status %s without exposing account or provider details',async(status,expected)=>{
 mocks.signin.mockResolvedValue({error:{status,message:'Synthetic private provider/account detail'}});
 const response=await POST(request());expect(response.status).toBe(expected);expect(await response.json()).toEqual({error:'Sign-in failed'});expect(mocks.command).not.toHaveBeenCalled();
});
it('keeps native form errors on the sign-in page and rejects malformed input before calling Auth',async()=>{
 const response=await POST(request({email:'invalid',html:true}));expect(response.status).toBe(303);expect(response.headers.get('location')).toBe(origin+'/login?error=signin');expect(mocks.signin).not.toHaveBeenCalled();
});
