import {afterEach,it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {verifyRecoveryChallenge} from '../../src/lib/auth/signup-challenge';
const now=Date.now(),origin='http://127.0.0.1:3000',config={siteKey:'synthetic-site-key-for-unit',secret:'synthetic-private-key-for-unit'};
const success={success:true,hostname:'127.0.0.1',action:'recovery',challenge_ts:new Date(now).toISOString()};
afterEach(()=>vi.unstubAllGlobals());
it('accepts only a fresh recovery-action proof from the approved hostname',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>new Response(JSON.stringify(success))));expect(await verifyRecoveryChallenge('synthetic-proof',origin,config,now)).toBe(true);
});
it('rejects missing, invalid, expired, replayed and cross-purpose proofs',async()=>{
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
 expect(await verifyRecoveryChallenge('',origin,config,now)).toBe(false);expect(fetch).not.toHaveBeenCalled();
 for(const value of [{success:false,'error-codes':['invalid-input-response']},{success:false,'error-codes':['timeout-or-duplicate']},{...success,action:'signup'},{...success,hostname:'foreign.invalid'},{...success,challenge_ts:new Date(now-300000).toISOString()}]){
  fetch.mockResolvedValueOnce(new Response(JSON.stringify(value)));expect(await verifyRecoveryChallenge('synthetic-proof',origin,config,now)).toBe(false);
 }
});
it('fails closed during provider outages',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockRejectedValue(Error('Synthetic outage')));expect(await verifyRecoveryChallenge('synthetic-proof',origin,config,now)).toBe(false);
});
