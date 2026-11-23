// Read-only browser rendering with an ephemeral sealed continuation for the
// already-created synthetic account. Never posts, resends, verifies or signs in.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import assert from 'node:assert/strict';import {parse} from 'dotenv';import pg from 'pg';
import {chromium} from '@playwright/test';import AxeBuilder from '@axe-core/playwright';
import {testDatabaseConfig} from './postgres-config.mjs';import {assertTestTarget} from './test-target.mjs';import {sealAuthFlow,signupCodeCookie} from '../src/lib/security/auth-flow.ts';
let db,browser;
try {
 const e=parse(readFileSync('.env.local')),o=parse(readFileSync('.secrets/operator.env')),cfg=JSON.parse(readFileSync('config/test-target.json')),binding=JSON.parse(readFileSync('.secrets/isolated-registration/pending-onboarding.json'));
 const target=assertTestTarget({projectRef:o.TEST_PROJECT_REF,url:o.TEST_SUPABASE_URL,databaseUrl:o.TEST_DATABASE_URL},cfg);assert.equal(target.projectRef,'mjtejwafxriwntweussc');assert.equal(e.APP_ORIGIN,'http://127.0.0.1:3000');assert.equal(binding.project,target.projectRef);
 const email=JSON.parse(readFileSync('.secrets/onboarding-recipient.json')).email.trim().toLowerCase();
 db=new pg.Client(testDatabaseConfig(o.TEST_DATABASE_URL,cfg));await db.connect();await db.query('begin read only');assert.equal((await db.query('select marker from foundation_probe.environment_identity where singleton')).rows[0].marker,target.databaseMarker);
 assert.equal((await db.query('select private.mitsa_pilot_registration_open() open')).rows[0].open,false);
 const row=(await db.query('select created_at from private.registration_intents where id=$1 and provider_user_id=$2 and email=$3 and finalized_at is null',[binding.intentId,binding.userId,email])).rows[0];assert(row);await db.query('commit');
 const issuedAt=row.created_at.getTime(),cookie=sealAuthFlow({purpose:'signup-code',email,intentId:binding.intentId,issuedAt,resendAt:issuedAt+60000,expiresAt:issuedAt+86400000},e.AUTH_FLOW_KEY);
 browser=await chromium.launch({channel:'msedge',headless:true});const cases=[];mkdirSync('artifacts/verification-continuation',{recursive:true});
 for(const [width,height,javascript] of [[1440,1000,true],[390,844,true],[390,844,false]]){
  const context=await browser.newContext({viewport:{width,height},javaScriptEnabled:javascript}),page=await context.newPage();let posts=0,errors=0;
  page.on('request',request=>{if(request.method()==='POST')posts++;});page.on('pageerror',()=>errors++);
  await context.addCookies([{name:signupCodeCookie,value:cookie,url:e.APP_ORIGIN,httpOnly:true,sameSite:'Strict'}]);
  await page.goto(e.APP_ORIGIN+'/verify-email?error=unavailable');
  const content=await page.locator('body').textContent();assert(!content.includes(email));
  assert(content.includes('controlled email-delivery window is closed'));assert(!content.includes('verification service couldn’t complete'));
  assert(await page.getByRole('button',{name:'Verify email',exact:true}).isEnabled());assert(await page.getByRole('button',{name:'Resend code',exact:true}).isDisabled());
  assert(await page.getByLabel('Verification code',{exact:true}).isVisible());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(javascript){assert.equal((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.length,0);await page.screenshot({path:`artifacts/verification-continuation/closed-${width}.png`,fullPage:true});}
  assert.equal(posts,0);assert.equal(errors,0);cases.push({width,javascript,closedDeliveryExplained:true,verificationStillEnabled:true,resendDisabled:true,noIdentityDisplayed:true,noOverflow:true,posts,errors});await context.close();
 }
 writeFileSync('artifacts/pending-verification-page-results.json',JSON.stringify({checkedAt:new Date().toISOString(),project:target.projectRef,cases,passed:true,remoteChanges:0,emailsSent:0,privateValuesPrinted:false},null,2)+'\n');console.log(JSON.stringify({browserCasesPassed:cases.length,emailsSent:0,verificationAttempts:0,remoteChanges:0,privateValuesPrinted:false}));
}catch{try{await db?.query('rollback');}catch{}console.error('Read-only verification-page check failed; private details suppressed.');process.exitCode=1;}finally{await browser?.close();await db?.end();}
