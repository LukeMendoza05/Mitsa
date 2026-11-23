// Newly proposed read-only follow-up, NOT authorized by the failed D probe.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import assert from 'node:assert/strict';
import {parse} from 'dotenv';
import pg from 'pg';
import {readKey,readPrivateKey,readMessage,decrypt,createMessage,encrypt} from 'openpgp';
import {testDatabaseConfig} from './postgres-config.mjs';
import {assertTestTarget} from './test-target.mjs';
import {assertProbeChildStopped,nextTransportBudget} from './lib/registration-transport-probe.mjs';
import {preservationDifferences,preservationPrimaryKeysSql} from './lib/registration-preservation-diff.mjs';
import {collect} from '../.tools/stage-c3-collect.mjs';
const root='.secrets/registration-completion/transport-probe',path='config/registration-preservation-drift-review.json',artifact='artifacts/registration-preservation-drift-result.json';
const json=p=>JSON.parse(readFileSync(p)),sha=v=>createHash('sha256').update(v).digest('hex');
const persist=(p,v,exclusive=false)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n',{mode:0o600,flush:true,flag:exclusive?'wx':'w'});
let db,timer,stage='local-source',counts,requests=0,readQueries=0,transactionQueries=0;
try{
 const mode=process.argv[2];assert.equal(process.argv.length,3);assert(['--check','--run'].includes(mode));const bytes=readFileSync(path),review=JSON.parse(String(bytes));
 for(const f of review.sources)assert.equal(sha(readFileSync(f.path)),f.sha256);
 assert.equal(review.project,'mjtejwafxriwntweussc');assert.equal(review.scope,'D-preservation-drift-readonly-v1');
 assert.equal(sha(readFileSync('config/registration-transport-probe-review.json')),'00290c2e2713d8d94ab1fac20cfc4791b57eb4e55595440094e0ce41eae3a841');
 if(mode==='--check'){console.log(JSON.stringify({status:'Read-only drift package matches; no execution',sources:review.sources.length,hostedRequests:0,approvalPresent:existsSync(root+'/drift-diagnostic-approval.json')}));}
 else{
  const approval=json(root+'/drift-diagnostic-approval.json'),now=Date.now();assert.equal(approval.approved,true);assert.equal(approval.scope,review.scope);assert.equal(approval.project,review.project);assert.equal(approval.reviewSha256,sha(bytes));assert(isDeepStrictEqual(approval.limits,review.limits));assert(approval.evidence?.trim());
  assert(now>=Date.parse(approval.notBefore)&&now<Date.parse(approval.notAfter)&&Date.parse(approval.notAfter)-Date.parse(approval.notBefore)<=1800000);
  for(const f of review.budgetBaselines)assert.equal(sha(readFileSync(f.path)),f.sha256,'prior consumed budget changed');
  const started=json(root+'/child-started.json'),terminal=json(root+'/child-terminal.json');
  assertProbeChildStopped(started,terminal,{reviewSha256:'00290c2e2713d8d94ab1fac20cfc4791b57eb4e55595440094e0ce41eae3a841',isRunning:pid=>{try{process.kill(pid,0);return true;}catch(e){if(e.code==='ESRCH')return false;throw Error('Prior child state unknown');}}});
  persist(root+'/drift-diagnostic-attempt.json',{claimedAt:new Date().toISOString(),reviewSha256:sha(bytes)},true);
  counts=json(root+'/budget.json');const localStart=performance.now();
  timer=setTimeout(()=>{try{persist(artifact,{status:'TIMED_OUT_NO_RETRY',stage,requests,readQueries,transactionQueries,privateValuesPrinted:false});}finally{process.exit(1);}},120000);
  const read=async(sql,args)=>{assert(performance.now()-localStart<120000);assert(requests<51);assert(/^(select\b|begin isolation level repeatable read read only$|commit$|rollback$)/i.test(sql.trim()));const kind=/^select\b/i.test(sql.trim())?'readQueries':'transactionQueries';assert(kind==='readQueries'?readQueries<49:transactionQueries<2);const next=nextTransportBudget(counts,kind);persist(root+'/budget.json',next);counts=next;requests++;if(kind==='readQueries')readQueries++;else transactionQueries++;persist(root+'/drift-diagnostic-budget.json',{requests,readQueries,transactionQueries});return db.query(sql,args);};
  const original=json('config/registration-transport-probe-review.json');assert.equal(sha(readFileSync(original.preservationManifest)),original.preservationManifestSha256);const m=json(original.preservationManifest),cipher=readFileSync(m.snapshot);assert.equal(sha(cipher),m.cipherSha256);
  const key=await readPrivateKey({armoredKey:readFileSync('.secrets/auth-mail/private.asc','utf8')});const raw=String((await decrypt({message:await readMessage({binaryMessage:cipher}),decryptionKeys:key})).data);assert.equal(sha(raw),m.payloadSha256);const before=JSON.parse(raw);
  const op=parse(readFileSync('.secrets/operator.env')),approved=json('config/test-target.json'),target=assertTestTarget({projectRef:op.TEST_PROJECT_REF,url:op.TEST_SUPABASE_URL,databaseUrl:op.TEST_DATABASE_URL},approved);assert.equal(target.projectRef,review.project);
  const previous=json(root+'/connections-budget.json').databaseConnections;assert(Number.isInteger(previous)&&previous>=0&&previous<3);persist(root+'/connections-budget.json',{databaseConnections:previous+1});
  stage='read-only-collection';db=new pg.Client({...testDatabaseConfig(op.TEST_DATABASE_URL,approved),statement_timeout:15000,idle_in_transaction_session_timeout:30000});db.on('error',()=>{});
  await db.connect();await read('begin isolation level repeatable read read only');assert.equal((await read('select marker from foundation_probe.environment_identity where singleton')).rows[0]?.marker,'fireworks-foundation-proof-01a12e38');
  const after=await collect({query:read},target);
  const pk=(await read(preservationPrimaryKeysSql)).rows;
  await read('commit');stage='encrypted-diagnostic-evidence';
  const currentRaw=JSON.stringify(after),publicKey=await readKey({armoredKey:readFileSync('.secrets/auth-mail/public.asc','utf8')}),encrypted=await encrypt({message:await createMessage({text:currentRaw}),encryptionKeys:publicKey,format:'binary'}),prefix=root+'/drift-evidence-'+randomUUID();
  writeFileSync(prefix+'.pgp',encrypted,{flag:'wx',mode:0o600,flush:true});const recovered=String((await decrypt({message:await readMessage({binaryMessage:readFileSync(prefix+'.pgp')}),decryptionKeys:key})).data);assert.equal(sha(recovered),sha(currentRaw));
  persist(prefix+'.json',{snapshot:prefix+'.pgp',cipherSha256:sha(encrypted),payloadSha256:sha(currentRaw),diagnosticOnly:true,replacementBaselineApproved:false},true);
  const summary=preservationDifferences(before,after,Object.fromEntries(pk.map(p=>[p.table,p.columns])));persist(artifact,{status:'READ_ONLY_DRIFT_DIAGNOSTIC_COMPLETED',...summary,requests,readQueries,transactionQueries,cumulativeDatabaseRequests:counts.databaseRequests,additionalConnections:1,workerLaunches:0,smtpConnections:0,authRequests:0,writes:0,encryptedDiagnosticManifest:prefix+'.json',privateValuesPrinted:false});console.log(JSON.stringify({status:'Read-only drift diagnostic completed',...summary,requests,readQueries,transactionQueries,hostedWrites:0,privateValuesPrinted:false}));
 }
}catch(error){console.error(JSON.stringify({status:'Read-only drift operation stopped',stage,category:error.name,requests,readQueries,transactionQueries,hostedWrites:0,noAutomaticRetry:true,privateDetailsSuppressed:true}));process.exitCode=1;}
finally{if(timer)clearTimeout(timer);try{await db?.end();}catch{}}
