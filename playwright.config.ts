import { defineConfig, devices } from "@playwright/test";
import { browserOrigin, browserPort } from "./tests/support/browser-origin";

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: ["**/ui-refinement.spec.ts"],
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: browserOrigin, trace: "off", screenshot: "off" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "msedge" } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: "msedge" } },
  ],
  webServer: { command: `npm run start -- --port ${browserPort}`, url: browserOrigin, env: { APP_ORIGIN: browserOrigin }, reuseExistingServer: false, timeout: 60000 },
});
