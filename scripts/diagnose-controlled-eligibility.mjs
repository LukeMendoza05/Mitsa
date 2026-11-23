// Read-only eligibility checks and a deliberately CAPTCHA-less form probe.
// No intent, account or email can be created by this probe.
import {readFileSync,writeFileSync} from 'node:fs';
import {parse} from 'dotenv';import pg from 'pg';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {testDatabaseConfig} from './postgres-config.mjs';import {recipientHash} from './lib/development-mail.mjs';
let db,stage='configuration';
try {
 const e=parse(readFileSync('.env.local')),o=parse(readFileSync('.secrets/operator.env')),cfg=JSON.parse(readFileSync('config/test-target.json'));
 assert.equal(cfg.projectRef,'mjtejwafxriwntweussc');assert.equal(e.APP_ORIGIN,'http://127.0.0.1:3000');
 const email=JSON.parse(readFileSync('.secrets/onboarding-recipient.json')).email.trim().toLowerCase(),runtime=JSON.parse(readFileSync('.secrets/isolated-registration/runtime.json'));
 assert.equal(recipientHash(email),runtime.recipientHash);
 stage='database';db=new pg.Client(testDatabaseConfig(o.TEST_DATABASE_URL,cfg));await db.connect();await db.query('begin read only');
 assert.equal((await db.query('select marker from foundation_probe.environment_identity where singleton')).rows[0].marker,cfg.databaseMarker);
 const accounts=(await db.query('select count(*)::int n from auth.users where email=$1',[email])).rows[0].n;
 const intents=(await db.query('select count(*)::int n from private.registration_intents where email=$1',[email])).rows[0].n;
 await db.query('set local role app_workspace');
 const policy=(await db.query('select private.mitsa_registration_policy() p')).rows[0].p;
 const allowed=(await db.query('select private.mitsa_pilot_registration_open() open')).rows[0].open;
 await db.query('rollback');stage='form';
 const password='Synthetic!'+randomUUID();
 const r=await fetch(e.APP_ORIGIN+'/auth/register',{method:'POST',headers:{origin:e.APP_ORIGIN,'x-mitsa-form':'1'},body:new URLSearchParams({email,fullName:'Synthetic eligibility probe',password,confirmPassword:password,accepted:'on',termsVersion:policy.id}),redirect:'manual',signal:AbortSignal.timeout(15000)});
 const b=await r.json();
 const report={checkedAt:new Date().toISOString(),project:cfg.projectRef,aliasMatchesRuntime:true,accounts,intents,intentRoleWindowOpen:allowed,policyWindowOpen:policy.pilotRegistration===true,approvedAliasProbeStatus:r.status,approvedAliasProbeCode:b.error?.code,approvedAliasPassesAppEligibility:r.status===403&&b.error?.code==='challenge',accountsCreated:0,emailsRequested:0,privateValuesPrinted:false};
 writeFileSync('artifacts/controlled-eligibility-diagnostic.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch(e){console.error(JSON.stringify({stage,code:/^[A-Z0-9]{5}$/.test(e.code??'')?e.code:e.name,privateDetailsSuppressed:true}));process.exitCode=1;}finally{await db?.end();}
