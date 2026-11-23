import {it,expect} from 'vitest';
import {providerCodeRejected} from '../../scripts/lib/provider-code-rejection.mjs';
it('accepts only explicit provider invalid/expired OTP rejection without an identity or session',()=>{expect(providerCodeRejected({error:{status:403,code:'otp_expired'},data:{user:null,session:null}})).toBe(true);});
it('does not mistake network errors, provider outages or rate limits for invalidation',()=>{
 for(const error of [undefined,{status:0},{status:503,code:'unexpected_failure'},{status:429,code:'over_request_rate_limit'},{status:403,code:'other'},{status:400,code:'otp_expired'}])expect(providerCodeRejected({error,data:{user:null,session:null}})).toBe(false);
});
it('refuses any response containing an authenticated user or session',()=>{
 for(const data of [{user:{id:'synthetic'},session:null},{user:null,session:{access_token:'synthetic-inactive'}}])expect(providerCodeRejected({error:{status:403,code:'otp_expired'},data})).toBe(false);
});
