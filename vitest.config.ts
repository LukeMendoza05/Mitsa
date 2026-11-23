import { defineConfig } from "vitest/config";
import {fileURLToPath} from "node:url";
import {loadEmailCodeTestSetting} from './tests/support/email-format-config.mjs';
loadEmailCodeTestSetting();

export default defineConfig({
  resolve:{alias:{"@":fileURLToPath(new URL("./src",import.meta.url))}},
  test: {
    projects: [
      { test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node" } },
      { test: { name: "integration", include: ["tests/integration/**/*.test.ts"], environment: "node", fileParallelism: false, testTimeout: 30000, hookTimeout: 60000 } },
    ],
  },
});
