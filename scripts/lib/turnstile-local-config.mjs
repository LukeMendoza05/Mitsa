import {parse} from 'dotenv';

// Pure preparation only. Never include caller values in errors or diagnostics.
export function prepareTurnstileConfig(text, siteKey, secretKey) {
 const env=parse(text);
 if(env.MITSA_REGISTRATION_MODE!=='isolated-test')throw Error('Local isolated-test mode is required');
 if(typeof siteKey!=='string'||typeof secretKey!=='string'||siteKey===secretKey||siteKey.length<20||siteKey.length>256||secretKey.length<20||secretKey.length>512||
  [siteKey,secretKey].some(value=>!/^[A-Za-z0-9_-]+$/.test(value)||/^[123]x0{15,}/.test(value)))throw Error('Real widget keys are required');
 const updates={MITSA_PUBLIC_CAPTCHA_PROVIDER:'turnstile',MITSA_TURNSTILE_SITE_KEY:siteKey,MITSA_TURNSTILE_SECRET_KEY:secretKey};
 const newline=text.includes('\r\n')?'\r\n':'\n';let next=text;
 for(const [name,value] of Object.entries(updates)){
  const expression=new RegExp(`^(?:export[ \\t]+)?${name}[ \\t]*=.*$`,'gm');
  const matches=[...next.matchAll(expression)];
  if(matches.length>1)throw Error('Duplicate CAPTCHA configuration must be resolved privately');
  if(matches.length)next=next.replace(expression,`${name}=${value}`);
  else next+=(next.endsWith('\n')?'':newline)+`${name}=${value}${newline}`;
 }
 const after=parse(next);
 for(const name of new Set([...Object.keys(env),...Object.keys(after)])){
  if(!(name in updates)&&env[name]!==after[name])throw Error('Unrelated configuration changed');
 }
 return next;
}
