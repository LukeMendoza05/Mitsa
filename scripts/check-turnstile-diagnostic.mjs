// Local missing-configuration/browser checks only. No real challenge or signup.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {parse} from 'dotenv';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const local=parse(readFileSync('.env.local'));
assert.equal(local.MITSA_REGISTRATION_MODE,'isolated-test');assert(!local.MITSA_TURNSTILE_SITE_KEY&&!local.MITSA_TURNSTILE_SECRET_KEY,'Private key setup changed; use the actual widget diagnostic instead');
let browser;const report={checkedAt:new Date().toISOString(),keysConfigured:false,liveCloudflareValidationTested:false,accountCreated:false,externalEmailsSent:0,checks:[],privateValuesPrinted:false};
try{
 browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext(),page=await context.newPage();let cloudflareRequests=0;
 page.on('request',request=>{if(new URL(request.url()).hostname==='challenges.cloudflare.com')cloudflareRequests++;});
 await page.goto('http://127.0.0.1:3000/testing/registration');assert(await page.getByText('Turnstile keys are not configured.',{exact:false}).isVisible());
 for(const width of [320,390,768,1024,1440]){
  await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations,[]);report.checks.push({width,noOverflow:true,axeViolations:0});
 }
 const missing=await context.request.post('http://127.0.0.1:3000/testing/registration/challenge',{headers:{origin:'http://127.0.0.1:3000'},form:{captchaToken:'synthetic-proof'}});assert.equal(missing.status(),503);assert.deepEqual(await missing.json(),{verified:false});
 const cross=await context.request.post('http://127.0.0.1:3000/testing/registration/challenge',{headers:{origin:'https://attacker.invalid'},form:{captchaToken:'synthetic-proof'}});assert.equal(cross.status(),403);
 const production=await context.request.post('http://127.0.0.1:3001/testing/registration/challenge',{headers:{origin:'http://127.0.0.1:3001'},form:{captchaToken:'synthetic-proof'}});assert.equal(production.status(),404);
 const productionPage=await context.request.get('http://127.0.0.1:3001/testing/registration');assert.equal(productionPage.status(),404);
 assert.equal(cloudflareRequests,0);Object.assign(report,{missingConfigRejected:true,crossOriginRejected:true,productionEndpoint404:true,productionGuide404:true,cloudflareRequests,passed:true});
 mkdirSync('docs/previews/turnstile',{recursive:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'docs/previews/turnstile/local-guide-mobile.png',fullPage:true});
 writeFileSync('artifacts/turnstile-local-diagnostic.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch{console.error('Local CAPTCHA diagnostic check failed; private details suppressed');process.exitCode=1;}
finally{if(browser)await browser.close();}
