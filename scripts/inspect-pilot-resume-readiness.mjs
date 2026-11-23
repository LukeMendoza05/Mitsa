// Read-only preparation. Never authenticates to SMTP or activates a window.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {parse} from 'dotenv';import pg from 'pg';
import {assertTestTarget} from './test-target.mjs';import {testDatabaseConfig} from './postgres-config.mjs';
import {readProtectedGmailCredentials} from './lib/gmail-credentials.mjs';import {readExistingPilot} from './lib/pilot-existing-identity.mjs';
import {readPriorPilotDelivery} from './lib/pilot-prior-delivery.mjs';
const finish=process.argv.includes('--finish-readiness');
const config=JSON.parse(readFileSync('config/test-target.json','utf8')),operator=parse(readFileSync('.secrets/operator.env')),
 target=assertTestTarget({projectRef:operator.TEST_PROJECT_REF,url:operator.TEST_SUPABASE_URL,databaseUrl:operator.TEST_DATABASE_URL},config),db=new pg.Client(testDatabaseConfig(operator.TEST_DATABASE_URL,config));
try{
 const local=parse(readFileSync('.env.local')),smtp=readProtectedGmailCredentials();assert.equal(local.MITSA_REGISTRATION_MODE,'isolated-test');assert.equal(local.MITSA_EMAIL_OTP_LENGTH,'6');assert(!existsSync('.secrets/pilot-relay/delivery-approval.json'));
 assert.equal(createHash('sha256').update(smtp.sender).digest('hex'),JSON.parse(readFileSync('.secrets/pilot-relay/credential-readiness.json','utf8')).senderSha256);
 assert.notEqual(smtp.sender,JSON.parse(readFileSync('.secrets/developer-registration.json','utf8')).email.trim().toLowerCase());
 await db.connect();await db.query('begin isolation level repeatable read read only');assert.equal((await db.query('select marker from foundation_probe.environment_identity where singleton')).rows[0].marker,target.databaseMarker);
 assert.deepEqual((await db.query('select enabled,smtp_enabled,private.mitsa_pilot_registration_open() open from private.pilot_registration_window where singleton')).rows[0],{enabled:false,smtp_enabled:false,open:false});
 const gates=(await db.query('select * from private.release_gates where singleton')).rows[0];assert(['registration_enabled','external_mail_enabled','eligibility_approved','legal_publication_enabled','disposal_enabled'].every(k=>gates[k]===false));
 assert.equal((await db.query('select count(*)::int n from private.pilot_mail_deliveries')).rows[0].n,finish?1:0);
 const existing=await readExistingPilot(db,smtp.sender,gates.test_terms_id);
 if(finish)await readPriorPilotDelivery(db,createHash('sha256').update(smtp.sender).digest('hex'),existing.binding.userId);
 await db.query('commit');
 const report={checkedAt:new Date().toISOString(),project:target.projectRef,markerVerified:true,protectedSmtpCredentialsReadable:true,encryptedSyntheticCredentialVerified:true,exactOriginalSyntheticIdentityMatched:true,unverifiedAccount:true,currentOriginalSignedIntent:true,currentTermsMatched:true,workspaceMemberships:0,mfaFactors:0,pilotClosed:true,globalReleaseGatesClosed:true,deliveryLedgerRows:finish?1:0,priorAcceptedDeliveryBound:finish,maximumNewAttempts:finish?1:3,smtpConnectionsAttempted:0,remoteChanges:0,privateValuesPrinted:false};
 writeFileSync('artifacts/pilot-resume-readiness.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch{try{await db.query('rollback');}catch{}console.error('Synthetic pilot resume preflight stopped; private details suppressed');process.exitCode=1;}finally{await db.end();}
