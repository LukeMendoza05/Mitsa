import {expect,it,vi} from 'vitest';import {pendingOnboardingBinding} from '../../scripts/lib/pending-onboarding.mjs';
const row={user_id:crypto.randomUUID(),intent_id:crypto.randomUUID(),terms_id:crypto.randomUUID(),email_confirmed_at:null,deleted_at:null,banned:false,finalized_at:null,intent_live:true,intents:1,memberships:0,factors:0,bindings:0,acceptances:0};
const baseline={userId:row.user_id,intentId:row.intent_id,termsId:row.terms_id};
it('binds only the single pending identity without changing account or provider state',async()=>{
 const db={query:vi.fn().mockResolvedValue({rows:[row]})};expect(await pendingOnboardingBinding(db,'synthetic-pending@example.com',baseline)).toEqual(baseline);
 expect(db.query).toHaveBeenCalledOnce();expect(db.query.mock.calls[0][0]).toMatch(/^select /);expect(db.query.mock.calls[0][1]).toEqual(['synthetic-pending@example.com']);
});
it('stops for changed identity, membership, MFA, confirmation, consent or expired intent',async()=>{
 for(const change of [{user_id:crypto.randomUUID()},{intent_id:crypto.randomUUID()},{terms_id:crypto.randomUUID()},{memberships:1},{factors:1},{bindings:1},{acceptances:1},{intents:2},{email_confirmed_at:new Date()},{deleted_at:new Date()},{banned:true},{finalized_at:new Date()},{intent_live:false}])await expect(pendingOnboardingBinding({query:vi.fn().mockResolvedValue({rows:[{...row,...change}]})},'synthetic-pending@example.com',baseline)).rejects.toThrow();
 for(const rows of [[],[row,row]])await expect(pendingOnboardingBinding({query:vi.fn().mockResolvedValue({rows})},'synthetic-pending@example.com',baseline)).rejects.toThrow();
});
