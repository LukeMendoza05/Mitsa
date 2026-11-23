// Future D/E authority, not a grant. No file, transport or process on import.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,readdirSync,readFileSync,writeFileSync,appendFileSync,existsSync,rmdirSync} from 'node:fs';
import {join,resolve,relative,isAbsolute,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {assessStrictSessionTrace} from './strict-session-acceptance.mjs';
const sha=v=>createHash('sha256').update(v).digest('hex');
// NEW, UNAPPROVED proposal. These are NOT additional allowances on old scopes.
// Counts include the server-side requests invisible to browser action logs.
export const onboardingLimits=Object.freeze({databaseConnections:1,sqlRequests:12000,sqlWriteCalls:10000,transactionStatements:12,
 authRequests:200,signedCommands:120,resourceRequests:600,captchaRequests:6,operatorRequests:240,browserRequests:2000,nextInboundRequests:2000,managementRequests:4,
 emails:6,smtpVerifications:5,newAccounts:2,newFactors:2,newWorkspaces:2,newLocations:2,
 workerLaunches:1,nextServerLaunches:1,browserLaunches:1,runtimeSeconds:5400});
// Explicitly approved LOCAL/OFFLINE profile only. HOSTED remains at 200.
export const offlineOnboardingLimits=Object.freeze({...onboardingLimits,authRequests:256});
const project='mjtejwafxriwntweussc',origin='http://127.0.0.1:3000',marker='fireworks-foundation-proof-01a12e38';
const labels=['e-a','e-b'];
/** @param {{root:string,reviewBytes:any,fixtureBytes:any,authorization:any,strictEvidence:any,strictTrace:any,now?:()=>number,evidenceMode?:'HOSTED'|'OFFLINE'}} options */
export function onboardingExecutionScope({root,reviewBytes,fixtureBytes,authorization,strictEvidence,strictTrace,now=()=>Date.now(),evidenceMode='HOSTED'}){
 const review=JSON.parse(String(reviewBytes)),fixtures=JSON.parse(String(fixtureBytes));
 assert(['HOSTED','OFFLINE'].includes(evidenceMode));const offline=evidenceMode==='OFFLINE',limits=offline?offlineOnboardingLimits:onboardingLimits;
 assert(authorization?.approved===true&&authorization.scope===(offline?'D-E-offline-v1':'D-E-journey-v1'),'Onboarding execution is not approved');
 if(offline){const path=relative(resolve(tmpdir()),resolve(root));assert(path&&!isAbsolute(path)&&path!=='..'&&!path.startsWith('..'+sep)&&path.split(sep)[0].startsWith('mitsa-'),'Offline scope requires an isolated temporary fixture directory');assert(review.evidenceMode==='OFFLINE'&&authorization.evidenceMode==='OFFLINE','Explicit offline review/authority required');}
 else assert(review.evidenceMode!=='OFFLINE'&&authorization.evidenceMode!=='OFFLINE','Offline authority cannot select hosted limits');
 assert.equal(review.project,project);assert.equal(review.marker,marker);assert.equal(review.origin,origin);
 assert.equal(authorization.project,project);assert.equal(authorization.marker,marker);assert.equal(authorization.reviewSha256,sha(reviewBytes));
 assert(Array.isArray(review.sources)&&review.sources.length>0,'Reviewed onboarding sources missing');
 for(const file of review.sources)assert.equal(sha(readFileSync(file.path)),file.sha256,'Reviewed onboarding source changed');
 assert.deepEqual(authorization.limits,limits);assert.equal(authorization.fixtureSha256,sha(fixtureBytes));assert.equal(review.fixtureSha256,sha(fixtureBytes));
 assert.equal(fixtures.project,project);assert.equal(authorization.securityPolicy,'strict-proven');
 assert(strictEvidence?.status==='PASSED'&&strictEvidence.policy==='Strict Option A'&&strictEvidence.project===project&&strictEvidence.humanReviewed===true,'Strict security is not proven');
 assert.equal(authorization.strictEvidenceSha256,sha(JSON.stringify(strictEvidence)));assert.equal(strictEvidence.traceSha256,sha(JSON.stringify(strictTrace)));
 assert.equal(assessStrictSessionTrace(strictTrace).status,'READY_FOR_HUMAN_SECURITY_REVIEW');
 for(const name of ['terminalReuseDenial','noFurtherRenewal','immediateProtectedResourceDenial','directApiBoundary','legitimateMfaRecovery','directAuthAndFactors'])assert.equal(strictEvidence.checks?.[name],true);
 const selected=labels.map(label=>{const matches=fixtures.fixtures.filter(f=>f.label===label);assert.equal(matches.length,1);assert(/^[^\s@]+@gmail\.com$/.test(matches[0].email),'Approved recipient unavailable');return Object.freeze({...matches[0]});});
 assert.equal(new Set(selected.map(f=>f.email)).size,2);assert.equal(authorization.noticesSha256,review.noticesSha256);assert(/^[a-f0-9]{64}$/.test(review.noticesSha256));
 let clock;
 const active=()=>{const start=Date.parse(authorization.notBefore),end=Date.parse(authorization.notAfter);assert(Number.isFinite(start)&&Number.isFinite(end)&&end>start&&end-start<=7200000&&now()>=start&&now()<end,'Onboarding authority expired');
  if(clock)assert(now()>=clock.startedAt&&now()-clock.startedAt<limits.runtimeSeconds*1000,'Onboarding runtime expired');};active();
 // All prerequisite validation precedes ledger creation. Never overwrite old
 // authority: binding includes the exact approval, fixtures and review bytes.
 const binding={reviewSha256:sha(reviewBytes),approvalSha256:sha(JSON.stringify(authorization)),fixtureSha256:sha(fixtureBytes)};
 mkdirSync(root,{recursive:true,mode:0o700});
 const persist=(path,value)=>writeFileSync(path,JSON.stringify(value),{flag:'wx',mode:0o600,flush:true});
 try{persist(join(root,'binding.json'),binding);}catch{assert.deepEqual(JSON.parse(readFileSync(join(root,'binding.json'))),binding,'Onboarding authority changed');}
 try{persist(join(root,'execution-clock.json'),{binding:binding.approvalSha256,startedAt:now()});}catch{}
 clock=JSON.parse(readFileSync(join(root,'execution-clock.json')));assert.equal(clock.binding,binding.approvalSha256);assert(Number.isFinite(clock.startedAt));active();
 // An append-only mirror avoids reopening thousands of old files for every
 // SSR/static-resource reservation. Individual historical records remain the
 // authority and are FULLY compared on construction and every counts() audit.
 // Either side missing after an interrupted dual write is a terminal mismatch,
 // never an automatic repair, migration, refund, or permission to dispatch.
 const journal=join(root,'journal.ndjson');
 if(!existsSync(journal)){assert(!readdirSync(root).some(n=>/^op-\d{6}\.json$/.test(n)),'Historical journal needs explicit reconciliation; never regenerate');writeFileSync(journal,'',{flag:'wx',mode:0o600,flush:true});}
 let verifiedLength=0,verifiedPrefix=sha(Buffer.alloc(0));
 const locked=fn=>{const lock=join(root,'reservation.lock'),until=performance.now()+(offline?5000:2000);for(;;){try{mkdirSync(lock);break;}catch(e){if(e.code!=='EEXIST'||performance.now()>=until)throw Error('Onboarding journal lock unavailable');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,5);}}try{active();return fn();}finally{rmdirSync(lock);}};
 const load=(full=true)=>{const files=readdirSync(root).filter(n=>/^op-\d{6}\.json$/.test(n)).sort(),raw=readFileSync(journal),counts=/** @type {Record<string,number>} */({});
  assert(raw.length>=verifiedLength&&sha(raw.subarray(0,verifiedLength))===verifiedPrefix,'Consumed journal prefix changed');assert(!raw.length||raw.at(-1)===10,'Interrupted journal append; no dispatch');
  const lines=String(raw).split('\n').filter(Boolean);assert(lines.length===files.length,'Operation/mirror mismatch; consumed evidence must be reconciled');
  for(let i=0;i<files.length;i++){assert.equal(files[i],`op-${String(i+1).padStart(6,'0')}.json`);const entry=JSON.parse(lines[i]);assert.equal(entry.name,files[i]);const row=entry.record;if(full)assert.deepEqual(row,JSON.parse(readFileSync(join(root,files[i]))),'Immutable operation differs from mirror');assert.equal(row.binding,binding.approvalSha256);
   assert(Object.hasOwn(limits,row.kind)&&row.kind!=='runtimeSeconds');counts[row.kind]=(counts[row.kind]??0)+1;assert(counts[row.kind]<=limits[row.kind]);
  }verifiedLength=raw.length;verifiedPrefix=sha(raw);return {counts,next:files.length+1};};
 locked(()=>load());
 /** @param {string} kind @param {{fixture?:string,job?:string,cleanup?:boolean,operation?:string}} [options] */
 const reserve=(kind,{fixture,job,cleanup=false,operation}={})=>{
  active();assert(typeof kind==='string'&&Object.hasOwn(limits,kind)&&kind!=='runtimeSeconds');assert.equal(typeof cleanup,'boolean');if(fixture!==undefined)assert(labels.includes(fixture),'Unknown fixture label');
  if(['emails','newAccounts','newFactors','newWorkspaces','newLocations','authRequests','signedCommands','resourceRequests','captchaRequests'].includes(kind))assert(labels.includes(fixture),'Retained identity is not an approved fixture');
  if(cleanup)assert(['sqlRequests','sqlWriteCalls','transactionStatements','managementRequests'].includes(kind)||kind==='authRequests'&&operation==='fixture-local-signout','Cleanup cannot grant account, mail or process authority');
  else assert(now()-clock.startedAt<(limits.runtimeSeconds-120)*1000,'Onboarding cleanup margin reached');
  // The browser parent and SSR child share one append-only journal. A complete
  // audit of hundreds of immutable records can exceed 250 ms on Windows.
  // HOSTED waits at most two seconds; isolated OFFLINE disk contention may
  // wait five. Neither path steals/removes another producer's owned lock.
  // Reservation still completes durably BEFORE network or SQL dispatch.
  return locked(()=>{const state=load(false),used=state.counts[kind]??0;assert(used<limits[kind],'Onboarding budget exhausted');
   if(kind==='sqlRequests'&&!cleanup)assert(used<limits.sqlRequests-130,'SQL cleanup reserve reached');
   if(offline&&kind==='authRequests'&&!cleanup)assert(used<limits.authRequests-4,'Auth cleanup reserve reached');
   if(job!==undefined){assert.equal(kind,'emails');assert(typeof job==='string'&&job.length>0);persist(join(root,'job-'+sha(job)),{reserved:true});}
   const name=`op-${String(state.next).padStart(6,'0')}.json`,record={binding:binding.approvalSha256,kind,fixture,cleanup,reservedAt:now()};persist(join(root,name),record);appendFileSync(journal,JSON.stringify({name,record})+'\n',{mode:0o600,flush:true});
  });
 };
 return {root,project,origin,evidenceMode,reviewSha256:binding.reviewSha256,executionClock:{...clock},active,reserve,counts:()=>locked(()=>load().counts),limits,
  assertRecipient(label,email){assert(selected.some(f=>f.label===label&&f.email===email),'Recipient binding rejected');return true;},
  fixture(label){return selected.find(f=>f.label===label);},
  wrapSql(query,{readOnlySql=new Set(),writeSql=new Set()}={}){return async(sql,args,{cleanup=false}={})=>{
   const transaction=['begin','begin isolation level repeatable read read only','commit','rollback'].includes(sql);
   assert(transaction||readOnlySql.has(sql)||writeSql.has(sql),'SQL is not in the reviewed onboarding query set');
   reserve('sqlRequests',{cleanup});if(transaction)reserve('transactionStatements',{cleanup});else if(writeSql.has(sql))reserve('sqlWriteCalls',{cleanup});
   return query(sql,args);
  };},
  // No automatic reset, expiry extension, retry, baseline acceptance or release.
  securityApprovalGranted:false};
}
