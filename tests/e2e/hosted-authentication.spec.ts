import { expect, test } from "@playwright/test";
import { database, hostedConfig, publicClient } from "../support/hosted";
import { securityFixture } from "../support/fixtures";
import { createClient } from "@supabase/supabase-js";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { totp } from "../support/totp";
import { browserOrigin } from "../support/browser-origin";

test.describe("real hosted server-only authentication",()=>{
  test.setTimeout(120000);
  let f: Awaited<ReturnType<typeof securityFixture>>;
  test.beforeAll(async()=>{ test.setTimeout(240000); f=await securityFixture(); });

  test("native Mitsa forms authenticate and sign out without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    try {
      const page = await context.newPage();
      await page.goto(`${browserOrigin}/login`);
      await page.getByLabel("Email").fill(f.manager.email);
      await page.getByLabel("Password", { exact: true }).fill(f.manager.password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page).toHaveURL(`${browserOrigin}/workspaces`);
      await expect(page).toHaveTitle("Workspaces | Mitsa");
      await expect(page.getByRole("heading", { name: "Your workspaces." })).toBeVisible();
      await page.getByRole("link", { name: "Verify authenticator", exact: true }).click();
      await page.getByLabel("Authenticator code", { exact: true }).fill(totp(f.manager.totpSecret));
      await page.getByRole("button", { name: "Verify authenticator", exact: true }).click();
      await page.getByRole("link", { name: "Open workspace", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Synthetic proof", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Sign out", exact: true }).click();
      await expect(page).toHaveURL(`${browserOrigin}/login`);
    } finally { await context.close(); }
  });

  test("Mitsa authenticated and membership-denied views stay accessible and allow logout", async ({ page }, info) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(f.manager.email);
    await page.getByLabel("Password", { exact: true }).fill(f.manager.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Your workspaces." })).toBeVisible();
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
    mkdirSync("docs/previews/auth-workspaces", { recursive: true });
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `docs/previews/auth-workspaces/picker-${info.project.name}-${width}.png`, fullPage: true, scale: "css" });
    }
    await page.setViewportSize({ width: info.project.name === "mobile" ? 390 : 1440, height: 900 });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `docs/previews/auth-workspaces/workspace-access-${info.project.name}.png`, fullPage: true, scale: "css" });
    const db = await database();
    try {
      await db.query("update private.memberships set active=false where business_id=$1 and user_id=$2", [f.business, f.manager.id]);
      await page.reload();
      await expect(page.getByText("No active workspace membership is available.", { exact: false })).toBeVisible();
      expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
      await page.screenshot({ path: `docs/previews/auth-workspaces/no-membership-${info.project.name}.png`, fullPage: true, scale: "css" });
      await page.getByRole("button", { name: "Sign out", exact: true }).click();
      await expect(page).toHaveURL(`${browserOrigin}/login`);
    } finally {
      await db.query("update private.memberships set active=true where business_id=$1 and user_id=$2", [f.business, f.manager.id]);
      await db.end();
    }
  });

  test("concurrent signed-in contexts keep distinct identities",async({browser})=>{
    const contexts=await Promise.all([browser.newContext(),browser.newContext()]);
    try {
      await Promise.all(contexts.map(async(context,index)=>{
        const user=index===0?f.cashier:f.manager;
        const login=await context.request.post(`${browserOrigin}/auth/login`,{headers:{origin:browserOrigin},form:{email:user.email,password:user.password},maxRedirects:0});
        expect(login.status()).toBe(303);
      }));
      const identities=await Promise.all(contexts.map(async context=>{
        const response=await context.request.get(`${browserOrigin}/api/proof/session`);
        expect(response.status()).toBe(200); return (await response.json()).userId;
      }));
      expect(identities).toEqual([f.cashier.id,f.manager.id]);
    } finally { await Promise.all(contexts.map(context=>context.close())); }
  });

  test("password login, HttpOnly cookie chunks, refresh, isolation and logout",async({page,context,browser,request})=>{
    await page.goto("/login");
    await page.getByLabel("Email").fill(f.cashier.email);
    await page.getByLabel("Password", { exact: true }).fill(f.cashier.password);
    await page.getByRole("button",{name:"Sign in"}).click();
    await expect(page.getByRole("heading",{name:"Your workspaces."})).toBeVisible();
    const cookies=(await context.cookies()).filter(c=>c.name.startsWith("sb-"));
    expect(cookies.length).toBeGreaterThan(0);
    expect(cookies.every(c=>c.httpOnly&&c.secure&&c.sameSite==="Lax")).toBe(true);
    expect(await page.evaluate(()=>document.cookie.includes("sb-"))).toBe(false);
    expect(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length}))).toEqual({local:0,session:0});
    expect(await page.evaluate(async()=>await indexedDB.databases())).toEqual([]);
    const session=await page.request.get("/api/proof/session");
    expect(session.status()).toBe(200);
    expect((await session.json()).userId).toBe(f.cashier.id);
    expect(session.headers()["cache-control"]).toContain("no-store");
    // A separate context must not inherit a request-scoped client's identity.
    const isolated=await browser.newContext();
    try { expect((await isolated.request.get(`${browserOrigin}/api/proof/session`)).status()).toBe(401); }
    finally { await isolated.close(); }
    await page.reload();
    await expect(page.getByRole("heading",{name:"Your workspaces."})).toBeVisible();
    // Decode the server cookie only in the test harness; never in product JavaScript.
    const ordered=cookies.sort((a,b)=>a.name.localeCompare(b.name));
    const cookieValue=ordered.map(c=>c.value).join("");
    expect(cookieValue.startsWith("base64-")).toBe(true);
    const stored=JSON.parse(Buffer.from(cookieValue.slice(7),"base64url").toString("utf8"));
    stored.expires_at=1; stored.expires_in=0;
    const expired="base64-"+Buffer.from(JSON.stringify(stored)).toString("base64url");
    const base=ordered[0].name.replace(/\.\d+$/,"");
    await context.clearCookies({name:/^sb-/});
    const chunks=[];
    for(let start=0,index=0;start<expired.length;start+=3000,index++) chunks.push({name:expired.length>3000?`${base}.${index}`:base,value:expired.slice(start,start+3000),domain:"127.0.0.1",path:"/",httpOnly:true,secure:true,sameSite:"Lax" as const});
    await context.addCookies(chunks);
    const refreshed=await page.request.get("/api/proof/session");
    expect(refreshed.status()).toBe(200);
    expect(refreshed.headers()["set-cookie"]).toContain("HttpOnly");
    expect(refreshed.headers()["cache-control"]).toContain("no-store");
    await page.goto("/proof");
    await page.getByRole("button",{name:"Sign out"}).click();
    await expect(page.getByRole("button",{name:"Sign in"})).toBeVisible();
    expect((await page.request.get("/api/proof/session")).status()).toBe(401);
    // Forged cookie content does not authenticate a separate request client.
    expect((await request.get("/api/proof/session",{headers:{cookie:`${base}=base64-forged`}})).status()).toBe(401);
  });

  test("recovery token callback is server-only, fixed-destination and single-use",async({request})=>{
    const cfg=hostedConfig();
    const admin=createClient(cfg.url,cfg.adminKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const link=await admin.auth.admin.generateLink({type:"recovery",email:f.manager.email});
    expect(link.error).toBeNull();
    const hash=link.data.properties?.hashed_token;
    expect(hash).toBeTruthy();
    const url=`/auth/confirm?type=recovery&token_hash=${hash}&next=https://attacker.example`;
    const response=await request.get(url,{maxRedirects:0});
    expect(response.status()).toBe(303);
    expect(response.headers().location).toBe(`${browserOrigin}/proof`);
    expect(response.headers()["set-cookie"]).toContain("HttpOnly");
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect((await request.get(url,{maxRedirects:0})).status()).toBe(400);
  });

  test("database rejects revoked membership and revoked Auth session",async({request})=>{
    const login=await request.post("/auth/login",{headers:{origin:browserOrigin},form:{email:f.cashier.email,password:f.cashier.password},maxRedirects:0});
    expect(login.status()).toBe(303);
    expect((await request.get("/api/proof/session")).status()).toBe(200);
    const db=await database();
    try {
      await db.query("update private.memberships set active=false where business_id=$1 and user_id=$2",[f.business,f.cashier.id]);
      expect((await request.get("/api/proof/session")).status()).toBe(403);
      await db.query("update private.memberships set active=true where business_id=$1 and user_id=$2",[f.business,f.cashier.id]);
      // Revoke the actual signed session and then replay its old access token.
      const client=publicClient();
      await client.auth.setSession({access_token:f.owner.session.access_token,refresh_token:f.owner.session.refresh_token});
      expect((await client.auth.signOut({scope:"global"})).error).toBeNull();
      expect((await publicClient(f.owner.session.access_token).schema("api").rpc("foundation_identity")).error?.code).toBe("42501");
    } finally { await db.query("update private.memberships set active=true where business_id=$1 and user_id=$2",[f.business,f.cashier.id]); await db.end(); }
  });

  test("rejected refresh clears expired cookies and returns only generic denial",async({page,context})=>{
    const login=await page.request.post("/auth/login",{headers:{origin:browserOrigin},form:{email:f.cashier.email,password:f.cashier.password},maxRedirects:0});
    expect(login.status()).toBe(303);
    const cookies=(await context.cookies()).filter(c=>c.name.startsWith("sb-")).sort((a,b)=>a.name.localeCompare(b.name));
    expect(cookies.length).toBeGreaterThan(0);
    const value=cookies.map(c=>c.value).join("");
    expect(value.startsWith("base64-")).toBe(true);
    const stored=JSON.parse(Buffer.from(value.slice(7),"base64url").toString("utf8"));
    // Revoke this actual server-issued session, then replay its expired cookie.
    const revoker=publicClient();
    expect((await revoker.auth.setSession({access_token:stored.access_token,refresh_token:stored.refresh_token})).error?.code).toBeUndefined();
    expect((await revoker.auth.signOut({scope:"local"})).error?.code).toBeUndefined();
    stored.expires_at=1; stored.expires_in=0;
    const expired="base64-"+Buffer.from(JSON.stringify(stored)).toString("base64url");
    const base=cookies[0].name.replace(/\.\d+$/,"");
    await context.clearCookies({name:/^sb-/});
    const chunks=[];
    for(let start=0,index=0;start<expired.length;start+=3000,index++) chunks.push({name:expired.length>3000?`${base}.${index}`:base,value:expired.slice(start,start+3000),domain:"127.0.0.1",path:"/",httpOnly:true,secure:true,sameSite:"Lax" as const});
    await context.addCookies(chunks);
    const response=await page.request.get("/api/proof/session");
    expect(response.status()).toBe(401);
    expect(response.headers()["cache-control"]).toContain("no-store");
    // Boolean assertions avoid printing cookie or token-bearing bodies on failure.
    expect((await response.text())===JSON.stringify({error:"Authentication required"})).toBe(true);
    expect(response.headers().location===undefined).toBe(true);
    expect(response.headers()["set-cookie"]?.includes("Max-Age=0")).toBe(true);
    expect((await context.cookies()).some(c=>c.name.startsWith("sb-"))).toBe(false);
    await page.goto("/proof");
    await expect(page).toHaveURL(`${browserOrigin}/login`);
    await expect(page.getByRole("button",{name:"Sign in"})).toBeVisible();
  });

  test("time-expired recovery tokens cannot create a session",async({request})=>{
    const cfg=hostedConfig();
    const admin=createClient(cfg.url,cfg.adminKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const link=await admin.auth.admin.generateLink({type:"recovery",email:f.manager.email});
    expect(link.error).toBeNull();
    const hash=link.data.properties?.hashed_token;
    expect(hash).toBeTruthy();
    const db=await database();
    const prior=(await db.query("select recovery_sent_at from auth.users where id=$1",[f.manager.id])).rows[0];
    try {
      await db.query("update auth.users set recovery_sent_at=now()-interval '2 days' where id=$1",[f.manager.id]);
      const response=await request.get(`/auth/confirm?type=recovery&token_hash=${hash}`,{maxRedirects:0});
      expect(response.status()).toBe(400);
      expect(response.headers()["set-cookie"]).toBeUndefined();
      expect(response.headers()["cache-control"]).toContain("no-store");
      expect((await request.get("/api/proof/session")).status()).toBe(401);
    } finally { await db.query("update auth.users set recovery_sent_at=$2 where id=$1",[f.manager.id,prior.recovery_sent_at]); await db.end(); }
  });
});
