import {it,expect} from 'vitest';
import {existingPilotBinding} from '../../scripts/lib/pilot-existing-identity.mjs';
const user=crypto.randomUUID(),intent=crypto.randomUUID(),terms=crypto.randomUUID(),now=Date.now(),hash='a'.repeat(64);
const record={project:'mjtejwafxriwntweussc',purpose:'dedicated-sender-self-test',userId:user,emailHash:hash,approvedAt:new Date(now-60000).toISOString(),expiresAt:new Date(now+60000).toISOString()};
const row={id:user,emailHash:hash,fullName:'Synthetic Mitsa Gmail delivery test',unverified:true,active:true,memberships:0,factors:0,finalized:false,termsId:terms,createdAt:now,intentExpiresAt:now+3600000,intentId:intent};
it('binds only the preserved unverified, unprivileged synthetic sender and original current Terms intent',()=>{expect(existingPilotBinding(row,record,hash,terms,now)).toEqual({userId:user,intentId:intent});});
it('rejects confirmed, privileged, changed, expired, stale-Terms or differently bound accounts',()=>{
 for(const change of [{id:crypto.randomUUID()},{emailHash:'b'.repeat(64)},{fullName:'Other account'},{unverified:false},{active:false},{memberships:1},{factors:1},{finalized:true},{termsId:crypto.randomUUID()},{createdAt:now-120000},{intentExpiresAt:now+1000}])expect(()=>existingPilotBinding({...row,...change},record,hash,terms,now)).toThrow();
});
it('rejects a different target or scope record',()=>{expect(()=>existingPilotBinding(row,{...record,project:'other'},hash,terms,now)).toThrow();expect(()=>existingPilotBinding(row,{...record,purpose:'other'},hash,terms,now)).toThrow();});
