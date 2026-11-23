// Inactive one-shot Stage A candidate capture. --check has zero hosted effects.
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import {parse} from 'dotenv';
import pg from 'pg';
import {collectCurrentPreservation} from './lib/current-preservation.mjs';
import {compareLegacyToCurrent} from './lib/legacy-preservation-bridge.mjs';
import {evidenceKeys,loadPrivateEvidence,savePrivateEvidence,readJson,sha256} from './lib/preservation-private-evidence.mjs';
import {testDatabaseConfig} from './postgres-config.mjs';
import {assertTestTarget} from './test-target.mjs';
import {assertProbeChildStopped} from './lib/registration-transport-probe.mjs';
import {assertCurrentSecurity} from './lib/current-preservation-security.mjs';
const root='.secrets/registration-final-v1/A',reviewPath='config/registration-final-review.json',artifact='artifacts/current-preservation-capture-result.json';
const persist=(p,v,exclusive=false)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n',{mode:0o600,flush:true,flag:exclusive?'wx':'w'});
let db,timer,timedOut=false,started,stage='local-preflight',counts={connections:0,requests:0,selects:0,transactions:0,writes:0};
try{
 const mode=process.argv[2];assert.equal(process.argv.length,3);assert(['--check','--capture'].includes(mode));
 const bytes=readFileSync(reviewPath),review=JSON.parse(bytes),section=review.stages.A;
 for(const f of [...review.sources,...review.historicalEvidence])assert.equal(sha256(readFileSync(f.path)),f.sha256);
 assert.equal(section.scope,'A-current-preservation-v2');assert.equal(review.project,'mjtejwafxriwntweussc');assert.equal(review.marker,'fireworks-foundation-proof-01a12e38');assert(!existsSync(root+'/attempt.json'));
 if(mode==='--capture')assert(existsSync(root+'/approval.json'),'explicit capture approval required');
 const keys=await evidenceKeys(),old=readJson('config/registration-transport-probe-review.json'),legacy=await loadPrivateEvidence(old.preservationManifest,keys),diagnostic=await loadPrivateEvidence(readJson('artifacts/registration-preservation-drift-result.json').diagnosticManifest,keys);
 assert(isDeepStrictEqual(legacy.rows,diagnostic.rows));assert(isDeepStrictEqual(legacy.security,diagnostic.security));assert(isDeepStrictEqual(legacy.identities.mfa_factors,diagnostic.identities.mfa_factors));
 const op=parse(readFileSync('.secrets/operator.env')),local=parse(readFileSync('.env.local')),approved=readJson('config/test-target.json');
 const target=assertTestTarget({projectRef:op.TEST_PROJECT_REF,url:op.TEST_SUPABASE_URL,databaseUrl:op.TEST_DATABASE_URL},approved);assert.equal(target.projectRef,review.project);assert.equal(target.databaseMarker,review.marker);assert(!local.MITSA_REGISTRATION_ENGINE||local.MITSA_REGISTRATION_ENGINE==='legacy');assert.equal(local.MITSA_REGISTRATION_SERVICE_ENABLED,'false');
 const oldRoot='.secrets/registration-completion/transport-probe';assertProbeChildStopped(readJson(oldRoot+'/child-started.json'),readJson(oldRoot+'/child-terminal.json'),{reviewSha256:sha256(readFileSync('config/registration-transport-probe-review.json')),isRunning:pid=>{try{process.kill(pid,0);return true;}catch(e){if(e.code==='ESRCH')return false;throw Error('Process state unavailable');}}});
 if(mode==='--check')console.log(JSON.stringify({status:'READY_LOCAL_ONLY',scope:section.scope,sourcesMatch:true,oldEvidenceVerified:true,approvalPresent:existsSync(root+'/approval.json'),...counts}));
 else{
  const approval=readJson(root+'/approval.json');assert.equal(approval.approved,true);assert.equal(approval.scope,section.scope);assert.equal(approval.reviewSha256,sha256(bytes));assert.deepEqual(approval.limits,section.limits);assert(Date.now()>=Date.parse(approval.notBefore)&&Date.now()<Date.parse(approval.notAfter));assert(Date.parse(approval.notAfter)-Date.parse(approval.notBefore)<=1800000);assert(approval.evidence?.trim());
  mkdirSync(root,{recursive:true});persist(root+'/attempt.json',{claimedAt:new Date().toISOString(),reviewSha256:sha256(bytes)},true);
  const comparisonKey=randomBytes(32);started=performance.now();counts.connections=1;persist(root+'/budget.json',counts,true);
  db=new pg.Client({...testDatabaseConfig(op.TEST_DATABASE_URL,approved),statement_timeout:15000,idle_in_transaction_session_timeout:30000});db.on('error',()=>{});timer=setTimeout(()=>{timedOut=true;db.connection?.stream?.destroy();},177000);
  const query=async(sql,args)=>{assert(!timedOut&&performance.now()-started<180000);assert(counts.requests<54);const select=/^(select|with)\b/i.test(sql);assert(select||['begin isolation level repeatable read read only','commit','rollback'].includes(sql));assert(select?counts.selects<52:counts.transactions<2);counts.requests++;if(select)counts.selects++;else counts.transactions++;persist(root+'/budget.json',counts);return db.query(sql,args);};
  stage='connect';await db.connect();let began=false,terminal=false,payload;
  try{await query('begin isolation level repeatable read read only');began=true;stage='capture';payload=await collectCurrentPreservation({query},{expected:review.expectedRegistry,comparisonKey});terminal=true;await query('commit');began=false;}
  catch(error){if(began&&!terminal&&!timedOut){try{terminal=true;await query('rollback');}catch{}}throw error;}
  stage='encrypted-candidate';const manifest=await savePrivateEvidence(root,{payload,comparisonKey:comparisonKey.toString('base64'),historicalAttribution:'UNRESOLVED',accepted:false,reviewSha256:sha256(bytes)},keys);
  stage='installed-security-invariants';const security=assertCurrentSecurity(payload,readJson('config/stage-c1-identity-boundary-baseline.json'),readJson('artifacts/stage-c1-identity-boundary-manifest.json'));
  stage='offline-historical-bridge';const bridge=await compareLegacyToCurrent(legacy,payload,comparisonKey);const recentBridge=await compareLegacyToCurrent(diagnostic,payload,comparisonKey);
  const result={status:'CAPTURE_PASSED_NOT_ACCEPTED',counts,encryptedCandidateManifest:manifest,security,bridge,recentBridge,accepted:false,baselineReplaced:false,historicalAttribution:'UNRESOLVED',runtimeSeconds:Number(((performance.now()-started)/1000).toFixed(3)),authRequests:0,smtpConnections:0,emails:0,workerLaunches:0,strictOptionA:'BLOCKED_SU-519045',privateValuesPrinted:false};persist(artifact,result);console.log(JSON.stringify(result));
 }
}catch(error){const report={status:'STOPPED_NO_RETRY',stage,category:error.name,counts,timedOut,accepted:false,privateValuesPrinted:false};persist(artifact,report);console.error(JSON.stringify(report));process.exitCode=1;}
finally{try{await db?.end();}catch{db?.connection?.stream?.destroy();}if(timer)clearTimeout(timer);}
