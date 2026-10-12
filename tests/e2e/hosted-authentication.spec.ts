import { expect, test } from "@playwright/test";
import { database, hostedConfig, publicClient } from "../support/hosted";
import { securityFixture } from "../support/fixtures";
import { createClient } from "@supabase/supabase-js";

test.describe("real hosted server-only authentication",()=>{
  test.setTimeout(120000);
  let f: Awaited<ReturnType<typeof securityFixture>>;
  test.beforeAll(async()=>{ f=await securityFixture(); });

  test("concurrent signed-in contexts keep distinct identities",async({browser})=>{
    const contexts=await Promise.all([browser.newContext(),browser.newContext()]);
    try {
      await Promise.all(contexts.map(async(context,index)=>{
        const user=index===0?f.cashier:f.manager;
        const login=await context.request.post("http://127.0.0.1:3000/auth/login",{headers:{origin:"http://127.0.0.1:3000"},form:{email:user.email,password:user.password},maxRedirects:0});
        expect(login.status()).toBe(303);
      }));
      const identities=await Promise.all(contexts.map(async context=>{
        const response=await context.request.get("http://127.0.0.1:3000/api/proof/session");
        expect(response.status()).toBe(200); return (await response.json()).userId;
      }));
      expect(identities).toEqual([f.cashier.id,f.manager.id]);
    } finally { await Promise.all(contexts.map(context=>context.close())); }
  });

  test("password login, HttpOnly cookie chunks, refresh, isolation and logout",async({page,context,browser,request})=>{
    await page.goto("/login");
    await page.getByLabel("Email").fill(f.cashier.email);
    await page.getByLabel("Password").fill(f.cashier.password);
    await page.getByRole("button",{name:"Sign in"}).click();
    await expect(page.getByRole("heading",{name:"Signed-in authentication proof"})).toBeVisible();
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
    try { expect((await isolated.request.get("http://127.0.0.1:3000/api/proof/session")).status()).toBe(401); }
    finally { await isolated.close(); }
    await page.reload();
    await expect(page.getByRole("heading",{name:"Signed-in authentication proof"})).toBeVisible();
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
    expect(response.headers().location).toBe("http://127.0.0.1:3000/proof");
    expect(response.headers()["set-cookie"]).toContain("HttpOnly");
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect((await request.get(url,{maxRedirects:0})).status()).toBe(400);
  });

  test("database rejects revoked membership and revoked Auth session",async({request})=>{
    const login=await request.post("/auth/login",{headers:{origin:"http://127.0.0.1:3000"},form:{email:f.owner.email,password:f.owner.password},maxRedirects:0});
    expect(login.status()).toBe(303);
    expect((await request.get("/api/proof/session")).status()).toBe(200);
    const db=await database();
    try {
      await db.query("update private.memberships set active=false where business_id=$1 and user_id=$2",[f.business,f.owner.id]);
      expect((await request.get("/api/proof/session")).status()).toBe(403);
      await db.query("update private.memberships set active=true where business_id=$1 and user_id=$2",[f.business,f.owner.id]);
      // Revoke the actual signed session and then replay its old access token.
      const client=publicClient();
      await client.auth.setSession({access_token:f.owner.session.access_token,refresh_token:f.owner.session.refresh_token});
      expect((await client.auth.signOut({scope:"global"})).error).toBeNull();
      expect((await publicClient(f.owner.session.access_token).schema("api").rpc("foundation_identity")).error?.code).toBe("42501");
    } finally { await db.query("update private.memberships set active=true where business_id=$1 and user_id=$2",[f.business,f.owner.id]); await db.end(); }
  });
});
