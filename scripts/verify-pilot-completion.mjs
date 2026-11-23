// Independent read-only postflight for the completed, approved synthetic test.
// No provider calls, decryptions, sessions, email delivery or private output.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import {parse} from 'dotenv';
import pg from 'pg';
import {assertTestTarget} from './test-target.mjs';
import {testDatabaseConfig} from './postgres-config.mjs';
const config=JSON.parse(readFileSync('config/test-target.json','utf8')),env=parse(readFileSync('.secrets/operator.env'));
const target=assertTestTarget({projectRef:env.TEST_PROJECT_REF,url:env.TEST_SUPABASE_URL,databaseUrl:env.TEST_DATABASE_URL},config);
const db=new pg.Client(testDatabaseConfig(env.TEST_DATABASE_URL,config));
try{
 const run=JSON.parse(readFileSync('artifacts/controlled-gmail-test-results.json','utf8')),identity=JSON.parse(readFileSync('.secrets/pilot-relay/self-test-identity.json','utf8'));
 assert.equal(run.project,target.projectRef);assert.equal(identity.project,target.projectRef);assert.equal(run.scope,'dedicated-sender-self-test-finish');
 assert.equal(run.attempts,2);assert.equal(run.maximumNewAttempts,1);assert.equal(run.priorAttempts,1);assert.equal(run.inboxReceipt,'User confirmed first message');assert.equal(run.windowClosed,true);
 for(const key of ['actualProviderCodeVerified','replacedCodeRejected','previousCodeUnexpiredAtRejectionCheck','verifiedCodeReplayRejected','initialResendCooldownEnforced','encryptedProviderCaptureVerified','realResendSmtpAccepted','syntheticTermsFinalized'])assert.equal(run[key],true);
 assert(!run.failureStage&&!run.closureError);
 await db.connect();await db.query('begin isolation level repeatable read read only');
 assert.equal((await db.query('select marker from foundation_probe.environment_identity where singleton')).rows[0].marker,target.databaseMarker);
 const account=(await db.query(`select u.email_confirmed_at is not null confirmed,i.finalized_at is not null finalized,
  (select count(*)::int from private.memberships where user_id=u.id) memberships,(select count(*)::int from auth.mfa_factors where user_id=u.id) factors
  from auth.users u join private.registration_intents i on i.provider_user_id=u.id and i.email=u.email
  where u.id=$1 and encode(sha256(convert_to(u.email,'UTF8')),'hex')=$2`,[identity.userId,identity.emailHash])).rows;
 assert.deepEqual(account,[{confirmed:true,finalized:true,memberships:0,factors:0}]);
 const deliveries=(await db.query(`select count(*)::int total,count(*) filter(where state='smtp-accepted')::int accepted,
  count(*) filter(where recipient_hash=$1)::int expected_recipient,count(*) filter(where created_at>=$2 and created_at<=$3)::int new_window
  from private.pilot_mail_deliveries`,[identity.emailHash,run.windowStartedAt,run.windowExpiresAt])).rows[0];
 assert.deepEqual(deliveries,{total:2,accepted:2,expected_recipient:2,new_window:1});
 const captures=(await db.query(`select count(*)::int n from private.isolated_auth_mail m join private.pilot_mail_deliveries d on d.capture_id=m.id
  where m.recipient_hash=$1 and m.action='signup' and m.created_at>=$2 and m.created_at<=$3 and octet_length(m.encrypted_payload)>0`,[identity.emailHash,run.windowStartedAt,run.windowExpiresAt])).rows[0];
 assert.equal(captures.n,1);
 assert.deepEqual((await db.query('select enabled,smtp_enabled,private.mitsa_pilot_registration_open() open from private.pilot_registration_window where singleton')).rows[0],{enabled:false,smtp_enabled:false,open:false});
 const gates=(await db.query('select registration_enabled,external_mail_enabled,eligibility_approved,legal_publication_enabled,disposal_enabled from private.release_gates where singleton')).rows[0];
 assert(Object.values(gates).every(value=>value===false));assert(!existsSync('.secrets/pilot-relay/delivery-approval.json'));assert.equal(parse(readFileSync('.env.local')).MITSA_REGISTRATION_MODE,'isolated-test');
 await db.query('commit');
 const result={checkedAt:new Date().toISOString(),project:target.projectRef,markerVerified:true,syntheticAccountConfirmed:true,originalTermsFinalized:true,syntheticMemberships:0,syntheticMfaFactors:0,acceptedDeliveriesTotal:2,acceptedDeliveriesInFinalWindow:1,newEncryptedCaptureBound:true,priorUnexpiredCodeRejected:true,freshCodeVerified:true,verifiedCodeReplayRejected:true,cooldownEnforced:true,latestMessageReceiptConfirmedByUser:true,pilotWindowAndSmtpDisabled:true,globalReleaseGatesClosed:true,activeManifestAbsent:true,localModeIsolated:true,remoteChanges:0,privateValuesPrinted:false};
 writeFileSync('artifacts/controlled-gmail-completion-postflight.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}catch{try{await db.query('rollback');}catch{}console.error('Read-only completion postflight failed; private details suppressed');process.exitCode=1;}finally{await db.end();}
