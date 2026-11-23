import {defineConfig,devices} from "@playwright/test";
// Isolated browser contexts against the approved running loopback app.
export default defineConfig({testDir:"./tests/e2e",testMatch:"auth-refresh.spec.ts",fullyParallel:false,workers:1,retries:0,reporter:"list",timeout:240000,expect:{timeout:20000},
  use:{baseURL:"http://127.0.0.1:3000",trace:"off",screenshot:"off",actionTimeout:30000,navigationTimeout:30000},
  projects:[{name:"desktop",use:{...devices["Desktop Chrome"],channel:"msedge"}},{name:"mobile",use:{...devices["Pixel 7"],channel:"msedge"}}],
});
