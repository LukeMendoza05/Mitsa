// LOCAL ONLY. Does not record approval, launch a worker, connect or decrypt SMTP.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {evidenceKeys,loadPrivateEvidence,readJson,sha256} from './lib/preservation-private-evidence.mjs';
import {compareCurrentPreservation} from './lib/current-preservation.mjs';
import {assertCurrentSecurity} from './lib/current-preservation-security.mjs';
import {finalLimits} from './lib/registration-final-controls.mjs';
assert.deepEqual(process.argv.slice(2),['--prepare']);
const basePath='config/registration-final-review.json',base=readJson(basePath),baseSha=sha256(readFileSync(basePath));
assert.equal(baseSha,'7d354cffb5f50993167485b803de76d9f6be6cb1178dfa9407b08bfe39a13d55');
const hash=path=>sha256(readFileSync(path));
const replacements=new Map([
 ['scripts/registration-transport-retry.mjs','docs/history/b-transport-retry-v2/registration-transport-retry.mjs.txt'],
 ['tests/unit/registration-final-entrypoints.test.ts','docs/history/b-lifecycle-local-v2/tests_unit_registration-final-entrypoints.test.ts.txt']
]);
for(const f of base.sources)assert.equal(hash(replacements.get(f.path)??f.path),f.sha256);
for(const f of base.historicalEvidence)assert.equal(hash(f.path),f.sha256);
const previousLocalMapping=new Map([
 ['scripts/lib/registration-transport-lifecycle.mjs','docs/history/b-lifecycle-local-v2/scripts_lib_registration-transport-lifecycle.mjs.txt'],
 ['tests/unit/registration-transport-lifecycle.test.ts','docs/history/b-lifecycle-local-v2/tests_unit_registration-transport-lifecycle.test.ts.txt']
]);
for(const f of readJson('artifacts/registration-transport-lifecycle-candidate.json').files)assert.equal(hash(previousLocalMapping.get(f.path)??f.path),f.sha256);
const root='.secrets/registration-final-v1/B-lifecycle-v3';
for(const name of ['approval.json','attempt.json','budget.json','terminal.json'])assert(!existsSync(root+'/'+name),'Fresh lifecycle scope already used; do not regenerate');
const previousWorkers=[
 {attempt:'.secrets/registration-completion/transport-probe/child-started.json',terminal:'.secrets/registration-completion/transport-probe/child-terminal.json'},
 {attempt:'.secrets/registration-final-v1/B/attempt.json',terminal:'.secrets/registration-final-v1/B/terminal.json'}
];
for(const p of previousWorkers){const a=readJson(p.attempt),t=readJson(p.terminal);assert.equal(a.childPid??a.pid,t.pid);try{process.kill(t.pid,0);throw Error('Prior process present');}catch(e){assert.equal(e.code,'ESRCH','Prior process status unknown');}}
const a=readJson('.secrets/registration-final-v1/A/accepted.json');assert.equal(a.acceptedByHuman,true);assert.equal(a.manifestSha256,'05206a18393390f9849ea5c2e3b3ae8a50f2b0e25f86bcdc0056ed02ab77318e');assert.equal(hash(a.manifest),a.manifestSha256);
const keys=await evidenceKeys(),reference=await loadPrivateEvidence(a.manifest,keys);assert.equal(reference.reviewSha256,baseSha);
const body=readJson('artifacts/registration-transport-retry-result.json');
for(const path of [body.preManifest,body.postManifest]){const observation=await loadPrivateEvidence(path,keys);assert.equal(compareCurrentPreservation(reference.payload,observation.payload).exactMatch,true);assertCurrentSecurity(observation.payload,readJson('config/stage-c1-identity-boundary-baseline.json'),readJson('artifacts/stage-c1-identity-boundary-manifest.json'));}
const extra=['scripts/lib/registration-transport-lifecycle.mjs','scripts/prepare-transport-lifecycle-review.mjs','tests/unit/registration-transport-lifecycle.test.ts','tests/support/transport-ipc-fixture.mjs','tests/support/transport-cleanup-fixture.mjs','docs/registration-transport-lifecycle-retest-approval.md'];
const sources=[...new Set([...base.sources.map(f=>f.path),...extra])].sort().map(path=>({path,sha256:hash(path)}));
const history=[...base.historicalEvidence.map(f=>f.path),basePath,...replacements.values(),
 'docs/history/b-lifecycle-local-v2/scripts_registration-transport-retry.mjs.txt',
 'docs/history/b-lifecycle-local-v2/scripts_lib_registration-transport-lifecycle.mjs.txt',
 'docs/history/b-lifecycle-local-v2/tests_support_transport-ipc-fixture.mjs.txt',
 'docs/history/b-lifecycle-local-v2/tests_unit_registration-transport-lifecycle.test.ts.txt',
 'artifacts/registration-transport-lifecycle-candidate.json','docs/proposals/registration-transport-retry-lifecycle.mjs.txt',
 'artifacts/registration-transport-retry-result.json','artifacts/registration-transport-retry-supervision-result.json',
 '.secrets/registration-final-v1/A/accepted.json',a.manifest,readJson(a.manifest).snapshot];
for(const name of ['approval.json','attempt.json','budget.json','terminal.json','preflight.json','local-preflight.json'])history.push('.secrets/registration-final-v1/B/'+name);
for(const p of [body.preManifest,body.postManifest])history.push(p,readJson(p).snapshot);
const manifest={scope:'B-transport-lifecycle-v3',status:'READY_NOT_APPROVED_NOT_EXECUTED',project:base.project,marker:base.marker,generation:base.generation,origin:base.origin,
 baseReview:{path:basePath,sha256:baseSha},acceptedCandidateManifestSha256:a.manifestSha256,
 limits:finalLimits.B,timing:{workSeconds:210,hardStopSeconds:240,overallSeconds:300,reconcileStopSeconds:290},
 expectedRegistry:base.expectedRegistry,exactSelectSources:base.exactSelectSources,previousWorkers,
 sources,historicalEvidence:[...new Set(history)].sort().map(path=>({path,sha256:hash(path)})),
 historicalSourceReplacements:[...replacements].map(([originalPath,archivePath])=>({originalPath,archivePath,sha256:hash(archivePath)})),
 strictOptionA:'BLOCKED_SU-519045',residualRiskAccepted:false,hostedRequests:0};
const manifestPath='config/registration-transport-lifecycle-review.json';writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
const result={status:manifest.status,manifest:manifestPath,manifestSha256:hash(manifestPath),sources:sources.length,historicalFiles:manifest.historicalEvidence.length,
 changedFiles:sources.filter(f=>!base.sources.some(b=>b.path===f.path&&b.sha256===f.sha256)),
 acceptedReferenceIntegrityVerified:true,oldPrePostExact:true,previousWorkersAbsent:true,priorBudgetsUnchanged:true,
 approvalCreated:false,attemptCreated:false,hostedRequests:0,privateValuesPrinted:false};
writeFileSync('artifacts/registration-transport-lifecycle-package-result.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
