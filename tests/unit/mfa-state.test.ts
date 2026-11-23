import {describe,it,expect} from "vitest";
import {classifyFactors,enrollmentDeadline,passwordDeadline,sensitiveWindowMs,type SecurityState} from "../../src/lib/security/mfa-state";
describe("MFA enrollment state and shared authorization deadline",()=>{
  const now=1800000000000,claims={amr:[{method:"password",timestamp:now/1000}]};
  it("bounds setup by password confirmation, not a fresh five minutes after QR creation",()=>{
    const later=now+240000;
    expect(enrollmentDeadline(claims,later,later)).toBe(now+sensitiveWindowMs);
    expect(enrollmentDeadline(claims,now+295000,now+295000)).toBeNull();
    expect(passwordDeadline(claims,now+300000)).toBeNull();
  });
  it("fails closed for absent, malformed and future authentication evidence",()=>{
    for(const value of [null,{}, {amr:[{method:"totp",timestamp:now/1000}]},{amr:[{method:"password",timestamp:now/1000+6}]}])expect(passwordDeadline(value,now)).toBeNull();
  });
  it("distinguishes first-time, pending, provider-verified incomplete and trusted factors",()=>{
    const id=crypto.randomUUID(),factor={id,factor_type:"totp",status:"verified"};
    const state:SecurityState={ready:false,recent:false,initialized:false,factors:[],pendingRemovals:[]};
    expect(classifyFactors([],state).needsReview).toBe(false);
    expect(classifyFactors([{...factor,status:"unverified"}],state).pending).toHaveLength(1);
    expect(classifyFactors([factor],state)).toMatchObject({needsReview:true,trusted:[],unbound:[factor]});
    expect(classifyFactors([factor],{...state,initialized:true,factors:[{id,active:true}]})).toMatchObject({needsReview:false,trusted:[factor]});
    expect(classifyFactors([factor],{...state,initialized:true,factors:[{id,active:false}]}).needsReview).toBe(true);
  });
});
