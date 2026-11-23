import { describe,it,expect } from "vitest";
import { randomBytes } from "node:crypto";
import { openAuthFlow,sealAuthFlow } from "../../src/lib/security/auth-flow";
import { signupSchema,resetPasswordSchema } from "../../src/lib/auth/forms";
describe("Authentication link protection",()=>{
  const key=randomBytes(32).toString("base64url"), now=Date.now();
  const context={purpose:"email" as const,type:"signup" as const,tokenHash:"a".repeat(64),expiresAt:now+600000};
  it("encrypts and authenticates a bounded link without exposing its hash",()=>{
    const token=sealAuthFlow(context,key);
    expect(token).not.toContain(context.tokenHash);
    expect(openAuthFlow(token,key,now)).toEqual(context);
    expect(openAuthFlow(token,randomBytes(32).toString("base64url"),now)).toBeNull();
    const bytes=Buffer.from(token,"base64url");bytes[30]^=1;
    expect(openAuthFlow(bytes.toString("base64url"),key,now)).toBeNull();
  });
  it("rejects expired, overlong, missing and excessively future state",()=>{
    const token=sealAuthFlow(context,key);
    expect(openAuthFlow(token,key,now+600000)).toBeNull();
    expect(openAuthFlow(token,key,now-1)).toBeNull();
    expect(openAuthFlow("a".repeat(1501),key,now)).toBeNull();
    expect(openAuthFlow(undefined,key,now)).toBeNull();
  });
  it("distinguishes confirmed recovery from an unconsumed recovery link",()=>{
    const proof={purpose:"recovery" as const,userId:crypto.randomUUID(),sessionId:crypto.randomUUID(),expiresAt:now+300000};
    expect(openAuthFlow(sealAuthFlow(proof,key),key,now)).toEqual(proof);
    expect(()=>sealAuthFlow({...context,purpose:"recovery"} as never,key)).toThrow();
  });
  it("supports provider PKCE hashes without stripping the security prefix",()=>{
    const pkce={...context,tokenHash:"pkce_"+context.tokenHash};
    expect(openAuthFlow(sealAuthFlow(pkce,key),key,now)).toEqual(pkce);
    expect(()=>sealAuthFlow({...context,tokenHash:"arbitrary_"+context.tokenHash},key)).toThrow();
  });
  it("requires current agreement, unchecked acceptance, matching passwords and rejects role injection",()=>{
    const input={fullName:"Synthetic Owner",email:" FOUNDATION-OWNER@EXAMPLE.INVALID ",password:"Test-password-123",confirmPassword:"Test-password-123",termsVersion:crypto.randomUUID(),accepted:"on"};
    expect(signupSchema.parse(input).email).toBe("foundation-owner@example.invalid");
    expect(signupSchema.safeParse({...input,accepted:undefined}).success).toBe(false);
    expect(signupSchema.safeParse({...input,confirmPassword:"mismatch"}).success).toBe(false);
    expect(signupSchema.safeParse({...input,role:"owner"}).success).toBe(false);
    expect(resetPasswordSchema.safeParse({password:"Test-password-123",confirmPassword:"mismatch"}).success).toBe(false);
  });
});
