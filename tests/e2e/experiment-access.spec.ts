import { test, expect } from "@playwright/test";
test("product burst is unavailable in production", async ({ request }) => {
  const response = await request.get("/experiments/product-burst");
  expect(response.status()).toBe(404);
  expect(await response.text()).not.toContain("Dragon Family Package 2");
  expect(await response.text()).not.toContain("Order. Unfolded.");
  expect(await response.text()).not.toContain("unbranded technical placeholders");
  const baseline=await request.get("/login");
  for(const name of ["x-content-type-options","x-frame-options","referrer-policy","permissions-policy"]) expect(response.headers()[name]).toBe(baseline.headers()[name]);
  const csp=response.headers()["content-security-policy"];
  expect(csp.replace(/'nonce-[^']+'/g,"'nonce-REDACTED'")).toBe(baseline.headers()["content-security-policy"].replace(/'nonce-[^']+'/g,"'nonce-REDACTED'"));
  expect(csp).not.toContain("unsafe-eval"); expect(csp).not.toContain("unsafe-inline");
  expect(response.headers()["cache-control"]).toContain("no-store");
});
