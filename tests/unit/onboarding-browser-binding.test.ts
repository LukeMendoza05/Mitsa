import {it,expect,vi} from 'vitest';
import {bindOnboardingBrowser} from '../../scripts/lib/onboarding-browser-binding.mjs';
async function fixture(url:string){
 let callback:any;const scope={reserve:vi.fn()},onFailure=vi.fn(),route={request:()=>({url:()=>url,allHeaders:async()=>({'accept':'text/html','X-Mitsa-Test-Authorization':'MUST-NOT-LEAK','x-mitsa-test-fixture':'old'})}),continue:vi.fn(async(_options:any)=>{}),abort:vi.fn(async()=>{})};
 await bindOnboardingBrowser({context:{route:async(_pattern:any,cb:any)=>{callback=cb;}},fixture:'e-a',authorization:'a'.repeat(64),scope,onFailure});return {scope,onFailure,route,run:()=>callback(route)};
}
it('adds the private fixture header only to the exact loopback origin and reserves before continuation',async()=>{
 const f=await fixture('http://127.0.0.1:3000/signup');await f.run();expect(f.scope.reserve).toHaveBeenCalledWith('browserRequests',{fixture:'e-a'});expect(f.route.continue.mock.calls[0][0].headers).toMatchObject({'x-mitsa-test-fixture':'e-a','x-mitsa-test-authorization':'a'.repeat(64)});expect(f.route.abort).not.toHaveBeenCalled();
});
it('strips private test credentials from Cloudflare challenge requests',async()=>{
 const f=await fixture('https://challenges.cloudflare.com/turnstile/v0/test');await f.run();expect(f.route.continue.mock.calls[0][0].headers).toEqual({accept:'text/html'});expect(f.route.abort).not.toHaveBeenCalled();
});
it.each(['https://other.example.com','http://127.0.0.1:3001/signup','https://mjtejwafxriwntweussc.supabase.co/auth/v1/signup','http://private@127.0.0.1:3000/signup'])('blocks browser bypass/foreign destination %s',async url=>{const f=await fixture(url);await f.run();expect(f.route.continue).not.toHaveBeenCalled();expect(f.route.abort).toHaveBeenCalledOnce();});
it('does not issue a request or expose details when the budget fails',async()=>{
 const f=await fixture('http://127.0.0.1:3000/signup');f.scope.reserve.mockImplementation(()=>{throw Error('PRIVATE-KEY');});await f.run();expect(f.route.continue).not.toHaveBeenCalled();expect(f.route.abort).toHaveBeenCalledOnce();expect(f.onFailure).toHaveBeenCalledWith('browser-budget-failed');
});
