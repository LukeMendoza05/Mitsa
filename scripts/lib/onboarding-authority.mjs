// Source-bound HOSTED entry configuration. No connections or subprocesses.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {parse} from 'dotenv';
import {onboardingExecutionScope,onboardingLimits} from './onboarding-execution-scope.mjs';
import {evidenceKeys,loadPrivateEvidence,savePrivateEvidence,readJson,sha256} from './preservation-private-evidence.mjs';
import {assertTestTarget} from '../test-target.mjs';
import {testDatabaseConfig} from '../postgres-config.mjs';
import {onboardingNextEnvironment} from './onboarding-next-process.mjs';
export const onboardingRoot='.secrets/registration-onboarding/DE-v1';
export const onboardingReviewPath='config/registration-onboarding-review.json';
export function checkOnboardingReview(){
 const reviewBytes=readFileSync(onboardingReviewPath),review=JSON.parse(reviewBytes);
 assert(review.status==='PREPARED_NOT_AUTHORIZED'&&review.project==='mjtejwafxriwntweussc'&&review.marker==='fireworks-foundation-proof-01a12e38'&&review.origin==='http://127.0.0.1:3000');
 assert(review.fixtureTransportVersion==='bound-provider-v1'&&review.nextEntry==='scripts/onboarding-next-child.mjs');
 for(const f of [...review.sources,...review.historicalEvidence])assert(sha256(readFileSync(f.path))===f.sha256,'Reviewed source or historical evidence changed');
 assert.deepEqual(review.limits,onboardingLimits,'Reviewed future limits changed');assert(review.runtimeBuildFiles?.length>0);for(const f of review.runtimeBuildFiles)assert(sha256(readFileSync(f.path))===f.sha256,'Reviewed compiled runtime changed');
 assert(sha256(readFileSync('.next/BUILD_ID'))===review.nextBuildIdSha256,'Production build changed');
 assert(review.privateFixtures.path==='.secrets/registration-completion/fixtures.json');
 const fixtureBytes=readFileSync(review.privateFixtures.path);assert(sha256(fixtureBytes)===review.fixtureSha256&&review.privateFixtures.sha256===review.fixtureSha256);
 assert(review.publicEvidenceKey.path==='.secrets/auth-mail/public.asc'&&sha256(readFileSync(review.publicEvidenceKey.path))===review.publicEvidenceKey.sha256);
 assert(resolve(review.privateRecoveryPasswords.path)===resolve(onboardingRoot+'/recovery-passwords.json')&&sha256(readFileSync(review.privateRecoveryPasswords.path))===review.privateRecoveryPasswords.sha256);
 assert(sha256(readFileSync(review.nextEntry))===review.nextEntrySha256);
 return {reviewBytes,review,fixtureBytes};
}
// Only an explicit private authorization plus proven Strict A can enter here.
// Every reference digest is authorized BEFORE decryption; no implicit latest file.
export async function loadOnboardingAuthority(){
 const checked=checkOnboardingReview(),root=onboardingRoot,authorization=readJson(root+'/approval.json');
 assert(checked.review.hostedRunnerReady===true&&checked.review.integratedOfflineAcceptance?.status==='PASSED','Complete integrated offline acceptance is required before any hosted attempt');
 const strictEvidence=readJson(root+'/strict-evidence.json'),strictTrace=readJson(root+'/strict-trace.json');
 const scope=onboardingExecutionScope({root,...checked,authorization,strictEvidence,strictTrace});
 const keys=await evidenceKeys(),bound=async(name)=>{const r=authorization[name];assert(r&&typeof r.path==='string'&&r.path.startsWith('.secrets/')&&/^[a-f0-9]{64}$/.test(r.sha256)&&sha256(readFileSync(r.path))===r.sha256,'Approved private reference missing or changed');return loadPrivateEvidence(r.path,keys);};
 const acceptedRecord=readJson('.secrets/registration-final-v1/A/accepted.json');assert(sha256(readFileSync(acceptedRecord.manifest))==='05206a18393390f9849ea5c2e3b3ae8a50f2b0e25f86bcdc0056ed02ab77318e');
 const accepted=await loadPrivateEvidence(acceptedRecord.manifest,keys),reference=await bound('cbReference'),cbCohort=await bound('cbCohort');
 const cbPath='artifacts/registration-stage-c-B-hosted-result.json';assert(sha256(readFileSync(cbPath))===authorization.cbResultSha256);const cbResult=readJson(cbPath);assert(cbResult.status==='PASSED_REAL_OTP_TEST'&&cbResult.naturalChildExit&&cbResult.childAbsent);
 const managementRef=readJson('.secrets/registration-stage-c/management-ref.json');assert(sha256(readFileSync(managementRef.manifest))===authorization.managementManifestSha256);const management=await loadPrivateEvidence(managementRef.manifest,keys);
 const provider=readJson(root+'/provider-config.json');assert(sha256(JSON.stringify(provider))===authorization.providerConfigSha256&&provider.project===scope.project&&provider.humanReadOnlyConfirmed===true);assert.deepEqual(provider.settings,{emailConfirmation:true,otpDigits:6,otpExpirySeconds:3600,globalCaptchaEnabled:false,beforeUserCreated:'private.mitsa_before_user_created',beforeUserCreatedEnabled:true,sendEmail:'private.mitsa_isolated_send_email',sendEmailEnabled:true,serviceEnabled:false,requireCurrentPassword:true});
 const op=parse(readFileSync('.secrets/operator.env')),env=parse(readFileSync('.env.local')),target=readJson('config/test-target.json');assertTestTarget({projectRef:op.TEST_PROJECT_REF,url:op.TEST_SUPABASE_URL,databaseUrl:op.TEST_DATABASE_URL},target);
 assert(env.MITSA_REGISTRATION_SERVICE_ENABLED==='false'&&(!env.MITSA_REGISTRATION_ENGINE||env.MITSA_REGISTRATION_ENGINE==='legacy'),'Saved application controls must remain disabled');
 const appValues={...env};for(const k of ['TEST_AUTH_ADMIN_KEY','TEST_DATABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEY','DATABASE_URL'])delete appValues[k];
 const appEnvironment=onboardingNextEnvironment(appValues,process.env),databaseConfig={...testDatabaseConfig(op.TEST_DATABASE_URL,target),query_timeout:10000,statement_timeout:10000,lock_timeout:5000,application_name:'mitsa-bounded-onboarding'};
 const recoveryPasswords=readJson(checked.review.privateRecoveryPasswords.path);for(const label of ['e-a','e-b'])assert(typeof recoveryPasswords[label]==='string'&&recoveryPasswords[label].length>=20&&recoveryPasswords[label]!==scope.fixture(label).password);
 const evidenceDirectory=root+'/evidence';mkdirSync(evidenceDirectory,{recursive:true,mode:0o700});
 const persistPrivate=value=>savePrivateEvidence(evidenceDirectory,value,keys);
 return {...checked,scope,root,authorization,keys,reference,accepted,cbCohort,cbResult,managementToken:management.token,appEnvironment,databaseConfig,recoveryPasswords,persistPrivate,notAfter:authorization.notAfter,c1Baseline:readJson('config/stage-c1-identity-boundary-baseline.json'),c1Manifest:readJson('artifacts/stage-c1-identity-boundary-manifest.json')};
}
