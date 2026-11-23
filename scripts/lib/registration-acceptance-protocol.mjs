// Inactive request-budget specification for C-F. No network/worker startup.
import assert from 'node:assert/strict';
export const acceptanceProtocol=Object.freeze({
 C:{fixtures:['c3b-a','c3b-b'],newAccounts:2,authRequests:30,signedCommands:48,resourceRequests:0,emails:6,newFactors:0,newWorkspaces:0,newLocations:0,sqlRequests:9000,sqlWriteCalls:8000,workerLaunches:1,workerMinutes:90,smtpVerifications:3},
 D:{fixtures:['e-a','e-b'],newAccounts:2,authRequests:40,signedCommands:60,resourceRequests:24,emails:4,newFactors:2,newWorkspaces:2,newLocations:2,sqlRequests:6000,sqlWriteCalls:5400,workerLaunches:1,workerMinutes:60,smtpVerifications:3},
 E:{fixtures:['c3b-a','e-a','e-b'],newAccounts:0,authRequests:20,signedCommands:20,resourceRequests:24,emails:2,newFactors:0,newWorkspaces:0,newLocations:0,sqlRequests:3000,sqlWriteCalls:2700,workerLaunches:0,workerMinutes:30,smtpVerifications:2},
 F:{fixtures:['e-a','e-b','c3b-b'],newAccounts:0,authRequests:12,signedCommands:48,resourceRequests:24,emails:2,newFactors:0,newWorkspaces:0,newLocations:0,sqlRequests:12000,sqlWriteCalls:10800,workerLaunches:3,workerMinutes:120,smtpVerifications:4}
});
export function assertAcceptancePrerequisites({security,transport,baseline,notices,actualRunnerReviewed}){
 assert.equal(baseline,true);assert.equal(transport,true);assert.equal(notices,true);assert.equal(actualRunnerReviewed,true);
 assert(security==='strict-proven'||security==='separately-approved-development-exception','no silent strict-policy bypass');
}
export function reserveAcceptanceOperation(counts,stage,kind,{fixture}={}){
 const limits=acceptanceProtocol[stage];assert(limits);assert(Object.hasOwn(limits,kind)&&kind!=='fixtures');assert(Number.isSafeInteger(counts[kind]??0)&&(counts[kind]??0)>=0);
 if(['authRequests','signedCommands','resourceRequests','emails','newAccounts','newFactors','newWorkspaces','newLocations'].includes(kind))assert(limits.fixtures.includes(fixture),'retained/unapproved identity is not a fixture');
 assert((counts[kind]??0)<limits[kind]);return {...counts,[kind]:(counts[kind]??0)+1};
}
