import {test,expect} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {readFileSync,mkdirSync} from "node:fs";
import {signInJourney,reauthenticateJourney,type JourneyIdentity} from "../support/journeys";

test("authenticated management pages reflow, remain accessible and expose no setup secrets",async({page},info)=>{
  test.setTimeout(180000);
  const account=(JSON.parse(readFileSync(".secrets/signup-access.json","utf8")) as {owner:JourneyIdentity&{workspaceUrl:string}}).owner;
  const root=new URL(account.workspaceUrl).pathname,errors:string[]=[];
  page.on("pageerror",error=>errors.push(error.name));page.on("console",message=>{if(message.type()==="error")errors.push("console-error");});
  await signInJourney(page,account);await reauthenticateJourney(page,account);
  mkdirSync("docs/previews/auth-workspaces",{recursive:true});
  for(const path of [root,...["settings","locations","members","permissions","ownership","audit"].map(s=>`${root}/${s}`),"/settings/account","/settings/account/security","/settings/account/privacy","/settings/account/recovery"]){
    const response=await page.goto(path);expect(response?.status()).toBe(200);await expect(page).toHaveTitle(/\| Mitsa$/);expect(await page.getByTestId("mfa-manual-key").count()).toBe(0);
    expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze()).violations).toEqual([]);
    for(const width of [320,390,768,1024,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Management reflow: ${path}, ${width}`).toBe(true);}
    if([root,"/settings/account/security"].includes(path))for(const width of [390,768,1440]){await page.setViewportSize({width,height:900});await page.screenshot({path:`docs/previews/auth-workspaces/${path===root?"workspace":"security"}-final-${info.project.name}-${width}.png`,fullPage:true});}
    await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.documentElement.style.fontSize="200%");expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Management enlarged text: ${path}`).toBe(true);
  }
  expect(errors).toEqual([]);expect(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length}))).toEqual({local:0,session:0});
  await page.getByRole("link",{name:"Workspaces",exact:true}).first().click();await page.getByRole("button",{name:"Sign out",exact:true}).click();await expect(page).toHaveURL(/\/login$/);
});
