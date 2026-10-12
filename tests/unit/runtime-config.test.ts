import { describe, expect, it } from "vitest";
import { parseRuntimeConfig } from "../../src/lib/runtime-config";

const ref = "abcdefghijklmnopqrst";
const input = { SUPABASE_URL: `https://${ref}.supabase.co`, SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic", APP_ORIGIN: "http://127.0.0.1:3000" };

describe("ordinary runtime configuration", () => {
  it("accepts the approved project with a publishable key", () => {
    expect(parseRuntimeConfig(input, ref).origin).toBe("http://127.0.0.1:3000");
  });
  it("rejects privileged keys and privileged credentials in the runtime", () => {
    expect(() => parseRuntimeConfig({ ...input, SUPABASE_PUBLISHABLE_KEY: "sb_secret_synthetic" }, ref)).toThrow("publishable");
    for (const key of ["TEST_AUTH_ADMIN_KEY", "TEST_DATABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY", "DATABASE_URL"]) {
      expect(() => parseRuntimeConfig({ ...input, [key]: "synthetic-secret" }, ref)).toThrow("administrative");
    }
  });
  it("rejects another project and insecure non-local application origins", () => {
    expect(() => parseRuntimeConfig({ ...input, SUPABASE_URL: "https://zzzzzzzzzzzzzzzzzzzz.supabase.co" }, ref)).toThrow("approved project");
    expect(() => parseRuntimeConfig({ ...input, APP_ORIGIN: "http://shop.example.com" }, ref)).toThrow("HTTPS");
    expect(() => parseRuntimeConfig({ ...input, APP_ORIGIN: "https://shop.example.com/redirect" }, ref)).toThrow("origin");
  });
});
