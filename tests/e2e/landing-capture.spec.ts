import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

test("captures the rebuilt Mitsa pages for visual inspection", async ({ page }, info) => {
  test.setTimeout(60000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  mkdirSync("docs/previews/mitsa", { recursive: true });
  const sizes = info.project.name === "desktop" ? [{ name: "desktop", width: 1440, height: 1000 }, { name: "tablet", width: 768, height: 1024 }] : [{ name: "mobile", width: 390, height: 844 }];
  for (const size of sizes) {
    await page.setViewportSize(size);
    for (const [name, url] of [["landing", "/"], ["sign-in", "/login"], ["not-found", "/missing-page"]]) {
      await page.goto(url);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `docs/previews/mitsa/${name}-${size.name}.png`, fullPage: true, scale: "css" });
    }
  }
});
