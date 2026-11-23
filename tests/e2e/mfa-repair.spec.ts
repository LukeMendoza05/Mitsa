import {test,expect,devices,type Page} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {readFileSync,mkdirSync} from "node:fs";
import {parse} from "dotenv";
import {createSyntheticUser,acceptSyntheticTerms,database} from "../support/hosted";
import {incompleteSyntheticMfa} from "../support/mfa-fixtures";
import {signInJourney,createJourneyWorkspace} from "../support/journeys";
import {totp} from "../support/totp";
import {openEnrollment,sealEnrollment,enrollmentCookieName} from "../../src/lib/security/enrollment-cookie";
const origin="http://127.0.0.1:3000";
async function confirm(page:Page,password:string){await page.getByLabel("Current password",{exact:true}).fill(password);const navigation=page.waitForEvent("framenavigated",{predicate:frame=>frame===page.mainFrame()});await page.getByRole("button",{name:"Confirm identity",exact:true}).click();await navigation;await page.waitForLoadState("domcontentloaded");}
async function synthetic(label:string){const user={...await createSyntheticUser(label),fullName:"Synthetic MFA browser"};await acceptSyntheticTerms(user);return user;}
async function startSetup(page:Page){const navigation=page.waitForEvent("framenavigated",{predicate:frame=>frame===page.mainFrame()});await page.getByRole("button",{name:"Start authenticator setup",exact:true}).click();await navigation;await page.waitForLoadState("domcontentloaded");const code=new URL(page.url()).searchParams.get("error");if(code)throw Error(`Synthetic setup denied: ${["pending","recent","provider","trusted","security","rate_limited"].includes(code)?code:"unknown"}`);}
// Explicit contexts are always closed in finally. Secret-bearing enrollment
// pages must never be left open for Playwright's automatic failure snapshot.
for(const javaScriptEnabled of [true,false])test(`first-time ${javaScriptEnabled?"enhanced":"native"} password confirmation, TOTP, persistence, workspace and return`,async({browser},info)=>{
 const context=await browser.newContext({...devices[info.project.name==="mobile"?"Pixel 7":"Desktop Chrome"],javaScriptEnabled}),page=await context.newPage(),user=await synthetic("mfa-journey");
 try{
  await signInJourney(page,user);await page.goto("/settings/account/security");await expect(page.getByLabel("Authenticator",{exact:true})).toHaveCount(0);await expect(page.getByLabel("Current authenticator",{exact:true})).toHaveCount(0);
  await confirm(page,"Incorrect-synthetic-password!");await expect(page).toHaveURL(/error=password$/);await expect(page.getByRole("main").getByRole("alert")).toContainText("Password confirmation failed");
  await confirm(page,user.password);await expect(page).toHaveURL(/updated=reauthenticated$/);await expect(page.getByText(/^Identity confirmed\./)).toBeVisible();
  await startSetup(page);await expect(page.getByRole("img",{name:"Mitsa authenticator setup QR code"})).toBeVisible();
  const secret=await page.getByTestId("mfa-manual-key").textContent();if(!secret)throw Error("Synthetic setup unavailable; key omitted");
  if(javaScriptEnabled){
   mkdirSync("docs/previews/mfa-repair",{recursive:true});
   for(const width of [320,390,768,1024,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
   await page.setViewportSize({width:info.project.name==="mobile"?390:1440,height:900});await page.screenshot({path:`docs/previews/mfa-repair/setup-${info.project.name}-redacted.png`,fullPage:true,mask:[page.getByRole("img",{name:"Mitsa authenticator setup QR code"}),page.getByTestId("mfa-manual-key"),page.locator("input[name=password],input[name=code]")]});
   expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze()).violations.length).toBe(0);
  }
  const wrong=String((Number(totp(secret))+12345)%1000000).padStart(6,"0");await page.getByLabel("New authenticator code",{exact:true}).fill(wrong);await page.getByRole("button",{name:"Confirm new authenticator",exact:true}).click();await expect(page).toHaveURL(/error=code$/);
  await page.getByLabel("New authenticator code",{exact:true}).fill(totp(secret));await page.getByRole("button",{name:"Confirm new authenticator",exact:true}).click();await expect(page).toHaveURL(/updated=enrolled$/);
  await page.reload();await expect(page.getByText("Your current session has verified MFA.",{exact:true})).toBeVisible();await expect(page.getByRole("heading",{name:"Your verified authenticators.",exact:true})).toBeVisible();
  const slug=await createJourneyWorkspace(page,`Synthetic MFA repaired ${crypto.randomUUID().slice(0,8)}`);await expect(page.getByText("Business Owner",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Sign out",exact:true}).click();await expect(page).toHaveURL(/\/login$/);await signInJourney(page,user);await page.goto("/settings/account/security");await page.getByLabel("Authenticator code",{exact:true}).fill(totp(secret));await page.getByRole("button",{name:"Verify authenticator",exact:true}).click();await page.locator(`a[href='/w/${slug}']`).click();await expect(page.getByText("Business Owner",{exact:true})).toBeVisible();
 }finally{await context.close();}
});
test("expired pending setup is never verified and can be canceled for a fresh secret",async({browser})=>{
 const context=await browser.newContext(),page=await context.newPage(),user=await synthetic("mfa-expired");
 try{
  await signInJourney(page,user);await page.goto("/settings/account/security");await confirm(page,user.password);await startSetup(page);
  const old=await page.getByTestId("mfa-manual-key").textContent(),cookie=(await context.cookies()).find(c=>c.name===enrollmentCookieName);if(!cookie)throw Error("Synthetic enrollment context unavailable");
  const key=parse(readFileSync(".env.local")).MFA_ENROLLMENT_KEY,session=(JSON.parse(Buffer.from((await context.cookies()).filter(c=>c.name.startsWith("sb-")).sort((a,b)=>a.name.localeCompare(b.name)).map(c=>c.value).join("").slice(7),"base64url").toString("utf8"))),claims=JSON.parse(Buffer.from(session.access_token.split(".")[1],"base64url").toString("utf8"));
  const enrollment=openEnrollment(cookie.value,key,user.id,claims.session_id);if(!enrollment)throw Error("Synthetic context validation failed");
  await context.addCookies([{...cookie,value:sealEnrollment({...enrollment,expiresAt:Date.now()-1},key)}]);
  const result=await context.request.post(`${origin}/auth/security`,{headers:{origin},form:{action:"verify-enrollment",code:"000000"},maxRedirects:0});expect(result.headers().location).toContain("error=expired");
  await page.goto("/settings/account/security?error=expired");await expect(page.getByTestId("mfa-manual-key")).toHaveCount(0);await expect(page.getByRole("button",{name:"Cancel unfinished setup",exact:true})).toBeVisible();
  const db=await database();try{expect((await db.query("select count(*)::int n from auth.mfa_factors where user_id=$1 and status='verified'",[user.id])).rows[0].n).toBe(0);}finally{await db.end();}
  const cancellation=page.waitForEvent("framenavigated",{predicate:frame=>frame===page.mainFrame()});await page.getByRole("button",{name:"Cancel unfinished setup",exact:true}).click();await cancellation;await page.waitForLoadState("domcontentloaded");await expect(page).toHaveURL(/updated=cancelled$/);await confirm(page,user.password);await startSetup(page);
  const fresh=await page.getByTestId("mfa-manual-key").textContent();expect(Boolean(fresh&&fresh!==old)).toBe(true);await page.getByRole("button",{name:"Cancel setup",exact:true}).click();
 }finally{await context.close();}
});
test("provider-verified incomplete state has no empty dropdown, cannot skip recovery or cancel a verified factor",async({browser})=>{
 const {user,factorId}=await incompleteSyntheticMfa(),context=await browser.newContext(),page=await context.newPage();
 try{
  await signInJourney(page,user);await page.goto("/settings/account/security");await expect(page.getByRole("heading",{name:"Authenticator setup needs review.",exact:true})).toBeVisible();await expect(page.locator("select[name=factorId]")).toHaveCount(0);await expect(page.getByRole("button",{name:"Start authenticator setup",exact:true})).toHaveCount(0);
  const attempts:Array<Record<string,string>>=[{action:"reauthenticate",password:user.password},{action:"cancel-unverified",factorId}];
  for(const form of attempts){const result=await context.request.post(`${origin}/auth/security`,{headers:{origin},form,maxRedirects:0});expect(result.headers().location).toContain(form.action==="reauthenticate"?"error=trusted":"error=cancelled");}
  const db=await database();try{expect((await db.query("select count(*)::int n from auth.mfa_factors where user_id=$1 and status='verified'",[user.id])).rows[0].n).toBe(1);}finally{await db.end();}
 }finally{await context.close();}
});
