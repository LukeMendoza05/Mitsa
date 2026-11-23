import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {randomBytes} from 'node:crypto';
const mocks=vi.hoisted(()=>({rpc:vi.fn(),runtime:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/supabase/server',()=>({runtimeConfig:()=>({origin:'http://127.0.0.1:3000',url:'https://synthetic.invalid',key:'synthetic-publishable'}),componentClient:async()=>({schema:()=>({rpc:mocks.rpc})})}));
vi.mock('@/lib/auth/development-registration',()=>({developmentRegistrationRuntime:mocks.runtime}));
import {registrationContext} from '../../src/lib/auth/registration';
import {registrationIntentionallyClosed} from '../../src/lib/auth/registration-policy';
const policy={id:crypto.randomUUID(),version:'synthetic-v1',hash:'synthetic-hash',content:'Synthetic agreement',status:'published',publicRegistration:true};
beforeEach(()=>{vi.stubEnv('MITSA_REGISTRATION_MODE','public');vi.stubEnv('MITSA_REGISTRATION_INTENT_KEY',randomBytes(32).toString('hex'));vi.stubEnv('MITSA_PUBLIC_CAPTCHA_PROVIDER','disabled');vi.stubEnv('MITSA_TURNSTILE_SITE_KEY','');vi.stubEnv('MITSA_TURNSTILE_SECRET_KEY','');mocks.rpc.mockResolvedValue({error:null,data:policy});vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({disable_signup:false,mailer_autoconfirm:false}))));});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
it('keeps public signup unavailable without configured human verification even with published database policy',async()=>{const context=await registrationContext();expect(context.enabled).toBe(false);expect(context.captchaSiteKey).toBeUndefined();});
it('exposes only the public sitekey and still requires provider email confirmation',async()=>{
 vi.stubEnv('MITSA_PUBLIC_CAPTCHA_PROVIDER','turnstile');vi.stubEnv('MITSA_TURNSTILE_SITE_KEY','synthetic-real-shaped-sitekey');vi.stubEnv('MITSA_TURNSTILE_SECRET_KEY','synthetic-secret-kept-server-only');const context=await registrationContext();expect(context.enabled).toBe(true);expect(context.captchaSiteKey).toBe('synthetic-real-shaped-sitekey');expect(JSON.stringify(context).includes('synthetic-secret-kept-server-only')).toBe(false);
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({disable_signup:false,mailer_autoconfirm:true}))));expect((await registrationContext()).enabled).toBe(false);
});
it('preserves isolated-test registration without loading or requiring an external challenge',async()=>{vi.stubEnv('MITSA_REGISTRATION_MODE','isolated-test');mocks.rpc.mockResolvedValue({error:null,data:{...policy,status:'test',publicRegistration:false}});const context=await registrationContext();expect(context.enabled).toBe(true);expect(context.isTest).toBe(true);expect(context.captchaSiteKey).toBeUndefined();});
it('requires real challenge configuration AND a healthy development mail runtime behind the database lease',async()=>{
 vi.stubEnv('NODE_ENV','development');vi.stubEnv('MITSA_REGISTRATION_MODE','development-open');
 vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>new Response(JSON.stringify({disable_signup:false,mailer_autoconfirm:false}))));
 mocks.rpc.mockResolvedValue({error:null,data:{...policy,status:'test',publicRegistration:false,pilotRegistration:true}});
 mocks.runtime.mockResolvedValue(null);expect((await registrationContext()).enabled).toBe(false);
 mocks.runtime.mockResolvedValue({phase:'general'});expect((await registrationContext()).enabled).toBe(false);
 vi.stubEnv('MITSA_PUBLIC_CAPTCHA_PROVIDER','turnstile');vi.stubEnv('MITSA_TURNSTILE_SITE_KEY','synthetic-real-shaped-sitekey');vi.stubEnv('MITSA_TURNSTILE_SECRET_KEY','synthetic-secret-kept-server-only');
 expect(await registrationContext()).toMatchObject({enabled:true,isDevelopmentOpen:true,isTest:false,requiresChallenge:true});
 mocks.runtime.mockResolvedValue({phase:'controlled',registrationAllowed:false});
 expect(await registrationContext()).toMatchObject({enabled:false,emailDeliveryEnabled:true,isDevelopmentOpen:true});
 mocks.rpc.mockResolvedValue({error:null,data:{...policy,status:'test',publicRegistration:false,pilotRegistration:false}});expect((await registrationContext()).enabled).toBe(false);
});
it('classifies an explicitly closed isolated lease without treating missing policy as intentional closure',async()=>{
 vi.stubEnv('NODE_ENV','development');vi.stubEnv('MITSA_REGISTRATION_MODE','development-open');
 mocks.rpc.mockResolvedValue({error:null,data:{...policy,status:'test',publicRegistration:false,pilotRegistration:false}});
 expect(await registrationContext()).toMatchObject({enabled:false,emailDeliveryEnabled:false,availability:'closed'});
 mocks.rpc.mockResolvedValue({error:null,data:null});expect(await registrationContext()).toMatchObject({enabled:false,availability:'unavailable'});
 expect(registrationIntentionallyClosed('development-open',{status:'test',publicRegistration:false,pilotRegistration:false},'https://wrong-origin.invalid')).toBe(false);
});
it('distinguishes a paused worker from missing signing, CAPTCHA or provider safeguards',async()=>{
 vi.stubEnv('NODE_ENV','development');vi.stubEnv('MITSA_REGISTRATION_MODE','development-open');
 vi.stubEnv('MITSA_PUBLIC_CAPTCHA_PROVIDER','turnstile');vi.stubEnv('MITSA_TURNSTILE_SITE_KEY','synthetic-real-shaped-sitekey');vi.stubEnv('MITSA_TURNSTILE_SECRET_KEY','synthetic-server-only');
 mocks.rpc.mockResolvedValue({error:null,data:{...policy,status:'test',publicRegistration:false,pilotRegistration:true}});mocks.runtime.mockResolvedValue(null);
 expect(await registrationContext()).toMatchObject({enabled:false,availability:'paused'});
 vi.stubEnv('MITSA_REGISTRATION_INTENT_KEY','');expect(await registrationContext()).toMatchObject({enabled:false,availability:'unavailable'});
});
it('labels a delivery-only continuation closed for new accounts while retaining its existing delivery readiness',async()=>{
 vi.stubEnv('NODE_ENV','development');vi.stubEnv('MITSA_REGISTRATION_MODE','development-open');
 vi.stubEnv('MITSA_PUBLIC_CAPTCHA_PROVIDER','turnstile');vi.stubEnv('MITSA_TURNSTILE_SITE_KEY','synthetic-real-shaped-sitekey');vi.stubEnv('MITSA_TURNSTILE_SECRET_KEY','synthetic-server-only');
 mocks.rpc.mockResolvedValue({error:null,data:{...policy,status:'test',publicRegistration:false,pilotRegistration:true}});mocks.runtime.mockResolvedValue({phase:'controlled',registrationAllowed:false});
 expect(await registrationContext()).toMatchObject({enabled:false,emailDeliveryEnabled:true,availability:'closed'});
});
