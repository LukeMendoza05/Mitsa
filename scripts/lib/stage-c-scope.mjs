// Inactive, durable Stage C operator authorization. Importing has no effects.
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync,readdirSync,rmdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {finalAcceptanceBudget} from './registration-final-budget.mjs';
const sha=v=>createHash('sha256').update(v).digest('hex');
export const stageCLimits=Object.freeze({
 A:{databaseConnections:1,sqlRequests:120,sqlWriteCalls:0,transactionStatements:6,authRequests:0,edgeRequests:0,emails:1,smtpVerifications:1,workerLaunches:1,workerMinutes:10,runtimeSeconds:600,managementRequests:0,captchaRequests:0,operatorRequests:30,newAccounts:0},
 B:{databaseConnections:1,sqlRequests:9000,sqlWriteCalls:8000,transactionStatements:12,authRequests:30,edgeRequests:48,emails:6,smtpVerifications:3,workerLaunches:1,workerMinutes:90,runtimeSeconds:5400,managementRequests:4,captchaRequests:6,operatorRequests:180,newAccounts:2}
});
export function stageCScope({root,selection,reviewBytes,fixtureBytes,authorization,securityEvidence,now=()=>Date.now()}) {
 const review=JSON.parse(String(reviewBytes)),fixtures=JSON.parse(String(fixtureBytes));const limits=stageCLimits[selection];assert(limits);
 assert.equal(authorization?.approved,true);assert.equal(authorization.scope,`C-${selection}-v1`);assert.equal(authorization.selection,selection);
 assert.equal(review.project,'mjtejwafxriwntweussc');assert.equal(authorization.project,review.project);assert.equal(authorization.marker,'fireworks-foundation-proof-01a12e38');
 assert.equal(authorization.reviewSha256,sha(reviewBytes));assert.equal(sha(fixtureBytes),review.privateFixtures.sha256);assert.equal(fixtures.project,review.project);assert.deepEqual(authorization.limits,limits);assert(authorization.evidence?.trim());
 if(selection==='B'){
  assert.equal(authorization.securityPolicy,'strict-proven','Strict Option A is not waived');
  assert.equal(securityEvidence?.status,'PASSED');assert.equal(securityEvidence?.policy,'Strict Option A');assert.equal(securityEvidence?.project,review.project);assert.equal(securityEvidence?.humanReviewed,true);
  for(const name of ['terminalReuseDenial','noFurtherRenewal','immediateProtectedResourceDenial','directApiBoundary','legitimateMfaRecovery'])assert.equal(securityEvidence.checks?.[name],true);
  assert.equal(authorization.securityEvidenceSha256,sha(JSON.stringify(securityEvidence)));
 }
 const active=()=>{const start=Date.parse(authorization.notBefore),end=Date.parse(authorization.notAfter);assert(Number.isFinite(start)&&Number.isFinite(end)&&end>start&&end-start<=86400000&&now()>=start&&now()<end,'Scope expired');};active();
 const labels=selection==='A'?['c3b-a']:['c3b-a','c3b-b'];const selected=labels.map(label=>{const matches=fixtures.fixtures.filter(f=>f.label===label);assert.equal(matches.length,1);assert(/^[^\s@]+@gmail\.com$/.test(matches[0].email));return Object.freeze({...matches[0]});});
 assert.equal(new Set(selected.map(f=>f.email)).size,selected.length);
 const finalBudget=selection==='B'?finalAcceptanceBudget({root:join(root,'acceptance'),stage:'C',reviewBytes,authorization:{...authorization,stage:'C',limits:review.acceptanceLimits},preconditions:{security:'strict-proven',transport:true,baseline:true,notices:true,actualRunnerReviewed:true},now}):null;
 mkdirSync(root,{recursive:true,mode:0o700});const binding={reviewSha256:sha(reviewBytes),approvalHash:sha(JSON.stringify(authorization)),fixtureHash:sha(fixtureBytes),selection};
 const persist=(p,v)=>writeFileSync(p,JSON.stringify(v),{flag:'wx',mode:0o600,flush:true});
 try{persist(join(root,'binding.json'),binding);}catch{assert.deepEqual(JSON.parse(readFileSync(join(root,'binding.json'))),binding);}
 const load=()=>{const names=readdirSync(root).filter(n=>/^op-\d{6}\.json$/.test(n)).sort(),counts=/** @type {Record<string,number>} */({});for(let i=0;i<names.length;i++){assert.equal(names[i],`op-${String(i+1).padStart(6,'0')}.json`);const row=JSON.parse(readFileSync(join(root,names[i])));assert.equal(row.binding,binding.approvalHash);for(const k of row.kinds){counts[k]=(counts[k]??0)+1;assert(counts[k]<=limits[k]);}}return {counts,next:names.length+1};};
 const reserve=(kinds,{label,job}={})=>{
  active();assert(kinds.every(k=>Object.hasOwn(limits,k)&&!['runtimeSeconds','workerMinutes'].includes(k)));
  if(label!==undefined)assert(labels.includes(label),'Recipient outside scope');
  const lock=join(root,'lock');mkdirSync(lock);try{
   const {counts,next}=load();for(const k of kinds)assert((counts[k]??0)<limits[k],'Budget exhausted');
   if(job){assert.equal(kinds.includes('emails'),true);const p=join(root,'job-'+sha(job));persist(p,{reserved:true});}
   // Only operation categories and fixture labels are journaled, never args.
   persist(join(root,`op-${String(next).padStart(6,'0')}.json`),{binding:binding.approvalHash,kinds,label,at:now()});
   const map={edgeRequests:'signedCommands'};
   for(const k of kinds)if(['sqlRequests','sqlWriteCalls','authRequests','emails','smtpVerifications','workerLaunches','newAccounts'].includes(k)||map[k])finalBudget?.reserve(map[k]??k,{fixture:label??labels[0]});
  }finally{rmdirSync(lock);}
 };
 return {active,counts:()=>{const used=load().counts;return Object.fromEntries(Object.keys(limits).filter(k=>!['runtimeSeconds','workerMinutes'].includes(k)).map(k=>[k,used[k]??0]));},reserve,fixtures:Object.freeze(selected),limits,
  assertRecipient(label,email){assert.equal(selected.find(f=>f.label===label)?.email,email,'Recipient mismatch');},
  sql:(query,{readOnlySql=new Set()}={})=>async(sql,args)=>{const txn=['begin isolation level repeatable read read only','commit','rollback','begin'].includes(sql);reserve(txn?['sqlRequests','transactionStatements']:readOnlySql.has(sql)?['sqlRequests']:['sqlRequests','sqlWriteCalls']);return query(sql,args);}
 };
}
