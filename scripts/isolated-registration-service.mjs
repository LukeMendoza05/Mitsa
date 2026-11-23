// Local operator process only. No privileged connection/key enters Next.js.
// Activation is deliberately gated on live CAPTCHA and security evidence;
// general mode additionally requires a completed unallowlisted onboarding run.
import {readFileSync,writeFileSync,mkdirSync,renameSync,existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {parse} from 'dotenv';
import pg from 'pg';
import {readPrivateKey,readMessage,decrypt} from 'openpgp';
import {assertTestTarget} from './test-target.mjs';
import {testDatabaseConfig} from './postgres-config.mjs';
import {readProtectedGmailCredentials} from './lib/gmail-credentials.mjs';
import {recipientHash,controlledSenderAliasAllowed,developmentMailCapacity,requireRegistrationEvidence} from './lib/development-mail.mjs';
import {claimPilotMailDelivery} from './lib/pilot-mail-claim.ts';
import {renewDevelopmentMailLease} from './lib/development-mail-lease.ts';
import {providerMailNow} from './lib/provider-mail-clock.ts';
import {pendingOnboardingBinding} from './lib/pending-onboarding.mjs';
import {signupChallengeConfig} from '../src/lib/auth/signup-challenge.ts';
import {rehearsalRecipientFile,rehearsalApprovalFile,verifyRegistrationRehearsalApproval} from './lib/registration-rehearsal.mjs';
import {assertClosedOnboardingEvidence} from './lib/closed-pilot-evidence.mjs';

const folder='.secrets/isolated-registration';
const json=path=>JSON.parse(readFileSync(path,'utf8'));
const atomic=(path,value)=>{writeFileSync(path+'.tmp',JSON.stringify(value)+'\n',{mode:0o600});renameSync(path+'.tmp',path);};
const resumeControlled=process.argv.includes('--resume-controlled');
const phase=process.argv.includes('--activate-controlled')||resumeControlled?'controlled':process.argv.includes('--activate-general')?'general':null;
const stopOnly=process.argv.includes('--stop');
const readOnly=process.argv.includes('--check');
const rehearsal=process.argv.includes('--registration-rehearsal');
let db,ownsWindow=false,runtime,credentials,smtpAttempts=0,stage='preflight',stopping=false,authorizationStage;
const safeReport=value=>console.log(JSON.stringify({...value,privateValuesPrinted:false}));
function heartbeat(deliveryReady,capacityAvailable) {if(runtime)atomic(`${folder}/status.json`,{runId:runtime.runId,checkedAt:new Date().toISOString(),deliveryReady,capacityAvailable});}
async function close() {
 try{if(db&&ownsWindow)await db.query('update private.pilot_registration_window set enabled=false,smtp_enabled=false,expires_at=statement_timestamp() where singleton and approved_at=$1',[runtime.approvedAt]);}
 finally{ownsWindow=false;heartbeat(false,false);}
}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
process.once('SIGINT',()=>{stopping=true;});process.once('SIGTERM',()=>{stopping=true;});
try {
 if(!phase&&!stopOnly&&!readOnly)throw Error('Explicit isolated activation or stop option required');
 if(rehearsal&&(phase!=='controlled'||resumeControlled||stopOnly||readOnly))throw Error('Rehearsal requires fresh controlled activation');
 if(phase&&(stopOnly||readOnly)||stopOnly&&readOnly||[process.argv.includes('--activate-controlled'),process.argv.includes('--activate-general'),resumeControlled].filter(Boolean).length>1)throw Error('Ambiguous activation');
 const approved=json('config/test-target.json'),operator=parse(readFileSync('.secrets/operator.env'));
 const target=assertTestTarget({projectRef:operator.TEST_PROJECT_REF,url:operator.TEST_SUPABASE_URL,databaseUrl:operator.TEST_DATABASE_URL},approved);
 assert.equal(target.projectRef,'mjtejwafxriwntweussc');
 db=new pg.Client({...testDatabaseConfig(operator.TEST_DATABASE_URL,approved),statement_timeout:15000});await db.connect();
 assert.equal((await db.query('select marker from foundation_probe.environment_identity where singleton')).rows[0]?.marker,target.databaseMarker);
 if(readOnly){
  const local=parse(readFileSync('.env.local')),dashboard=json('artifacts/provider-otp-dashboard-review.json');
  assert.equal(local.APP_ORIGIN,'http://127.0.0.1:3000');assert.equal(local.MITSA_AUTH_MAIL_MODE,'isolated-capture');assert.equal(local.MITSA_EMAIL_OTP_LENGTH,'6');assert(signupChallengeConfig(local));
  assert.equal(dashboard.project,target.projectRef);assert.equal(dashboard.emailOtpLength,6);assert.equal(dashboard.emailOtpExpirySeconds,3600);
  credentials=readProtectedGmailCredentials();assert(credentials.sender.endsWith('@gmail.com'));
  const states=(await db.query("select private.mitsa_pilot_registration_open() open,to_regprocedure('private.mitsa_development_recovery_allowed(uuid,text)') is not null recovery_ready")).rows[0];
  const counts=(await db.query("select count(*) filter(where created_at>statement_timestamp()-interval '1 hour')::int hourly,count(*)::int daily,0::int run from private.pilot_mail_deliveries where created_at>statement_timestamp()-interval '24 hours'")).rows[0];
  const report={checkedAt:new Date().toISOString(),project:target.projectRef,markerVerified:true,readOnly:true,currentMode:local.MITSA_REGISTRATION_MODE,
   realCaptchaConfigured:true,protectedGmailCredentialsReadable:true,codeLength:6,expirySeconds:3600,pilotOpen:states.open,
   recoveryCandidateApplied:states.recovery_ready,capacityAvailable:developmentMailCapacity(counts,'controlled'),hourlyClaims:counts.hourly,dailyClaims:counts.daily,
   configuredHourlyLimit:10,configuredDailyLimit:20,smtpConnections:0,databaseWrites:0,privateValuesPrinted:false};
  writeFileSync('artifacts/isolated-registration-service-preflight.json',JSON.stringify(report,null,2)+'\n');safeReport(report);
 }else if(stopOnly){
  await db.query('update private.pilot_registration_window set enabled=false,smtp_enabled=false,expires_at=statement_timestamp() where singleton');
  if(existsSync(`${folder}/runtime.json`)){runtime=json(`${folder}/runtime.json`);heartbeat(false,false);}
  safeReport({status:'Isolated registration and delivery closed',smtpAttempts:0});
 }else {
  const local=parse(readFileSync('.env.local'));
  assert.equal(local.SUPABASE_URL,target.url);
  assert.equal(local.APP_ORIGIN,'http://127.0.0.1:3000');assert.equal(local.MITSA_AUTH_MAIL_MODE,'isolated-capture');assert.equal(local.MITSA_EMAIL_OTP_LENGTH,'6');
  assert(signupChallengeConfig(local));
  requireRegistrationEvidence(json('artifacts/turnstile-live-results.json'),json('artifacts/isolated-registration-security.json'),phase,
   phase==='general'?json('artifacts/controlled-onboarding-results.json'):null,
   existsSync('artifacts/controlled-registration-evidence-decision.json')?json('artifacts/controlled-registration-evidence-decision.json'):null);
  // Recovery eligibility is a separately reviewed migration. Refuse activation
  // before it exists; this process never installs schema or changes Auth hooks.
  assert((await db.query("select to_regprocedure('private.mitsa_development_recovery_allowed(uuid,text)') is not null ready")).rows[0].ready);
  const gates=(await db.query('select * from private.release_gates where singleton')).rows[0];
  assert(['registration_enabled','external_mail_enabled','eligibility_approved','legal_publication_enabled','disposal_enabled'].every(key=>gates[key]===false));
  stage='provider-settings';
  const settings=await fetch(`${target.url}/auth/v1/settings`,{headers:{apikey:local.SUPABASE_PUBLISHABLE_KEY??''},signal:AbortSignal.timeout(10000)});
  const provider=await settings.json();assert(settings.ok&&provider.disable_signup===false&&provider.mailer_autoconfirm===false);
  stage='sender-scope';credentials=readProtectedGmailCredentials();
  const senderBaseline=json('.secrets/pilot-relay/credential-readiness.json');assert.equal(senderBaseline.project,target.projectRef);assert.equal(senderBaseline.senderSha256,recipientHash(credentials.sender));
  const privateKey=await readPrivateKey({armoredKey:readFileSync('.secrets/auth-mail/private.asc','utf8')});
  let controlledRecipient,resumedIdentity,resumeApproval,rehearsalApproval;
  if(phase==='controlled') {
   stage='controlled-recipient';
   controlledRecipient=json(rehearsal?rehearsalRecipientFile:'.secrets/onboarding-recipient.json').email?.trim().toLowerCase();
   assert(controlledSenderAliasAllowed(credentials.sender,controlledRecipient));
   if(rehearsal){rehearsalApproval=json(rehearsalApprovalFile);verifyRegistrationRehearsalApproval(rehearsalApproval,recipientHash(controlledRecipient));}
   if(resumeControlled){
    const approval=json('artifacts/controlled-verification-resume-approval.json'),baseline=json(`${folder}/pending-onboarding.json`);
    assert.equal(approval.project,target.projectRef);assert.equal(approval.approvedByUser,true);assert.equal(approval.scope,'existing-pending-onboarding-only');assert.equal(approval.windowMinutes,30);assert.equal(approval.maxAuthenticationEmailAttempts,4);
    assert.equal(approval.usedAt,undefined);resumeApproval=approval;
    assert.equal(baseline.project,target.projectRef);assert.equal(baseline.purpose,'existing-pending-onboarding-only');
    resumedIdentity=await pendingOnboardingBinding(db,controlledRecipient,baseline);assert.equal(resumedIdentity.termsId,gates.test_terms_id);
    assert.equal((await db.query('select count(*)::int n from private.pilot_mail_deliveries where recipient_hash=$1',[recipientHash(controlledRecipient)])).rows[0].n,0);
   }else assert.equal((await db.query('select count(*)::int n from auth.users where email=$1',[controlledRecipient])).rows[0].n,0);
   assert.equal((await db.query('select private.mitsa_test_recipient_allowed($1) allowed',[controlledRecipient])).rows[0].allowed,false);
  }
  const start=Date.now();runtime={version:1,project:target.projectRef,origin:local.APP_ORIGIN,runId:randomUUID(),phase,
   approvedAt:new Date(start).toISOString(),expiresAt:new Date(start+(phase==='controlled'?30:120)*60000).toISOString(),
   ...(controlledRecipient?{recipientHash:recipientHash(controlledRecipient)}:{}),...(resumeControlled?{registrationAllowed:false}:{})};
  mkdirSync(folder,{recursive:true});
  // A DB row lock prevents competing operator workers from claiming a window.
  stage='open-lease';
  await db.query('begin');
  const existing=(await db.query('select *,private.mitsa_pilot_registration_open() open from private.pilot_registration_window where singleton for update')).rows[0];assert.equal(existing.open,false);
  if(rehearsal){
   const priorRuntime=json(`${folder}/runtime.json`),rows=(await db.query('select recipient_hash,state,created_at from private.pilot_mail_deliveries')).rows;
   assertClosedOnboardingEvidence(existing,json('artifacts/controlled-gmail-test-results.json'),json('artifacts/controlled-onboarding-results.json'),json('artifacts/controlled-verification-resume-approval.json'),priorRuntime,senderBaseline.senderSha256,rows);
   mkdirSync('.secrets/registration-rehearsal',{recursive:true});
   writeFileSync('.secrets/registration-rehearsal/prior-runtime.json',JSON.stringify(priorRuntime)+'\n',{mode:0o600,flag:'wx'});
   writeFileSync('.secrets/registration-rehearsal/prior-window.json',JSON.stringify({project:target.projectRef,window:existing})+'\n',{mode:0o600,flag:'wx'});
  }
  await db.query("update private.pilot_registration_window set enabled=true,smtp_enabled=true,approved_at=$1,expires_at=least($2::timestamptz,statement_timestamp()+interval '60 seconds'),provider_otp_expiry_seconds=3600,approved_sender_sha256=$3 where singleton",[runtime.approvedAt,runtime.expiresAt,recipientHash(credentials.sender)]);
  await db.query('commit');ownsWindow=true;atomic(`${folder}/runtime.json`,runtime);heartbeat(false,false);
  if(resumeApproval)atomic('artifacts/controlled-verification-resume-approval.json',{...resumeApproval,usedAt:new Date().toISOString(),windowApprovedAt:runtime.approvedAt,windowExpiresAt:runtime.expiresAt});
  if(rehearsalApproval)atomic(rehearsalApprovalFile,{...rehearsalApproval,usedAt:new Date().toISOString(),windowApprovedAt:runtime.approvedAt,windowExpiresAt:runtime.expiresAt});
  // Preserve every other local setting and never print the resulting file.
  stage='local-runtime';
  const text=readFileSync('.env.local','utf8');assert(/^MITSA_REGISTRATION_MODE=.*$/m.test(text));
  writeFileSync('.env.local',text.replace(/^MITSA_REGISTRATION_MODE=.*$/m,'MITSA_REGISTRATION_MODE=development-open'));
  process.env.MITSA_EMAIL_OTP_LENGTH='6';const {deliverSignupCodeWithGmail,deliverRecoveryWithGmail}=await import('../src/lib/mail/smtp.ts');
  const scope={phase,approvedAtMs:start,runExpiresAtMs:Date.parse(runtime.expiresAt),maxAttempts:rehearsal?2:phase==='controlled'?4:20,...(runtime.recipientHash?{recipientHash:runtime.recipientHash}:{}),...(resumedIdentity?{existingIdentity:{userId:resumedIdentity.userId,intentId:resumedIdentity.intentId}}:{})};
  safeReport({status:'Isolated registration service starting',phase,url:`${runtime.origin}/signup`,durationMinutes:phase==='controlled'?30:120});
  while(!stopping&&Date.now()<scope.runExpiresAtMs) {
   stage='capacity';
   const counts=(await db.query("select count(*) filter(where created_at>statement_timestamp()-interval '1 hour')::int hourly,count(*)::int daily,count(*) filter(where created_at>=$1)::int run from private.pilot_mail_deliveries where created_at>statement_timestamp()-interval '24 hours'",[runtime.approvedAt])).rows[0];
   if(rehearsal&&counts.run>=scope.maxAttempts){stopping=true;break;}
   const capacity=developmentMailCapacity(counts,phase);heartbeat(true,capacity);
   // Crash, failed heartbeat or explicit stop closes the DB lease in <=60s.
   assert(await renewDevelopmentMailLease(db,runtime,capacity));
   if(!capacity){await pause(5000);continue;}
   stage='bound-capture';
   const candidate=(await db.query(`select distinct on(m.id) m.id,m.recipient_hash,m.encrypted_payload,m.action,m.created_at,u.id user_id,u.email,u.confirmation_sent_at,u.recovery_sent_at
    from private.isolated_auth_mail m join auth.users u on encode(sha256(convert_to(u.email,'UTF8')),'hex')=m.recipient_hash
    join private.registration_intents i on i.provider_user_id=u.id and i.email=u.email
    where m.created_at>=$1 and m.action in ('signup','recovery') and ($5::boolean=false or m.action='signup') and ($2::text is null or m.recipient_hash=$2)
    and ($3::uuid is null or (u.id=$3::uuid and i.id=$4::uuid))
    and u.email not like '%.invalid' and u.deleted_at is null and (u.banned_until is null or u.banned_until<=statement_timestamp())
    and ((m.action='signup' and u.email_confirmed_at is null and i.finalized_at is null and i.expires_at>statement_timestamp()) or (m.action='recovery' and u.email_confirmed_at is not null and i.finalized_at is not null))
    and not exists(select 1 from private.pilot_mail_deliveries d where d.capture_id=m.id or (d.recipient_hash=m.recipient_hash and d.created_at>statement_timestamp()-interval '1 minute'))
    and not exists(select 1 from private.isolated_auth_mail newer where newer.recipient_hash=m.recipient_hash and newer.action=m.action and newer.created_at>m.created_at)
    order by m.id limit 1`,[runtime.approvedAt,runtime.recipientHash??null,resumedIdentity?.userId??null,resumedIdentity?.intentId??null,rehearsal])).rows[0];
   if(candidate){
    const mail=JSON.parse(String((await decrypt({message:await readMessage({binaryMessage:candidate.encrypted_payload}),decryptionKeys:privateKey})).data));
    assert.equal(mail.email,candidate.email);assert.equal(mail.userId,candidate.user_id);assert.equal(recipientHash(mail.email),candidate.recipient_hash);assert.equal(mail.type,candidate.action);assert.equal(mail.origin,runtime.origin);
    const issued=candidate.action==='signup'?candidate.confirmation_sent_at:candidate.recovery_sent_at;assert(issued instanceof Date);
    stage='provider-clock';const providerNow=await providerMailNow(db);
    stage='smtp';const deliver=candidate.action==='signup'?deliverSignupCodeWithGmail:deliverRecoveryWithGmail;
    await deliver({message:{eventKey:candidate.id,recipient:mail.email,providerCode:mail.code,providerTokenHash:mail.tokenHash,issuedAt:Math.min(candidate.created_at.getTime(),issued.getTime())},
     authorization:{externalMailEnabled:true,senderApproved:true,approvedSender:credentials.sender,approvedOrigin:runtime.origin,providerExpirySeconds:3600},appPassword:credentials.appPassword,
     async authorizeAndClaim(eventKey,recipient){let claimed;try{claimed=await claimPilotMailDelivery(db,{captureId:eventKey,recipientHash:candidate.recipient_hash,recipient,userId:mail.userId,captureCreatedAt:candidate.created_at,senderHash:recipientHash(credentials.sender),expirySeconds:3600,action:candidate.action,developmentScope:scope});}catch(error){authorizationStage=error instanceof Error?error.message.match(/\((window|approved-test-scope|intent|latest-message|limits|claim)\)$/)?.[1]:undefined;throw Error('Delivery authorization failed');}if(claimed)smtpAttempts++;return claimed;}},providerNow);
    await db.query("update private.pilot_mail_deliveries set state='smtp-accepted' where capture_id=$1",[candidate.id]);safeReport({status:'Authentication message accepted by SMTP; inbox receipt unconfirmed',action:candidate.action,smtpAttempts});
   }
   await pause(3000);
  }
  await close();safeReport({status:'Isolated registration window closed',smtpAttempts});
 }
}catch(error){
 try{if(db)await db.query('rollback');await close();}catch{ /* Short database lease remains the fail-closed fallback. */ }
 const deliveryFailure=['authentication','timeout','tls','connection','unconfirmed'].includes(error?.deliveryFailure)?error.deliveryFailure:undefined;
 const smtpResponseCode=Number.isInteger(error?.smtpResponseCode)&&error.smtpResponseCode>=100&&error.smtpResponseCode<=599?error.smtpResponseCode:undefined;
 const preSmtpFailure=({'Invalid or expired provider message':'provider-message','Provider mail clock unavailable':'provider-clock','External mail is not authorized':'sender-authorization','Delivery authorization unavailable':'claim-authorization','Delivery is not authorized or was already claimed':'claim-refused'})[error?.message];
 const result={status:'Registration service stopped; private failure details suppressed',stage,smtpAttempts,deliveryFailure,smtpResponseCode,authorizationStage,preSmtpFailure,checkedAt:new Date().toISOString(),...(runtime?{project:runtime.project,windowApprovedAt:runtime.approvedAt,windowDeadline:runtime.expiresAt}:{}),privateValuesPrinted:false};
 try{writeFileSync('artifacts/controlled-registration-service-failure.json',JSON.stringify(result,null,2)+'\n');}catch{/* Logging must not alter closure. */}
 safeReport(result);process.exitCode=1;
}finally{if(db)await db.end();}
