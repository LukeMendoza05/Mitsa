import {it,expect,vi} from 'vitest';
import {countedOnboardingFetch,onboardingRequestKind} from '../../scripts/lib/onboarding-counted-fetch.mjs';
const base='https://mjtejwafxriwntweussc.supabase.co';
it.each([
 ['/auth/v1/signup','POST','authRequests'],['/auth/v1/token?grant_type=refresh_token','POST','authRequests'],['/auth/v1/user','GET','authRequests'],
 ['/auth/v1/factors/10000000-0000-4000-8000-000000000001/verify','POST','authRequests'],
 ['/functions/v1/mitsa-registration-service','POST','signedCommands'],['/rest/v1/rpc/mitsa_identity','POST','resourceRequests']
])('classifies actual provider paths %s', (path,method,kind)=>expect(onboardingRequestKind(base+path,{method})).toBe(kind));
it.each(['https://other.supabase.co/auth/v1/signup',base+'.evil.invalid/auth/v1/token',base+'/auth/v1/admin/users',base+'/rest/v1/businesses',base+'/functions/v1/mitsa-registration-intent',base+'/auth/v1/unknown','http://mjtejwafxriwntweussc.supabase.co/auth/v1/token',base+'/auth/v1/token#secret'])('blocks unreviewed transport %s',url=>expect(()=>onboardingRequestKind(url,{method:'POST'})).toThrow('Unapproved'));
it('counts each actual attempt BEFORE transport and retains uncertainty without retry',async()=>{
 const events:string[]=[],scope={reserve:vi.fn((kind:string)=>events.push(kind))},fetcher=vi.fn(async()=>{events.push('transport');throw Error('PRIVATE-TOKEN');});
 const request=countedOnboardingFetch({fixture:'e-a',scope,fetcher});await expect(request(base+'/auth/v1/token',{method:'POST',body:'PRIVATE-REFRESH'})).rejects.toThrow(/^Onboarding provider response unconfirmed; no automatic retry$/);
 expect(events).toEqual(['authRequests','transport']);expect(fetcher).toHaveBeenCalledOnce();expect(scope.reserve).toHaveBeenCalledWith('authRequests',{fixture:'e-a'});
});
it('refuses exhausted budgets before calling the provider',async()=>{
 const fetcher=vi.fn(),scope={reserve:()=>{throw Error('Budget exhausted');}},request=countedOnboardingFetch({fixture:'e-b',scope,fetcher});
 await expect(request(base+'/auth/v1/user')).rejects.toThrow('Budget exhausted');expect(fetcher).not.toHaveBeenCalled();
});
it('forbids redirects and propagates the parent abort signal',async()=>{
 const stop=new AbortController(),fetcher=vi.fn(async(_url:any,options:any)=>new Response(String(options.redirect))),scope={reserve:vi.fn()};
 const request=countedOnboardingFetch({fixture:'e-a',scope,fetcher,signal:stop.signal});const r=await request(base+'/auth/v1/user',{redirect:'follow'});expect(await r.text()).toBe('error');
 stop.abort();expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);await expect(request(base+'/auth/v1/user')).rejects.toThrow('stopped');expect(fetcher).toHaveBeenCalledTimes(1);
});
it('accepts Request objects and never substitutes its own credentials or body',async()=>{
 const transport=vi.fn(async(_input:any,_options:any)=>new Response('{}')),scope={reserve:vi.fn()},request=countedOnboardingFetch({fixture:'e-a',scope,fetcher:transport});
 const input=new Request(base+'/auth/v1/verify',{method:'POST',body:'PRIVATE-CODE'});await request(input);expect(transport.mock.calls[0][0]).toBe(input);expect(input.bodyUsed).toBe(false);
});
it('accounts for real server CAPTCHA verification separately from browser widget status',()=>{
 expect(onboardingRequestKind('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST'})).toBe('captchaRequests');
 expect(()=>onboardingRequestKind('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'GET'})).toThrow();
});
it('has no default global transport and refuses retained identities',()=>{
 expect(()=>countedOnboardingFetch({fixture:'Yuno',scope:{reserve(){}},fetcher:vi.fn()})).toThrow();
 expect(()=>countedOnboardingFetch({fixture:'e-a',scope:{reserve(){}},fetcher:undefined})).toThrow();
});
