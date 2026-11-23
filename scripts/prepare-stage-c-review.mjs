// Offline package creation only. No approvals, connections, workers or accounts.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {readJson,sha256,evidenceKeys,loadPrivateEvidence} from './lib/preservation-private-evidence.mjs';
import {stageCLimits} from './lib/stage-c-scope.mjs';
import {acceptanceProtocol} from './lib/registration-acceptance-protocol.mjs';
import {cSql} from './lib/stage-c-sql.mjs';
assert.deepEqual(process.argv.slice(2),['--prepare']);
const basePath='config/registration-transport-lifecycle-review.json',base=readJson(basePath);assert.equal(sha256(readFileSync(basePath)),'b0a9e321cf84e136d731084fe5841cd8981f40ce1e3a49e24ac3660223b75930');
for(const f of [...base.sources,...base.historicalEvidence])assert.equal(sha256(readFileSync(f.path)),f.sha256);
const transport=readJson('artifacts/registration-transport-lifecycle-v3-postflight.json');assert.equal(transport.status,'PASSED');assert.equal(transport.naturalChildExit,true);for(const f of transport.evidenceHashes)assert.equal(sha256(readFileSync(f.path)),f.sha256);
const accepted=readJson('.secrets/registration-final-v1/A/accepted.json');assert.equal(accepted.manifestSha256,base.acceptedCandidateManifestSha256);assert.equal(sha256(readFileSync(accepted.manifest)),base.acceptedCandidateManifestSha256);await loadPrivateEvidence(accepted.manifest,await evidenceKeys());
for(const stage of ['A','B'])for(const f of ['approval.json','attempt.json','body-result.json'])assert(!existsSync(`.secrets/registration-stage-c/${stage}-v1/${f}`),'New scope already recorded; never regenerate');
const previous=readJson('config/registration-completion-review.json'),fixtureBytes=readFileSync(previous.privateFixtures.path);assert.equal(sha256(fixtureBytes),previous.privateFixtures.sha256);const fixtures=JSON.parse(fixtureBytes);assert.equal(fixtures.createdAccounts,0);
const noticeSql=readFileSync('supabase/security-proposals/persistent-registration-test-notices.sql.txt','utf8'),notices=[...noticeSql.matchAll(/\('([0-9a-f-]{36})','(terms|privacy)',\s*'((?:''|[^'])*)'\)/g)].map(m=>({id:m[1],kind:m[2],sha256:sha256(m[3].replaceAll("''","'"))}));assert.equal(notices.length,2);
const additional=['scripts/registration-stage-c.mjs','scripts/configure-stage-c-management.mjs','scripts/prepare-stage-c-review.mjs','scripts/lib/stage-c-scope.mjs','scripts/lib/stage-c-engine.mjs','scripts/lib/stage-c-runtime.mjs','scripts/lib/stage-c-panel.mjs','scripts/lib/stage-c-preservation.mjs','scripts/lib/stage-c-sql.mjs','scripts/lib/stage-c-management.mjs','tests/unit/stage-c-runner.test.ts','tests/unit/stage-c-runtime-adapter.test.ts','docs/registration-stage-c-final-approval.md'];
const paths=[...new Set([...base.sources.map(f=>f.path),...additional])].sort();const history=[...base.historicalEvidence.map(f=>f.path),basePath,'artifacts/registration-transport-lifecycle-v3-postflight.json',...transport.evidenceHashes.map(f=>f.path)];
const hashFile=path=>({path,sha256:sha256(readFileSync(path))});
const manifest={version:1,project:base.project,marker:base.marker,origin:base.origin,generation:randomUUID(),status:'LOCAL_IMPLEMENTED_NOT_HOSTED_EXECUTED',limits:stageCLimits,acceptanceLimits:acceptanceProtocol.C,acceptedCandidateManifestSha256:base.acceptedCandidateManifestSha256,expectedRegistry:base.expectedRegistry,
 privateFixtures:{path:previous.privateFixtures.path,sha256:previous.privateFixtures.sha256,labels:['c3b-a','c3b-b'],addressesPublic:false},notices,
 exactNewSql:cSql,existingControlSources:['supabase/security-proposals/persistent-registration-delivery-controls.sql.txt','supabase/security-proposals/persistent-registration-admission-controls.sql.txt','supabase/security-proposals/persistent-registration-operational-stop.sql.txt'],
 selections:{A:{scope:'C-A-v1',status:'READY_FOR_SEPARATE_APPROVAL',realOtp:false,requiresStrictA:false},B:{scope:'C-B-v1',status:'LOCAL_READY_HOSTED_BLOCKED_STRICT_A',requiresStrictA:true,requiresProtectedManagementCredential:true,requiresProviderReadinessEvidence:true}},
 sources:paths.map(hashFile),historicalEvidence:[...new Set(history)].sort().map(hashFile),strictOptionA:'BLOCKED_SU-519045',riskAccepted:false,approvalsCreated:false,hostedRequests:0};
const output='config/registration-stage-c-review.json';writeFileSync(output,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});const result={status:manifest.status,review:output,sha256:sha256(readFileSync(output)),sources:manifest.sources.length,historicalFiles:manifest.historicalEvidence.length,newFiles:additional.map(hashFile),stageBPreserved:true,acceptedEncryptedReferenceVerified:true,privateFixtureHashVerified:true,stageAApproved:false,stageBApproved:false,hostedRequests:0};
writeFileSync('artifacts/registration-stage-c-package.json',JSON.stringify({...result,stageAApproved:undefined,stageBApproved:undefined,selectionAApproved:false,selectionBApproved:false},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({...result,stageAApproved:undefined,stageBApproved:undefined,selectionAApproved:false,selectionBApproved:false}));
