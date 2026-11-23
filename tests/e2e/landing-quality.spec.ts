import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {browserOrigin} from "../support/browser-origin";
import {mkdirSync} from "node:fs";
const publicPages=["/", "/login", "/signup", "/forgot-password", "/reset-password", "/verify-email", "/invitations/accept", "/privacy", "/terms", "/cookies", "/missing-page"];

test("public pages meet automated WCAG checks", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const url of publicPages) {
    await page.goto(url);
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(result.violations).toEqual([]);
    expect(await page.evaluate(() => { const ids = [...document.querySelectorAll("[id]")].map(el => el.id); return ids.length === new Set(ids).size; })).toBe(true);
  }
});

test("all layouts reflow at small widths and enlarged text", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const url of publicPages) {
    await page.goto(url);
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${url} overflow at ${width}`).toBe(true);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${url} enlarged text overflow`).toBe(true);
  }
});

test("no-JavaScript navigation, previews and native form remain available", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${browserOrigin}/`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.locator("header summary").click();
  await expect(page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Sign In" })).toBeVisible();
  await page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Sign In" }).click();
  await expect(page.locator("form")).toHaveAttribute("action", "/auth/login");
  await expect(page.locator("form")).toHaveAttribute("method", "post");
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password",{exact:true})).toBeVisible();
  await context.close();
});

test("page navigation has no runtime errors, external assets or legacy resources", async ({ page }) => {
  const errors: string[] = [], assets: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("request", request => { if (/\.(woff2|glb|webp|png|svg)(\?|$)/.test(request.url())) assets.push(request.url()); });
  for (const url of publicPages.filter(url=>url!=="/missing-page")) { await page.goto(url); await page.evaluate(() => document.fonts.ready); }
  expect(errors).toEqual([]);
  expect(assets.length).toBeGreaterThan(0);
  expect(assets.every(url => url.startsWith(`${browserOrigin}/`))).toBe(true);
  expect(assets.some(url => /marketing|dragon/.test(url))).toBe(false);
  expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
});

test("authentication pages preserve Mitsa metadata, keyboard access and draft disclosures",async({page},info)=>{
  mkdirSync("docs/previews/auth-workspaces",{recursive:true});
  for(const path of ["/login","/signup","/forgot-password","/privacy","/terms","/cookies"]){
    await page.goto(path);await expect(page).toHaveTitle(/\| Mitsa$/);
    await expect(page.getByRole("link",{name:"Mitsa home",exact:true})).toHaveCount(2);
    if(["/privacy","/terms","/cookies"].includes(path))await expect(page.getByText("Draft for review.",{exact:true})).toBeVisible();
    if(["/login","/signup"].includes(path)){
      await page.keyboard.press("Tab");await expect(page.getByRole("link",{name:"Skip to content",exact:true})).toBeFocused();
      await page.getByRole("heading",{level:1}).click();
      await page.screenshot({path:`docs/previews/auth-workspaces/${path.slice(1)}-final-${info.project.name}.png`,fullPage:true});
    }
    expect(await page.evaluate(()=>localStorage.length+sessionStorage.length)).toBe(0);
  }
});

