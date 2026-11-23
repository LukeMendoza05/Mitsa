// Read-only bounded diagnosis. No provider calls, code output or mail delivery.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import {parse} from 'dotenv';
import pg from 'pg';
import {assertTestTarget} from './test-target.mjs';
import {testDatabaseConfig} from './postgres-config.mjs';
const config=JSON.parse(readFileSync('config/test-target.json','utf8')),env=parse(readFileSync('.secrets/operator.env'));
const target=assertTestTarget({projectRef:env.TEST_PROJECT_REF,url:env.TEST_SUPABASE_URL,databaseUrl:env.TEST_DATABASE_URL},config);
const db=new pg.Client(testDatabaseConfig(env.TEST_DATABASE_URL,config));
try {
 const identity=JSON.parse(readFileSync('.secrets/pilot-relay/self-test-identity.json','utf8')),run=JSON.parse(readFileSync('artifacts/controlled-gmail-test-results.json','utf8'));
 assert.equal(identity.project,target.projectRef);assert.equal(run.project,target.projectRef);
 await db.connect();await db.query('begin isolation level repeatable read read only');
 assert.equal((await db.query('select marker from foundation_probe.environment_identity where singleton')).rows[0].marker,target.databaseMarker);
 const captures=(await db.query(`select count(*)::int total,count(*) filter(where m.created_at>d.created_at)::int after_first_delivery,
  max(m.created_at) latest_created_at from private.isolated_auth_mail m cross join (select min(created_at) created_at from private.pilot_mail_deliveries where recipient_hash=$1) d
  where m.recipient_hash=$1 and m.action='signup' and m.created_at>=$2`,[identity.emailHash,run.windowStartedAt])).rows[0];
 const account=(await db.query(`select u.email_confirmed_at is not null confirmed,i.finalized_at is not null finalized,
  (select count(*)::int from private.memberships where user_id=u.id) memberships,(select count(*)::int from auth.mfa_factors where user_id=u.id) factors
  from auth.users u join private.registration_intents i on i.provider_user_id=u.id where u.id=$1`,[identity.userId])).rows[0];
 assert(account);assert.equal(account.memberships,0);assert.equal(account.factors,0);
 const window=(await db.query('select enabled,smtp_enabled,private.mitsa_pilot_registration_open() open from private.pilot_registration_window where singleton')).rows[0];
 assert.deepEqual(window,{enabled:false,smtp_enabled:false,open:false});
 const gates=(await db.query('select registration_enabled,external_mail_enabled from private.release_gates where singleton')).rows[0];
 assert.deepEqual(gates,{registration_enabled:false,external_mail_enabled:false});
 const report={checkedAt:new Date().toISOString(),project:target.projectRef,markerVerified:true,capturesInApprovedWindow:captures.total,capturesAfterFirstSmtpClaim:captures.after_first_delivery,
  latestCaptureCreatedAt:captures.latest_created_at,syntheticAccountConfirmed:account.confirmed,syntheticTermsFinalized:account.finalized,syntheticMemberships:account.memberships,syntheticMfaFactors:account.factors,
  pilotClosed:true,publicRegistrationEnabled:false,globalExternalMailEnabled:false,activeManifestAbsent:!existsSync('.secrets/pilot-relay/delivery-approval.json'),localModeIsolated:parse(readFileSync('.env.local')).MITSA_REGISTRATION_MODE==='isolated-test',remoteChanges:0,privateValuesPrinted:false};
 await db.query('commit');writeFileSync('artifacts/pilot-resend-diagnostic.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch{try{await db.query('rollback');}catch{}console.error('Read-only resend diagnosis failed; private details suppressed');process.exitCode=1;}finally{await db.end();}
