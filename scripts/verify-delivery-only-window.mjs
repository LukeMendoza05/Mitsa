// Negative local HTTP probes plus read-only database checks. Never requests a
// valid resend, verifies an OTP, creates an account or connects to SMTP.
import {readFileSync,writeFileSync} from 'node:fs';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {parse} from 'dotenv';import pg from 'pg';
import {assertTestTarget} from './test-target.mjs';import {testDatabaseConfig} from './postgres-config.mjs';import {recipientHash} from './lib/development-mail.mjs';import {sealAuthFlow,signupCodeCookie} from '../src/lib/security/auth-flow.ts';
let db,stage='target';const checks=[];
try {
 const cfg=JSON.parse(readFileSync('config/test-target.json')),o=parse(readFileSync('.secrets/operator.env')),e=parse(readFileSync('.env.local'));
 const target=assertTestTarget({projectRef:o.TEST_PROJECT_REF,url:o.TEST_SUPABASE_URL,databaseUrl:o.TEST_DATABASE_URL},cfg);assert.equal(target.projectRef,'mjtejwafxriwntweussc');assert.equal(e.SUPABASE_URL,target.url);assert.equal(e.APP_ORIGIN,'http://127.0.0.1:3000');
 const runtime=JSON.parse(readFileSync('.secrets/isolated-registration/runtime.json')),baseline=JSON.parse(readFileSync('.secrets/isolated-registration/pending-onboarding.json')),email=JSON.parse(readFileSync('.secrets/onboarding-recipient.json')).email.trim().toLowerCase();
 assert.equal(runtime.phase,'controlled');assert.equal(runtime.registrationAllowed,false);assert.equal(runtime.recipientHash,recipientHash(email));assert.equal(baseline.project,target.projectRef);
 db=new pg.Client(testDatabaseConfig(o.TEST_DATABASE_URL,cfg));await db.connect();assert.equal((await db.query('select marker from foundation_probe.environment_identity where singleton')).rows[0].marker,target.databaseMarker);
 const snapshot=async()=> (await db.query(`select
  (select count(*)::int from auth.users where email=$1) users,
  (select count(*)::int from private.registration_intents where email=$1) intents,
  (select count(*)::int from private.isolated_auth_mail where recipient_hash=$2) captures,
  (select count(*)::int from private.pilot_mail_deliveries where recipient_hash=$2) claims`,[email,runtime.recipientHash])).rows[0];
 const before=await snapshot();assert.equal(before.users,1);assert.equal(before.intents,1);assert.equal(before.claims,0);
 assert.equal((await db.query('select private.mitsa_pilot_registration_open() open')).rows[0].open,true);
 const terms=(await db.query('select test_terms_id from private.release_gates where singleton')).rows[0].test_terms_id;
 const post=(path,form,cookie,origin=e.APP_ORIGIN)=>fetch(e.APP_ORIGIN+path,{method:'POST',headers:{origin,...(cookie?{cookie:`${signupCodeCookie}=${cookie}`}:{})},body:new URLSearchParams(form),redirect:'manual',signal:AbortSignal.timeout(15000)});
 stage='new-signup-disabled';const password='Synthetic!'+randomUUID();
 const signup=await fetch(e.APP_ORIGIN+'/auth/register',{method:'POST',headers:{origin:e.APP_ORIGIN,'x-mitsa-form':'1'},body:new URLSearchParams({fullName:'Synthetic delivery-only refusal',email,password,confirmPassword:password,termsVersion:terms,accepted:'on',captchaToken:'intentionally-invalid-proof'}),redirect:'manual',signal:AbortSignal.timeout(15000)});
 assert.equal(signup.status,503);assert.equal((await signup.json()).error?.code,'registration_closed');checks.push({name:stage,passed:true});
 stage='forged-continuation';assert((await post('/auth/email/code',{action:'resend'},'forged')).headers.get('location')?.endsWith('error=expired'));checks.push({name:stage,passed:true});
 const now=Date.now(),flow={purpose:'signup-code',email,intentId:baseline.intentId,issuedAt:now-120000,resendAt:now+60000,expiresAt:now+3600000};
 const cookie=sealAuthFlow(flow,e.AUTH_FLOW_KEY);
 stage='CSRF';assert.equal((await post('/auth/email/code',{action:'resend'},cookie,'https://attacker.invalid')).status,403);checks.push({name:stage,passed:true});
 stage='resend-cooldown';assert((await post('/auth/email/code',{action:'resend'},cookie)).headers.get('location')?.endsWith('error=cooldown'));checks.push({name:stage,passed:true});
 stage='other-recipient';const other=sealAuthFlow({...flow,email:'foundation-other-continuation@example.invalid'},e.AUTH_FLOW_KEY);assert((await post('/auth/email/code',{action:'resend'},other)).headers.get('location')?.endsWith('error=delivery_paused'));checks.push({name:stage,passed:true});
 stage='expired-continuation';const expired=sealAuthFlow({...flow,issuedAt:now-240000,resendAt:now-120000,expiresAt:now-1},e.AUTH_FLOW_KEY);assert((await post('/auth/email/code',{action:'resend'},expired)).headers.get('location')?.endsWith('error=expired'));checks.push({name:stage,passed:true});
 stage='verification-page-ready';const page=await fetch(e.APP_ORIGIN+'/verify-email',{headers:{cookie:`${signupCodeCookie}=${cookie}`},signal:AbortSignal.timeout(15000)}),body=await page.text();assert.equal(page.status,200);assert(body.includes('Verification code'));assert(!body.includes(email));assert(!body.includes('controlled email-delivery window is closed'));checks.push({name:stage,passed:true});
 assert.deepEqual(await snapshot(),before);
 const status=JSON.parse(readFileSync('.secrets/isolated-registration/status.json'));assert.equal(status.runId,runtime.runId);assert(status.deliveryReady&&status.capacityAvailable&&Date.now()-Date.parse(status.checkedAt)<15000);
 const report={checkedAt:new Date().toISOString(),project:target.projectRef,deliveryOnly:true,deadline:runtime.expiresAt,checks,passed:true,existingPendingAccountPreserved:true,newSignupDisabled:true,accountsCreated:0,intentsCreated:0,emailRequests:0,smtpClaimsAdded:0,otpVerificationAttempts:0,privateValuesPrinted:false};writeFileSync('artifacts/delivery-only-window-checks.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch{console.error(JSON.stringify({stage,status:'Delivery-only checks failed; stop the window before continuing',privateValuesPrinted:false}));process.exitCode=1;}finally{await db?.end();}
