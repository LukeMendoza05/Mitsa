import { expect, test } from "@playwright/test";

test("foundation exposes no unapproved business workflow", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.headers()["content-security-policy"]).toContain("'strict-dynamic'");
  expect(response?.headers()["content-security-policy"]).not.toContain("'unsafe-eval'");
  await expect(page.getByRole("heading", { name: "A clearer view of every shop." })).toBeVisible();
  await expect(page.getByText("Planned capabilities", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Checkout", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
