// Read-only, local source-publication verification. Never fetches, pushes or deploys.
import assert from 'node:assert/strict';
import {readFileSync,existsSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex'),read=p=>JSON.parse(readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const manifest=read('config/phase2-publication-review.json'),exportRoot=resolve(manifest.exportDirectory);
const git=(args,cwd=exportRoot,binary=false)=>{const r=spawnSync('git',args,{cwd,windowsHide:true,encoding:binary?undefined:'utf8',maxBuffer:8*1024*1024});assert.equal(r.status,0,'Local Git check failed');return r.stdout;};
try{
 assert.equal(process.argv.length,2,'No hosted execution mode exists');
 for(const f of manifest.sources)assert.equal(hash(readFileSync(f.path)),f.sha256,'Review source changed: '+f.path);
 const inventory=read(manifest.inventoryPath),commit=read(manifest.commitReviewPath),review=read(manifest.sourceReviewPath);
 assert.equal(hash(readFileSync(manifest.inventoryPath)),manifest.inventorySha256);
 assert.equal(commit.commit,manifest.commit);assert.equal(commit.tree,manifest.tree);
 assert.equal(String(git(['rev-parse','HEAD'])).trim(),manifest.commit);assert.equal(String(git(['rev-parse','HEAD^{tree}'])).trim(),manifest.tree);
 assert.equal(String(git(['branch','--show-current'])).trim(),'codex/publication-review');assert.equal(String(git(['remote','get-url','origin'])).trim(),manifest.remote);
 assert.deepEqual(String(git(['rev-list','--reverse','HEAD'])).trim().split('\n'),manifest.newSourceOnlyCommits);
 assert.equal(String(git(['show','-s','--format=%P',manifest.newSourceOnlyCommits[0]])).trim(),'');
 assert.equal(String(git(['status','--porcelain=v1'])).trim(),'');assert(!existsSync(resolve(exportRoot,'.git/objects/info/alternates')));
 const tracked=String(git(['ls-files','-z'])).split('\0').filter(Boolean).sort();assert.deepEqual(tracked,inventory.files.map(x=>x.path).sort());assert.equal(tracked.length,170);
 for(const f of inventory.files)assert.equal(hash(readFileSync(resolve(exportRoot,f.path))),f.sha256,'Published source changed: '+f.path);
 for(const f of commit.files)assert.equal(hash(git(['cat-file','blob',f.blobSha1],exportRoot,true)),f.blobSha256,'Git blob changed');
 git(['fsck','--full','--strict']);
 const baseline=read(manifest.originalBaselinePath);
 assert.equal(String(git(['rev-parse','HEAD'],process.cwd())).trim(),baseline.head);assert.equal(String(git(['branch','--show-current'],process.cwd())).trim(),baseline.branch);assert.equal(String(git(['remote','-v'],process.cwd())).trim(),baseline.remotes);
 for(const f of baseline.files)assert.equal(hash(readFileSync(f.path)),f.sha256,'Original checkpoint changed');
 for(const p of review.pinnedResults)assert.equal(hash(readFileSync(p.path)),p.sha256,'Historical manifest changed');
 const browser=read(manifest.browserResultPath),tests=read(manifest.testResultPath),audit=read(manifest.auditResultPath);
 assert.equal(browser.status,'PASSED');assert.equal(browser.externalBrowserRequests,0);assert.equal(browser.hostedRequests,0);assert.equal(browser.applicationProcessClosed,true);
 assert.equal(tests.numPassedTests,23);assert.equal(tests.numFailedTests,0);assert.equal(audit.metadata.vulnerabilities.total,0);assert.equal(review.traceEscapes,0);
 const result={status:'READY_FOR_PUBLICATION_APPROVAL',commit:manifest.commit,tree:manifest.tree,manifestSha256:hash(readFileSync('config/phase2-publication-review.json')),inventorySha256:manifest.inventorySha256,sourceFiles:170,newSourceOnlyCommits:2,originalFilesUnchanged:baseline.files.length,publicSafeOfflineTests:23,desktopRoutes:browser.routes.length,mobilePages:browser.mobilePages,traceManifests:review.traceManifests,traceReferences:review.traceReferences,traceEscapes:0,knownDependencyAdvisories:0,pushed:false,deployed:false,hostedAuthDatabaseSmtpRequests:0,strictOptionA:'BLOCKED_SU-519045'};
 const path='artifacts/publication-review-20261029-v3/verification-'+Date.now()+'.json';writeFileSync(path,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({...result,resultPath:path}));
}catch(e){console.error(JSON.stringify({status:'FAILED',category:e instanceof assert.AssertionError?'source-or-state-mismatch':'local-verification-error',networkRequests:0,pushed:false,privateValuesPrinted:false}));process.exitCode=1;}
