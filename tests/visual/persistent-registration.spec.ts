import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const widths=[320,390,768,1024,1440];
const previewDirectory=process.env.MITSA_AUTH_PREVIEW_DIR??'docs/previews/persistent-registration';
const evidencePath=process.env.MITSA_AUTH_SCOPE_REPORT??'artifacts/persistent-registration-browser-scope.json';
test.beforeEach(async({page})=>{await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:3107'?route.continue():route.abort());});
async function fill(page:Page) {
 await page.getByLabel('Full name',{exact:true}).fill('Synthetic Stage A');await page.getByLabel('Email',{exact:true}).fill('synthetic-stage-a@example.invalid');
 await page.getByLabel('Password',{exact:true}).fill('Synthetic-stage-a-pass-123!');await page.getByLabel('Confirm password',{exact:true}).fill('Synthetic-stage-a-pass-123!');
 await page.getByRole('checkbox').check();
}
for(const path of ['/signup?persistent=1','/forgot-password?persistent=1','/verify-email?persistent=1','/verify-email/renew?persistent=1'])test(`responsive and accessible ${path}`,async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.name));
 await page.goto(path);await expect(page.locator('h1')).toBeVisible();await page.evaluate(()=>document.fonts.ready);
 for(const width of widths){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(width===320||width===1440)expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([]);
  if(width===390||width===1440){for(const input of await page.locator('input[type=password],input[name=code]').all())await expect(input).toHaveValue('');mkdirSync(previewDirectory,{recursive:true});await page.screenshot({path:`${previewDirectory}/${path.split('?')[0].replaceAll('/','-')}-${width}.png`,fullPage:true});}
 }
 expect(errors).toEqual([]);
});
test('uncertain signup preserves fields and the original identifier without making another provider request',async({page})=>{
 await page.goto('/signup?persistent=1');await fill(page);
 const before=await page.locator('input[name=submissionId]').inputValue();let posts=0;
 await page.route('**/auth/register',route=>{posts++;return route.abort();});
 await page.getByRole('button',{name:'Create account',exact:true}).click();await expect(page.getByRole('alert')).toBeFocused();
 await expect(page.getByRole('button',{name:'Check registration status',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Create account',exact:true})).toBeDisabled();
 await page.route('**/auth/registration/status',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({state:'checking'})}));
 await page.getByRole('button',{name:'Check registration status',exact:true}).click();expect(posts).toBe(1);
 await page.getByRole('button',{name:'Retry this same request',exact:true}).click();await expect(page.locator('input[name=submissionId]')).toHaveValue(before);
 await expect(page.getByLabel('Full name',{exact:true})).toHaveValue('Synthetic Stage A');await expect(page.getByLabel('Email',{exact:true})).toHaveValue('synthetic-stage-a@example.invalid');
 await page.getByRole('button',{name:'Create account',exact:true}).click();expect(posts).toBe(2); // Same identifier; atomic provider claim is tested in PostgreSQL.
});
test('recovery uses its own challenge action and a durable request key',async({page})=>{
 await page.goto('/forgot-password?persistent=1');await expect(page.getByRole('button',{name:'Request reset link',exact:true})).toBeEnabled();
 expect(await page.evaluate(()=>Reflect.get(window,'fixtureChallengeAction'))).toBe('recovery');
 expect(await page.locator('input[name=requestKey]').inputValue()).toMatch(/^[a-f0-9-]{36}$/);
 await page.getByLabel('Email',{exact:true}).fill('unknown-synthetic@example.invalid');
 await page.route('**/auth/password/request',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({redirect:'/forgot-password?persistent=1&sent=1'})}));
 await page.getByRole('button',{name:'Request reset link',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'If this account is eligible'})).toBeVisible();
});
test('offers a new identifier only after an expired unbound status result',async({page})=>{
 await page.goto('/signup?persistent=1');await fill(page);const before=await page.locator('input[name=submissionId]').inputValue();
 await page.route('**/auth/register',route=>route.abort());await page.getByRole('button',{name:'Create account',exact:true}).click();
 await expect(page.getByLabel('Email',{exact:true})).toHaveAttribute('readonly','');
 await page.route('**/auth/registration/status',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({state:'expired',restartAllowed:true})}));
 await page.getByRole('button',{name:'Check registration status',exact:true}).click();await expect(page.getByRole('button',{name:'Start a new request',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Start a new request',exact:true}).click();expect(await page.locator('input[name=submissionId]').inputValue()).not.toBe(before);await expect(page.getByLabel('Email',{exact:true})).not.toHaveAttribute('readonly','');
});
test('mail status distinguishes acceptance from confirmed inbox receipt',async({page})=>{
 await page.goto('/verify-email?persistent=1');
 await page.route('**/auth/email/status',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({state:'sent'})}));
 await page.getByRole('button',{name:'Check delivery status',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'inbox receipt is not confirmed'})).toBeVisible();
});
test('native markup and enlarged text preserve the registration controls',async({page,browser})=>{
 await page.goto('/signup?persistent=1');await expect(page.getByRole('button',{name:'Create account',exact:true})).toBeEnabled();
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{for(const element of document.querySelectorAll<HTMLElement>('h1,h2,p,label,button,input,summary,a'))element.style.fontSize=`${parseFloat(getComputedStyle(element).fontSize)*2}px`;});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const html=await page.content(),native=await browser.newContext({javaScriptEnabled:false});
 try{await native.route('**/*',route=>route.request().resourceType()==='document'?route.fulfill({contentType:'text/html',body:html}):route.abort());const target=await native.newPage();await target.goto('http://127.0.0.1:3107/native-stage-a');await expect(target.locator('form')).toHaveAttribute('method','post');await expect(target.locator('form')).toHaveAttribute('action','/auth/register');await expect(target.locator('input[name=submissionId]')).toHaveCount(1);}finally{await native.close();}
 writeFileSync(evidencePath,JSON.stringify({scope:'real-page-components-with-synthetic-data-and-mocked-provider',widths,externalRequests:0,accountsCreated:0,emailsSent:0,liveCaptchaVerified:false,jsxDisabledScope:'serialized fixture markup only'},null,2));
});
