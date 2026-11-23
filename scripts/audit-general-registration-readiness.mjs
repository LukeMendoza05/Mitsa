// Read-only investigation: no intent, signup, SMTP, session refresh or activation.
// Report only bounded flags, schema definitions' hashes and aggregate counts.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {parse} from 'dotenv';
import pg from 'pg';
import {assertTestTarget} from './test-target.mjs';
import {testDatabaseConfig} from './postgres-config.mjs';
const json=path=>JSON.parse(readFileSync(path,'utf8'));
let db;
try {
 const approved=json('config/test-target.json'),env=parse(readFileSync('.env.local')),operator=parse(readFileSync('.secrets/operator.env'));
 const target=assertTestTarget({projectRef:operator.TEST_PROJECT_REF,url:operator.TEST_SUPABASE_URL,databaseUrl:operator.TEST_DATABASE_URL},approved);
 assert.equal(target.projectRef,'mjtejwafxriwntweussc');assert.equal(env.SUPABASE_URL,target.url);assert.equal(env.APP_ORIGIN,'http://127.0.0.1:3000');
 db=new pg.Client({...testDatabaseConfig(operator.TEST_DATABASE_URL,approved),statement_timeout:15000});await db.connect();await db.query('begin read only');
 assert.equal((await db.query('select marker from foundation_probe.environment_identity where singleton')).rows[0].marker,target.databaseMarker);
 const gates=(await db.query('select registration_enabled,external_mail_enabled,eligibility_approved,legal_publication_enabled,disposal_enabled from private.release_gates where singleton')).rows[0];
 const lease=(await db.query('select enabled,smtp_enabled,expires_at<=statement_timestamp() expired,private.mitsa_pilot_registration_open() open from private.pilot_registration_window where singleton')).rows[0];
 await db.query('set local role app_workspace');const policy=(await db.query('select private.mitsa_registration_policy() value')).rows[0].value;await db.query('reset role');
 const names=['current_actor','mitsa_registration_policy','mitsa_registration_intent','mitsa_signed_registration_intent','mitsa_before_user_created','mitsa_isolated_send_email','mitsa_development_recovery_allowed','mitsa_pilot_registration_open','mitsa_finalize_registration','mitsa_create_workspace'];
 const functions=(await db.query("select p.proname name,p.prosecdef definer,p.proconfig config,pg_get_userbyid(p.proowner) owner,pg_get_functiondef(p.oid) definition,has_function_privilege('anon',p.oid,'EXECUTE') anon_execute,has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execute from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname=any($1)",[names])).rows.map(f=>({name:f.name,owner:f.owner,definer:f.definer,config:f.config,anonExecute:f.anon_execute,authenticatedExecute:f.authenticated_execute,sha256:createHash('sha256').update(f.definition).digest('hex'),pilotDependent:f.definition.includes('mitsa_pilot_registration_open'),checksSessionTable:f.definition.includes('auth.sessions'),checksNotAfter:f.definition.includes('not_after'),checksRefreshTable:f.definition.includes('auth.refresh_tokens'),encryptedCapture:f.definition.includes('pgp_pub_encrypt')}));
 assert.equal(functions.length,names.length,'Expected registration/security function missing');
 const tables=(await db.query("select c.relname name,c.relrowsecurity rls,c.relforcerowsecurity forced,has_table_privilege('anon',c.oid,'SELECT') anon_select,has_table_privilege('authenticated',c.oid,'SELECT') authenticated_select from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relkind='r' and c.relname in ('pilot_registration_window','pilot_mail_deliveries','registration_intents','isolated_auth_mail','memberships','businesses','shops') order by c.relname")).rows;
 assert.equal(tables.length,7,'Expected registration/tenant table missing');
 const mail=(await db.query("select count(*)::int total,count(*) filter(where created_at>statement_timestamp()-interval '1 hour')::int hourly,count(*) filter(where created_at>statement_timestamp()-interval '24 hours')::int daily,count(*) filter(where state='smtp-accepted')::int smtp_accepted,count(*) filter(where state='unconfirmed')::int unconfirmed from private.pilot_mail_deliveries")).rows[0];
 const triggerCount=(await db.query("select count(*)::int n from pg_trigger where tgrelid='auth.refresh_tokens'::regclass and not tgisinternal")).rows[0].n;
 const capture=(await db.query('select enabled,public_key is not null encryption_configured from private.isolated_mail_config where singleton')).rows[0];
 await db.query('commit');
 const responses=await Promise.all(['/auth/v1/settings','/auth/v1/health'].map(path=>fetch(target.url+path,{headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY},signal:AbortSignal.timeout(10000)})));
 assert(responses.every(r=>r.ok));const [settings,health]=await Promise.all(responses.map(r=>r.json()));
 const runtime=existsSync('.secrets/isolated-registration/runtime.json')?json('.secrets/isolated-registration/runtime.json'):null,status=existsSync('.secrets/isolated-registration/status.json')?json('.secrets/isolated-registration/status.json'):null;
 const security=json('artifacts/isolated-registration-security.json'),onboarding=json('artifacts/controlled-onboarding-results.json');
 const mode=['disabled','isolated-test','controlled-pilot','development-open','public'].includes(env.MITSA_REGISTRATION_MODE)?env.MITSA_REGISTRATION_MODE:'unknown';
 const localPage=await fetch(env.APP_ORIGIN+'/signup',{signal:AbortSignal.timeout(15000)}).catch(()=>null);
 const html=localPage?await localPage.text():'';
 const evidenceFiles=['artifacts/controlled-onboarding-results.json','artifacts/isolated-registration-security.json','artifacts/controlled-registration-boundary-results.json','artifacts/refresh-reuse-inside-post-revocation-interval.json','artifacts/refresh-reuse-after-post-revocation-interval.json','artifacts/refresh-revocation-alternatives.json','artifacts/recovery-security-desktop.json','artifacts/recovery-security-mobile.json'];
 const result={checkedAt:new Date().toISOString(),project:target.projectRef,markerVerified:true,readOnly:true,localMode:mode,loopbackOrigin:true,
  credentials:{intentSigningKeyConfigured:/^[a-f0-9]{64}$/i.test(env.MITSA_REGISTRATION_INTENT_KEY??''),turnstileSiteKeyConfigured:Boolean(env.MITSA_TURNSTILE_SITE_KEY),turnstileSecretConfigured:Boolean(env.MITSA_TURNSTILE_SECRET_KEY),authFlowKeyConfigured:Boolean(env.AUTH_FLOW_KEY)},
  provider:{signupEnabled:settings.disable_signup===false,emailConfirmationRequired:settings.mailer_autoconfirm===false,anonymousSignupDisabled:settings.external?.anonymous_users===false,version:/^v?\d+\.\d+\.\d+$/.test(health.version??'')?health.version:'unavailable',hookPointersReadable:false,globalCaptchaSettingReadable:false,jwtLifetimeReadable:false},
  gates,lease,policy:{status:policy?.status,publicRegistration:policy?.publicRegistration,pilotRegistration:policy?.pilotRegistration},capture,
  runtime:{present:Boolean(runtime),expired:runtime?Date.parse(runtime.expiresAt)<=Date.now():null,heartbeatFresh:Boolean(status&&Date.now()-Date.parse(status.checkedAt)<=15000),deliveryReady:status?.deliveryReady===true,capacityAvailable:status?.capacityAvailable===true},
  generalEvidence:{...Object.fromEntries(['sessionSpecificLogoutPassed','rotatedRefreshReplayProtected','authenticatedTenantIsolationPassed','generalRegistrationSecuritySignoffPassed'].map(k=>[k,security[k]===true])),onboardingMissing:['captcha','realInboxReceipt','emailVerification','resend','mfa','workspaceOwner','initialLocation','signOut','returningSignIn','workspacePersistence','tenantIsolation','recovery'].filter(k=>onboarding[k]!==true)},
  functions,tables,mail,managedRefreshTriggers:triggerCount,
  signupPage:{reachable:localPage?.ok===true,status:localPage?.status??null,fieldsetDisabled:localPage?/<fieldset[^>]*disabled/.test(html):null,closedMessage:localPage?html.includes('New account registration is currently closed'):null},
  evidenceFiles:evidenceFiles.map(path=>({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')})),
  limitations:['Public Auth settings do not expose hook pointers, global CAPTCHA, provider rate limits or JWT lifetime.','Function hashes and table ACL/RLS metadata are not a fresh authenticated tenant attack test.','Historical onboarding and refresh-reuse records were inspected, not rerun.'],
  accountsCreated:0,emailsRequested:0,smtpConnections:0,databaseWrites:0,privateValuesPrinted:false};
 writeFileSync('artifacts/general-registration-readiness-audit.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}catch{try{await db?.query('rollback');}catch{}console.error('Read-only readiness audit failed; private details suppressed. No activation or mail.');process.exitCode=1;}finally{await db?.end();}
