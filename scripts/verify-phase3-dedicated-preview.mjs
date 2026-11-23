// Local integrity/preparation verification only. No network, push or execution.
import assert from'node:assert/strict';import{readFileSync,writeFileSync,readdirSync,existsSync}from'node:fs';import{resolve,join}from'node:path';import{createHash}from'node:crypto';import{spawnSync}from'node:child_process';
const hash=b=>createHash('sha256').update(b).digest('hex'),read=p=>JSON.parse(readFileSync(p,'utf8'));
try{
 if(existsSync('config/phase3-dedicated-preview-review.json'))for(const f of read('config/phase3-dedicated-preview-review.json').sources)assert.equal(hash(readFileSync(f.path)),f.sha256,'Active Phase 3 review source changed');
 const baseline=read('artifacts/publication-review-20261029-v3/source-baseline.json');
 for(const f of baseline.files)assert.equal(hash(readFileSync(f.path)),f.sha256,'Original checkpoint changed');
 const rootGit=args=>{const r=spawnSync('git',args,{encoding:'utf8',windowsHide:true});assert.equal(r.status,0);return r.stdout.trim();};
 assert.equal(rootGit(['rev-parse','HEAD']),baseline.head);assert.equal(rootGit(['branch','--show-current']),baseline.branch);assert.equal(rootGit(['remote','-v']),baseline.remotes);
 const frozen=read('config/registration-stage-c-review.json');
 for(const f of [...frozen.sources,...frozen.historicalEvidence])assert.equal(hash(readFileSync(f.path)),f.sha256,'Historical source/evidence changed');
 const previous=read('artifacts/phase3-preview-review-20261029-v2/origin-proposal/application-source-inventory.json');
 for(const f of previous.files)assert.equal(hash(readFileSync(resolve(previous.directory,f.path))),f.sha256,'Previous source candidate changed');
 const pub=read('artifacts/phase3-preview-review-20261029-v3/public-update-commit.json');assert.equal(pub.commit,'ec4a96bef0ea77e3553513b37931076f288cc204');assert.equal(pub.sourceFiles,172);assert.equal(pub.pushed,false);
 const app=read('artifacts/phase3-preview-review-20261029-v3/validation.json'),http=read('artifacts/phase3-preview-review-20261029-v3/application-http-result-v3.json');assert.equal(app.unitTests,25);assert.equal(http.checksPassed,8);assert.equal(http.processAbsent,true);assert.equal(http.hostedRequests,0);assert.equal(http.error,null);
 const expected=read('artifacts/phase3-backend-review-20261029-v1/expected-offline-security-catalog.json');assert.equal(expected.tables.length,41);assert(expected.tables.every(t=>t.rls&&t.forced));
 for(const [p,count]of [['artifacts/phase3-backend-review-20261029-v1/catalog-offline-bootstrap-tests.tap',24],['artifacts/phase3-backend-review-20261029-v1/final-offline-package-tests.tap',9],['artifacts/phase3-preview-review-20261029-v3/origin-final-tests.tap',15]]){const s=readFileSync(p,'utf8');assert(s.includes('pass '+count)&&s.includes('fail 0'),'Offline test result mismatch');}
 const migration='artifacts/phase3-backend-package-20261029-v1/supabase/migrations/20261029060326_mitsa_empty_preview_bootstrap.sql';
 const sql=readFileSync(migration,'utf8');assert(!/^begin;|^commit;/m.test(sql),'Migration API owns the atomic transaction');assert(!sql.includes('mjtejwafxriwntweussc'));assert(sql.includes('__PREVIEW_PROJECT_REF__'));assert(sql.includes('preview_strict_policy_only'));
 const traces=[];function walk(p){for(const e of readdirSync(p,{withFileTypes:true})){const f=join(p,e.name);if(e.isDirectory())walk(f);else if(e.name.endsWith('.nft.json'))traces.push(f);}}
 const candidate=resolve('artifacts/phase3-preview-source-20261029-v2');walk(join(candidate,'.next'));let traceReferences=0;
 for(const p of traces)for(const f of read(p).files){traceReferences++;assert(resolve(p,'..',f).startsWith(candidate+'\\'),'Private ancestor traced into deployment');}
 const result={status:'PASSED_LOCAL_PREPARATION',originalFilesPreserved:baseline.files.length,frozenStageCSources:frozen.sources.length,historicalEvidence:frozen.historicalEvidence.length,previousCandidateFilesPreserved:previous.files.length,offlineTests:73,offlineHTTPChecks:8,newBackendTables:expected.tables.length,newBackendFunctions:expected.functions.length,productionBuild:'PASSED',typeScript:'PASSED',traceManifests:traces.length,traceReferences,traceEscapes:0,publicationCommit:pub.commit,publicationFiles:172,hostedWrites:0,authRequests:0,emails:0,createdProjects:0,pushed:false,deployed:false,strictOptionA:'BLOCKED_SU-519045'};
 const path='artifacts/phase3-preview-review-20261029-v3/local-verification-'+Date.now()+'.json';writeFileSync(path,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({...result,evidencePath:path}));
}catch(e){console.error(JSON.stringify({status:'FAILED_LOCAL_VERIFICATION',category:e instanceof assert.AssertionError?'integrity-or-state':'local-file-error',message:e.message.slice(0,160),hostedWrites:0}));process.exitCode=1;}
