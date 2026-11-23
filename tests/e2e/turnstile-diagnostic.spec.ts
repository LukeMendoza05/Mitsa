import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdirSync} from 'node:fs';
// Clearly mocked widget/validator UI tests only. No real CAPTCHA is solved,
// provider proof obtained, signup performed or public gate opened here.
const widget=`window.fixtureRemovals=0;window.turnstile={render:function(target,options){window.fixtureOptions=options;var button=document.createElement('button');button.type='button';button.textContent='Complete synthetic challenge';button.onclick=function(){options.callback('synthetic-proof-only')};target.replaceChildren(button);return 'fixture-widget'},remove:function(){window.fixtureRemovals++;document.querySelector('[aria-label="Human verification"]')?.replaceChildren()}};`;
async function fixture(page:Page){
 let registrationRequests=0;
 await page.route('**/auth/register',route=>{registrationRequests++;return route.abort();});
 await page.route('https://challenges.cloudflare.com/**',async route=>{
  if(new URL(route.request().url()).pathname==='/turnstile/v0/api.js')await route.fulfill({contentType:'application/javascript',body:widget});
  else await route.abort();
 });
 await page.goto('/testing/registration');
 await expect(page.getByRole('button',{name:'Complete synthetic challenge',exact:true})).toBeVisible();
 return ()=>expect(registrationRequests).toBe(0);
}
test('success reports replay evidence and double submission stays locked',async({page})=>{
 const noRegistration=await fixture(page);let checks=0;
 await page.route('**/testing/registration/challenge',async route=>{checks++;await new Promise(resolve=>setTimeout(resolve,400));await route.fulfill({json:{verified:true,replayRejected:true}});});
 await page.getByRole('button',{name:'Complete synthetic challenge',exact:true}).click();
 await page.getByRole('button',{name:'Check server verification',exact:true}).click();
 await expect(page.getByRole('button',{name:'Checking…',exact:true})).toBeDisabled();
 await expect(page.getByText('Server verification and replay protection passed. No account was created.',{exact:true})).toBeVisible();
 expect(checks).toBe(1);await expect(page.getByRole('button',{name:'Check server verification',exact:true})).toBeDisabled();noRegistration();
});
test('held unconsumed proof cannot be submitted before real countdown deadline',async({page})=>{
 await page.clock.install();const noRegistration=await fixture(page);let checks=0,expiryMode=false;
 await page.route('**/testing/registration/challenge',async route=>{checks++;expiryMode=(route.request().postData()??'').includes('expiry');await route.fulfill({json:{verified:false,expiredRejected:true,reason:'provider-expired-or-duplicate'}});});
 await page.getByRole('button',{name:'Complete synthetic challenge',exact:true}).click();await page.getByRole('button',{name:'Start expiry test',exact:true}).click();
 await expect(page.getByRole('button',{name:'Complete synthetic challenge',exact:true})).toHaveCount(0);
 expect(await page.evaluate(()=>Reflect.get(window,'fixtureRemovals'))).toBe(0);
 expect(await page.evaluate(()=>Reflect.get(window,'fixtureOptions')['refresh-expired'])).toBe('never');
 await page.evaluate(()=>Reflect.get(window,'fixtureOptions')['expired-callback']());
 await page.setViewportSize({width:320,height:900});expect(await page.evaluate(()=>Reflect.get(window,'fixtureRemovals'))).toBe(0);
 await expect(page.getByText(/Automatic expiry check in 301s/)).toBeVisible();
 await page.clock.fastForward(300000);expect(checks).toBe(0);
 await page.clock.fastForward(1000);
 await expect(page.getByText('Expired proof was rejected. No account was created.',{exact:true})).toBeVisible();expect(checks).toBe(1);expect(expiryMode).toBe(true);noRegistration();
});
test('cancel clears held proof and a provider outage cannot report success',async({page})=>{
 const noRegistration=await fixture(page);let checks=0;
 await page.route('**/testing/registration/challenge',async route=>{checks++;await route.fulfill({status:503,json:{verified:false,replayRejected:false}});});
 await page.getByRole('button',{name:'Complete synthetic challenge',exact:true}).click();await page.getByRole('button',{name:'Start expiry test',exact:true}).click();
 await page.getByRole('button',{name:'Cancel expiry test…',exact:true}).click();
 await expect(page.getByText(/Automatic expiry check in/)).toBeVisible();expect(checks).toBe(0);
 await page.getByRole('button',{name:'Discard held proof',exact:true}).click();await expect(page.getByRole('button',{name:'Start expiry test',exact:true})).toBeDisabled();expect(checks).toBe(0);
 await page.getByRole('button',{name:'Complete synthetic challenge',exact:true}).click();await page.getByRole('button',{name:'Check server verification',exact:true}).click();
 await expect(page.getByText('Server verification did not pass. Complete a new challenge and try again.',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Check server verification',exact:true})).toBeDisabled();noRegistration();
});
test('development controls remain readable, keyboard accessible and responsive',async({page},info)=>{
 const noRegistration=await fixture(page);await page.emulateMedia({reducedMotion:'reduce'});
 await page.getByRole('button',{name:'Complete synthetic challenge',exact:true}).click();await page.getByRole('button',{name:'Start expiry test',exact:true}).click();
 for(const width of [320,390,768,1024,1440]){
  await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const violations=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations;expect(violations).toEqual([]);
 }
 await page.getByRole('button',{name:'Cancel expiry test…',exact:true}).focus();await page.keyboard.press('Enter');
 await page.getByRole('button',{name:'Keep waiting',exact:true}).click();await expect(page.getByText(/Automatic expiry check in/)).toBeVisible();
 await page.getByRole('button',{name:'Cancel expiry test…',exact:true}).click();await page.getByRole('button',{name:'Discard held proof',exact:true}).focus();await page.keyboard.press('Enter');
 await expect(page.getByText('Expiry test cancelled. The held proof was cleared.',{exact:true})).toBeVisible();
 await page.setViewportSize({width:info.project.name==='desktop'?1440:390,height:1000});mkdirSync('docs/previews/turnstile',{recursive:true});
 await page.screenshot({path:`docs/previews/turnstile/diagnostic-fixture-${info.project.name}.png`,fullPage:true});noRegistration();
});

test('automatic expiry cannot mistake a provider outage for rejection, and cancellation confirmation alone keeps the proof',async({page})=>{
 await page.clock.install();const noRegistration=await fixture(page);let checks=0;
 await page.route('**/testing/registration/challenge',async route=>{checks++;await route.fulfill({status:503,json:{verified:false,expiredRejected:false,reason:'provider-network'}});});
 await page.getByRole('button',{name:'Complete synthetic challenge',exact:true}).click();await page.getByRole('button',{name:'Start expiry test',exact:true}).click();
 await page.getByRole('button',{name:'Cancel expiry test…',exact:true}).click();
 await page.clock.fastForward(301000);
 await expect(page.getByText('The server could not reach Cloudflare or the request timed out. Expiration rejection is not confirmed.',{exact:true})).toBeVisible();expect(checks).toBe(1);noRegistration();
});

test('holds the exact original proof despite replacement callbacks, expiration and widget errors; generic invalidity is not an expiry pass',async({page})=>{
 await page.clock.install();const noRegistration=await fixture(page);let checks=0,originalProofReceived=false;
 await page.route('**/testing/registration/challenge',async route=>{
  checks++;
  // This fixture uses only invented strings. Keep the assertion boolean so no
  // request payload is needed in test output, including on failure.
  const data=route.request().postData()??'';
  originalProofReceived=data.includes('synthetic-proof-only')&&!data.includes('synthetic-replacement-proof');
  await route.fulfill({status:403,json:{verified:false,expiredRejected:false,reason:'provider-invalid-token'}});
 });
 await page.getByRole('button',{name:'Complete synthetic challenge',exact:true}).click();
 await page.getByRole('button',{name:'Start expiry test',exact:true}).click();
 await page.evaluate(()=>{
  const options=Reflect.get(window,'fixtureOptions');
  options.callback('synthetic-replacement-proof');options['expired-callback']();options['error-callback']();
 });
 await page.setViewportSize({width:320,height:900});expect(await page.evaluate(()=>Reflect.get(window,'fixtureRemovals'))).toBe(0);
 await page.clock.fastForward(301000);
 await expect(page.getByText('Cloudflare rejected the held proof as invalid-input-response (invalid, malformed, or expired). Expiration-specific rejection is not confirmed. No account was created.',{exact:true})).toBeVisible();
 expect(originalProofReceived).toBe(true);expect(checks).toBe(1);noRegistration();
});
