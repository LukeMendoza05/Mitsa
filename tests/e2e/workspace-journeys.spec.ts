import {test,expect,devices,type Page} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {randomUUID} from "node:crypto";
import {mkdirSync} from "node:fs";
import {database} from "../support/hosted";
import {totp} from "../support/totp";
import {fillPrivateInput} from '../support/private-input';
import {journeyIdentity,capturedLink,openPrivateLink,registerJourney,enrollJourney,reauthenticateJourney,createJourneyWorkspace,signInJourney,type JourneyIdentity} from "../support/journeys";
const origin="http://127.0.0.1:3000";
const formWithButton=(page:Page,name:string)=>page.locator("form").filter({has:page.getByRole("button",{name,exact:true})});
test("invitation context survives navigation to account registration",async({browser,baseURL},info)=>{
  const context=await browser.newContext(devices[info.project.name==="mobile"?"Pixel 7":"Desktop Chrome"]);
  try {
    const response=await context.request.get(`${baseURL}/invitations/open?token=${"f".repeat(64)}`,{maxRedirects:0});
    expect(response.status()).toBe(303);expect(response.headers()["set-cookie"]?.includes("mitsa-invitation-context=")).toBe(true);
    expect(response.headers()["set-cookie"]?.includes("Max-Age=3600")).toBe(true);
    expect((await context.cookies()).some(c=>c.name==="mitsa-invitation-context")).toBe(true);
    const page=await context.newPage();await page.goto("/invitations/accept");await expect(page.getByRole("link",{name:"Create an account",exact:true})).toBeVisible();
    await page.getByRole("link",{name:"Create an account",exact:true}).click();await expect(page).toHaveURL(/\/signup$/);
    expect((await context.cookies()).some(c=>c.name==="mitsa-invitation-context")).toBe(true);
  }finally{await context.close();}
});
async function invite(page:Page,slug:string,user:JourneyIdentity,role:"admin"|"staff") {
  await page.goto(`/w/${slug}/members`);const form=formWithButton(page,"Create captured invitation");
  await form.getByLabel("Invited email",{exact:true}).fill(user.email);await form.getByLabel("Invited role",{exact:true}).selectOption(role);
  if(role==="staff")await form.getByLabel("Main shop",{exact:true}).check();
  await form.getByRole("button",{name:"Create captured invitation",exact:true}).click();await expect(page).toHaveURL(/updated=captured/);
  return capturedLink(user,"invitation");
}
test("native signup, Admin/Staff invitations, location isolation, switching and dual ownership transfer",async({browser},info)=>{
  const device=devices[info.project.name==="mobile"?"Pixel 7":"Desktop Chrome"];
  const contexts=await Promise.all([browser.newContext(device),browser.newContext(device),browser.newContext(device)]);
  const [ownerPage,adminPage,staffPage]=await Promise.all(contexts.map(c=>c.newPage()));
  const [owner,admin,staff]=await Promise.all([journeyIdentity("owner"),journeyIdentity("admin"),journeyIdentity("staff")]);
  try {
    await registerJourney(ownerPage,owner);await enrollJourney(ownerPage,owner);
    const name=`Synthetic browser workspace ${randomUUID().slice(0,8)}`,slug=await createJourneyWorkspace(ownerPage,name);
    await ownerPage.goto(`/w/${slug}/locations`);await expect(ownerPage.getByRole("button",{name:"Add location",exact:true})).toBeVisible();const add=formWithButton(ownerPage,"Add location");await expect(add.getByLabel("New location name",{exact:true})).toBeVisible();await add.getByLabel("New location name",{exact:true}).fill("Back warehouse");await add.getByLabel("New location type",{exact:true}).selectOption("warehouse");await add.getByRole("button",{name:"Add location",exact:true}).click();await expect(ownerPage).toHaveURL(/updated=1/);
    console.info("Journey checkpoint: Owner workspace and location management passed");
    await reauthenticateJourney(ownerPage,owner);const adminLink=await invite(ownerPage,slug,admin,"admin");
    await openPrivateLink(adminPage,adminLink);await expect(adminPage.getByRole("heading",{name:"A place in the workspace.",exact:true})).toBeVisible();
    await registerJourney(adminPage,admin,true);await adminPage.getByRole("checkbox",{name:"I confirm that I want to join this workspace with the invited role.",exact:true}).check();await adminPage.getByRole("button",{name:"Accept invitation",exact:true}).click();await expect(adminPage).toHaveURL(/\/settings\/account\/security$/);
    await enrollJourney(adminPage,admin);await adminPage.goto(`/w/${slug}`);await expect(adminPage.getByText("Admin",{exact:true})).toBeVisible();
    await adminPage.goto(`/w/${slug}/permissions`);await expect(adminPage.getByRole("button",{name:"Save financial permission",exact:true})).toHaveCount(0);
    const forged=await contexts[1].request.post(`${origin}/auth/invitations/manage`,{headers:{origin},form:{action:"issue",slug,email:staff.email,role:"admin",commandKey:randomUUID()},maxRedirects:0});expect(forged.status()).toBe(303);expect(forged.headers().location).toContain("error=invitation");
    const staffLink=await invite(adminPage,slug,staff,"staff");await openPrivateLink(staffPage,staffLink);await registerJourney(staffPage,staff,true);
    await staffPage.getByRole("checkbox",{name:"I confirm that I want to join this workspace with the invited role.",exact:true}).check();await staffPage.getByRole("button",{name:"Accept invitation",exact:true}).click();await expect(staffPage).toHaveURL(new RegExp(`/w/${slug}$`));
    await expect(staffPage.getByText("Staff",{exact:true})).toBeVisible();await expect(staffPage.getByText("Main shop · Shop",{exact:true})).toBeVisible();await expect(staffPage.getByText("Back warehouse",{exact:false})).toHaveCount(0);
    await expect(staffPage.getByRole("link",{name:"Members & invitations",exact:true})).toHaveCount(0);await staffPage.goto(`/w/${slug}/members`);await expect(staffPage).toHaveURL(/\/access-denied$/);
    const escalation=await contexts[2].request.post(`${origin}/auth/workspace`,{headers:{origin},form:{action:"financial",slug,enabled:"on",confirm:"on"},maxRedirects:0});expect(escalation.status()).toBe(303);expect(escalation.headers().location).toContain("error=unavailable");
    const secondName=`Synthetic independent workspace ${randomUUID().slice(0,8)}`,second=await createJourneyWorkspace(ownerPage,secondName);
    await ownerPage.goto("/workspaces");await ownerPage.locator(`a[href='/w/${slug}']`).click();await expect(ownerPage.getByRole("heading",{name,exact:true})).toBeVisible();
    for(const page of [adminPage,staffPage]){await page.goto(`/w/${second}`);await expect(page).toHaveURL(/\/access-denied$/);}
    await reauthenticateJourney(ownerPage,owner);await ownerPage.goto(`/w/${slug}/permissions`);await ownerPage.getByLabel("Allow Admins to view sensitive financial information.",{exact:true}).check();await ownerPage.getByLabel("I confirm this change for this workspace.",{exact:true}).check();await ownerPage.getByRole("button",{name:"Save financial permission",exact:true}).click();await expect(ownerPage).toHaveURL(/updated=1/);
    await ownerPage.goto(`/w/${slug}/ownership`);await ownerPage.getByLabel("Incoming Business Owner",{exact:true}).selectOption({label:admin.fullName});await ownerPage.getByLabel("I understand that Admin financial access resets to disabled. The incoming Owner must independently confirm.",{exact:true}).check();await ownerPage.getByRole("button",{name:"Propose ownership transfer",exact:true}).click();await expect(ownerPage).toHaveURL(/updated=1/);
    await reauthenticateJourney(adminPage,admin);await adminPage.goto(`/w/${slug}/ownership`);await adminPage.getByLabel("I confirm this ownership transfer after verifying my password and authenticator.",{exact:true}).check();await adminPage.getByRole("button",{name:"Confirm my part of transfer",exact:true}).click();await expect(adminPage).toHaveURL(/\/workspaces$/);
    const db=await database();try {
      const business=(await db.query("select id,admin_financial_access from private.businesses where slug=$1",[slug])).rows[0];expect(business.admin_financial_access).toBe(false);
      const roles=(await db.query("select u.email,m.role,m.active from private.memberships m join auth.users u on u.id=m.user_id where business_id=$1",[business.id])).rows;
      expect(roles.find(r=>r.email===owner.email)).toMatchObject({role:"admin",active:true});expect(roles.find(r=>r.email===admin.email)).toMatchObject({role:"owner",active:true});expect(roles.filter(r=>r.role==="owner"&&r.active)).toHaveLength(1);
    }finally{await db.end();}
    await ownerPage.goto(`/w/${slug}`);await expect(ownerPage.getByText("Admin",{exact:true})).toBeVisible();await ownerPage.goto(`/w/${second}`);await expect(ownerPage.getByText("Business Owner",{exact:true})).toBeVisible();
    await adminPage.goto(`/w/${slug}`);await expect(adminPage.getByText("Business Owner",{exact:true})).toBeVisible();
    expect((await new AxeBuilder({page:adminPage}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze()).violations).toEqual([]);
    mkdirSync("docs/previews/auth-workspaces",{recursive:true});
    for(const width of [320,390,768,1024,1440]){await adminPage.setViewportSize({width,height:900});expect(await adminPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await adminPage.screenshot({path:`docs/previews/auth-workspaces/journey-owner-${info.project.name}-${width}.png`,fullPage:true});}
    await adminPage.getByRole("button",{name:"Sign out",exact:true}).click();await expect(adminPage).toHaveURL(/\/login$/);await adminPage.goto(`/w/${slug}`);await expect(adminPage).toHaveURL(/\/login/);
  }finally{await Promise.all(contexts.map(c=>c.close()));}
});

test("captured password recovery preserves MFA and revokes prior workspace sessions",async({browser},info)=>{
  const device=devices[info.project.name==="mobile"?"Pixel 7":"Desktop Chrome"];
  const context=await browser.newContext(device),recovery=await browser.newContext(device),page=await context.newPage(),reset=await recovery.newPage();const user=await journeyIdentity("recovery");
  try {
    await registerJourney(page,user);await enrollJourney(page,user);const slug=await createJourneyWorkspace(page,`Synthetic recovery workspace ${randomUUID().slice(0,8)}`);
    await reset.goto("/forgot-password");await fillPrivateInput(reset.getByLabel("Email",{exact:true}),user.email);await reset.getByRole("button",{name:"Request reset link",exact:true}).click();await expect(reset).toHaveURL(/sent=1/);
    await openPrivateLink(reset,await capturedLink(user,"recovery"));await reset.getByRole("button",{name:"Continue password reset",exact:true}).click();await expect(reset.getByRole("button",{name:"Verify recovery authenticator",exact:true})).toBeVisible();
    await fillPrivateInput(reset.getByLabel("Recovery authenticator code",{exact:true}),totp(user.totpSecret!));await reset.getByRole("button",{name:"Verify recovery authenticator",exact:true}).click();await expect(reset.getByLabel("New password",{exact:true})).toBeVisible();
    const changed=`M2!${randomUUID()}`;await fillPrivateInput(reset.getByLabel("New password",{exact:true}),changed);await fillPrivateInput(reset.getByLabel("Confirm new password",{exact:true}),changed);await reset.getByRole("button",{name:"Update password",exact:true}).click();await expect(reset).toHaveURL(/\/login\?updated=password$/);
    await page.goto(`/w/${slug}`);await expect(page).toHaveURL(/\/login/);
    const old=await recovery.request.post(`${origin}/auth/login`,{headers:{origin},form:{email:user.email,password:user.password},maxRedirects:0});expect(old.status()).toBe(401);
    user.password=changed;await signInJourney(reset,user);await reset.getByRole("link",{name:"Verify authenticator",exact:true}).click();await fillPrivateInput(reset.getByLabel("Authenticator code",{exact:true}),totp(user.totpSecret!));await reset.getByRole("button",{name:"Verify authenticator",exact:true}).click();await reset.locator(`a[href='/w/${slug}']`).click();await expect(reset.getByText("Business Owner",{exact:true})).toBeVisible();
  }finally{await Promise.all([context.close(),recovery.close()]);}
});
