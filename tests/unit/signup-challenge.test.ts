import {it,expect,vi,afterEach} from 'vitest';
vi.mock('server-only',()=>({}));
import {signupChallengeConfig,verifySignupChallenge,checkSignupChallenge,inspectSignupChallenge,requiresSignupChallenge} from '../../src/lib/auth/signup-challenge';
const config={siteKey:'synthetic-real-shaped-sitekey',secret:'synthetic-private-secret-for-tests'},now=Date.now();
const good={success:true,hostname:'127.0.0.1',action:'signup',challenge_ts:new Date(now-1000).toISOString()};
afterEach(()=>vi.unstubAllGlobals());
it('requires real configured keys for public signup and rejects published dummy keys',()=>{
 expect(signupChallengeConfig({})).toBeNull();expect(signupChallengeConfig({MITSA_PUBLIC_CAPTCHA_PROVIDER:'turnstile',MITSA_TURNSTILE_SITE_KEY:config.siteKey,MITSA_TURNSTILE_SECRET_KEY:config.secret})).toEqual(config);
 expect(signupChallengeConfig({MITSA_PUBLIC_CAPTCHA_PROVIDER:'turnstile',MITSA_TURNSTILE_SITE_KEY:config.secret,MITSA_TURNSTILE_SECRET_KEY:config.secret})).toBeNull();
 for(const key of ['1x00000000000000000000AA','2x00000000000000000000AB','3x00000000000000000000FF'])expect(signupChallengeConfig({MITSA_PUBLIC_CAPTCHA_PROVIDER:'turnstile',MITSA_TURNSTILE_SITE_KEY:key,MITSA_TURNSTILE_SECRET_KEY:config.secret})).toBeNull();
 expect(requiresSignupChallenge({status:'published',publicRegistration:true})).toBe(true);expect(requiresSignupChallenge({status:'test',publicRegistration:false})).toBe(false);
});
it('keeps inspection bounded and distinguishes generic invalidity from explicit provider expiry and server expiry',async()=>{
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
 fetch.mockResolvedValue(new Response(JSON.stringify({success:false,'error-codes':['invalid-input-response'],private:'never return this'})));
 expect(await inspectSignupChallenge('synthetic-proof','http://127.0.0.1:3000',config,now)).toEqual({kind:'rejected',reason:'provider-invalid-token'});
 fetch.mockResolvedValue(new Response(JSON.stringify({...good,challenge_ts:new Date(now-301000).toISOString()})));
 expect(await inspectSignupChallenge('synthetic-proof','http://127.0.0.1:3000',config,now)).toEqual({kind:'rejected',reason:'server-expired'});
});
it('refuses missing configuration, missing/oversized proof before any external request',async()=>{
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);for(const value of [undefined,'','x'.repeat(2049)])expect(await verifySignupChallenge(value,'http://127.0.0.1:3000',config,now)).toBe(false);
 expect(await verifySignupChallenge('synthetic-proof','http://127.0.0.1:3000',null,now)).toBe(false);expect(fetch).not.toHaveBeenCalled();
});
it('validates provider success, action, hostname and bounded age before issuing any intent',async()=>{
 const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify(good)));vi.stubGlobal('fetch',fetch);
 expect(await verifySignupChallenge('synthetic-proof','http://127.0.0.1:3000',config,now)).toBe(true);
 const [url,options]=fetch.mock.calls[0];expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');expect(options.cache).toBe('no-store');expect(options.body.get('response')).toBe('synthetic-proof');expect(options.body.get('secret')).toBe(config.secret);
 for(const change of [{success:false},{action:'login'},{hostname:'attacker.invalid'},{challenge_ts:new Date(now-300001).toISOString()},{challenge_ts:new Date(now+6000).toISOString()},{challenge_ts:'invalid'}]){fetch.mockResolvedValue(new Response(JSON.stringify({...good,...change})));expect(await verifySignupChallenge('synthetic-proof','http://127.0.0.1:3000',config,now)).toBe(false);}
});
it('fails closed for replay/expiry, malformed responses, provider errors and network failures',async()=>{
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
 for(const response of [new Response(JSON.stringify({success:false,'error-codes':['timeout-or-duplicate']})),new Response('invalid json'),new Response('',{status:503})]){fetch.mockResolvedValue(response);expect(await verifySignupChallenge('synthetic-proof','http://127.0.0.1:3000',config,now)).toBe(false);}
 fetch.mockRejectedValue(Error('Private provider details'));expect(await verifySignupChallenge('synthetic-proof','http://127.0.0.1:3000',config,now)).toBe(false);
});
it('distinguishes explicit expired/duplicate proofs from outages without returning private response data',async()=>{
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
 fetch.mockResolvedValue(new Response(JSON.stringify({success:false,'error-codes':['timeout-or-duplicate'],secret:'synthetic-private-value'})));
 expect(await checkSignupChallenge('synthetic-proof','http://127.0.0.1:3000',config,now)).toEqual({kind:'expired-or-duplicate'});
 fetch.mockResolvedValue(new Response(JSON.stringify({success:false,'error-codes':['invalid-input-response']})));
 expect(await checkSignupChallenge('synthetic-proof','http://127.0.0.1:3000',config,now)).toEqual({kind:'rejected'});
 fetch.mockRejectedValue(Error('private provider details'));
 expect(await checkSignupChallenge('synthetic-proof','http://127.0.0.1:3000',config,now)).toEqual({kind:'unavailable'});
});
