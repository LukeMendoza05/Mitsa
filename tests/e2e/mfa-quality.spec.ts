import {test,expect} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {createSyntheticUser} from "../support/hosted";
import {signInJourney} from "../support/journeys";

test("MFA page supports keyboard, enlarged text, reduced motion and grouped pending actions",async({browser})=>{
 const user={...await createSyntheticUser("mfa-quality"),fullName:"Synthetic MFA quality"},context=await browser.newContext(),page=await context.newPage();let release=()=>{};
 try{
  await signInJourney(page,user);await page.emulateMedia({reducedMotion:"reduce"});await page.goto("http://127.0.0.1:3000/settings/account/security");
  await page.keyboard.press("Tab");await expect(page.getByRole("link",{name:"Skip to content",exact:true})).toBeFocused();
  await page.getByLabel("Current password",{exact:true}).focus();expect(await page.getByLabel("Current password",{exact:true}).evaluate(el=>getComputedStyle(el).outlineStyle!=="none")).toBe(true);
  expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze()).violations.length).toBe(0);
  for(const width of [320,390,768,1024,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{const els=[...document.querySelectorAll<HTMLElement>("h1,h2,p,label,a,button,input,span")],sizes=els.map(el=>parseFloat(getComputedStyle(el).fontSize));els.forEach((el,i)=>el.style.fontSize=`${sizes[i]*2}px`);});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await page.getByRole("main").evaluate(el=>getComputedStyle(el).animationName)).toBe("none");
  let requests=0;const gate=new Promise<void>(resolve=>release=resolve);await page.route("**/auth/security",async route=>{requests++;await gate;await route.abort("internetdisconnected");});
  await page.getByLabel("Current password",{exact:true}).fill(user.password);await page.getByRole("button",{name:"Confirm identity",exact:true}).click();await expect(page.getByRole("button",{name:"Start authenticator setup",exact:true})).toBeDisabled();await expect(page.getByLabel("Current password",{exact:true})).toBeDisabled();expect(requests).toBe(1);release();
  await expect(page.locator("form").filter({has:page.getByRole("button",{name:"Confirm identity",exact:true})}).getByRole("alert")).toBeFocused();await expect(page.getByRole("button",{name:"Start authenticator setup",exact:true})).toBeEnabled();
 }finally{release();await context.close();}
});
