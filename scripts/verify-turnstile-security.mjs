// Nonsecret configuration/output audit and closed-gate HTTP rejection checks.
// No real challenge is solved and no signup, email or provider setting changes.
import {readFileSync,readdirSync,statSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {parse} from 'dotenv';
import {signupChallengeConfig} from '../src/lib/auth/signup-challenge.ts';
const env=parse(readFileSync('.env.local')),config=signupChallengeConfig(env),origin='http://127.0.0.1:3000',target=JSON.parse(readFileSync('config/test-target.json','utf8'));
const result={checkedAt:new Date().toISOString(),project:target.projectRef,checks:[],liveSuccessVerified:false,liveReplayVerified:false,liveExpiryVerified:false,publicRegistrationEnabled:false,smtpAttempts:0,accountActions:0,privateValuesPrinted:false};
let stage='private-configuration';
try{
 assert(config);assert.equal(env.MITSA_REGISTRATION_MODE,'isolated-test');assert.equal(env.MITSA_AUTH_MAIL_MODE,'isolated-capture');assert.equal(env.APP_ORIGIN,origin);assert.equal(env.SUPABASE_URL,`https://${target.projectRef}.supabase.co`);
 const gmail=JSON.parse(readFileSync('artifacts/controlled-gmail-test-results.json','utf8'));assert.equal(gmail.actualProviderCodeVerified,true);assert.equal(gmail.windowClosed,true);assert.equal(gmail.attempts,2);assert(!existsSync('.secrets/pilot-relay/delivery-approval.json'));
 execFileSync('git',['check-ignore','--quiet','.env.local'],{stdio:'ignore',windowsHide:true});assert.equal(execFileSync('git',['ls-files','.env.local'],{encoding:'utf8',windowsHide:true}).trim(),'');
 assert(!Object.entries(env).some(([name,value])=>name.startsWith('NEXT_PUBLIC_')&&value===config.secret));
 const ignore=readFileSync('.vercelignore','utf8').split(/\r?\n/);assert(['.env*','.secrets/','.next/','artifacts/','docs/','scripts/','tests/'].every(value=>ignore.includes(value)));
 const files=root=>readdirSync(root).flatMap(name=>{const path=`${root}/${name}`;return statSync(path).isDirectory()?files(path):[path];});
 stage='public-build-output';const examined=['.next/static','public'].flatMap(files);
 assert(!examined.some(path=>readFileSync(path).includes(Buffer.from(config.secret))));
 const guide=await fetch(`${origin}/testing/registration`,{signal:AbortSignal.timeout(15000)}),html=await guide.text();assert.equal(guide.status,200);assert(html.includes(config.siteKey));assert(!html.includes(config.secret));assert(html.includes('Start expiry test'));
 result.serverConfigurationReadable=true;result.gitIgnoredAndUntracked=true;result.privateDeploymentExclusionsPresent=true;result.publicFilesScanned=examined.length;result.secretAbsentFromPublicOutput=true;result.siteKeyIntentionallyPublic=true;
 const post=async(body,expected,name,headers={})=>{
  stage=name;const response=await fetch(`${origin}/testing/registration/challenge`,{method:'POST',headers:{origin,...headers},body,signal:AbortSignal.timeout(25000)}),json=await response.json();
  const refused=json.verified===false||(name==='cross-origin'&&json.error==='Request origin rejected');
  const passed=response.status===expected&&refused&&response.headers.get('cache-control')?.includes('no-store')===true;
  result.checks.push({name,status:response.status,expected,refused,passed});assert(passed);
 };
 await post(new URLSearchParams(),400,'missing-token');
 await post(new URLSearchParams({captchaToken:''}),403,'empty-token');
 await post(new URLSearchParams({captchaToken:'mitsa-synthetic-invalid-proof'}),403,'invalid-token-real-provider');
 await post(new URLSearchParams({captchaToken:'x'.repeat(2049)}),403,'oversized-token');
 await post(new URLSearchParams([['captchaToken','one'],['captchaToken','two']]),400,'duplicate-token-fields');
 await post(new URLSearchParams({captchaToken:'synthetic-proof',email:'synthetic-account-input'}),400,'unexpected-account-input');
 await post(new URLSearchParams({captchaToken:'synthetic-proof'}),403,'cross-origin',{origin:'https://attacker.invalid'});
 await post('{}',400,'malformed-form',{'content-type':'application/json'});
 await post('x'.repeat(8193),413,'oversized-body',{'content-type':'application/x-www-form-urlencoded'});
 await post(new URLSearchParams({captchaToken:'synthetic-proof',check:'unsupported'}),400,'invalid-test-mode');
 await post(new URLSearchParams({captchaToken:'mitsa-synthetic-invalid-proof',check:'expiry'}),403,'invalid-proof-is-not-expiry-evidence');
 result.passed=true;
}catch{result.passed=false;result.failureStage=stage;process.exitCode=1;}
writeFileSync('artifacts/turnstile-security-results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
