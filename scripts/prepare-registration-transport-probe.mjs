// Local package preparation only. Never generates an authorization or connects.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {transportProbeLimits} from './lib/registration-transport-probe.mjs';
const sha=v=>createHash('sha256').update(v).digest('hex'),json=p=>JSON.parse(readFileSync(p));
const commonPath='config/registration-completion-review.json',commonBytes=readFileSync(commonPath),common=JSON.parse(String(commonBytes));
for(const f of common.sources)assert.equal(sha(readFileSync(f.path)),f.sha256);
const checkpoint='artifacts/stage-c3ba-notices-retry-01-result.json',passed=json(checkpoint);assert(passed.passed&&passed.controlsDisabled&&passed.rowsAdded===2);
const manifest=json('.secrets/stage-c3ba-notices-retry-01/postflight.json').manifest;
const sources=['scripts/registration-transport-probe.mjs','scripts/lib/registration-transport-probe.mjs','scripts/prepare-registration-transport-probe.mjs','scripts/verify-registration-transport-package.mjs','tests/unit/registration-transport-probe.test.ts','scripts/lib/persistent-mail-worker.ts','scripts/lib/registration-mail-test-scope.mjs','scripts/lib/gmail-credentials.mjs','scripts/postgres-config.mjs','scripts/test-target.mjs','scripts/lib/c1-identity-preflight.mjs','.tools/stage-c3-collect.mjs','.tools/c3ba-catalog.mjs','config/test-target.json','config/supabase-ca.crt','config/stage-c1-identity-boundary-baseline.json','artifacts/stage-c1-identity-boundary-manifest.json','supabase/security-proposals/persistent-registration-delivery-controls.sql.txt','package.json','package-lock.json','docs/registration-transport-only-approval.md'];
const output={preparedAt:new Date().toISOString(),scope:'D-transport-only-rollback-v1',status:'PREPARED_NOT_APPROVED_NOT_EXECUTED',project:'mjtejwafxriwntweussc',marker:'fireworks-foundation-proof-01a12e38',generation:common.reviewId,limits:transportProbeLimits,commonReviewSha256:sha(commonBytes),preservationCheckpoint:checkpoint,preservationCheckpointSha256:sha(readFileSync(checkpoint)),preservationManifest:manifest,preservationManifestSha256:sha(readFileSync(manifest)),sources:sources.map(path=>({path,sha256:sha(readFileSync(path))}))};
assert(!existsSync('.secrets/registration-completion/transport-probe/approval.json'));assert(!existsSync('.secrets/registration-completion/transport-probe/attempt.json'));
writeFileSync('config/registration-transport-probe-review.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({status:output.status,sources:sources.length,commonSources:common.sources.length,approvalCreated:false,networkRequests:0,databaseWrites:0}));
