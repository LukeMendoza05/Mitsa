// Local source/privacy/evidence audit only. No hosted client or execution grant.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const hash=v=>createHash('sha256').update(v).digest('hex'),read=p=>JSON.parse(readFileSync(p));
const files=[
 'scripts/lib/onboarding-probe-sql.mjs','scripts/lib/onboarding-hosted-observers.mjs','scripts/lib/onboarding-mail-bridge.mjs',
 'scripts/lib/onboarding-browser-driver.mjs','scripts/verify-onboarding-observers-local.mjs',
 'tests/unit/onboarding-hosted-observers.test.ts','tests/unit/onboarding-probe-sql.test.ts','tests/unit/onboarding-mail-bridge.test.ts','tests/unit/onboarding-browser-driver.test.ts',
 'docs/registration-onboarding-observers-worker.md'
];
try{
 const reviewPath='config/registration-stage-c-review.json',bytes=readFileSync(reviewPath),review=JSON.parse(bytes);
 assert.equal(hash(bytes),'407651a10d92e13118a5b12ccb48c9a1d75b34b3aa8acb35716ac4038e6e9424');
 for(const item of [...review.sources,...review.historicalEvidence])assert.equal(hash(readFileSync(item.path)),item.sha256,'Historical reviewed source/evidence changed');
 assert.equal(review.acceptedCandidateManifestSha256,'05206a18393390f9849ea5c2e3b3ae8a50f2b0e25f86bcdc0056ed02ab77318e');
 const ledger=read('artifacts/registration-completion-status.json');assert.equal(ledger.strictOptionA.status,'BLOCKED');assert.equal(ledger.strictOptionA.residualRiskAccepted,false);
 assert.equal(ledger.generalRegistrationOperational,false);assert.equal(ledger.controlsEnabled,false);assert.equal(ledger.selectedSecurityArchitecture,'MANAGED_SUPABASE_SUPPORTED_SESSION_TERMINATION');
 const reportPath='artifacts/onboarding-observer-worker-runtime-offline.json',tests=read(reportPath);
 assert(tests.success&&tests.numPassedTests===tests.numTotalTests&&tests.numPendingTests===0&&tests.numFailedTests===0);
 const fixtures=[];for(const ref of [review.privateFixtures,read('config/registration-completion-review.json').privateFixtures]){
  const raw=readFileSync(ref.path);assert.equal(hash(raw),ref.sha256,'Private fixture definition changed');fixtures.push(...JSON.parse(raw).fixtures);
 }
 // Compare in memory only. Private strings never enter the report/errors.
 const privateValues=fixtures.flatMap(f=>[f.email,f.password]).filter(v=>typeof v==='string'&&v.length>0);
 const walk=p=>readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(p+'/'+e.name):[p+'/'+e.name]);
 const scanned=[...files,reportPath,...walk('.next/static'),...walk('public')];
 for(const path of scanned){const content=readFileSync(path);for(const value of privateValues)assert(!content.includes(Buffer.from(value))&&!content.includes(Buffer.from(encodeURIComponent(value))),'Private fixture appeared in public/local review output');}
 const result={checkedAt:new Date().toISOString(),status:'PASSED_OFFLINE_OBSERVERS_AND_WORKER_PORTS_CONTROLLER_PENDING',architecture:ledger.selectedSecurityArchitecture,
  offlineTests:tests.numPassedTests,testFiles:tests.testResults.length,zeroSkipped:true,report:{path:reportPath,sha256:hash(readFileSync(reportPath))},
  reviewedStageCManifestSha256:hash(bytes),reviewedStageCSourcesVerified:review.sources.length,historicalHashesVerified:review.historicalEvidence.length,
  privateFixtureDefinitionsUnchanged:true,privateValuesNotExposed:true,privacyFilesScanned:scanned.length,
  newHostedDatabaseRequests:0,newHostedAuthRequests:0,newSmtpRequests:0,newEmails:0,newAccounts:0,hostedAcceptanceCompleted:false,
  executionApprovalPresent:false,strictOptionA:'BLOCKED_SU-519045',riskAccepted:false,registrationActivated:false,deliveryActivated:false,
  actualNextRuntimeEvidence:'artifacts/onboarding-next-runtime-review.json',actualNextRuntimeRerunInCombinedReport:true,
  previousGoalTurn:'PROGRESS',files:files.map(path=>({path,sha256:hash(readFileSync(path))}))};
 writeFileSync('artifacts/onboarding-observers-worker-local-review.json',JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({status:result.status,offlineTests:result.offlineTests,reviewedStageCSourcesVerified:result.reviewedStageCSourcesVerified,historicalHashesVerified:result.historicalHashesVerified,privacyFilesScanned:result.privacyFilesScanned,hostedRequests:0}));
}catch{console.error('Local onboarding review failed; private details suppressed. No hosted work authorized or executed.');process.exitCode=1;}
