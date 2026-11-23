import {defineConfig,devices} from "@playwright/test";
// Real isolated backend + the user's running loopback app. Separate browser
// contexts never overwrite the user's current tab or reuse its cookies.
export default defineConfig({testDir:"./tests/e2e",testMatch:["workspace-journeys.spec.ts","reviewed-requests.spec.ts"],fullyParallel:false,workers:1,retries:0,reporter:"list",timeout:900000,expect:{timeout:15000},
  use:{baseURL:"http://127.0.0.1:3000",trace:"off",screenshot:"off",actionTimeout:30000,navigationTimeout:30000},
  projects:[{name:"desktop",use:{...devices["Desktop Chrome"],channel:"msedge"}},{name:"mobile",use:{...devices["Pixel 7"],channel:"msedge"}}],
});
