// Active controlled-window NEGATIVE probes only. No valid CAPTCHA, signed
// intent, account creation, email request or workspace grant is issued here.
import {readFileSync,writeFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';import assert from 'node:assert/strict';
import {parse} from 'dotenv';import pg from 'pg';import {createClient} from '@supabase/supabase-js';
import {assertTestTarget} from './test-target.mjs';import {testDatabaseConfig} from './postgres-config.mjs';import {recipientHash} from './lib/development-mail.mjs';
let db,stage='target';const checks=[];
try {
 const config=JSON.parse(readFileSync('config/test-target.json')),operator=parse(readFileSync('.secrets/operator.env')),local=parse(readFileSync('.env.local'));
 const target=assertTestTarget({projectRef:operator.TEST_PROJECT_REF,url:operator.TEST_SUPABASE_URL,databaseUrl:operator.TEST_DATABASE_URL},config);
 assert.equal(target.projectRef,'mjtejwafxriwntweussc');assert.equal(local.SUPABASE_URL,target.url);assert.equal(local.APP_ORIGIN,'http://127.0.0.1:3000');assert.equal(local.MITSA_REGISTRATION_MODE,'development-open');
 const runtime=JSON.parse(readFileSync('.secrets/isolated-registration/runtime.json')),email=JSON.parse(readFileSync('.secrets/onboarding-recipient.json')).email.trim().toLowerCase();
 assert.equal(runtime.phase,'controlled');assert.equal(runtime.recipientHash,recipientHash(email));
 db=new pg.Client(testDatabaseConfig(operator.TEST_DATABASE_URL,config));await db.connect();assert.equal((await db.query('select marker from foundation_probe.environment_identity where singleton')).rows[0]?.marker,target.databaseMarker);
 assert.equal((await db.query('select private.mitsa_pilot_registration_open() open')).rows[0].open,true);
 const claims=async()=>(await db.query('select count(*)::int n from private.pilot_mail_deliveries where created_at>=$1',[runtime.approvedAt])).rows[0].n;
 const before=await claims();assert.equal(before,0);
 const client=createClient(target.url,local.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const policy=(await client.schema('api').rpc('mitsa_registration_policy')).data;assert(policy?.pilotRegistration===true&&policy.publicRegistration===false);
 stage='app-ready';let ready=false;
 for(let attempt=0;attempt<10&&!ready;attempt++){
  const page=await fetch(`${local.APP_ORIGIN}/signup`,{signal:AbortSignal.timeout(15000)}),body=await page.text();
  ready=page.status===200&&!body.includes('Registration unavailable')&&body.includes(local.MITSA_TURNSTILE_SITE_KEY)&&page.headers.get('content-security-policy')?.includes('https://challenges.cloudflare.com');
  if(!ready)await new Promise(resolve=>setTimeout(resolve,1000));
 }
 assert(ready);checks.push({name:'controlled-signup-page-with-CAPTCHA',passed:true});
 const password=`Synthetic!${randomUUID()}`,unknown=`foundation-controlled-denied-${randomUUID()}@example.invalid`;
 const base={fullName:'Synthetic controlled security probe',email,password,confirmPassword:password,termsVersion:policy.id,accepted:'on'};
 async function post(fields={},origin=local.APP_ORIGIN){return fetch(`${local.APP_ORIGIN}/auth/register`,{method:'POST',headers:{origin,'x-mitsa-form':'1'},body:new URLSearchParams({...base,...fields}),redirect:'manual',signal:AbortSignal.timeout(20000)});}
 for(const [name,fields,status,code] of [
  ['missing-CAPTCHA',{},403,'challenge'],['invalid-CAPTCHA',{captchaToken:'invalid-controlled-proof'},403,'challenge'],
  ['other-recipient',{email:unknown},403,'controlled_recipient'],['unchecked-Terms',{accepted:''},422,'input'],['injected-owner-role',{role:'owner'},422,'input']
 ]){stage=name;const response=await post(fields),body=await response.json();assert.equal(response.status,status);assert.equal(body.error?.code,code);assert.equal(response.headers.get('set-cookie'),null);checks.push({name,passed:true});}
 stage='CSRF';assert.equal((await post({},'https://attacker.invalid')).status,403);checks.push({name:'CSRF',passed:true});
 stage='direct-provider';const direct=await client.auth.signUp({email:unknown,password,options:{emailRedirectTo:`${local.APP_ORIGIN}/auth/email`,data:{registration_nonce:'0'.repeat(64),role:'owner',terms_accepted:true}}});
 assert(direct.error);assert.equal(direct.data.session,null);assert.equal(direct.data.user,null);checks.push({name:'forged-direct-Supabase-signup',passed:true});
 stage='unsigned-intent';const unsigned=await fetch(`${target.url}/functions/v1/mitsa-registration-intent`,{method:'POST',headers:{apikey:local.SUPABASE_PUBLISHABLE_KEY,origin:local.APP_ORIGIN,'content-type':'application/json'},body:JSON.stringify({email:unknown,fullName:'Synthetic forged intent',termsVersion:policy.id,accepted:true}),signal:AbortSignal.timeout(15000)});assert.equal(unsigned.status,401);checks.push({name:'unsigned-private-intent',passed:true});
 stage='absence-of-side-effects';
 assert.equal((await db.query('select count(*)::int n from auth.users where email=any($1::text[])',[[email,unknown]])).rows[0].n,0);
 assert.equal((await db.query('select count(*)::int n from private.registration_intents where email=any($1::text[])',[[email,unknown]])).rows[0].n,0);
 assert.equal(await claims(),before);
 const report={checkedAt:new Date().toISOString(),project:target.projectRef,phase:'controlled',checks,passed:true,accountsCreated:0,intentsCreated:0,smtpClaimsAdded:0,realSignupStillPending:true,privateValuesPrinted:false};
 writeFileSync('artifacts/controlled-registration-boundary-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch{console.error(JSON.stringify({status:'Controlled boundary check failed; stop window before continuing',stage,privateValuesPrinted:false}));process.exitCode=1;}finally{await db?.end();}
