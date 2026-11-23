import {describe,it,expect,vi} from "vitest";
import {createHash} from "node:crypto";
vi.mock("server-only",()=>({}));
import {isLocalTestingEmail} from "../../src/lib/auth/developer-access";
import {signupFieldErrors,providerRegistrationFailure} from "../../src/lib/auth/feedback";
describe("safe authentication feedback",()=>{
  it("keeps personal email requests closed without the exact private developer hint",()=>{
    const email="developer@example.com",hash=createHash("sha256").update(email).digest("hex");
    expect(isLocalTestingEmail(email,"")).toBe(false);expect(isLocalTestingEmail(email,hash)).toBe(true);expect(isLocalTestingEmail("other@example.com",hash)).toBe(false);expect(isLocalTestingEmail("foundation-approved@example.invalid","")).toBe(true);
  });
  it("identifies fields without echoing submitted names, emails or passwords",()=>{
    const errors=signupFieldErrors({fullName:"",email:"PRIVATE-invalid-value",password:"SECRET",confirmPassword:"OTHER-SECRET",accepted:"",termsVersion:crypto.randomUUID()});
    expect(Object.keys(errors).sort()).toEqual(["accepted","confirmPassword","email","fullName","password"]);
    expect(JSON.stringify(errors)).not.toMatch(/PRIVATE|SECRET/);
  });
  it("maps supported provider errors without exposing account existence",()=>{
    expect(providerRegistrationFailure("weak_password",422)).toBe("password");expect(providerRegistrationFailure("over_email_send_rate_limit",429)).toBe("rate_limited");
    expect(providerRegistrationFailure("hook_timeout",500)).toBe("mail_unavailable");expect(providerRegistrationFailure("otp_expired",403)).toBe("request_expired");
    expect(providerRegistrationFailure("user_already_exists",422)).toBe("unavailable");expect(providerRegistrationFailure("PRIVATE_DATABASE_DETAIL",500)).toBe("unavailable");
  });
});
