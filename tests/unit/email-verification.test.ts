import {describe,it,expect} from "vitest";
import {randomBytes} from "node:crypto";
import {emailActionLimit,verificationCode,verificationFailure} from "../../src/lib/auth/email-verification";
import {openAuthFlow,sealAuthFlow} from "../../src/lib/security/auth-flow";
import {signupEmailTemplate} from "../../src/lib/mail/verification-template";
import {emailCodeSettings,emailVerificationCodeLength} from "../../src/lib/auth/email-code-settings";
describe("Email confirmation state and abuse controls",()=>{
 it("binds an encrypted continuation to a bounded signup recipient without storing a code",()=>{
  const key=randomBytes(32).toString("base64url"),now=Date.now(),value={purpose:"signup-code" as const,email:"foundation-cookie@example.invalid",issuedAt:now,resendAt:now+60000,expiresAt:now+86400000};
  const cookie=sealAuthFlow(value,key);expect(cookie).not.toContain(value.email);expect(openAuthFlow(cookie,key,now)).toEqual(value);expect(openAuthFlow(cookie,key,now+86400000)).toBeNull();
  expect(openAuthFlow(cookie,randomBytes(32).toString("base64url"),now)).toBeNull();const tampered=Buffer.from(cookie,"base64url");tampered[30]^=1;expect(openAuthFlow(tampered.toString("base64url"),key,now)).toBeNull();
  expect(openAuthFlow(sealAuthFlow({...value,expiresAt:now+86400001},key),key,now)).toBeNull();expect(openAuthFlow(sealAuthFlow({...value,issuedAt:now+6000},key),key,now)).toBeNull();
 });
 it.each([undefined,"6","8"])("uses the six-digit default or an explicit supported rollback without changing expiration (%s)",value=>{const settings=emailCodeSettings(value);expect(settings.length).toBe(value==="8"?8:6);expect(settings.label).toBe(value==="8"?"eight-digit":"six-digit");expect(settings.expirySeconds).toBe(3600);});
 it.each(["","5","7","10","06","6 ","six"])("fails closed for invalid email-code configuration (%s)",value=>{expect(()=>emailCodeSettings(value)).toThrow("Unsupported email verification configuration");});
 it("requires exactly the selected provider length and rejects alternate lengths",()=>{expect(verificationCode.safeParse("1".repeat(emailVerificationCodeLength)).success).toBe(true);for(const code of ["1".repeat(emailVerificationCodeLength===6?8:6),"12345","1234567890","12345678901","12 345678","abcdefgh"])expect(verificationCode.safeParse(code).success).toBe(false);});
 it("serializes repeated recipient requests independently of replayed browser cookies",()=>{
  const email=`foundation-limits-${crypto.randomUUID()}@example.invalid`,now=Date.now();expect(emailActionLimit(email,"resend",now)).toBe(true);expect(emailActionLimit(email,"resend",now+59999)).toBe(false);expect(emailActionLimit(email,"resend",now+60000)).toBe(true);
  for(let i=0;i<5;i++)expect(emailActionLimit(email,"verify",now+i)).toBe(true);expect(emailActionLimit(email,"verify",now+6)).toBe(false);expect(emailActionLimit(email,"verify",now+60001)).toBe(true);
 });
 it("returns bounded errors rather than provider details",()=>{expect(verificationFailure("otp_expired",403)).toBe("code");expect(verificationFailure("over_request_rate_limit",429)).toBe("rate_limited");expect(verificationFailure("private-provider-message",500)).toBe("unavailable");});
 it("prepares a responsive provider-token template only for an explicit approved expiry",()=>{const template=signupEmailTemplate(600);expect(template.subject).toBe("Verify your Mitsa email address");expect(template.html).toContain("{{ .Token }}");expect(template.html).toContain("{{ .TokenHash }}");expect(template.html).toContain("10 minutes");expect(template.html).not.toMatch(/<img|tracking|https?:\/\//);expect(()=>signupEmailTemplate(0)).toThrow();expect(()=>signupEmailTemplate(86401)).toThrow();});
 it("omits unverified expiration numbers from local previews",()=>{const template=signupEmailTemplate();expect(template.html).toContain("Verification codes expire.");expect(template.text).not.toMatch(/\d+ minutes|\d+ seconds/);});
});
