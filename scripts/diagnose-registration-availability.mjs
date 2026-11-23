// Read-only diagnosis. Never creates an intent/account, opens a lease or sends mail.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {parse} from 'dotenv';import pg from 'pg';import assert from 'node:assert/strict';
import {assertTestTarget} from './test-target.mjs';import {testDatabaseConfig} from './postgres-config.mjs';
let db;
try {
 const cfg=JSON.parse(readFileSync('config/test-target.json')),env=parse(readFileSync('.env.local')),op=parse(readFileSync('.secrets/operator.env'));
 const target=assertTestTarget({projectRef:op.TEST_PROJECT_REF,url:op.TEST_SUPABASE_URL,databaseUrl:op.TEST_DATABASE_URL},cfg);
 assert.equal(target.projectRef,'mjtejwafxriwntweussc');assert.equal(env.SUPABASE_URL,target.url);assert.equal(env.APP_ORIGIN,'http://127.0.0.1:3000');
 db=new pg.Client(testDatabaseConfig(op.TEST_DATABASE_URL,cfg));await db.connect();await db.query('begin read only');assert.equal((await db.query('select marker from foundation_probe.environment_identity where singleton')).rows[0].marker,target.databaseMarker);
 const lease=(await db.query('select enabled,smtp_enabled,expires_at,private.mitsa_pilot_registration_open() open from private.pilot_registration_window where singleton')).rows[0];
 const gates=(await db.query('select registration_enabled,external_mail_enabled,legal_publication_enabled,eligibility_approved,disposal_enabled from private.release_gates where singleton')).rows[0];
 await db.query('set local role app_workspace');const policy=(await db.query('select private.mitsa_registration_policy() value')).rows[0].value;await db.query('reset role');
 const rejectedTriggerAbsent=(await db.query("select count(*)::int n from pg_trigger where tgrelid='auth.refresh_tokens'::regclass and not tgisinternal")).rows[0].n===0;
 await db.query('commit');
 const provider=await fetch(`${target.url}/auth/v1/settings`,{headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY},signal:AbortSignal.timeout(10000)}),settings=await provider.json();assert.equal(provider.status,200);
 const local=await fetch(`${env.APP_ORIGIN}/signup`,{signal:AbortSignal.timeout(15000)}),html=await local.text();
 let runtime=null,status=null;try{runtime=JSON.parse(readFileSync('.secrets/isolated-registration/runtime.json'));status=JSON.parse(readFileSync('.secrets/isolated-registration/status.json'));}catch{}
 const security=JSON.parse(readFileSync('artifacts/isolated-registration-security.json'));
 const result={checkedAt:new Date().toISOString(),project:target.projectRef,markerVerified:true,
  localMode:['disabled','isolated-test','controlled-pilot','development-open','public'].includes(env.MITSA_REGISTRATION_MODE)?env.MITSA_REGISTRATION_MODE:'unrecognized',loopbackOrigin:true,
  signedIntentKeyConfigured:/^[a-f0-9]{64}$/i.test(env.MITSA_REGISTRATION_INTENT_KEY??''),turnstileSiteKeyConfigured:Boolean(env.MITSA_TURNSTILE_SITE_KEY),turnstileSecretConfigured:Boolean(env.MITSA_TURNSTILE_SECRET_KEY),
  databasePolicyAvailable:Boolean(policy),agreementIsTest:policy?.status==='test',databasePublicRegistration:policy?.publicRegistration===true,databasePilotRegistration:policy?.pilotRegistration===true,
  leaseEnabled:lease.enabled===true,smtpEnabled:lease.smtp_enabled===true,leaseOpen:lease.open===true,leaseExpired:!lease.expires_at||new Date(lease.expires_at).getTime()<=Date.now(),
  runtimeFilePresent:existsSync('.secrets/isolated-registration/runtime.json'),runtimeExpired:runtime?Date.parse(runtime.expiresAt)<=Date.now():null,heartbeatFresh:status?Date.now()-Date.parse(status.checkedAt)<=15000:false,
  providerSignupEnabled:settings.disable_signup===false,providerEmailConfirmationRequired:settings.mailer_autoconfirm===false,anonymousSignupDisabled:settings.external?.anonymous_users===false,
  releaseGatesClosed:Object.values(gates).every(v=>v===false),refreshReuseProtectionPassed:security.rotatedRefreshReplayProtected===true,generalSecuritySignoffPassed:security.generalRegistrationSecuritySignoffPassed===true,
  signupGetStatus:local.status,signupShowsGenericUnavailable:html.includes('The current account setup could not be verified'),signupFieldsetDisabled:/<fieldset[^>]*disabled/.test(html),rejectedTriggerAbsent,
  authHookPointersRead:false,authHookPointerScope:'Provider public settings do not expose hook pointers; use scoped rejection tests and existing reviewed configuration evidence.',accountsCreated:0,emailsRequested:0,databaseWrites:0,privateValuesPrinted:false};
 writeFileSync('artifacts/registration-availability-diagnosis.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}catch {try{await db?.query('rollback');}catch{}console.error('Registration read-only diagnosis failed; private details suppressed. No activation or mail.');process.exitCode=1;}finally{await db?.end();}
