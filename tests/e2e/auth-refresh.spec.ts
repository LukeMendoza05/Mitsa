import {test,expect,devices,type Page} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {randomUUID} from "node:crypto";
import {mkdirSync} from "node:fs";
import {database} from "../support/hosted";
import {totp} from "../support/totp";
import {journeyIdentity,registerJourney,enrollJourney,createJourneyWorkspace,signInJourney} from "../support/journeys";

const sizes=[[320,568],[390,844],[768,1024],[1024,768],[1440,900],[1920,1080]];
async function fillSignup(page:Page){
  await page.getByLabel("Full name",{exact:true}).fill("Synthetic feedback test");await page.getByLabel("Email",{exact:true}).fill("foundation-feedback@example.invalid");
  await page.getByLabel("Password",{exact:true}).fill("Synthetic-strong-pass-123!");await page.getByLabel("Confirm password",{exact:true}).fill("Synthetic-strong-pass-123!");
  await page.getByRole("checkbox").check();
}
test("auth pages reflow, preserve editorial hierarchy and pass accessibility checks",async({page},info)=>{
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.name));await page.emulateMedia({reducedMotion:"reduce"});
  for(const route of ["login","signup"]){
    await page.goto(`/${route}`);await expect(page).toHaveTitle(route==="login"?"Sign In | Mitsa":"Sign Up | Mitsa");
    for(const [width,height] of info.project.name==="desktop"?sizes:[[390,844]]){
      await page.setViewportSize({width,height});await page.evaluate(()=>document.fonts.ready);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${route} ${width}`).toBe(true);
      const email=await page.getByLabel("Email",{exact:true}).boundingBox();expect(email?.width).toBeLessThanOrEqual(480);
      if(width>=1024)expect(email?.width).toBeGreaterThanOrEqual(420);
      expect(await page.getByRole("complementary",{name:"About Mitsa"}).isVisible()).toBe(width>=1024);
      expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze()).violations).toEqual([]);
    }
    await page.setViewportSize({width:390,height:844});
    // Double actual computed text sizes, rather than changing a root value that
    // fixed-pixel descendants could ignore. Text must wrap without clipping.
    await page.evaluate(()=>{const elements=[...document.querySelectorAll<HTMLElement>("h1,p,label,a,button,input,span")];const sizes=elements.map(el=>parseFloat(getComputedStyle(el).fontSize));elements.forEach((el,i)=>el.style.fontSize=`${sizes[i]*2}px`);});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await expect(page.getByRole("button",{name:route==="login"?"Sign in":"Create account",exact:true})).toBeVisible();
    mkdirSync("docs/previews/auth-refresh/accessibility",{recursive:true});await page.screenshot({path:`docs/previews/auth-refresh/accessibility/${route}-200-percent-${info.project.name}.png`,fullPage:true});
    expect(await page.getByRole("main").evaluate(el=>getComputedStyle(el.children[1]).animationName)).toBe("none");
  }
  expect(errors).toEqual([]);expect(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length}))).toEqual({local:0,session:0});
});
test("keyboard, password controls and focused field errors work without sending invalid forms",async({page})=>{
  let posts=0;page.on("request",r=>{if(r.method()==="POST"&&r.url().includes("/auth/register"))posts++;});
  await page.goto("/signup");await page.keyboard.press("Tab");await expect(page.getByRole("link",{name:"Skip to content"})).toBeFocused();
  await page.getByRole("button",{name:"Create account",exact:true}).click();await expect(page.getByRole("main").getByRole("alert")).toBeFocused();expect(posts).toBe(0);
  for(const name of ["Full name","Email","Password","Confirm password"])await expect(page.getByLabel(name,{exact:true})).toHaveAttribute("aria-invalid","true");
  await fillSignup(page);await page.getByRole("button",{name:"Show password",exact:true}).click();await expect(page.getByLabel("Password",{exact:true})).toHaveAttribute("type","text");
  await page.getByRole("button",{name:"Hide password",exact:true}).click();await expect(page.getByLabel("Password",{exact:true})).toHaveAttribute("type","password");
  await page.getByLabel("Confirm password",{exact:true}).fill("Does-not-match-123!");await page.getByRole("button",{name:"Create account",exact:true}).click();await expect(page.getByRole("main").getByRole("alert")).toBeFocused();expect(posts).toBe(0);
  await page.goto("/login");await page.getByRole("button",{name:"Sign in",exact:true}).click();await expect(page.getByRole("main").getByRole("alert")).toBeFocused();
  await expect(page.getByLabel("Email",{exact:true})).toHaveAttribute("aria-invalid","true");await expect(page.getByLabel("Password",{exact:true})).toHaveAttribute("aria-invalid","true");
  expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze()).violations).toEqual([]);
});
test("pending submission, safe server errors and network failure preserve entered values",async({page})=>{
  await page.goto("/signup");await fillSignup(page);let resolve!:()=>void;const gate=new Promise<void>(done=>resolve=done);let calls=0;
  await page.route("**/auth/register",async route=>{calls++;await gate;await route.fulfill({status:429,contentType:"application/json",body:JSON.stringify({error:{code:"rate_limited"}})});});
  await page.getByRole("button",{name:"Create account",exact:true}).click();await expect(page.getByRole("button",{name:"Creating account…",exact:true})).toBeDisabled();
  await expect(page.getByLabel("Email",{exact:true})).toBeDisabled();resolve();await expect(page.getByRole("main").getByRole("alert")).toBeFocused();await expect(page.getByRole("main").getByRole("alert")).toContainText("Too many attempts");
  expect(calls).toBe(1);await expect(page.getByLabel("Full name",{exact:true})).toHaveValue("Synthetic feedback test");await expect(page.getByRole("checkbox")).toBeChecked();
  await page.unroute("**/auth/register");await page.route("**/auth/register",route=>route.abort("internetdisconnected"));await page.getByRole("button",{name:"Create account",exact:true}).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeFocused();await expect(page.getByRole("main").getByRole("alert")).toContainText("Check your connection");await expect(page.getByLabel("Password",{exact:true})).toHaveValue("Synthetic-strong-pass-123!");
});
test("unapproved personal addresses get actionable feedback and cannot register directly",async({page})=>{
  await page.goto("/signup");await fillSignup(page);await page.getByLabel("Email",{exact:true}).fill(`unapproved-${randomUUID()}@example.com`);
  await page.getByRole("button",{name:"Create account",exact:true}).click();await expect(page.getByRole("main").getByRole("alert")).toContainText("not approved for development testing");await expect(page.getByRole("main").getByRole("alert")).toBeFocused();
  await expect(page.getByRole("link",{name:"Local testing guide",exact:true})).toBeVisible();await page.getByRole("link",{name:"Local testing guide",exact:true}).click();await expect(page.getByRole("heading",{level:1})).toHaveText("Your local path into Mitsa.");
});
test("invalid credentials stay generic and native registration cannot skip Terms or add a role",async({page,request})=>{
  await page.goto("/login");await page.getByLabel("Email",{exact:true}).fill(`unapproved-${randomUUID()}@example.invalid`);await page.getByLabel("Password",{exact:true}).fill("Invalid-credentials-123!");
  await page.getByRole("button",{name:"Sign in",exact:true}).click();await expect(page.getByRole("main").getByRole("alert")).toBeFocused();await expect(page.getByRole("main").getByRole("alert")).toHaveText("We couldn’t sign you in. Check your email and password, then try again.");
  await page.goto("/signup");const terms=await page.locator("input[name=termsVersion]").inputValue();
  const form={fullName:"Synthetic denied form",email:`foundation-denied-${randomUUID()}@example.invalid`,password:"Synthetic-pass-123!",confirmPassword:"Synthetic-pass-123!",termsVersion:terms};
  for(const body of [form,{...form,accepted:"on",role:"owner"}]){const denied=await request.post("/auth/register",{headers:{origin:"http://127.0.0.1:3000",accept:"text/html"},form:body,maxRedirects:0});expect(denied.status()).toBe(303);expect(denied.headers().location).toContain("/signup?error=input");}
  const csrf=await request.post("/auth/register",{headers:{origin:"https://attacker.example"},form:{...form,accepted:"on"},maxRedirects:0});expect(csrf.status()).toBe(403);
});
for(const javaScriptEnabled of [true,false])test(`real ${javaScriptEnabled?"enhanced":"native"} signup, private verification, mandatory MFA, Owner workspace and sign-out`,async({browser},info)=>{
  test.setTimeout(300000);const context=await browser.newContext({...devices[info.project.name==="mobile"?"Pixel 7":"Desktop Chrome"],javaScriptEnabled}),page=await context.newPage();
  const user=await journeyIdentity(`refresh-${javaScriptEnabled?"enhanced":"native"}`);
  try{
    await registerJourney(page,user);
    await expect(page.getByRole("button",{name:"Create workspace",exact:true})).toHaveCount(0);
    await expect(page.getByRole("link",{name:"Review account security",exact:true})).toBeVisible();
    const denied=await context.request.post("http://127.0.0.1:3000/auth/workspaces",{headers:{origin:"http://127.0.0.1:3000"},form:{name:`Synthetic guarded ${randomUUID().slice(0,8)}`,location:"Main shop",kind:"shop",commandKey:randomUUID()},maxRedirects:0});expect(denied.status()).toBe(303);expect(denied.headers().location).toContain("error=");
    await enrollJourney(page,user);const slug=await createJourneyWorkspace(page,`Synthetic auth refresh ${randomUUID().slice(0,8)}`);
    await expect(page.getByText("Business Owner",{exact:true})).toBeVisible();
    const db=await database();try{const row=(await db.query("select count(*)::int owners from private.memberships m join private.businesses b on b.id=m.business_id where b.slug=$1 and m.active and m.role='owner'",[slug])).rows[0];expect(row.owners).toBe(1);}finally{await db.end();}
    await page.getByRole("button",{name:"Sign out",exact:true}).click();await expect(page).toHaveURL(/\/login$/);await page.goto(`/w/${slug}`);await expect(page).toHaveURL(/\/login/);
    await signInJourney(page,user);await page.getByRole("link",{name:"Verify authenticator",exact:true}).click();await page.getByLabel("Authenticator code",{exact:true}).fill(totp(user.totpSecret!));await page.getByRole("button",{name:"Verify authenticator",exact:true}).click();
    await page.locator(`a[href='/w/${slug}']`).click();await expect(page.getByText("Business Owner",{exact:true})).toBeVisible();await page.getByRole("button",{name:"Sign out",exact:true}).click();await expect(page).toHaveURL(/\/login$/);
    if(javaScriptEnabled){
      await page.goto("/signup");await page.getByLabel("Full name",{exact:true}).fill(user.fullName);await page.getByLabel("Email",{exact:true}).fill(user.email);await page.getByLabel("Password",{exact:true}).fill(user.password);await page.getByLabel("Confirm password",{exact:true}).fill(user.password);await page.getByRole("checkbox").check();await page.getByRole("button",{name:"Create account",exact:true}).click();await expect(page).toHaveURL(/\/verify-email\?sent=1$/);
    }
  }finally{await context.close();}
});
