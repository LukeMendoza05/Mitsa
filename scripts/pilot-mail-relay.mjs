// Inactive, operator-only local pilot relay. Never run inside the Next runtime.
// Sending requires separately approved DB flags/window/sender/expiry AND an
// explicit command flag. No hook, schema, gate or SMTP setting is changed here.
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';import {parse} from 'dotenv';import pg from 'pg';import {readPrivateKey,readMessage,decrypt} from 'openpgp';
import {assertTestTarget} from './test-target.mjs';import {testDatabaseConfig} from './postgres-config.mjs';
import {claimPilotMailDelivery} from './lib/pilot-mail-claim.ts';
import {readProtectedGmailCredentials} from './lib/gmail-credentials.mjs';
import {pilotTestApproval} from './lib/pilot-test-approval.ts';
// Load only the non-secret email format setting; never load operator secrets
// into process.env or let the relay silently disagree with the application.
const localLength=parse(readFileSync('.env.local')).MITSA_EMAIL_OTP_LENGTH??'6';
if(process.env.MITSA_EMAIL_OTP_LENGTH&&process.env.MITSA_EMAIL_OTP_LENGTH!==localLength)throw Error('Email format mismatch; no delivery attempted');
process.env.MITSA_EMAIL_OTP_LENGTH=localLength;
const {deliverSignupCodeWithGmail}=await import('../src/lib/mail/smtp.ts'),{emailVerificationCodeLength}=await import('../src/lib/auth/email-code-settings.ts');
const hash=value=>createHash('sha256').update(value).digest('hex'),config=JSON.parse(readFileSync('config/test-target.json','utf8')),env=parse(readFileSync('.secrets/operator.env')),
 target=assertTestTarget({projectRef:env.TEST_PROJECT_REF,url:env.TEST_SUPABASE_URL,databaseUrl:env.TEST_DATABASE_URL},config),db=new pg.Client(testDatabaseConfig(env.TEST_DATABASE_URL,config));
let stage='read-only-target',connectionsAttempted=0,authorizationStage;
try {
 await db.connect();assert.equal((await db.query('select marker from foundation_probe.environment_identity where singleton')).rows[0]?.marker,target.databaseMarker);
 const present=(await db.query("select to_regclass('private.pilot_registration_window') is not null present")).rows[0].present;
 if(!present){console.log(JSON.stringify({status:'Not activated',smtpConnectionsAttempted:0}));}
 else {
  const window=(await db.query('select *,private.mitsa_pilot_registration_open() open from private.pilot_registration_window where singleton')).rows[0];
  if(!window?.open||!process.argv.includes('--send-approved-pilot'))console.log(JSON.stringify({status:window?.open?'Approved window open; explicit send flag required':'Pilot window closed',smtpConnectionsAttempted:0}));
  else {
   stage='private-configuration';const credentials=readProtectedGmailCredentials();assert.equal(hash(credentials.sender),window.approved_sender_sha256);
   const scope=pilotTestApproval(JSON.parse(readFileSync('.secrets/pilot-relay/delivery-approval.json','utf8')),window,hash(credentials.sender),emailVerificationCodeLength);
   const privateKey=await readPrivateKey({armoredKey:readFileSync('.secrets/auth-mail/private.asc','utf8')});
   // Process at most one latest eligible message per invocation. Synthetic
   // addresses remain encrypted capture-only. Never decrypt arbitrary history.
   const candidate=(await db.query(`select m.id,m.recipient_hash,m.encrypted_payload,m.created_at,u.id user_id,u.email,u.confirmation_sent_at
    from private.isolated_auth_mail m join auth.users u on encode(sha256(convert_to(u.email,'UTF8')),'hex')=m.recipient_hash
    join private.registration_intents i on i.provider_user_id=u.id and i.email=u.email
    where m.action='signup' and m.created_at >= $1 and (($3::uuid is null and i.created_at >= $1) or (u.id=$3::uuid and i.id=$4::uuid)) and u.email_confirmed_at is null
    and u.deleted_at is null and (u.banned_until is null or u.banned_until<=statement_timestamp())
    and u.email=$2 and u.email not like '%.invalid' and i.finalized_at is null and i.expires_at>statement_timestamp()
    and not exists(select 1 from private.pilot_mail_deliveries d where d.capture_id=m.id)
    and not exists(select 1 from private.isolated_auth_mail newer where newer.recipient_hash=m.recipient_hash and newer.action='signup' and newer.created_at>m.created_at)
    order by m.created_at desc limit 1`,[window.approved_at,credentials.sender,scope.existingIdentity?.userId??null,scope.existingIdentity?.intentId??null])).rows[0];
   if(!candidate)console.log(JSON.stringify({status:'No eligible unsent pilot message',smtpConnectionsAttempted:0}));
   else {
    stage='bound-provider-message';const mail=JSON.parse(String((await decrypt({message:await readMessage({binaryMessage:candidate.encrypted_payload}),decryptionKeys:privateKey})).data));
    assert.equal(mail.email,candidate.email);assert.equal(mail.userId,candidate.user_id);assert.equal(hash(mail.email),candidate.recipient_hash);assert.equal(mail.type,'signup');assert.equal(mail.origin,window.origin);assert.match(mail.code,new RegExp(`^\\d{${emailVerificationCodeLength}}$`));assert(candidate.confirmation_sent_at instanceof Date);
    const issuedAt=Math.min(candidate.created_at.getTime(),candidate.confirmation_sent_at.getTime());
    stage='approved-delivery';
    const {providerMailNow}=await import('./lib/provider-mail-clock.ts');const providerNow=await providerMailNow(db);
    const result=await deliverSignupCodeWithGmail({message:{eventKey:candidate.id,recipient:mail.email,providerCode:mail.code,providerTokenHash:mail.tokenHash,issuedAt},
     authorization:{externalMailEnabled:window.smtp_enabled,senderApproved:true,approvedSender:credentials.sender,approvedOrigin:window.origin,providerExpirySeconds:window.provider_otp_expiry_seconds},appPassword:credentials.appPassword,
     async authorizeAndClaim(eventKey,recipient){
      let claimed;try{claimed=await claimPilotMailDelivery(db,{captureId:eventKey,recipientHash:candidate.recipient_hash,recipient,userId:mail.userId,captureCreatedAt:candidate.created_at,senderHash:hash(credentials.sender),expirySeconds:window.provider_otp_expiry_seconds,approvedScope:scope});}
      catch(error){const match=error instanceof Error?error.message.match(/\((window|approved-test-scope|intent|latest-message|limits|claim)\)$/):null;authorizationStage=match?.[1];throw Error('Delivery authorization failed');}
      connectionsAttempted=Number(claimed);return claimed;
     }},providerNow);
    await db.query("update private.pilot_mail_deliveries set state='smtp-accepted' where capture_id=$1",[candidate.id]);
    console.log(JSON.stringify({status:result.status,inboxDeliveryVerified:false,smtpConnectionsAttempted:connectionsAttempted,privateValuesPrinted:false}));
   }
  }
 }
}catch(error){
 // A claim remains consumed after uncertainty. Never print a provider/database
 // exception, recipient, payload, OTP, hash, SMTP password or private key.
 const deliveryFailure=['authentication','timeout','tls','connection','unconfirmed'].includes(error?.deliveryFailure)?error.deliveryFailure:undefined;
 const smtpResponseCode=Number.isInteger(error?.smtpResponseCode)&&error.smtpResponseCode>=100&&error.smtpResponseCode<=599?error.smtpResponseCode:undefined;
 console.error(JSON.stringify({status:'Pilot relay stopped; no automatic retry',stage,authorizationStage,deliveryFailure,smtpResponseCode,smtpConnectionsAttempted:connectionsAttempted,privateValuesPrinted:false}));process.exitCode=1;
}finally{await db.end();}
