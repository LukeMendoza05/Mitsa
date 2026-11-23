import assert from 'node:assert/strict';
export const finalLimits=Object.freeze({
 A:{databaseConnections:1,sqlRequests:54,selects:52,writeCalls:0,transactionStatements:2,runtimeSeconds:180,accounts:0,emails:0,workerLaunches:0},
 B:{databaseConnections:2,sqlRequests:180,selects:164,writeCalls:4,transactionStatements:12,runtimeSeconds:300,smtpVerifications:1,accounts:0,emails:0,workerLaunches:1,workerMinutes:5,secretMetadataRequests:0}
});
export function assertFinalApproval(approval,{stage,reviewSha256,now=Date.now()}){
 assert.equal(approval?.approved,true);assert.equal(approval.stage,stage);assert.equal(approval.project,'mjtejwafxriwntweussc');assert.equal(approval.reviewSha256,reviewSha256);assert.deepEqual(approval.limits,finalLimits[stage]);
 assert(Number.isFinite(Date.parse(approval.notBefore))&&Number.isFinite(Date.parse(approval.notAfter)));assert(now>=Date.parse(approval.notBefore)&&now<Date.parse(approval.notAfter));assert(Date.parse(approval.notAfter)-Date.parse(approval.notBefore)<=1800000);assert(approval.evidence?.trim());
}
export function reserveFinalOperation(counts,kind,limits){
 const names=['sqlRequests','selects','writeCalls','transactionStatements'];for(const key of names)assert(Number.isSafeInteger(counts[key])&&counts[key]>=0&&counts[key]<=limits[key]);
 assert.equal(counts.sqlRequests,counts.selects+counts.writeCalls+counts.transactionStatements);assert(['selects','writeCalls','transactionStatements'].includes(kind));assert(counts.sqlRequests<limits.sqlRequests&&counts[kind]<limits[kind]);return {...counts,sqlRequests:counts.sqlRequests+1,[kind]:counts[kind]+1};
}
export function assertTransportPreservation(diff,{allowKnownActivityChanges=false,maxActivityRows=0}={}){
 if(diff.exactMatch)return;
 assert.equal(allowKnownActivityChanges,true,'preservation mismatch requires explicit activity-only policy');
 assert(diff.findings.length>0&&diff.findings.every(f=>f.category==='known-activity-fields-only'&&f.added===0&&f.removed===0));
 const changed=diff.findings.reduce((n,f)=>n+f.changed,0);assert(Number.isSafeInteger(maxActivityRows)&&changed<=maxActivityRows,'activity change ceiling exceeded');
}
