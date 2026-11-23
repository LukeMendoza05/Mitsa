// Local version-5 source/evidence review only. Never grants hosted authority.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {onboardingLimits,offlineOnboardingLimits} from './lib/onboarding-execution-scope.mjs';
import {evidenceKeys,loadPrivateEvidence} from './lib/preservation-private-evidence.mjs';
const hash=v=>createHash('sha256').update(v).digest('hex'),read=p=>JSON.parse(readFileSync(p)),walk=p=>readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(p+'/'+e.name):[p+'/'+e.name]),write=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n',{flag:'wx'});
try{
 assert(process.argv.length===2);
 const active='config/registration-onboarding-review.json',oldBytes=readFileSync(active),old=JSON.parse(oldBytes),previous='artifacts/onboarding-assembly-review-v4.json';
 assert(hash(oldBytes)==='c8392e7ead65d1926ee8dd1deb9537cdc844380ec890f68bf0fb74559dc1f029');assert(readFileSync(previous).equals(oldBytes),'Prior source review was changed');
 const frozenPath='config/registration-stage-c-review.json',frozen=read(frozenPath);assert(hash(readFileSync(frozenPath))==='407651a10d92e13118a5b12ccb48c9a1d75b34b3aa8acb35716ac4038e6e9424');
 for(const f of [...frozen.sources,...frozen.historicalEvidence])assert(hash(readFileSync(f.path))===f.sha256,'Frozen source/evidence differs');
 for(const f of read('artifacts/offline-budget-256-source-before/manifest.json'))assert(hash(readFileSync(f.archive))===f.sha256,'Pre-change source archive differs');
 const reportPath='artifacts/onboarding-offline-256-full-v1.json',report=read(reportPath);
 assert(report.success&&report.numFailedTests===0&&report.numPendingTests===0&&report.numPassedTests===report.numTotalTests);
 const passed=new Set(report.testResults.flatMap(t=>t.assertionResults.filter(a=>a.status==='passed').map(a=>a.fullName)));
 const earlier=['artifacts/onboarding-assembly-components-offline-v3.json','artifacts/onboarding-root-process-offline-v2.json','artifacts/onboarding-assembled-failures-offline-v1.json'];let previousPassingCases=0;
 for(const p of earlier){const r=read(p);assert(r.success);for(const t of r.testResults)for(const a of t.assertionResults){assert(a.status==='passed'&&passed.has(a.fullName),'A previous passing check is missing');previousPassingCases++;}}
 assert(previousPassingCases===213);assert(report.numPassedTests>=221);
 const postbuildPath='artifacts/onboarding-offline-256-postbuild-v1.json',postbuild=read(postbuildPath);assert(postbuild.success&&postbuild.numFailedTests===0&&postbuild.numPendingTests===0,'Post-build real-form checks are incomplete');
 const observations=walk('artifacts').filter(p=>/\/onboarding-assembled-observation-\d+\.json$/.test(p)).map(p=>({path:p,value:read(p)})).filter(o=>o.value.result.status==='PASSED_OFFLINE_CONTROLLER'&&o.value.cleanupAuthRequests===2&&o.value.reconstructedCounts&&hash(JSON.stringify(o.value.counts))===hash(JSON.stringify(o.value.reconstructedCounts))).sort((a,b)=>a.path.localeCompare(b.path));
 const observation=observations.at(-1);assert(observation);assert(observation.value.counts.authRequests<=256&&observation.value.counts.authRequests-observation.value.cleanupAuthRequests<=252);
 assert(observation.value.database.connected===false&&observation.value.database.controlsDisabled===true);
 const accepted=read('.secrets/registration-final-v1/A/accepted.json');assert(hash(readFileSync(accepted.manifest))==='05206a18393390f9849ea5c2e3b3ae8a50f2b0e25f86bcdc0056ed02ab77318e');await loadPrivateEvidence(accepted.manifest,await evidenceKeys());
 const fixtures=read(frozen.privateFixtures.path);assert(hash(readFileSync(frozen.privateFixtures.path))===frozen.privateFixtures.sha256);const privateValues=fixtures.fixtures.flatMap(f=>[f.email,f.password]).filter(v=>typeof v==='string'&&v.length>5);
 const additions=[...walk('tests/support').filter(p=>/onboarding-[^/]+\.(?:mjs|ts)$/.test(p)),...walk('tests/unit').filter(p=>/onboarding-[^/]+\.test\.ts$/.test(p)),'scripts/review-onboarding-offline-256.mjs'];
 const files=[...new Set([...old.sources.map(f=>f.path),...additions])].sort(),build=[...walk('.next/server'),...walk('.next/static'),'.next/BUILD_ID'];
 for(const p of [...files,...build,...walk('public')]){const bytes=readFileSync(p);for(const value of privateValues)assert(!bytes.includes(Buffer.from(value))&&!bytes.includes(Buffer.from(encodeURIComponent(value))),'Private fixture exposed');}
 for(const p of files.filter(p=>p.endsWith('.mjs')))assert(spawnSync(process.execPath,['--check',p],{windowsHide:true,stdio:'ignore'}).status===0,'Syntax check failed');
 const tracked=spawnSync('git',['ls-files','--','.secrets','.env.local','artifacts','docs/support'],{encoding:'utf8',windowsHide:true});assert(tracked.status===0&&tracked.stdout.trim()==='');
 for(const p of ['.secrets/registration-onboarding/DE-v1/approval.json','artifacts/onboarding-offline-256-full-v1.json','docs/support/supabase-refresh-reuse-request.txt','.aws/credentials'])assert(spawnSync('git',['check-ignore','--quiet','--',p],{windowsHide:true,stdio:'ignore'}).status===0);
 assert(!existsSync('.secrets/registration-onboarding/DE-v1/approval.json')&&!existsSync('.secrets/registration-onboarding/DE-v1/worker-attempt.json'),'Hosted scope must remain unused');
 assert(onboardingLimits.authRequests===200&&offlineOnboardingLimits.authRequests===256);
 const sourceChanges=files.map(path=>({path,sha256:hash(readFileSync(path)),previousSha256:old.sources.find(f=>f.path===path)?.sha256??null})).filter(f=>f.sha256!==f.previousSha256);
 const review={...old,version:5,hostedRunnerReady:true,readiness:'READY_FOR_HOSTED_APPROVAL_NOT_EXECUTION',hostedExecutionAuthorized:false,limits:onboardingLimits,offlineLimits:offlineOnboardingLimits,offlineCleanupAuthReserve:4,hostedBudgetAdequacy:'REQUIRES_SEPARATE_REVIEW_CURRENT_200_UNCHANGED',sources:files.map(path=>({path,sha256:hash(readFileSync(path))})),nextEntrySha256:hash(readFileSync(old.nextEntry)),nextBuildIdSha256:hash(readFileSync('.next/BUILD_ID')),runtimeBuildFiles:build.map(path=>({path,sha256:hash(readFileSync(path))})),componentTests:{path:reportPath,sha256:hash(readFileSync(reportPath)),passed:report.numPassedTests,skipped:0},postbuildTests:{path:postbuildPath,sha256:hash(readFileSync(postbuildPath)),passed:postbuild.numPassedTests,repeatedSubset:true},integratedOfflineAcceptance:{status:'PASSED',evidenceMode:'OFFLINE',path:reportPath,sha256:hash(readFileSync(reportPath)),observation:{path:observation.path,sha256:hash(readFileSync(observation.path))},actualAuthRequests:observation.value.counts.authRequests,authLimit:256,cleanupReserve:4,cleanupUsed:observation.value.cleanupAuthRequests,hostedPassed:false},localReviewHistory:[...(old.localReviewHistory??[]),{path:previous,sha256:hash(oldBytes)}],additionalOfflineAcceptance:{status:'PASSED_POSITIVE_AND_NEGATIVE',previousPassingChecksReverified:213,totalTests:report.numPassedTests,testFiles:report.testResults.length,skipped:0},approvalCreated:false,hostedRequests:0};
 const reviewPath='artifacts/onboarding-assembly-review-v5.json',output='artifacts/onboarding-offline-256-final-review.json';assert(!existsSync(reviewPath)&&!existsSync(output));
 write(reviewPath,review);
 const summary={status:'READY_FOR_HOSTED_APPROVAL_NOT_EXECUTION',reviewPath:active,reviewArchive:reviewPath,reviewSha256:hash(readFileSync(reviewPath)),tests:report.numPassedTests,testFiles:report.testResults.length,previousPassingChecksReverified:previousPassingCases,authRequests:observation.value.counts.authRequests,offlineAuthLimit:256,cleanupAuthReserve:4,cleanupAuthUsed:2,hostedAuthLimitUnchanged:200,frozenSources:frozen.sources.length,historicalEvidence:frozen.historicalEvidence.length,acceptedAEncryptedIntegrity:'PASSED_UNCHANGED',syntax:'PASSED',privacy:'PASSED',sourceFiles:files.length,buildFiles:build.length,sourceChanges,strictOptionA:'BLOCKED_SU-519045',hostedRequests:0,gitPushed:false,vercelDeployed:false};
 // Version 4 is already retained byte-for-byte. Advance only the active pointer.
 writeFileSync(active,readFileSync(reviewPath));write(output,summary);console.log(JSON.stringify({...summary,sourceChanges:summary.sourceChanges.length}));
}catch{console.error('Local version-5 review failed; private values suppressed. No hosted operation or authorization occurred.');process.exitCode=1;}
