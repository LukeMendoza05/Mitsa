import {defineConfig,devices} from "@playwright/test";
import {loadEmailCodeTestSetting} from './tests/support/email-format-config.mjs';
loadEmailCodeTestSetting();
export default defineConfig({testDir:"./tests/e2e",testMatch:"email-verification.spec.ts",workers:1,fullyParallel:false,retries:0,reporter:"list",timeout:240000,expect:{timeout:15000},use:{baseURL:"http://127.0.0.1:3000",trace:"off",screenshot:"off",actionTimeout:30000,navigationTimeout:30000},projects:[{name:"desktop",use:{...devices["Desktop Chrome"],channel:"msedge"}},{name:"mobile",use:{...devices["Pixel 7"],channel:"msedge"}}]});
