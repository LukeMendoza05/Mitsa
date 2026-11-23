import {it,expect} from 'vitest';
import {parse} from 'dotenv';
import {prepareTurnstileConfig} from '../../scripts/lib/turnstile-local-config.mjs';
const site='synthetic-widget-site-key',secret='synthetic-private-widget-secret';
it('changes only CAPTCHA settings and preserves closed registration and unrelated secrets',()=>{
 const source='# retained\r\nMITSA_REGISTRATION_MODE=isolated-test\r\nMITSA_EMAIL_OTP_LENGTH=6\r\nUNRELATED_PRIVATE_VALUE="unchanged"\r\nMITSA_PUBLIC_CAPTCHA_PROVIDER=disabled\r\n';
 const next=prepareTurnstileConfig(source,site,secret),env=parse(next);
 expect(env.MITSA_REGISTRATION_MODE).toBe('isolated-test');expect(env.MITSA_EMAIL_OTP_LENGTH).toBe('6');expect(env.UNRELATED_PRIVATE_VALUE).toBe('unchanged');
 expect(env.MITSA_PUBLIC_CAPTCHA_PROVIDER).toBe('turnstile');expect(env.MITSA_TURNSTILE_SITE_KEY).toBe(site);expect(env.MITSA_TURNSTILE_SECRET_KEY).toBe(secret);expect(next.startsWith('# retained\r\n')).toBe(true);
});
it('refuses public, pilot, disabled or missing registration modes',()=>{
 for(const mode of ['public','controlled-pilot','disabled',''])expect(()=>prepareTurnstileConfig(`MITSA_REGISTRATION_MODE=${mode}`,site,secret)).toThrow('Local isolated-test mode is required');
});
it('rejects dummy keys, unsafe text and duplicate settings without exposing caller values',()=>{
 const source='MITSA_REGISTRATION_MODE=isolated-test\n';
 expect(()=>prepareTurnstileConfig(source,secret,secret)).toThrow('Real widget keys are required');
 for(const key of ['1x00000000000000000000AA','2x0000000000000000000000000000000AA','private value with whitespace',secret+'\nINJECTED=1']){
  let message='';try{prepareTurnstileConfig(source,site,key);}catch(error){message=(error as Error).message;}expect(message).toBe('Real widget keys are required');expect(message.includes(key)).toBe(false);
 }
 expect(()=>prepareTurnstileConfig(source+'MITSA_TURNSTILE_SITE_KEY=a\nMITSA_TURNSTILE_SITE_KEY=b',site,secret)).toThrow('Duplicate CAPTCHA configuration');
});
