// Inactive operator entry. --check makes zero requests. --run requires a new
// exact private approval; it never signs in, provisions fixtures or changes Auth.
import assert from 'node:assert/strict';
import {readFileSync,existsSync,writeFileSync} from 'node:fs';
import {parse} from 'dotenv';
import {strictAuditAuthority,runStrictProviderAudit} from './lib/strict-provider-audit.mjs';
import {evidenceKeys,loadPrivateEvidence,savePrivateEvidence,sha256} from './lib/preservation-private-evidence.mjs';
import {assertTestTarget} from './test-target.mjs';
import {testDatabaseConfig} from './postgres-config.mjs';
const root='.secrets/strict-option-a/G-provider-readonly-v1',path='config/strict-option-a-phase1-review.json';
try{
 const mode=process.argv[2];assert(process.argv.length===3&&['--check','--run'].includes(mode));const reviewBytes=readFileSync(path),review=JSON.parse(reviewBytes);
 for(const f of review.sources)assert(sha256(readFileSync(f.path))===f.sha256,'Reviewed source differs');
 if(mode==='--check'){console.log(JSON.stringify({status:'SOURCE_CHECK_ONLY_NOT_AUTHORIZED',sources:review.sources.length,approvalPresent:existsSync(root+'/approval.json'),projectRequests:0}));}
 else{
  const authorization=JSON.parse(readFileSync(root+'/approval.json'));const authority=strictAuditAuthority({reviewBytes,authorization,root});
  const onboardingBytes=readFileSync('config/registration-onboarding-review.json');assert(sha256(onboardingBytes)===review.onboardingReviewSha256);const onboarding=JSON.parse(onboardingBytes);for(const f of [...onboarding.sources,...onboarding.runtimeBuildFiles,...onboarding.historicalEvidence])assert(sha256(readFileSync(f.path))===f.sha256,'Prior onboarding source/evidence changed');
  const frozenBytes=readFileSync('config/registration-stage-c-review.json');assert(sha256(frozenBytes)==='407651a10d92e13118a5b12ccb48c9a1d75b34b3aa8acb35716ac4038e6e9424');const frozen=JSON.parse(frozenBytes);for(const f of [...frozen.sources,...frozen.historicalEvidence])assert(sha256(readFileSync(f.path))===f.sha256,'Frozen C-B source/evidence changed');
  const keys=await evidenceKeys(),accepted=JSON.parse(readFileSync('.secrets/registration-final-v1/A/accepted.json'));assert(sha256(readFileSync(accepted.manifest))==='05206a18393390f9849ea5c2e3b3ae8a50f2b0e25f86bcdc0056ed02ab77318e');await loadPrivateEvidence(accepted.manifest,keys);
  const env=parse(readFileSync('.secrets/operator.env')),local=parse(readFileSync('.env.local')),target=JSON.parse(readFileSync('config/test-target.json'));assertTestTarget({projectRef:env.TEST_PROJECT_REF,url:env.TEST_SUPABASE_URL,databaseUrl:env.TEST_DATABASE_URL},target);assert(local.MITSA_REGISTRATION_SERVICE_ENABLED==='false'&&(!local.MITSA_REGISTRATION_ENGINE||local.MITSA_REGISTRATION_ENGINE==='legacy'));
  const {default:pg}=await import('pg');
  const result=await runStrictProviderAudit({authority,createClient:()=>new pg.Client({...testDatabaseConfig(env.TEST_DATABASE_URL,target),connectionTimeoutMillis:10000,query_timeout:10000,statement_timeout:10000,lock_timeout:3000,application_name:'mitsa-strict-readonly'}),
   fetchHealth:async()=>{const r=await fetch('https://mjtejwafxriwntweussc.supabase.co/auth/v1/health',{method:'GET',headers:{apikey:local.SUPABASE_PUBLISHABLE_KEY},redirect:'error',signal:AbortSignal.timeout(10000)});return {status:r.status,version:r.status===200?(await r.json()).version:null};},
   persistPrivate:async value=>{const manifest=await savePrivateEvidence(root,value,keys);writeFileSync(root+'/result-ref.json',JSON.stringify({manifest,sha256:sha256(readFileSync(manifest))}),{flag:'wx',mode:0o600,flush:true});}});
  console.log(JSON.stringify({status:result.status,counts:result.counts,strictOptionAPassed:false,privateValuesPrinted:false}));if(result.status==='FAILED')process.exitCode=1;
 }
}catch{console.error('Strict provider diagnostic stopped. No automatic retry; private values suppressed.');process.exitCode=1;}
