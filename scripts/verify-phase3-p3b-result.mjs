// Read-only local acceptance verification. No hosted API/SQL/CLI operations.
import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{createHash}from'node:crypto';import{spawnSync}from'node:child_process';
const read=p=>JSON.parse(readFileSync(p,'utf8')),hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
try{
 assert.equal(process.argv.length,2,'No hosted execution mode exists');
 const r=read('config/phase3-p3b-result.json');assert.equal(r.status,'PASSED');assert.equal(r.projectRef,'geuttbanjqdapcubjrnn');assert.equal(r.masterGoalComplete,false);
 for(const f of r.verificationSources)assert.equal(hash(f.path),f.sha256,'Acceptance verifier source changed');
 assert.equal(hash('config/phase3-dedicated-preview-review.json'),r.reviewSha256);for(const f of read('config/phase3-dedicated-preview-review.json').sources)assert.equal(hash(f.path),f.sha256,'Reviewed source changed');
 assert.equal(hash(r.evidence.acceptancePath),r.evidence.acceptanceSha256);assert.equal(hash(r.evidence.ledgerPath),r.evidence.ledgerSha256);assert.equal(hash(r.evidence.indexPath),r.evidence.indexSha256);assert.equal(hash(r.evidence.reportPath),r.evidence.reportSha256);
 for(const f of read(r.evidence.indexPath).sources)assert.equal(hash(f.path),f.sha256,'Private evidence changed');
 const baseline=read('artifacts/publication-review-20261029-v3/source-baseline.json');for(const f of baseline.files)assert.equal(hash(f.path),f.sha256,'Original checkpoint changed');
 const frozen=read('config/registration-stage-c-review.json');for(const f of [...frozen.sources,...frozen.historicalEvidence])assert.equal(hash(f.path),f.sha256,'Historical source or evidence changed');
 const current=read('.secrets/phase3-p3b-20261029-v1/final-postflight-catalog-20261031.json'),expected=read('artifacts/phase3-backend-review-20261029-v1/expected-offline-security-catalog.json');for(const k of ['tables','functions','custom_roles','helper_execute'])assert.deepEqual(current[k],expected[k]);
 const repository='artifacts/phase3-preview-publication-20261029-v1';const git=args=>{const p=spawnSync('git',args,{cwd:repository,encoding:'utf8',windowsHide:true,maxBuffer:1024*1024});assert.equal(p.status,0,'Local publication repository check failed');return p.stdout.trim();};
 assert.equal(git(['rev-parse','HEAD']),r.publication.commit);assert.equal(git(['rev-parse','HEAD^{tree}']),'a6a84434901dd7d0cdc84e74d866ab8659d404e4');assert.equal(git(['status','--porcelain']),'');
 assert.equal(git(['ls-tree','-r','--name-only','HEAD']).split('\n').length,172);assert.deepEqual(git(['rev-list','--reverse','HEAD']).split('\n'),['149ffb9cfc8c1bda908550419fdceb9d689892fe','4b7fdd29ac3c232ffae96dba6bef74ba1b046f66',r.publication.commit]);
 // A sealed attempt must reject further reservations without changing evidence.
 const ledgerBefore=hash(r.evidence.ledgerPath),guard=spawnSync(process.execPath,['artifacts/phase3-preview-review-20261029-v3/p3b-execution-ledger.mjs','reserve','select','sealed-scope-negative-check',r.projectRef],{encoding:'utf8',windowsHide:true});assert.equal(guard.status,1);assert.equal(hash(r.evidence.ledgerPath),ledgerBefore);
 console.log(JSON.stringify({status:'PASSED',milestone:'P3-B',projectRef:r.projectRef,tables:41,functions:124,restrictedRoles:4,privateEvidenceIntegrity:'PASSED',originalFilesPreserved:baseline.files.length,historicalSourcesPreserved:frozen.sources.length,historicalEvidencePreserved:frozen.historicalEvidence.length,consumed:r.consumed,completedScopeSealed:true,publicationPrepared:true,pushed:false,vercelCreated:false,deployed:false,registrationEnabled:false,emailDeliveryEnabled:false,strictOptionA:r.strictOptionA,resultSha256:hash('config/phase3-p3b-result.json'),hostedRequestsDuringThisVerifier:0}));
}catch{console.error(JSON.stringify({status:'FAILED_LOCAL_RESULT_VERIFICATION',hostedRequests:0,repairsAttempted:false}));process.exitCode=1;}
