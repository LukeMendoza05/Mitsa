import { expect, test } from "@playwright/test";

test("signed-out requests reveal no protected data and cannot submit cross-origin login", async ({ request, page }) => {
  const denied = await request.get("/api/proof/session");
  expect(denied.status()).toBe(401);
  expect(denied.headers()["cache-control"]).toContain("no-store");
  expect(await denied.json()).toEqual({ error: "Authentication required" });
  const csrf = await request.post("/auth/login", { headers: { origin: "https://attacker.example" }, form: { email: "x@example.invalid", password: "invalid" } });
  expect(csrf.status()).toBe(403);
  await page.goto("/login");
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("invalid authentication callbacks remain generic and uncacheable", async ({request}) => {
  for (const url of ["/auth/confirm", "/auth/confirm?type=recovery&token_hash=invalid-proof-token"]) {
    const response=await request.get(url,{maxRedirects:0});
    expect(response.status()).toBe(400);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers().location).toBeUndefined();
    expect(JSON.stringify(await response.json())).not.toContain("invalid-proof-token");
  }
});
