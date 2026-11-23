// Read-only, tightly scoped progress audit. Never emits identities, workspace
// names/IDs, passwords, provider hashes, OTPs, factor IDs or MFA secrets.
import {readFileSync,writeFileSync} from 'node:fs';import assert from 'node:assert/strict';import {parse} from 'dotenv';import pg from 'pg';
import {readPrivateKey,readMessage,decrypt} from 'openpgp';import {assertTestTarget} from './test-target.mjs';import {testDatabaseConfig} from './postgres-config.mjs';import {recipientHash} from './lib/development-mail.mjs';
let db;
try {
 const config=JSON.parse(readFileSync('config/test-target.json')),env=parse(readFileSync('.secrets/operator.env')),runtime=JSON.parse(readFileSync('.secrets/isolated-registration/runtime.json'));
 const target=assertTestTarget({projectRef:env.TEST_PROJECT_REF,url:env.TEST_SUPABASE_URL,databaseUrl:env.TEST_DATABASE_URL},config);assert.equal(target.projectRef,'mjtejwafxriwntweussc');assert.equal(runtime.phase,'controlled');assert.equal(runtime.project,target.projectRef);
 const email=JSON.parse(readFileSync('.secrets/onboarding-recipient.json')).email.trim().toLowerCase(),hash=recipientHash(email);assert.equal(hash,runtime.recipientHash);
 db=new pg.Client(testDatabaseConfig(env.TEST_DATABASE_URL,config));await db.connect();await db.query('begin isolation level repeatable read read only');assert.equal((await db.query('select marker from foundation_probe.environment_identity where singleton')).rows[0]?.marker,target.databaseMarker);
 const users=(await db.query('select id,email_confirmed_at,last_sign_in_at,deleted_at from auth.users where email=$1',[email])).rows;assert(users.length<=1);const user=users[0];
 assert.equal((await db.query('select private.mitsa_test_recipient_allowed($1) allowed',[email])).rows[0].allowed,false);
 const intent=user?(await db.query('select count(*)::int total,count(*) filter(where finalized_at is not null)::int finalized from private.registration_intents where provider_user_id=$1 and email=$2',[user.id,email])).rows[0]:{total:0,finalized:0};
 const acceptances=user?(await db.query("select count(*)::int n from private.legal_acceptances where user_id=$1 and source='registration'",[user.id])).rows[0].n:0;
 const factors=user?(await db.query("select count(*)::int n from auth.mfa_factors where user_id=$1 and status='verified'",[user.id])).rows[0].n:0;
 const bindings=user?(await db.query("select count(*)::int n,max(b.bound_at) latest from private.factor_bindings b join private.account_security s on s.user_id=b.user_id and s.generation=b.generation join auth.mfa_factors f on f.id=b.factor_id and f.user_id=b.user_id where b.user_id=$1 and b.revoked_at is null and f.status='verified'",[user.id])).rows[0]:{n:0,latest:null};
 const workspaces=user?(await db.query("select b.id,b.primary_owner_id,(select count(*)::int from private.memberships other where other.business_id=b.id and other.active and other.role='owner') owners,(select count(*)::int from private.shops l where l.business_id=b.id and l.active) locations from private.memberships m join private.businesses b on b.id=m.business_id where m.user_id=$1 and m.active and m.role='owner' and b.status='active'",[user.id])).rows:[];
 const captures=(await db.query("select action,count(*)::int n from private.isolated_auth_mail where recipient_hash=$1 and created_at>=$2 group by action",[hash,runtime.approvedAt])).rows;
 const deliveries=(await db.query('select state,count(*)::int n from private.pilot_mail_deliveries where recipient_hash=$1 and created_at>=$2 group by state',[hash,runtime.approvedAt])).rows;
 const latest=(await db.query("select encrypted_payload from private.isolated_auth_mail where recipient_hash=$1 and action='signup' and created_at>=$2 order by created_at desc limit 1",[hash,runtime.approvedAt])).rows[0];
 let numericCodeLength=null,privateCaptureBindingVerified=false;
 if(latest){
  const key=await readPrivateKey({armoredKey:readFileSync('.secrets/auth-mail/private.asc','utf8')}),mail=JSON.parse(String((await decrypt({message:await readMessage({binaryMessage:latest.encrypted_payload}),decryptionKeys:key})).data));
  assert.equal(mail.email,email);assert.equal(mail.userId,user?.id);assert.equal(mail.type,'signup');assert.equal(mail.origin,runtime.origin);assert.match(mail.code,/^[0-9]{6}$/);
  numericCodeLength=mail.code.length;privateCaptureBindingVerified=true;
 }
 const window=(await db.query('select private.mitsa_pilot_registration_open() open,enabled,smtp_enabled from private.pilot_registration_window')).rows[0];
 await db.query('commit');
 const attempts=deliveries.reduce((n,row)=>n+row.n,0);assert(attempts<=4);
 const report={checkedAt:new Date().toISOString(),project:target.projectRef,phase:'controlled',windowOpen:window.open,windowClosesAt:runtime.expiresAt,
  freshAliasDeveloperAllowlisted:false,accountExists:Boolean(user),emailVerified:Boolean(user?.email_confirmed_at),accountActive:Boolean(user&&!user.deleted_at),boundSignedIntents:Number(intent.total),finalizedIntents:Number(intent.finalized),registrationConsentCount:acceptances,
  signupCaptures:captures.find(row=>row.action==='signup')?.n??0,recoveryCaptures:captures.find(row=>row.action==='recovery')?.n??0,numericCodeLength,privateCaptureBindingVerified,
  smtpAttemptClaims:attempts,smtpAcceptedMessages:deliveries.find(row=>row.state==='smtp-accepted')?.n??0,inboxReceiptMustBeConfirmedByUser:true,
  verifiedMfaFactors:factors,trustedMfaBindings:Number(bindings.n),activeOwnedWorkspaces:workspaces.length,ownerInvariantsHold:workspaces.length>0&&workspaces.every(row=>row.owners===1&&row.primary_owner_id===user.id),initialActiveLocations:workspaces.reduce((n,row)=>n+row.locations,0),
  signInAfterEnrollmentObserved:Boolean(bindings.latest&&user.last_sign_in_at&&new Date(user.last_sign_in_at)>new Date(bindings.latest)),
  logoutAndReturningJourneyStillRequiresUserConfirmation:true,remoteChanges:0,privateValuesPrinted:false};
 writeFileSync('artifacts/controlled-onboarding-progress.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch{try{await db?.query('rollback');}catch{}console.error('Controlled onboarding inspection stopped; private details suppressed. No remote changes.');process.exitCode=1;}finally{await db?.end();}
