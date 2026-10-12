import { describe, expect, it } from "vitest";
import { assertTestTarget } from "../../scripts/test-target.mjs";

const approved = {
  projectRef: "abcdefghijklmnopqrst",
  purpose: "isolated-development-test",
  approvedByUser: true,
  databaseMarker: "synthetic-proof-marker",
};
const input = {
  projectRef: "abcdefghijklmnopqrst",
  url: "https://abcdefghijklmnopqrst.supabase.co",
  databaseUrl: "postgresql://postgres:synthetic@db.abcdefghijklmnopqrst.supabase.co:5432/postgres",
};

describe("isolated database guard", () => {
  it("does not expose credential text when a URL is malformed", () => {
    for (const field of ["url", "databaseUrl"]) {
      let failure: unknown;
      try { assertTestTarget({ ...input, [field]: "malformed-synthetic-secret" }, approved); }
      catch (error) { failure = error; }
      expect(failure).toBeInstanceOf(Error);
      expect(String(failure)).not.toContain("synthetic-secret");
      expect(failure).not.toHaveProperty("input");
      expect(String(failure)).toContain("Invalid test target URL");
    }
  });
  it("permits only the explicitly approved isolated target", () => {
    expect(assertTestTarget(input, approved).projectRef).toBe("abcdefghijklmnopqrst");
  });
  it("rejects another project before connecting", () => {
    expect(() => assertTestTarget({ ...input, projectRef: "zzzzzzzzzzzzzzzzzzzz" }, approved)).toThrow("unapproved project");
  });
  it("rejects production purpose even when the project matches", () => {
    expect(() => assertTestTarget(input, { ...approved, purpose: "production" })).toThrow("isolated");
  });
  it("rejects an API URL belonging to another project", () => {
    expect(() => assertTestTarget({ ...input, url: "https://zzzzzzzzzzzzzzzzzzzz.supabase.co" }, approved)).toThrow("API URL");
  });
  it("rejects a database connection to another project", () => {
    expect(() => assertTestTarget({ ...input, databaseUrl: "postgresql://postgres:synthetic@db.zzzzzzzzzzzzzzzzzzzz.supabase.co/postgres" }, approved)).toThrow("database target");
  });
  it("validates pooler username against the pinned project", () => {
    const databaseUrl = "postgresql://postgres.abcdefghijklmnopqrst:synthetic@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres";
    expect(assertTestTarget({ ...input, databaseUrl }, approved).projectRef).toBe(input.projectRef);
    expect(() => assertTestTarget({ ...input, databaseUrl: databaseUrl.replace("postgres.abcdefghijklmnopqrst", "postgres.zzzzzzzzzzzzzzzzzzzz") }, approved)).toThrow("database target");
  });
  it("rejects database URL options that can override the target or TLS", () => {
    for (const suffix of ["?host=unrelated.example", "?user=unrelated", "?ssl=0", "?sslmode=disable", "#unexpected"]) {
      expect(() => assertTestTarget({ ...input, databaseUrl: input.databaseUrl + suffix }, approved)).toThrow("database target");
    }
    expect(() => assertTestTarget({ ...input, databaseUrl: input.databaseUrl.replace(":5432/", ":6543/") }, approved)).toThrow("database target");
  });
  it("rejects unapproved targets and missing ownership markers", () => {
    expect(() => assertTestTarget(input, { ...approved, approvedByUser: false })).toThrow("approval");
    expect(() => assertTestTarget(input, { ...approved, databaseMarker: "" })).toThrow("marker");
  });
  it("rejects URL credentials, paths and insecure protocols", () => {
    for (const url of ["http://abcdefghijklmnopqrst.supabase.co", "https://user:pass@abcdefghijklmnopqrst.supabase.co", "https://abcdefghijklmnopqrst.supabase.co/other"]) {
      expect(() => assertTestTarget({ ...input, url }, approved)).toThrow("API URL");
    }
  });
});
