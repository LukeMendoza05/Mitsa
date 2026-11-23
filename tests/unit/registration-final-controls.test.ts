import {it,expect} from 'vitest';
import {finalLimits,reserveFinalOperation,assertFinalApproval,assertTransportPreservation} from '../../scripts/lib/registration-final-controls.mjs';
const zero=()=>({sqlRequests:0,selects:0,writeCalls:0,transactionStatements:0});
it('new scopes do not inherit or reset spent D budgets',()=>{
 let c=zero();for(let i=0;i<4;i++)c=reserveFinalOperation(c,'writeCalls',finalLimits.B);expect(c.writeCalls).toBe(4);expect(()=>reserveFinalOperation(c,'writeCalls',finalLimits.B)).toThrow();expect(()=>reserveFinalOperation(zero(),'writeCalls',finalLimits.A)).toThrow();expect(finalLimits.A.sqlRequests).toBe(54);
});
it('rejects forged, stale, wrong-stage or widened approval limits',()=>{
 const now=Date.now(),a={approved:true,stage:'B',project:'mjtejwafxriwntweussc',reviewSha256:'fixture',limits:finalLimits.B,notBefore:new Date(now-1000).toISOString(),notAfter:new Date(now+60000).toISOString(),evidence:'human'};
 expect(()=>assertFinalApproval(a,{stage:'B',reviewSha256:'fixture',now})).not.toThrow();
 for(const override of [{approved:false},{stage:'A'},{project:'other'},{reviewSha256:'changed'},{limits:{...finalLimits.B,emails:1}},{notAfter:new Date(now-1).toISOString()}])expect(()=>assertFinalApproval({...a,...override},{stage:'B',reviewSha256:'fixture',now})).toThrow();
});
it('activity classification cannot silently waive a preservation failure',()=>{
 const activity={exactMatch:false,findings:[{category:'known-activity-fields-only',added:0,removed:0,changed:1}]};expect(()=>assertTransportPreservation(activity)).toThrow();expect(()=>assertTransportPreservation(activity,{allowKnownActivityChanges:true,maxActivityRows:2})).not.toThrow();expect(()=>assertTransportPreservation(activity,{allowKnownActivityChanges:true,maxActivityRows:0})).toThrow();
 const sensitive={exactMatch:false,findings:[{category:'protected-or-unclassified-change',added:0,removed:0,changed:1}]};expect(()=>assertTransportPreservation(sensitive,{allowKnownActivityChanges:true,maxActivityRows:2})).toThrow();
});
it('malformed or exhausted ledgers cannot gain capacity',()=>{
 expect(()=>reserveFinalOperation({...zero(),sqlRequests:1},'selects',finalLimits.B)).toThrow();expect(()=>reserveFinalOperation({...zero(),selects:-1},'selects',finalLimits.B)).toThrow();let c=zero();for(let i=0;i<52;i++)c=reserveFinalOperation(c,'selects',finalLimits.A);for(let i=0;i<2;i++)c=reserveFinalOperation(c,'transactionStatements',finalLimits.A);expect(()=>reserveFinalOperation(c,'selects',finalLimits.A)).toThrow();expect(c.sqlRequests).toBe(54);
});
