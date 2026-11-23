import { expect, it } from "vitest";
import { totp } from "../support/totp";

it.each([[59, "94287082"], [1111111109, "07081804"], [1111111111, "14050471"], [1234567890, "89005924"], [2000000000, "69279037"]])("matches RFC 6238 synthetic SHA1 vector %s", (seconds, expected) => {
  expect(totp("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", Number(seconds) * 1000, 8)).toBe(expected);
});
