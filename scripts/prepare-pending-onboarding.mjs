// Read-only preparation. Does not reopen a lease or send/resend any message.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';import assert from 'node:assert/strict';import {parse} from 'dotenv';import pg from 'pg';
import {assertTestTarget} from './test-target.mjs';import {testDatabaseConfig} from './postgres-config.mjs';import {recipientHash} from './lib/development-mail.mjs';import {pendingOnboardingBinding} from './lib/pending-onboarding.mjs';
let db;
try {
 const cfg=JSON.parse(readFileSync('config/test-target.json')),e=parse(readFileSync('.secrets/operator.env')),runtime=JSON.parse(readFileSync('.secrets/isolated-registration/runtime.json'));
 const target=assertTestTarget({projectRef:e.TEST_PROJECT_REF,url:e.TEST_SUPABASE_URL,databaseUrl:e.TEST_DATABASE_URL},cfg);assert.equal(target.projectRef,'mjtejwafxriwntweussc');assert.equal(runtime.phase,'controlled');
 const email=JSON.parse(readFileSync('.secrets/onboarding-recipient.json')).email.trim().toLowerCase(),hash=recipientHash(email);assert.equal(hash,runtime.recipientHash);
 db=new pg.Client(testDatabaseConfig(e.TEST_DATABASE_URL,cfg));await db.connect();await db.query('begin isolation level repeatable read read only');assert.equal((await db.query('select marker from foundation_probe.environment_identity where singleton')).rows[0].marker,target.databaseMarker);
 assert.equal((await db.query('select private.mitsa_pilot_registration_open() open')).rows[0].open,false);
 const file='.secrets/isolated-registration/pending-onboarding.json',prior=existsSync(file)?JSON.parse(readFileSync(file)):null;
 if(prior)assert.equal(prior.project,target.projectRef);
 const binding=await pendingOnboardingBinding(db,email,prior);
 const claims=(await db.query('select count(*)::int n from private.pilot_mail_deliveries where recipient_hash=$1',[hash])).rows[0].n;assert.equal(claims,0);
 await db.query('commit');if(!prior)writeFileSync(file,JSON.stringify({version:1,project:target.projectRef,purpose:'existing-pending-onboarding-only',...binding,originalApprovedAt:runtime.approvedAt,originalExpiresAt:runtime.expiresAt,preparedAt:new Date().toISOString()})+'\n',{flag:'wx',mode:0o600});
 console.log(JSON.stringify({project:target.projectRef,pendingIdentityBoundPrivately:true,accountUnverified:true,originalIntentRetained:true,noMfaOrMemberships:true,priorSmtpClaims:0,windowReopened:false,emailsSent:0,remoteChanges:0,privateValuesPrinted:false}));
}catch{try{await db?.query('rollback');}catch{}console.error('Pending onboarding preparation stopped; private details suppressed. No remote changes.');process.exitCode=1;}finally{await db?.end();}
