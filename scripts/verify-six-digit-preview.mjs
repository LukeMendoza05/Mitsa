// Candidate UI only: no registration, code verification or SMTP request.
import {readFileSync,writeFileSync} from 'node:fs';import {parse} from 'dotenv';import {chromium} from 'playwright';import AxeBuilder from '@axe-core/playwright';import assert from 'node:assert/strict';
import {sealAuthFlow,signupCodeCookie} from '../src/lib/security/auth-flow.ts';
const origin='http://127.0.0.1:3002',key=parse(readFileSync('.env.local')).AUTH_FLOW_KEY,browser=await chromium.launch({channel:'msedge',headless:true}),checks=[];
try{
 for(const javaScriptEnabled of [true,false]){
  const context=await browser.newContext({javaScriptEnabled,reducedMotion:'reduce'}),page=await context.newPage(),now=Date.now();
  try{
   await context.addCookies([{name:signupCodeCookie,value:sealAuthFlow({purpose:'signup-code',email:'foundation-six-layout@example.invalid',issuedAt:now,resendAt:now+60000,expiresAt:now+3600000},key),url:origin,httpOnly:true,sameSite:'Strict'}]);
   await page.goto(`${origin}/verify-email`);const input=page.getByLabel('Verification code',{exact:true});assert.equal(await input.getAttribute('maxlength'),'6');assert.equal(await input.getAttribute('pattern'),'[0-9]{6}');assert((await page.locator('main').innerText()).includes('six-digit'));
   // Axe requires page timers, which Chromium disables with JavaScript off.
   // Scan the enhanced page; exercise native labels/keyboard/validation below.
   for(const width of [320,390,768,1024,1440]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));if(javaScriptEnabled)assert.deepEqual((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations,[]);checks.push({javaScriptEnabled,width,accessibilityScan:javaScriptEnabled,noOverflow:true});}
   await page.keyboard.press('Tab');assert(await page.getByRole('link',{name:'Skip to content'}).evaluate(el=>el===document.activeElement));
   await input.fill('123456');assert(await input.evaluate(el=>el.checkValidity()));await input.evaluate(el=>{el.value='12345678';});assert.equal(await input.evaluate(el=>el.checkValidity()),false);await input.fill('');
   // No valid candidate code is submitted to the still-eight-digit provider.
   const result=await context.request.post(`${origin}/auth/email/code`,{headers:{origin},form:{action:'verify',code:'12345678'},maxRedirects:0});assert.equal(result.status(),303);assert(result.headers().location.endsWith('/verify-email?error=input'));
   checks.push({javaScriptEnabled,alternateLengthRejectedBeforeProvider:true,illustrativeInputCleared:true});
   console.log(JSON.stringify({candidatePageChecked:true,javaScriptEnabled,providerCodeSubmitted:false}));
  }finally{await context.close();}
 }
 writeFileSync('artifacts/six-digit-ui-readiness.json',JSON.stringify({checkedAt:new Date().toISOString(),candidateOnly:true,realSixDigitProviderVerification:false,providerConfigurationChanged:false,externalEmailsSent:0,checks},null,2)+'\n');console.log(JSON.stringify({candidateChecks:checks.length,passed:true,providerConfigurationChanged:false,externalEmailsSent:0}));
}finally{await browser.close();}
