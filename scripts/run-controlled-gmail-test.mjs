// Explicitly approved one-shot sender-self test. No tracing, screenshots,
// credential output, public activation, Auth configuration or personal action.
import {readFileSync,writeFileSync,existsSync,unlinkSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {parse} from 'dotenv';
import pg from 'pg';
import {chromium} from '@playwright/test';
import {readPrivateKey,readMessage,decrypt,readKey,createMessage,encrypt} from 'openpgp';
import {assertTestTarget} from './test-target.mjs';
import {testDatabaseConfig} from './postgres-config.mjs';
import {readProtectedGmailCredentials} from './lib/gmail-credentials.mjs';
import {pilotTestApproval} from './lib/pilot-test-approval.ts';
import {waitForPilotInbox} from './lib/pilot-inbox-confirmation.mjs';
import {createClient} from '@supabase/supabase-js';
import {invokePilotRelay} from './lib/pilot-relay-process.mjs';
import {readExistingPilot} from './lib/pilot-existing-identity.mjs';
import {submitPilotResend} from './lib/pilot-browser-resend.mjs';
import {readPriorPilotDelivery} from './lib/pilot-prior-delivery.mjs';
import {providerCodeRejected} from './lib/provider-code-rejection.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const approvalPath='.secrets/pilot-relay/delivery-approval.json',reportPath='artifacts/controlled-gmail-test-results.json',origin='http://127.0.0.1:3000';
const report={checkedAt:new Date().toISOString(),project:'mjtejwafxriwntweussc',scope:'dedicated-sender-self-test',maxAttempts:3,attempts:0,smtpAccepted:false,inboxReceipt:'No message sent',codeLength:6,expirySeconds:3600,actualProviderCodeVerified:false,windowOpened:false,windowClosed:false,publicRegistrationEnabled:false,supabaseSmtpSettingsChanged:false,personalAccountModified:false,privateValuesPrinted:false};
const finish=process.argv.includes('--finish-approved-self-test'),resume=finish||process.argv.includes('--resume-approved-self-test');if(resume){report.scope=finish?'dedicated-sender-self-test-finish':'dedicated-sender-self-test-resume';report.resumedExistingSyntheticAccount=true;}
let db,browser,approvedAt,expiresAt,senderHash,ownsManifest=false,stage='approval-preflight';
let stopRequested=false;
async function closeWindow(){
 if(!ownsManifest)return;
 await db.query('update private.pilot_registration_window set enabled=false,smtp_enabled=false where singleton and approved_at=$1 and expires_at=$2 and approved_sender_sha256=$3',[approvedAt,expiresAt,senderHash]);
 const state=(await db.query('select enabled,smtp_enabled,private.mitsa_pilot_registration_open() open from private.pilot_registration_window where singleton')).rows[0];
 assert.deepEqual(state,{enabled:false,smtp_enabled:false,open:false});
 const text=readFileSync('.env.local','utf8'),env=parse(text);
 if(env.MITSA_REGISTRATION_MODE==='controlled-pilot')writeFileSync('.env.local',text.replace(/^MITSA_REGISTRATION_MODE[ \t]*=.*$/m,'MITSA_REGISTRATION_MODE=isolated-test'));
 else assert.equal(env.MITSA_REGISTRATION_MODE,'isolated-test');
 if(existsSync(approvalPath))unlinkSync(approvalPath);
 report.windowClosed=true;
}
async function privateFill(locator,value){try{await locator.fill(value);}catch{throw Error('Private form input failed');}}
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{
 stopRequested=true;report.failureStage=`operator-${signal}`;
 // Delivery always rechecks its DB window. Keep evidence if interrupted.
 closeWindow().then(async()=>{
  if(db){const rows=(await db.query('select state,count(*)::int n from private.pilot_mail_deliveries group by state')).rows;report.deliveryStates=rows;report.attempts=rows.reduce((n,row)=>n+row.n,0);}
  writeFileSync(reportPath,JSON.stringify({...report,finishedAt:new Date().toISOString()},null,2)+'\n');
 }).catch(()=>{}).finally(()=>process.exit(1));
});
try {
 assert(resume!==process.argv.includes('--run-approved-self-test'));assert(!existsSync(approvalPath));
 assert(!(finish&&process.argv.includes('--resume-approved-self-test')));
 assert.equal(existsSync('.secrets/pilot-relay/self-test-identity.json'),resume);assert.equal(existsSync('.secrets/pilot-relay/self-test-account.pgp'),resume);
 const config=JSON.parse(readFileSync('config/test-target.json','utf8')),operator=parse(readFileSync('.secrets/operator.env'));
 const target=assertTestTarget({projectRef:operator.TEST_PROJECT_REF,url:operator.TEST_SUPABASE_URL,databaseUrl:operator.TEST_DATABASE_URL},config);
 assert.equal(target.projectRef,report.project);
 assert.equal(hash(readFileSync('supabase/prepared/20261014_mitsa_controlled_pilot_relay.sql')),'fb8a76b0ffbb57fe4f378c439e70028a094745c3165099a1235455c23c303dff');
 for(const path of ['artifacts/developer-reset-preservation.json','artifacts/pilot-relay-postflight.json',resume?'artifacts/pilot-resume-readiness.json':'artifacts/email-delivery-readiness.json']){
  const evidence=JSON.parse(readFileSync(path,'utf8'));assert.equal(evidence.project,target.projectRef);assert.equal(evidence.markerVerified,true);assert(Date.now()-Date.parse(evidence.checkedAt)<20*60000);
 }
 const credentials=readProtectedGmailCredentials();senderHash=hash(credentials.sender);
 assert.equal(senderHash,JSON.parse(readFileSync('.secrets/pilot-relay/credential-readiness.json','utf8')).senderSha256);
 assert.notEqual(credentials.sender,JSON.parse(readFileSync('.secrets/developer-registration.json','utf8')).email.trim().toLowerCase());
 const localText=readFileSync('.env.local','utf8'),local=parse(localText),dashboard=JSON.parse(readFileSync('artifacts/provider-otp-dashboard-review.json','utf8'));
 assert.equal(local.MITSA_REGISTRATION_MODE,'isolated-test');assert.equal(local.MITSA_EMAIL_OTP_LENGTH,'6');assert.equal(local.APP_ORIGIN,origin);assert.equal(dashboard.emailOtpLength,6);assert.equal(dashboard.emailOtpExpirySeconds,3600);
 db=new pg.Client({...testDatabaseConfig(operator.TEST_DATABASE_URL,config),query_timeout:20000});await db.connect();
 assert.equal((await db.query('select marker from foundation_probe.environment_identity where singleton')).rows[0]?.marker,target.databaseMarker);
 assert.equal((await db.query('select count(*)::int n from auth.users where email=$1',[credentials.sender])).rows[0].n,resume?1:0);
 assert.equal((await db.query('select count(*)::int n from private.pilot_mail_deliveries')).rows[0].n,finish?1:0);
 const gates=(await db.query('select * from private.release_gates where singleton')).rows[0];
 assert(['registration_enabled','external_mail_enabled','eligibility_approved','legal_publication_enabled','disposal_enabled'].every(name=>gates[name]===false));
 const existing=resume?await readExistingPilot(db,credentials.sender,gates.test_terms_id):null;
 const prior=finish?await readPriorPilotDelivery(db,senderHash,existing.binding.userId):null;
 if(prior){report.priorAttempts=1;report.maximumNewAttempts=1;report.priorWindowStartedAt=prior.report.windowStartedAt;report.priorWindowExpiresAt=prior.report.windowExpiresAt;}
 assert.deepEqual((await db.query('select enabled,smtp_enabled,private.mitsa_pilot_registration_open() open from private.pilot_registration_window where singleton')).rows[0],{enabled:false,smtp_enabled:false,open:false});
 // Match the established browser test configuration and prove it launches
 // before opening a delivery window. Bundled Chromium is not installed here.
 stage='browser-preflight';browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({baseURL:origin}),page=await context.newPage();page.setDefaultTimeout(20000);
 await page.goto('/signup');assert(await page.getByRole('heading',{name:'Make room for your business.',exact:true}).isVisible());
 stage='bounded-pilot-activation';approvedAt=new Date();expiresAt=new Date(approvedAt.getTime()+30*60000);
 const approval={project:target.projectRef,origin,purpose:report.scope,maxAttempts:3,codeLength:6,expirySeconds:3600,senderHash,recipientHash:senderHash,approvedAt:approvedAt.toISOString(),expiresAt:expiresAt.toISOString(),...(existing?{existingIdentity:existing.binding}:{}),...(prior?{remainingAttempts:1,previousCaptureId:prior.captureId}:{})};
 pilotTestApproval(approval,{approved_at:approvedAt,expires_at:expiresAt,approved_sender_sha256:senderHash},senderHash,6);
 writeFileSync(approvalPath,JSON.stringify(approval),{flag:'wx',mode:0o600});ownsManifest=true;
 await db.query('update private.pilot_registration_window set approved_at=$1,expires_at=$2,provider_otp_expiry_seconds=3600,approved_sender_sha256=$3,enabled=true,smtp_enabled=true where singleton and not enabled and not smtp_enabled',[approvedAt,expiresAt,senderHash]);
 assert.equal((await db.query('select private.mitsa_pilot_registration_open() open')).rows[0].open,true);
 report.windowOpened=true;
 assert.equal(readFileSync('.env.local','utf8'),localText);writeFileSync('.env.local',localText.replace(/^MITSA_REGISTRATION_MODE[ \t]*=.*$/m,'MITSA_REGISTRATION_MODE=controlled-pilot'));
 // Database expiry independently rejects all work after 30 minutes; the
 // bounded receipt wait and finally block explicitly close the flags too.
 report.windowStartedAt=approvedAt.toISOString();report.windowExpiresAt=expiresAt.toISOString();
 if(existing){
  stage='normal-pending-account-signin';await page.goto('/login');await privateFill(page.getByLabel('Email',{exact:true}),credentials.sender);await privateFill(page.getByLabel('Password',{exact:true}),existing.password);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL(url=>url.pathname==='/verify-email',{timeout:30000});
  // Obtain a fresh provider capture inside the new approved window. The old
  // encrypted code and identity are retained; neither account is recreated.
  await submitPilotResend(page);
 }else{
 stage='normal-browser-signup';
 await page.goto('/signup');await page.getByRole('button',{name:'Create account',exact:true}).waitFor({state:'visible'});
 // Let next dev observe only the changed local registration mode.
 if(!await page.getByRole('button',{name:'Create account',exact:true}).isEnabled()){await page.waitForTimeout(2000);await page.reload();}
 assert(await page.getByRole('button',{name:'Create account',exact:true}).isEnabled());
 const password=`M1!${randomUUID()}`;
 // Retain this separate synthetic identity safely if delivery or receipt
 // fails. Never lose/overwrite its password or alter the personal account.
 const publicKey=await readKey({armoredKey:readFileSync('.secrets/auth-mail/public.asc','utf8')});
 const encrypted=await encrypt({message:await createMessage({text:JSON.stringify({project:target.projectRef,purpose:'dedicated-sender-self-test',email:credentials.sender,password,fullName:'Synthetic Mitsa Gmail delivery test'})}),encryptionKeys:publicKey,format:'binary'});
 writeFileSync('.secrets/pilot-relay/self-test-account.pgp',encrypted,{flag:'wx',mode:0o600});
 await privateFill(page.getByLabel('Full name',{exact:true}),'Synthetic Mitsa Gmail delivery test');await privateFill(page.getByLabel('Email',{exact:true}),credentials.sender);
 await privateFill(page.getByLabel('Password',{exact:true}),password);await privateFill(page.getByLabel('Confirm password',{exact:true}),password);await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Create account',exact:true}).click();await page.waitForURL(url=>url.pathname==='/verify-email'&&url.searchParams.get('sent')==='1',{timeout:30000});
 }
 stage='initial-resend-cooldown';
 const premature=await context.request.post(`${origin}/auth/email/code`,{headers:{origin},form:{action:'resend'},maxRedirects:0});assert(premature.headers().location?.endsWith('/verify-email?error=cooldown'));report.initialResendCooldownEnforced=true;
 stage='actual-encrypted-capture';
 if(!existing){const created=(await db.query('select id from auth.users where email=$1 and created_at>=$2',[credentials.sender,approvedAt])).rows[0];assert(created);
  writeFileSync('.secrets/pilot-relay/self-test-identity.json',JSON.stringify({project:target.projectRef,purpose:'dedicated-sender-self-test',userId:created.id,emailHash:senderHash,approvedAt:approvedAt.toISOString(),expiresAt:expiresAt.toISOString()}),{flag:'wx',mode:0o600});}
 const pending=(await db.query(`select u.id,m.encrypted_payload from auth.users u join private.registration_intents i on i.provider_user_id=u.id join private.isolated_auth_mail m on m.recipient_hash=$2 and m.action='signup' where u.email=$1 and u.email_confirmed_at is null and i.finalized_at is null and (($4::uuid is null and i.created_at>=$3) or (u.id=$4::uuid and i.id=$5::uuid)) and m.created_at>=$3 order by m.created_at desc limit 1`,[credentials.sender,senderHash,approvedAt,existing?.binding.userId??null,existing?.binding.intentId??null])).rows[0];assert(pending);
 const key=await readPrivateKey({armoredKey:readFileSync('.secrets/auth-mail/private.asc','utf8')});let mail=JSON.parse(String((await decrypt({message:await readMessage({binaryMessage:pending.encrypted_payload}),decryptionKeys:key})).data));
 assert.equal(mail.email,credentials.sender);assert.equal(mail.userId,pending.id);assert.equal(mail.type,'signup');assert.equal(mail.origin,origin);assert(/^\d{6}$/.test(mail.code));report.encryptedProviderCaptureVerified=true;
 stage='single-explicit-smtp-attempt';
 const sendOnce=()=>{
  assert(!stopRequested);
  if(finish)assert.equal(report.attempts,0);
  const delivery=invokePilotRelay(true);if(!delivery.ok){report.relayFailure=delivery.failure;throw Error('Relay stopped');}
  if(delivery.status!=='smtp-accepted')report.relayFailure={kind:'delivery-not-accepted',status:delivery.status};
  assert.equal(delivery.status,'smtp-accepted');assert.equal(delivery.smtpConnectionsAttempted,1);report.smtpAccepted=true;report.attempts++;
 };
 sendOnce();report.inboxReceipt='Awaiting user confirmation';
 stage='first-inbox-confirmation';console.log(JSON.stringify({checkpoint:'First signup message SMTP accepted; waiting for private inbox receipt confirmation',windowExpiresAt:expiresAt.toISOString(),attempts:report.attempts,privateValuesPrinted:false}));
 assert(await waitForPilotInbox(process.stdin,expiresAt.getTime()));report.inboxReceipt='User confirmed first message';
 if(finish){
  stage='compromised-code-rejection';assert.notEqual(mail.code,prior.code);report.previousCodeUnexpiredAtRejectionCheck=Date.now()-prior.issuedAt<3600000;
  const provider=createClient(target.url,operator.TEST_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const old=await provider.auth.verifyOtp({email:credentials.sender,type:'signup',token:prior.code});assert(providerCodeRejected(old));report.replacedCodeRejected=true;report.compromisedCodeNeverUsedForSuccessfulAuthentication=true;
  report.realResendSmtpAccepted=true;
 }else{
 stage='normal-browser-resend';
 const oldCode=mail.code;await submitPilotResend(page);
 const next=(await db.query("select encrypted_payload from private.isolated_auth_mail where recipient_hash=$1 and action='signup' and created_at>=$2 order by created_at desc limit 1",[senderHash,approvedAt])).rows[0];assert(next);
 mail=JSON.parse(String((await decrypt({message:await readMessage({binaryMessage:next.encrypted_payload}),decryptionKeys:key})).data));
 assert.equal(mail.email,credentials.sender);assert.equal(mail.userId,pending.id);assert.equal(mail.origin,origin);assert.equal(mail.type,'signup');assert(/^\d{6}$/.test(mail.code)&&mail.code!==oldCode);
 const provider=createClient(target.url,operator.TEST_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const old=await provider.auth.verifyOtp({email:credentials.sender,type:'signup',token:oldCode});assert(providerCodeRejected(old));report.replacedCodeRejected=true;
 stage='second-explicit-smtp-attempt';sendOnce();report.realResendSmtpAccepted=true;
 }
 stage='provider-code-verification';await privateFill(page.getByLabel('Verification code',{exact:true}),mail.code);await page.getByRole('button',{name:'Verify email',exact:true}).click();
 await page.waitForURL(url=>url.pathname==='/settings/account/security'&&url.searchParams.get('updated')==='email-verified',{timeout:30000});
 const verified=(await db.query(`select u.email_confirmed_at is not null confirmed,i.finalized_at is not null finalized,(select count(*)::int from private.memberships where user_id=u.id) memberships,(select count(*)::int from auth.mfa_factors where user_id=u.id) factors from auth.users u join private.registration_intents i on i.provider_user_id=u.id where u.id=$1`,[pending.id])).rows[0];
 assert.deepEqual(verified,{confirmed:true,finalized:true,memberships:0,factors:0});report.actualProviderCodeVerified=true;report.syntheticTermsFinalized=true;report.syntheticWorkspaceMemberships=0;
 const replayProvider=createClient(target.url,operator.TEST_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const replay=await replayProvider.auth.verifyOtp({email:credentials.sender,type:'signup',token:mail.code});assert(providerCodeRejected(replay));report.verifiedCodeReplayRejected=true;
 await context.close();stage='completed-awaiting-second-inbox-confirmation';
}catch{report.failureStage=stage;report.status='Stopped; private details suppressed. No automatic retry.';process.exitCode=1;}
finally{
 try{await closeWindow();}catch{report.closureError=true;process.exitCode=1;}
 if(browser)await browser.close().catch(()=>{});
 if(db){try{const rows=(await db.query('select state,count(*)::int n from private.pilot_mail_deliveries group by state')).rows;report.deliveryStates=rows;report.attempts=rows.reduce((n,row)=>n+row.n,0);}catch{}await db.end().catch(()=>{});}
 report.finishedAt=new Date().toISOString();writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}
