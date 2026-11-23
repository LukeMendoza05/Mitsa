import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { createSyntheticUser, syntheticTermsVersion } from "../support/hosted";
import { totp } from "../support/totp";
import { browserOrigin } from "../support/browser-origin";

test("native Terms, authenticator enrollment, backup replacement, disable and reenrollment", async ({ browser }, info) => {
  test.setTimeout(240000);
  const user = await createSyntheticUser("native-mfa");
  await syntheticTermsVersion();
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await page.goto(`${browserOrigin}/login`);
    await page.getByLabel("Email").fill(user.email); await page.getByLabel("Password", { exact: true }).fill(user.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.goto(`${browserOrigin}/onboarding`); await page.getByRole("link", { name: "Review agreement" }).click();
    const acceptance = page.getByLabel("I have read and accept this Terms version.");
    await expect(acceptance).not.toBeChecked();
    await acceptance.check(); await page.getByRole("button", { name: "Accept and continue" }).click();
    await page.goto(`${browserOrigin}/settings/account/security`);
    const enroll = async (label: string) => {
      await page.getByLabel("Authenticator name", { exact: true }).fill(label);
      await page.getByRole("button", { name: "Start authenticator setup" }).click();
      await expect(page.getByRole("img", { name: "Mitsa authenticator setup QR code" })).toBeVisible();
      const secret = (await page.getByTestId("mfa-manual-key").textContent())!;
      const cookie = (await context.cookies()).find(item => item.name === "mitsa-mfa-enrollment");
      expect(Boolean(cookie?.httpOnly && cookie.secure && cookie.sameSite === "Strict")).toBe(true);
      expect(cookie?.value.includes(secret)).toBe(false);
      await page.getByLabel("New authenticator code", { exact: true }).fill(totp(secret));
      await page.getByRole("button", { name: "Confirm new authenticator" }).click();
      await expect(page.getByText("Your current session has verified MFA.", { exact: true })).toBeVisible();
      expect((await context.cookies()).some(item => item.name === "mitsa-mfa-enrollment")).toBe(false);
      return secret;
    };
    await enroll("Primary device");
    await page.goto(`${browserOrigin}/onboarding`);
    const name = `Synthetic native ${crypto.randomUUID()}`;
    await page.getByLabel("Business name", { exact: true }).fill(name); await page.getByLabel("First location name").fill("Main shop");
    await page.getByRole("button", { name: "Create workspace" }).click();
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    const workspaceUrl = page.url();
    await page.getByRole("link", { name: "Security settings", exact: true }).click();
    const backup = await enroll("Backup device");
    const removePrimary = page.locator("form").filter({ has: page.getByLabel("Remove Primary device.", { exact: true }) });
    await removePrimary.getByRole("checkbox").check(); await removePrimary.getByRole("button", { name: "Remove authenticator" }).click();
    await expect(page.getByLabel("Remove Primary device.", { exact: true })).toHaveCount(0);
    await page.getByLabel("Current password", { exact: true }).fill(user.password);
    await page.getByLabel("Current authenticator code", { exact: true }).fill(totp(backup));
    await page.getByRole("button", { name: "Confirm identity" }).click();
    await page.getByLabel("I understand that disabling all authenticators", { exact: false }).check();
    await page.getByRole("button", { name: "Disable MFA", exact: true }).click();
    await expect(page.getByText("No verified authenticator is currently available.", { exact: true })).toBeVisible();
    await page.goto(workspaceUrl);
    await expect(page).toHaveURL(`${browserOrigin}/settings/account/security`);
    await enroll("Replacement device");
    await page.goto(workspaceUrl);
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    await page.goto(`${browserOrigin}/settings/account/security`);
    mkdirSync("docs/previews/auth-workspaces", { recursive: true });
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if ([390, 768, 1440].includes(width)) await page.screenshot({ path: `docs/previews/auth-workspaces/security-${info.project.name}-${width}.png`, fullPage: true });
    }
    // Axe injects JavaScript and cannot finish in the native-only context.
    // Keep all preceding business/security actions JavaScript-disabled, then
    // scan the same signed-in page in a separate enabled context.
    const audit = await browser.newContext({ storageState: await context.storageState(), viewport: { width: 390, height: 844 } });
    try {
      const auditPage = await audit.newPage(); await auditPage.goto(`${browserOrigin}/settings/account/security`);
      await auditPage.getByLabel("Authenticator name", { exact: true }).fill("Enhanced backup");
      await auditPage.getByRole("button", { name: "Start authenticator setup" }).click();
      await expect(auditPage.getByTestId("mfa-manual-key")).toBeVisible();
      await auditPage.getByRole("button", { name: "Cancel setup" }).click();
      await expect(auditPage.getByTestId("mfa-manual-key")).toHaveCount(0);
      expect((await new AxeBuilder({ page: auditPage }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
      await audit.setOffline(true);
      await auditPage.getByRole("button", { name: "Start authenticator setup" }).click();
      const setupForm = auditPage.locator("form").filter({ has: auditPage.getByLabel("Authenticator name", { exact: true }) });
      await expect(setupForm.getByRole("alert")).toHaveText("We couldn’t complete that request. Check your connection and try again.");
      await expect(setupForm.getByRole("alert")).toBeFocused();
    } finally { await audit.close(); }
  } finally { await context.close(); }
});
