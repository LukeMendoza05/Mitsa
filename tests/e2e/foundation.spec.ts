import { expect, test } from "@playwright/test";

test("foundation exposes no unapproved business workflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Fireworks operations foundation" })).toBeVisible();
  await expect(page.getByText("Tasks 1–3: architecture, tooling and security proof.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Checkout", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
