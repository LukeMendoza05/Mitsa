// Local source/privacy/preparation audit. No database, SMTP, CLI management or
// private credential decryption. Never records an execution authorization.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {parse} from 'dotenv';
import {transportProbeLimits} from './lib/registration-transport-probe.mjs';
const json=p=>JSON.parse(readFileSync(p)),sha=v=>createHash('sha256').update(v).digest('hex');
try{
 const path='config/registration-transport-probe-review.json',bytes=readFileSync(path),review=JSON.parse(String(bytes));
 assert.equal(review.status,'PREPARED_NOT_APPROVED_NOT_EXECUTED');assert.equal(review.scope,'D-transport-only-rollback-v1');assert.equal(review.project,'mjtejwafxriwntweussc');assert.equal(review.marker,'fireworks-foundation-proof-01a12e38');assert.deepEqual(review.limits,transportProbeLimits);
 for(const f of review.sources)assert.equal(sha(readFileSync(f.path)),f.sha256);
 const common=json('config/registration-completion-review.json');assert.equal(sha(readFileSync('config/registration-completion-review.json')),review.commonReviewSha256);for(const f of common.sources)assert.equal(sha(readFileSync(f.path)),f.sha256);
 const test=json('artifacts/registration-transport-probe-offline.json'),worker=json('artifacts/registration-transport-worker-regressions.json');assert(test.success&&test.numFailedTests===0);assert(worker.success&&worker.numFailedTests===0);
 const root='.secrets/registration-completion/transport-probe';for(const f of ['approval.json','attempt.json','budget.json','connections-budget.json','child-started.json','child-terminal.json','reconciliation-attempt.json'])assert(!existsSync(`${root}/${f}`),'unexpected live probe state');
 for(const p of [root+'/approval.json',common.privateFixtures.path,'.env.local','.secrets/operator.env']){assert.equal(spawnSync('git',['check-ignore','--quiet','--',p],{stdio:'ignore'}).status,0);assert.equal(spawnSync('git',['ls-files','--error-unmatch','--',p],{stdio:'ignore'}).status,1);}
 const local=parse(readFileSync('.env.local')),operator=parse(readFileSync('.secrets/operator.env'));
 assert(!local.MITSA_REGISTRATION_ENGINE||local.MITSA_REGISTRATION_ENGINE==='legacy');assert.equal(local.MITSA_REGISTRATION_SERVICE_ENABLED,'false');
 const secrets=new Set();for(const [name,value] of Object.entries({...local,...operator}))if(value.length>=12&&/(SECRET|PASSWORD|TOKEN|DATABASE_URL|AUTH_FLOW_KEY|SERVICE_KEY|ADMIN_KEY|SIGNING_KEY)/i.test(name)&&!/(PUBLISHABLE|ANON|SITE_KEY)/i.test(name))secrets.add(value);
 for(const f of json(common.privateFixtures.path).fixtures)secrets.add(f.email);
 for(const p of ['.secrets/developer-registration.json','.secrets/onboarding-recipient.json'])secrets.add(json(p).email);
 const scan=[path,...review.sources.map(f=>f.path),'artifacts/registration-transport-probe-offline.json','artifacts/registration-transport-worker-regressions.json'];
 for(const p of scan){const content=readFileSync(p);for(const s of secrets){assert(!content.includes(Buffer.from(s)));assert(!content.includes(Buffer.from(encodeURIComponent(s))));}assert(!content.includes(Buffer.from('-----BEGIN '+'PGP PRIVATE KEY BLOCK-----')));}
 const result={checkedAt:new Date().toISOString(),status:'LOCAL_PREPARATION_PASSED_NOT_APPROVED_NOT_EXECUTED',passed:true,reviewSha256:sha(bytes),sourcesMatched:review.sources.length,previous74SourcesMatched:common.sources.length,transportTestsPassed:test.numPassedTests,workerTestsPassed:worker.numPassedTests,privateValuesAbsentFromReviewedFiles:true,filesScanned:scan.length,privateFilesIgnoredAndUntracked:true,liveApprovalAndAttemptAbsent:true,localGatesUnchanged:true,limits:review.limits,databaseRequests:0,smtpConnections:0,workerLaunches:0,authRequests:0,emailsSent:0};
 writeFileSync('artifacts/registration-transport-package-readiness.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}catch{console.error('Transport preparation audit failed. Private details suppressed; no hosted request was made.');process.exitCode=1;}
