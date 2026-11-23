import {test,expect,devices,type Page} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {mkdirSync,readFileSync} from "node:fs";
import {parse} from "dotenv";
import {createHash} from "node:crypto";
import {journeyIdentity,enrollJourney,createJourneyWorkspace,signInJourney,capturedLink,openPrivateLink,type JourneyIdentity} from "../support/journeys";
import {capturedSignupCode,ageSyntheticConfirmation} from "../support/email-code";
import {database,publicClient} from "../support/hosted";
import {sealAuthFlow,openAuthFlow,signupCodeCookie} from "../../src/lib/security/auth-flow";
import {totp} from "../support/totp";
import {fillPrivateInput} from '../support/private-input';
import {emailVerificationCodeLength} from '../../src/lib/auth/email-code-settings';
const origin="http://127.0.0.1:3000";
async function submit(page:Page,name:string){
 // Enhanced forms navigate after their fetch. Wait for the final destination's
 // load before starting another navigation, rather than only its first frame event.
 const destination=name==="Sign out"?/\/login$/:name==="Verify authenticator"?/\/workspaces$/:null;
 const committed=destination?page.waitForURL(destination,{waitUntil:"load"}):page.waitForEvent("framenavigated",{predicate:frame=>frame===page.mainFrame()});
 await page.getByRole("button",{name,exact:true}).click();await committed;await page.waitForLoadState("load");
}
async function register(page:Page,user:JourneyIdentity){await page.goto("/signup");await page.getByLabel("Full name",{exact:true}).fill(user.fullName);await fillPrivateInput(page.getByLabel("Email",{exact:true}),user.email);await fillPrivateInput(page.getByLabel("Password",{exact:true}),user.password);await fillPrivateInput(page.getByLabel("Confirm password",{exact:true}),user.password);await page.getByRole("checkbox").check();await submit(page,"Create account");await expect(page).toHaveURL(/\/verify-email\?sent=1$/);}
async function memberships(user:JourneyIdentity){const db=await database();try{return (await db.query("select count(*)::int n from private.memberships m join auth.users u on u.id=m.user_id where u.email=$1",[user.email])).rows[0].n;}finally{await db.end();}}
for(const javaScriptEnabled of [true,false])test(`encrypted captured signup code, expiry and complete ${javaScriptEnabled?"enhanced":"native"} onboarding`,async({browser},info)=>{
 const context=await browser.newContext({...devices[info.project.name==="mobile"?"Pixel 7":"Desktop Chrome"],javaScriptEnabled}),page=await context.newPage(),user=await journeyIdentity("email-code");
 try{
  await register(page,user);await expect(page).toHaveTitle("Verify Email | Mitsa");await expect(page.getByRole("heading",{name:"Verify your email.",exact:true})).toBeVisible();
  const cookie=(await context.cookies()).find(c=>c.name===signupCodeCookie);expect(Boolean(cookie?.httpOnly&&cookie.sameSite==="Strict")).toBe(true);expect(await memberships(user)).toBe(0);
  let code=await capturedSignupCode(user);const input=page.getByLabel("Verification code",{exact:true});await expect(input).toHaveAttribute("autocomplete","one-time-code");
  await input.fill(code==="0".repeat(code.length)?"1".repeat(code.length):"0".repeat(code.length));await submit(page,"Verify email");await expect(page).toHaveURL(/error=code$/);await expect(page.getByRole("main").getByRole("alert")).toContainText("invalid or has expired");
  await ageSyntheticConfirmation(user,3601);await fillPrivateInput(page.getByLabel("Verification code",{exact:true}),code);await submit(page,"Verify email");await expect(page).toHaveURL(/error=code$/);
  const key=parse(readFileSync(".env.local")).AUTH_FLOW_KEY,stored=(await context.cookies()).find(c=>c.name===signupCodeCookie)!;const flow=openAuthFlow(stored.value,key);if(flow?.purpose!=="signup-code")throw Error("Synthetic continuation unavailable");const now=Date.now();
  await context.addCookies([{name:signupCodeCookie,value:sealAuthFlow({...flow,issuedAt:now-120000,resendAt:now-60000,expiresAt:now+3600000},key),url:origin,httpOnly:true,sameSite:"Strict"}]);await page.goto("/verify-email");await submit(page,"Resend code");await expect(page).toHaveURL(/resent=1$/);code=await capturedSignupCode(user);
  if(javaScriptEnabled){
   mkdirSync("docs/previews/email-verification",{recursive:true});await page.goto("/verify-email");await page.emulateMedia({reducedMotion:"reduce"});
   for(const width of info.project.name==="desktop"?[320,390,768,1024,1440]:[390]){await page.setViewportSize({width,height:900});await page.evaluate(()=>document.fonts.ready);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze()).violations).toEqual([]);}
   await page.setViewportSize({width:info.project.name==="desktop"?1440:390,height:info.project.name==="desktop"?900:844});await page.screenshot({path:`docs/previews/email-verification/${info.project.name}.png`,fullPage:true,mask:[page.getByLabel("Verification code",{exact:true})],maskColor:"#f2f2f3"});
   await page.keyboard.press("Tab");await expect(page.getByRole("link",{name:"Skip to content"})).toBeFocused();
  }
  await fillPrivateInput(page.getByLabel("Verification code",{exact:true}),code);await submit(page,"Verify email");await expect(page).toHaveURL(/\/settings\/account\/security\?updated=email-verified$/);await expect(page.getByRole("status").filter({hasText:"Email verified"})).toBeVisible();expect(await memberships(user)).toBe(0);
  const replay=await publicClient().auth.verifyOtp({type:"signup",email:user.email,token:code});expect(Boolean(replay.error)).toBe(true);
  await enrollJourney(page,user);const slug=await createJourneyWorkspace(page,"Synthetic email verification workspace");await submit(page,"Sign out");await signInJourney(page,user);await page.goto("/settings/account/security");await fillPrivateInput(page.getByLabel("Authenticator code",{exact:true}),totp(user.totpSecret!));await submit(page,"Verify authenticator");
  await expect(page).toHaveURL(/\/workspaces$/);await expect(page.getByRole("heading",{name:"Your workspaces.",exact:true})).toBeVisible();await page.locator(`a[href='/w/${slug}']`).click();await expect(page.getByRole("heading",{name:"Synthetic email verification workspace",exact:true})).toBeVisible();expect(await memberships(user)).toBe(1);
 }finally{await context.close();}
});
test("resend cooldown, replayed cookies, provider limits and old-code invalidation",async({browser},info)=>{
 const context=await browser.newContext({...devices[info.project.name==="mobile"?"Pixel 7":"Desktop Chrome"]}),page=await context.newPage(),user=await journeyIdentity("email-resend");
 try{
  await register(page,user);await expect(page.getByRole("button",{name:"Resend code",exact:true})).toBeDisabled();await expect(page.getByText(/You can request another code in \d+s/)).toBeVisible();
  const post=()=>context.request.post(`${origin}/auth/email/code`,{headers:{origin},form:{action:"resend",email:"intruder@example.invalid",type:"recovery"},maxRedirects:0});
  expect((await post()).headers().location).toContain("error=cooldown");
  const initialProvider=await publicClient().auth.resend({type:"signup",email:user.email,options:{emailRedirectTo:`${origin}/auth/email`}});expect(Boolean(initialProvider.error)).toBe(true);
  const oldCode=await capturedSignupCode(user);await ageSyntheticConfirmation(user,65);
  const key=parse(readFileSync(".env.local")).AUTH_FLOW_KEY,existing=(await context.cookies()).find(c=>c.name===signupCodeCookie)!;const flow=openAuthFlow(existing.value,key);if(flow?.purpose!=="signup-code")throw Error("Synthetic signup context unavailable");
  const now=Date.now(),aged=sealAuthFlow({...flow,issuedAt:now-120000,resendAt:now-60000,expiresAt:now+3600000},key);await context.addCookies([{name:signupCodeCookie,value:aged,url:origin,httpOnly:true,sameSite:"Strict"}]);
  const hash=createHash("sha256").update(user.email).digest("hex"),db=await database();let before:number;try{before=(await db.query("select count(*)::int n from private.isolated_auth_mail where recipient_hash=$1",[hash])).rows[0].n;}finally{await db.end();}
  await page.goto("/verify-email");await expect(page.getByRole("button",{name:"Resend code",exact:true})).toBeEnabled();await submit(page,"Resend code");await expect(page).toHaveURL(/resent=1$/);await expect(page.getByRole("main").getByRole("status")).toContainText("new verification message");
  // Replay the older encrypted cookie and send simultaneous requests. The
  // server/provider controls must still suppress both additional messages.
  await context.addCookies([{name:signupCodeCookie,value:aged,url:origin,httpOnly:true,sameSite:"Strict"}]);const results=await Promise.all([post(),post()]);expect(results.filter(r=>r.headers().location?.includes("error=cooldown"))).toHaveLength(2);
  const db2=await database();try{expect((await db2.query("select count(*)::int n from private.isolated_auth_mail where recipient_hash=$1",[hash])).rows[0].n).toBe(before+1);}finally{await db2.end();}
  const provider=await publicClient().auth.resend({type:"signup",email:user.email,options:{emailRedirectTo:`${origin}/auth/email`}});expect(provider.error?.status).toBe(429);
  const invalid=await publicClient().auth.verifyOtp({type:"signup",email:user.email,token:oldCode});expect(Boolean(invalid.error)).toBe(true);
  const latest=await capturedSignupCode(user);expect(latest===oldCode).toBe(false);
  // Legacy captured link remains scanner-safe and completes the same account.
  await openPrivateLink(page,await capturedLink(user,"signup"));await expect(page.getByLabel("Verification code",{exact:true})).toHaveCount(0);await submit(page,"Verify email");await expect(page).toHaveURL(/\/onboarding$/);expect(await memberships(user)).toBe(0);
 }finally{await context.close();}
});
test("verification recovery, missing contexts, offline feedback and no account leakage",async({browser},info)=>{
 const context=await browser.newContext({...devices[info.project.name==="mobile"?"Pixel 7":"Desktop Chrome"]}),page=await context.newPage(),user=await journeyIdentity("email-recovery");
 try{
  await page.goto("/verify-email");await expect(page.getByRole("button",{name:"Resend code",exact:true})).toHaveCount(0);
  const missing=await context.request.post(`${origin}/auth/email/code`,{headers:{origin},form:{action:"resend"},maxRedirects:0});expect(missing.headers().location).toContain("error=expired");
  const cross=await context.request.post(`${origin}/auth/email/code`,{headers:{origin:"https://attacker.invalid"},form:{action:"verify",code:"123456"},maxRedirects:0});expect(cross.status()).toBe(403);
  await register(page,user);await context.clearCookies();await page.goto("/login");await fillPrivateInput(page.getByLabel("Email",{exact:true}),user.email);await fillPrivateInput(page.getByLabel("Password",{exact:true}),user.password);await submit(page,"Sign in");await expect(page).toHaveURL(/\/verify-email$/);
  expect((await page.locator("body").textContent())?.includes(user.email)).toBe(false);
  await page.getByLabel("Verification code",{exact:true}).fill("1".repeat(emailVerificationCodeLength));await page.route("**/auth/email/code",route=>route.abort());await page.getByRole("button",{name:"Verify email",exact:true}).click();await expect(page.getByRole("main").getByRole("alert")).toBeFocused();await expect(page.getByRole("main").getByRole("alert")).toContainText("connection");
  await page.unroute("**/auth/email/code");await page.reload();await page.evaluate(()=>{const elements=[...document.querySelectorAll<HTMLElement>("h1,p,label,a,button,input,span")],sizes=elements.map(el=>parseFloat(getComputedStyle(el).fontSize));elements.forEach((el,i)=>el.style.fontSize=`${sizes[i]*2}px`);});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{await context.close();}
});
