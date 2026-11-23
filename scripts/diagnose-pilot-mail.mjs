// Read-only, exact approved synthetic recipient. Never opens gates or claims/sends.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {parse} from 'dotenv';import pg from 'pg';
import {readPrivateKey,readMessage,decrypt} from 'openpgp';
import {z} from 'zod';
import {assertTestTarget} from './test-target.mjs';import {testDatabaseConfig} from './postgres-config.mjs';
import {pilotTestApproval} from './lib/pilot-test-approval.ts';
const cfg=JSON.parse(readFileSync('config/test-target.json','utf8')),operator=parse(readFileSync('.secrets/operator.env')),
 target=assertTestTarget({projectRef:operator.TEST_PROJECT_REF,url:operator.TEST_SUPABASE_URL,databaseUrl:operator.TEST_DATABASE_URL},cfg),db=new pg.Client(testDatabaseConfig(operator.TEST_DATABASE_URL,cfg));
try{
 const identity=JSON.parse(readFileSync('.secrets/pilot-relay/self-test-identity.json','utf8'));assert.equal(identity.project,target.projectRef);assert.equal(identity.purpose,'dedicated-sender-self-test');
 await db.connect();await db.query('begin isolation level repeatable read read only');assert.equal((await db.query('select marker from foundation_probe.environment_identity where singleton')).rows[0].marker,target.databaseMarker);
 const row=(await db.query(`select u.id,u.email,u.confirmation_sent_at,u.email_confirmed_at,m.id capture_id,m.recipient_hash,m.created_at,m.encrypted_payload,i.created_at intent_created_at,i.finalized_at from auth.users u join private.registration_intents i on i.provider_user_id=u.id join private.isolated_auth_mail m on m.recipient_hash=$2 and m.action='signup' where u.id=$1 and u.raw_user_meta_data->>'full_name'='Synthetic Mitsa Gmail delivery test' order by m.created_at desc limit 1`,[identity.userId,identity.emailHash])).rows[0];assert(row);assert.equal(createHash('sha256').update(row.email).digest('hex'),identity.emailHash);
 const key=await readPrivateKey({armoredKey:readFileSync('.secrets/auth-mail/private.asc','utf8')}),mail=JSON.parse(String((await decrypt({message:await readMessage({binaryMessage:row.encrypted_payload}),decryptionKeys:key})).data));
 const state=(await db.query('select enabled,smtp_enabled,private.mitsa_pilot_registration_open() open from private.pilot_registration_window where singleton')).rows[0];assert.deepEqual(state,{enabled:false,smtp_enabled:false,open:false});
 const issued=Math.min(row.created_at.getTime(),row.confirmation_sent_at?.getTime()??Infinity),now=Date.now(),failed=JSON.parse(readFileSync('artifacts/controlled-gmail-test-results.json','utf8'));
 const window=(await db.query('select * from private.pilot_registration_window where singleton')).rows[0];let recordedScopeValid=false;
 try{pilotTestApproval({project:target.projectRef,origin:'http://127.0.0.1:3000',purpose:'dedicated-sender-self-test',maxAttempts:3,codeLength:6,expirySeconds:3600,senderHash:identity.emailHash,recipientHash:identity.emailHash,approvedAt:identity.approvedAt,expiresAt:identity.expiresAt},window,identity.emailHash,6,Date.parse(failed.finishedAt));recordedScopeValid=true;}catch{}
 const report={checkedAt:new Date().toISOString(),project:target.projectRef,markerVerified:true,pilotClosed:true,recipientMatches:mail.email===row.email,userMatches:mail.userId===row.id,typeSignup:mail.type==='signup',originMatches:mail.origin==='http://127.0.0.1:3000',codeSixDigits:/^\d{6}$/.test(mail.code??''),tokenHashFormatValid:/^(pkce_)?[a-f0-9]{32,256}$/.test(mail.tokenHash??''),eventKeyFormatValid:/^[a-zA-Z0-9_-]{1,100}$/.test(row.capture_id),recipientValid:z.email().safeParse(row.email).success,providerConfirmationDateValid:row.confirmation_sent_at instanceof Date,issuedAtNotFuture:issued<=now,issuedAtWithinLifetime:now-issued<3600000,unverifiedAccount:row.email_confirmed_at===null,unfinalizedIntent:row.finalized_at===null,intentInsideApprovedWindow:row.intent_created_at.getTime()>=Date.parse(identity.approvedAt),captureInsideApprovedWindow:row.created_at.getTime()>=Date.parse(identity.approvedAt),smtpConnectionsAttempted:0,remoteChanges:0,privateValuesPrinted:false};
 report.recordedScopeValidAtFailure=recordedScopeValid;report.issuedBeforeRunnerStopped=issued<=Date.parse(failed.finishedAt);
 // Execute the relay's exact SELECT with no activation or claim. Preserve
 // only the PostgreSQL error code if parsing/permissions fail.
 const relay=readFileSync('scripts/pilot-mail-relay.mjs','utf8'),queryStart=relay.indexOf('select m.id,m.recipient_hash'),queryEnd=relay.indexOf('`,[window.approved_at',queryStart);
 assert(queryStart>=0&&queryEnd>queryStart);
 await db.query('savepoint relay_candidate_probe');
 try{const candidates=await db.query(relay.slice(queryStart,queryEnd),[window.approved_at,row.email,null,null]);report.exactCandidateQueryWorks=true;report.eligibleCandidateCount=candidates.rows.length;}
 catch(error){report.exactCandidateQueryWorks=false;report.candidateQueryErrorCode=/^[0-9A-Z]{5}$/.test(error?.code??'')?error.code:'unknown';await db.query('rollback to savepoint relay_candidate_probe');}
 const precision=(await db.query(`select exists(select 1 from private.isolated_auth_mail where recipient_hash=$1 and action='signup' and created_at>$2 and id=$3) own_capture_misclassified,
  exists(select 1 from private.isolated_auth_mail where recipient_hash=$1 and action='signup' and created_at>(select created_at from private.isolated_auth_mail where id=$3)) actual_newer_capture`,[identity.emailHash,row.created_at,row.capture_id])).rows[0];
 report.ownCaptureMisclassifiedByMillisecondComparison=precision.own_capture_misclassified;report.actualNewerCaptureExists=precision.actual_newer_capture;
 await db.query('commit');writeFileSync('artifacts/pilot-relay-diagnostic.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch{try{await db.query('rollback');}catch{}console.error('Read-only pilot diagnosis stopped; private details suppressed');process.exitCode=1;}finally{await db.end();}
