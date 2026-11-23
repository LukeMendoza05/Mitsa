// Prepare the authorized fresh sender +alias privately. No account creation,
// allowlist change, SMTP connection or activation. Existing file is preserved.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';import {randomBytes} from 'node:crypto';import assert from 'node:assert/strict';
import {parse} from 'dotenv';import pg from 'pg';import {readProtectedGmailCredentials} from './lib/gmail-credentials.mjs';
import {assertTestTarget} from './test-target.mjs';import {testDatabaseConfig} from './postgres-config.mjs';
let db;
try {
 const targetConfig=JSON.parse(readFileSync('config/test-target.json')),env=parse(readFileSync('.secrets/operator.env'));
 const target=assertTestTarget({projectRef:env.TEST_PROJECT_REF,url:env.TEST_SUPABASE_URL,databaseUrl:env.TEST_DATABASE_URL},targetConfig);assert.equal(target.projectRef,'mjtejwafxriwntweussc');
 const file='.secrets/onboarding-recipient.json',credentials=readProtectedGmailCredentials();assert(credentials.sender.endsWith('@gmail.com'));
 const email=existsSync(file)?JSON.parse(readFileSync(file)).email:`${credentials.sender.split('@')[0].split('+')[0]}+onboarding-${randomBytes(6).toString('hex')}@gmail.com`;
 assert(typeof email==='string'&&email.endsWith('@gmail.com')&&email.split('@')[0].split('+')[0]===credentials.sender.split('@')[0].split('+')[0]);
 db=new pg.Client(testDatabaseConfig(env.TEST_DATABASE_URL,targetConfig));await db.connect();
 assert.equal((await db.query('select marker from foundation_probe.environment_identity where singleton')).rows[0]?.marker,target.databaseMarker);
 assert.equal((await db.query('select count(*)::int n from auth.users where email=$1',[email])).rows[0].n,0);
 assert.equal((await db.query('select private.mitsa_test_recipient_allowed($1) allowed',[email])).rows[0].allowed,false);
 if(!existsSync(file))writeFileSync(file,JSON.stringify({email})+'\n',{mode:0o600,flag:'wx'});
 console.log(JSON.stringify({project:target.projectRef,freshSenderAliasSavedPrivately:true,accountExists:false,developerAllowlisted:false,databaseWrites:0,smtpConnections:0,privateValuesPrinted:false}));
}catch{console.error('Controlled recipient preparation stopped; private details suppressed. No remote changes.');process.exitCode=1;}finally{await db?.end();}
