// Durable operator request wrapper. No network, SQL client, worker or activation.
import {mkdirSync,readdirSync,readFileSync,writeFileSync,rmdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {acceptanceProtocol,assertAcceptancePrerequisites,reserveAcceptanceOperation} from './registration-acceptance-protocol.mjs';
const sha=v=>createHash('sha256').update(v).digest('hex');
export function finalAcceptanceBudget({root,stage,reviewBytes,authorization,preconditions,now=()=>Date.now()}){
 const review=JSON.parse(String(reviewBytes));assertAcceptancePrerequisites(preconditions);
 assert.equal(authorization?.approved,true);assert.equal(authorization.project,'mjtejwafxriwntweussc');assert.equal(review.project,authorization.project);assert.equal(authorization.reviewSha256,sha(reviewBytes));assert.equal(authorization.stage,stage);assert.deepEqual(authorization.limits,acceptanceProtocol[stage]);assert(authorization.evidence?.trim());
 const active=()=>{const start=Date.parse(authorization.notBefore),end=Date.parse(authorization.notAfter);assert(Number.isFinite(start)&&Number.isFinite(end)&&end>start&&end-start<=86400000&&now()>=start&&now()<end);};active();
 const binding={stage,reviewSha256:sha(reviewBytes),project:review.project};mkdirSync(root,{recursive:true,mode:0o700});const bindingPath=join(root,'binding.json');
 try{writeFileSync(bindingPath,JSON.stringify(binding),{flag:'wx',mode:0o600,flush:true});}catch{assert.deepEqual(JSON.parse(readFileSync(bindingPath)),binding);}
 const load=()=>{const names=readdirSync(root).filter(n=>/^reservation-\d{6}\.json$/.test(n)).sort();let counts=/** @type {Record<string,number>} */ ({});for(let i=0;i<names.length;i++){assert.equal(names[i],`reservation-${String(i+1).padStart(6,'0')}.json`);const row=JSON.parse(readFileSync(join(root,names[i])));assert.equal(row.reviewSha256,binding.reviewSha256);for(const kind of row.kinds)counts=reserveAcceptanceOperation(counts,stage,kind,{fixture:row.fixture});}return {counts,next:names.length+1};};
 const reserve=(kinds,{fixture}={})=>{
  active();const lock=join(root,'reservation.lock');mkdirSync(lock);try{const state=load();let next=state.counts;for(const kind of kinds)next=reserveAcceptanceOperation(next,stage,kind,{fixture});writeFileSync(join(root,`reservation-${String(state.next).padStart(6,'0')}.json`),JSON.stringify({reviewSha256:binding.reviewSha256,kinds,fixture,reservedAt:new Date(now()).toISOString()}),{flag:'wx',mode:0o600,flush:true});return next;}finally{rmdirSync(lock);}
 };
 return {
  reserve:(kind,options)=>reserve([kind],options),
  counts:()=>load().counts,
  wrapSql:(query,{reviewedReadOnlySql=new Set()}={})=>async(sql,args)=>{reserve(reviewedReadOnlySql.has(sql)?['sqlRequests']:['sqlRequests','sqlWriteCalls']);return query(sql,args);},
  wrapRequest:(kind,fixture,operation)=>async(...privateArguments)=>{reserve([kind],{fixture});return operation(...privateArguments);}
 };
}
