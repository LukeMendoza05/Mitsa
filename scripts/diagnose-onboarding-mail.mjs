// Exact private controlled identity, read-only. Never claims, sends or verifies.
import {readFileSync,writeFileSync} from 'node:fs';import assert from 'node:assert/strict';import {parse} from 'dotenv';import pg from 'pg';
import {readPrivateKey,readMessage,decrypt} from 'openpgp';import {z} from 'zod';
import {assertTestTarget} from './test-target.mjs';import {testDatabaseConfig} from './postgres-config.mjs';import {recipientHash} from './lib/development-mail.mjs';
import {readProtectedGmailCredentials} from './lib/gmail-credentials.mjs';
let db,stage='configuration';
try {
 const cfg=JSON.parse(readFileSync('config/test-target.json')),o=parse(readFileSync('.secrets/operator.env')),runtime=JSON.parse(readFileSync('.secrets/isolated-registration/runtime.json')),status=JSON.parse(readFileSync('.secrets/isolated-registration/status.json'));
 const target=assertTestTarget({projectRef:o.TEST_PROJECT_REF,url:o.TEST_SUPABASE_URL,databaseUrl:o.TEST_DATABASE_URL},cfg);assert.equal(target.projectRef,'mjtejwafxriwntweussc');
 const email=JSON.parse(readFileSync('.secrets/onboarding-recipient.json')).email.trim().toLowerCase(),hash=recipientHash(email);assert.equal(hash,runtime.recipientHash);assert.equal(runtime.runId,status.runId);
 stage='database';db=new pg.Client(testDatabaseConfig(o.TEST_DATABASE_URL,cfg));await db.connect();await db.query('begin isolation level repeatable read read only');
 assert.equal((await db.query('select marker from foundation_probe.environment_identity where singleton')).rows[0].marker,target.databaseMarker);
 const row=(await db.query("select u.id,u.email,u.created_at user_created_at,u.confirmation_sent_at,u.email_confirmed_at,i.created_at intent_created_at,i.expires_at intent_expires_at,i.finalized_at,m.id capture_id,m.recipient_hash,m.created_at capture_created_at,m.encrypted_payload from auth.users u join private.registration_intents i on i.provider_user_id=u.id and i.email=u.email join private.isolated_auth_mail m on m.recipient_hash=$2 and m.action='signup' where u.email=$1 order by m.created_at desc limit 1",[email,hash])).rows[0];assert(row);
 const window=(await db.query('select enabled,smtp_enabled,approved_at,expires_at,provider_otp_expiry_seconds,approved_sender_sha256,private.mitsa_pilot_registration_open() open from private.pilot_registration_window')).rows[0];
 const counts=(await db.query('select count(*)::int n,count(*) filter(where state=\'smtp-accepted\')::int accepted from private.pilot_mail_deliveries where recipient_hash=$1 and created_at>=$2',[hash,runtime.approvedAt])).rows[0];
 const key=await readPrivateKey({armoredKey:readFileSync('.secrets/auth-mail/private.asc','utf8')}),mail=JSON.parse(String((await decrypt({message:await readMessage({binaryMessage:row.encrypted_payload}),decryptionKeys:key})).data));
 assert.equal(mail.email,email);assert.equal(mail.userId,row.id);assert.equal(mail.origin,runtime.origin);assert.equal(mail.type,'signup');
 const credentials=readProtectedGmailCredentials(),issued=Math.min(row.capture_created_at.getTime(),row.confirmation_sent_at.getTime()),closedAt=window.expires_at.getTime();
 // Re-run only the exact eligibility SELECT from the claim helper. No claim
 // INSERT, row lock, lease change or transport is executed.
 const helper=readFileSync('scripts/lib/pilot-mail-claim.ts','utf8');
 const prefix='db.query("select 1 from auth.users',start=helper.indexOf(prefix)+10,end=helper.indexOf('",[input.userId',start);assert(start>=10&&end>start);
 const eligibilitySql=helper.slice(start,end);let eligibilityQueryWorks=false,eligibilityErrorCode,eligibleBindings=0;
 await db.query('savepoint eligibility_probe');
 try{const result=await db.query(eligibilitySql,[row.id,email,row.capture_id,window.approved_at,hash,null,null,true,'signup',null,null]);eligibilityQueryWorks=true;eligibleBindings=result.rows.length;}
 catch(error){eligibilityErrorCode=/^[A-Z0-9]{5}$/.test(error?.code??'')?error.code:'unknown';await db.query('rollback to savepoint eligibility_probe');}
 // Exercise real rendering/validation with a callback that ALWAYS refuses.
 // Nodemailer cannot be reached because no durable claim is ever granted.
 process.env.MITSA_EMAIL_OTP_LENGTH='6';let claimCallbackReached=false,adapterOutcome='unknown';
 const {deliverSignupCodeWithGmail}=await import('../src/lib/mail/smtp.ts');
 try{await deliverSignupCodeWithGmail({message:{eventKey:row.capture_id,recipient:email,providerCode:mail.code,providerTokenHash:mail.tokenHash,issuedAt:issued},authorization:{externalMailEnabled:true,senderApproved:true,approvedSender:credentials.sender,approvedOrigin:runtime.origin,providerExpirySeconds:3600},appPassword:credentials.appPassword,authorizeAndClaim:async()=>{claimCallbackReached=true;return false;}},closedAt);}
 catch(error){adapterOutcome=({'Invalid or expired provider message':'invalid-provider-message','External mail is not authorized':'unauthorized-sender','Unapproved email destination':'invalid-origin','Delivery is not authorized or was already claimed':'deliberate-read-only-refusal'})[error?.message]??'other-suppressed';}
 let stopClockCallbackReached=false,stopClockOutcome='unknown';
 try{await deliverSignupCodeWithGmail({message:{eventKey:row.capture_id,recipient:email,providerCode:mail.code,providerTokenHash:mail.tokenHash,issuedAt:issued},authorization:{externalMailEnabled:true,senderApproved:true,approvedSender:credentials.sender,approvedOrigin:runtime.origin,providerExpirySeconds:3600},appPassword:credentials.appPassword,authorizeAndClaim:async()=>{stopClockCallbackReached=true;return false;}},Date.parse(status.checkedAt));}
 catch(error){stopClockOutcome=({'Invalid or expired provider message':'invalid-provider-message','Delivery is not authorized or was already claimed':'deliberate-read-only-refusal'})[error?.message]??'other-suppressed';}
 await db.query('commit');
 const report={checkedAt:new Date().toISOString(),project:target.projectRef,accountExists:true,accountPendingVerification:row.email_confirmed_at===null,intentFinalized:row.finalized_at!==null,signupHookAndCaptureAccepted:true,sixDigitCodeCaptured:/^\d{6}$/.test(mail.code??''),captureBindingValid:true,recipientValid:z.email().safeParse(email).success,tokenHashFormatValid:/^(pkce_)?[a-f0-9]{32,256}$/.test(mail.tokenHash??''),providerConfirmationTimeValid:row.confirmation_sent_at instanceof Date,
  signupCreatedAt:row.user_created_at.toISOString(),captureCreatedAt:row.capture_created_at.toISOString(),intentCreatedAt:row.intent_created_at.toISOString(),intentExpiresAt:row.intent_expires_at.toISOString(),windowApprovedAt:runtime.approvedAt,windowDeadline:runtime.expiresAt,windowActuallyClosedAt:window.expires_at.toISOString(),workerStoppedAt:status.checkedAt,windowClosed:!window.open&&!window.enabled&&!window.smtp_enabled,
  remainingWindowSecondsAtCapture:(Date.parse(runtime.expiresAt)-row.capture_created_at.getTime())/1000,remainingWindowSecondsAtWorkerStop:(Date.parse(runtime.expiresAt)-closedAt)/1000,secondsFromCaptureToWorkerStop:(closedAt-row.capture_created_at.getTime())/1000,codeUnexpiredAtWorkerStop:closedAt-issued<3600000,codeCurrentlyWithinProviderLifetime:Date.now()-issued<3600000,
  smtpClaims:counts.n,smtpAccepted:counts.accepted,senderBindingMatches:recipientHash(credentials.sender)===window.approved_sender_sha256,eligibilityQueryWorks,eligibilityErrorCode,eligibleBindings,adapterReachedClaimCallback:claimCallbackReached,adapterReadOnlyOutcome:adapterOutcome,
  stoppedHeartbeatDeliveryReady:status.deliveryReady,stoppedHeartbeatCapacityAvailable:status.capacityAvailable,providerIssuedAt:new Date(issued).toISOString(),databaseClosureAheadOfWorkerClockMs:closedAt-Date.parse(status.checkedAt),providerIssuedAfterWorkerStopClock:issued>Date.parse(status.checkedAt),adapterAtWorkerStopReachedClaim:stopClockCallbackReached,adapterAtWorkerStopOutcome:stopClockOutcome,
  networkSmtpAttempts:0,remoteChanges:0,privateValuesPrinted:false};
 writeFileSync('artifacts/onboarding-mail-diagnostic.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch(error){try{await db?.query('rollback');}catch{}console.error(JSON.stringify({stage,privateDetailsSuppressed:true}));process.exitCode=1;}finally{await db?.end();}
