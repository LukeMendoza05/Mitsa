import {it,expect} from 'vitest';
import {acceptanceProtocol,reserveAcceptanceOperation,assertAcceptancePrerequisites} from '../../scripts/lib/registration-acceptance-protocol.mjs';
it('preserves exact aggregate fixture, MFA, workspace, Auth and email ceilings',()=>{
 const stages=Object.values(acceptanceProtocol);for(const [field,total] of [['newAccounts',4],['newFactors',2],['newWorkspaces',2],['emails',14],['authRequests',102],['workerLaunches',5],['workerMinutes',300],['smtpVerifications',12]] as const)expect(stages.reduce((n,s)=>n+s[field],0)).toBe(total);
});
it('stage selection cannot authorize existing accounts or unseen recipients',()=>{
 for(const fixture of ['developer','Yuno','unapproved'])expect(()=>reserveAcceptanceOperation({},'C','authRequests',{fixture})).toThrow();expect(()=>reserveAcceptanceOperation({},'C','authRequests',{fixture:'c3b-a'})).not.toThrow();
});
it('missing proof or incomplete runner stops admission even if local tests are green',()=>{
 const p={security:'strict-proven',transport:true,baseline:true,notices:true,actualRunnerReviewed:true};expect(()=>assertAcceptancePrerequisites(p)).not.toThrow();for(const override of [{security:'strict-unresolved'},{actualRunnerReviewed:false},{transport:false},{baseline:false},{notices:false}])expect(()=>assertAcceptancePrerequisites({...p,...override})).toThrow();
});
it('email/recovery and request caps cannot expand on failure or a new stage name',()=>{
 let count={};for(let i=0;i<6;i++)count=reserveAcceptanceOperation(count,'C','emails',{fixture:'c3b-a'});expect(()=>reserveAcceptanceOperation(count,'C','emails',{fixture:'c3b-a'})).toThrow();expect(()=>reserveAcceptanceOperation({},'F','newAccounts',{fixture:'e-a'})).toThrow();expect(()=>reserveAcceptanceOperation({},'unknown','emails')).toThrow();
});
