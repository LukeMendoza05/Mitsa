import { expect, test } from "@playwright/test";

test("Mitsa is consistent across the public interface and metadata", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Mitsa — Fireworks inventory and business management");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("A clearer view of every shop.");
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute("content", "Mitsa");
  await expect(page.locator('meta[name="application-name"]')).toHaveAttribute("content", "Mitsa");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  expect(await page.locator("main section").count()).toBe(7);
  await expect(page.locator("#capabilities")).toContainText("Planned capabilities");
  await expect(page.locator("#workspace")).toContainText("Illustrative preview");
  await expect(page.locator('a[href="/register"], a[href="/signup"]')).toHaveCount(0);

  expect(await page.locator("body").innerText()).not.toMatch(/Fireworks Inventory|FireStock|Your Brand|App Name|Dragon Family/);
  for (const link of await page.getByRole("link", { name: /^Sign In/ }).all()) await expect(link).toHaveAttribute("href", "/login");
  await expect(page.getByRole("link", { name: "Mitsa home" })).toHaveCount(2);
});

test("mobile menu supports native disclosure, anchors and Escape", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const menu = page.locator("header details");
  const toggle = menu.locator("summary");
  await toggle.click();
  await expect(menu).toHaveAttribute("open", "");
  await page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Capabilities" }).focus();
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await expect(menu).not.toHaveAttribute("open");
  await toggle.click();
  await page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Workspace" }).click();
  await expect(page).toHaveURL(/#workspace$/);
  await expect(menu).not.toHaveAttribute("open");
  expect(await page.locator("#workspace").evaluate(el => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(76);
});

test("sign-in stays on the form for generic errors and permits retry", async ({ page }) => {
  await page.goto("/login");
  await expect(page).toHaveTitle("Sign In | Mitsa");
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/auth/login", async route => { await gate; await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Private backend detail" }) }); });
  await page.getByLabel("Email").fill("synthetic@example.invalid");
  await page.getByLabel("Password").fill("test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Signing in…" })).toBeDisabled();
  release();
  await expect(page.locator("form").getByRole("alert")).toContainText("Check your email and password");
  await expect(page.locator("form").getByRole("alert")).toBeFocused();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
  expect(await page.locator("body").innerText()).not.toContain("Private backend detail");
  await page.route("**/auth/login", route => route.abort());
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText("Check your connection");
});

test("removed experiment and unknown pages use the Mitsa 404", async ({ page, request }) => {
  for (const url of ["/experiments/product-burst", "/page-that-does-not-exist"]) {
    const response = await request.get(url);
    expect(response.status()).toBe(404);
    await page.goto(url);
    await expect(page).toHaveTitle("Page Not Found | Mitsa");
    await expect(page.getByRole("heading", { name: "A little off course." })).toBeVisible();
    await expect(page.getByRole("link", { name: "Mitsa home" })).toHaveCount(2);
  }
});


