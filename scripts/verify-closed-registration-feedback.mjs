import {readFileSync,writeFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';
import {parse} from 'dotenv';import pg from 'pg';import assert from 'node:assert/strict';
import {assertTestTarget} from './test-target.mjs';import {testDatabaseConfig} from './postgres-config.mjs';
let db;
try {
 const cfg=JSON.parse(readFileSync('config/test-target.json')),local=parse(readFileSync('.env.local')),op=parse(readFileSync('.secrets/operator.env'));
 const target=assertTestTarget({projectRef:op.TEST_PROJECT_REF,url:op.TEST_SUPABASE_URL,databaseUrl:op.TEST_DATABASE_URL},cfg);assert.equal(target.projectRef,'mjtejwafxriwntweussc');assert.equal(local.SUPABASE_URL,target.url);assert.equal(local.APP_ORIGIN,'http://127.0.0.1:3000');
 db=new pg.Client(testDatabaseConfig(op.TEST_DATABASE_URL,cfg));await db.connect();await db.query('begin read only');assert.equal((await db.query('select marker from foundation_probe.environment_identity where singleton')).rows[0].marker,target.databaseMarker);
 assert((await db.query('select not(enabled or smtp_enabled or private.mitsa_pilot_registration_open()) closed from private.pilot_registration_window')).rows[0].closed);
 const email=`foundation-closed-feedback-${randomUUID()}@example.invalid`,password=`Synthetic!${randomUUID()}`;
 const snapshot=async()=> (await db.query("select (select count(*)::int from auth.users where email=$1) accounts,(select count(*)::int from private.registration_intents where email=$1) intents,(select count(*)::int from private.isolated_auth_mail where recipient_hash=encode(sha256(convert_to($1,'UTF8')),'hex')) captures,(select count(*)::int from private.pilot_mail_deliveries) claims",[email])).rows[0];
 const before=await snapshot();assert(before.accounts===0&&before.intents===0&&before.captures===0);
 const get=await fetch(local.APP_ORIGIN+'/signup',{signal:AbortSignal.timeout(15000)}),html=await get.text();assert.equal(get.status,200);assert(html.includes('Registration is closed'));assert(!html.includes('The current account setup could not be verified'));
 const terms=html.match(/name="termsVersion"[^>]*value="([a-f0-9-]{36})"/i)?.[1];assert(terms);
 const body={email,password,confirmPassword:password,fullName:'Synthetic closed feedback',accepted:'on',termsVersion:terms};
 const post=await fetch(local.APP_ORIGIN+'/auth/register',{method:'POST',headers:{origin:local.APP_ORIGIN,'x-mitsa-form':'1'},body:new URLSearchParams(body),redirect:'manual',signal:AbortSignal.timeout(15000)});assert.equal(post.status,503);assert.equal((await post.json()).error?.code,'registration_closed');
 const csrf=await fetch(local.APP_ORIGIN+'/auth/register',{method:'POST',headers:{origin:'https://invalid-origin.example','x-mitsa-form':'1'},body:new URLSearchParams(body),redirect:'manual',signal:AbortSignal.timeout(15000)});assert.equal(csrf.status,403);
 assert.deepEqual(await snapshot(),before);await db.query('commit');
 const report={checkedAt:new Date().toISOString(),project:target.projectRef,markerVerified:true,actualSignupClosedMessage:true,technicalMisdiagnosisAbsent:true,staleSubmissionRejectedWithClosedCode:true,statusUnchanged503:true,csrfRejected:true,accountIntentCaptureAndDeliveryCountsUnchanged:true,accountsCreated:0,emailRequests:0,databaseWrites:0,privateValuesPrinted:false};
 writeFileSync('artifacts/closed-registration-feedback.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch {try{await db?.query('rollback');}catch{}console.error('Closed-registration feedback check failed; private details suppressed. No activation attempted.');process.exitCode=1;}finally{await db?.end();}
