// Approved synthetic negative verification only. No email, signup, role or
// existing developer action. Captured codes stay solely in private memory.
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {parse} from 'dotenv';
import {createHash} from 'node:crypto';
import pg from 'pg';
import {createClient} from '@supabase/supabase-js';
import {readPrivateKey,readMessage,decrypt} from 'openpgp';
import {assertTestTarget} from './test-target.mjs';
import {testDatabaseConfig} from './postgres-config.mjs';
import {providerCodeRejected} from './lib/provider-code-rejection.mjs';
const config=JSON.parse(readFileSync('config/test-target.json','utf8')),env=parse(readFileSync('.secrets/operator.env'));
const target=assertTestTarget({projectRef:env.TEST_PROJECT_REF,url:env.TEST_SUPABASE_URL,databaseUrl:env.TEST_DATABASE_URL},config),db=new pg.Client(testDatabaseConfig(env.TEST_DATABASE_URL,config));
try{
 const identity=JSON.parse(readFileSync('.secrets/pilot-relay/self-test-identity.json','utf8')),run=JSON.parse(readFileSync('artifacts/controlled-gmail-test-results.json','utf8'));
 assert.equal(run.scope,'dedicated-sender-self-test-finish');assert.equal(run.actualProviderCodeVerified,true);assert.equal(run.windowClosed,true);assert.equal(run.attempts,2);assert.equal(identity.project,target.projectRef);
 assert.notEqual(identity.userId,JSON.parse(readFileSync('.secrets/developer-reset/manifest.json','utf8')).userId);
 await db.connect();assert.equal((await db.query('select marker from foundation_probe.environment_identity where singleton')).rows[0].marker,target.databaseMarker);
 const account=(await db.query(`select u.email from auth.users u join private.registration_intents i on i.provider_user_id=u.id where u.id=$1
  and u.email_confirmed_at is not null and i.finalized_at is not null and u.raw_user_meta_data->>'full_name'='Synthetic Mitsa Gmail delivery test'
  and not exists(select 1 from private.memberships where user_id=u.id) and not exists(select 1 from auth.mfa_factors where user_id=u.id)`,[identity.userId])).rows;
 assert.equal(account.length,1);const email=account[0].email;assert.equal(createHash('sha256').update(email).digest('hex'),identity.emailHash);
 assert.deepEqual((await db.query('select enabled,smtp_enabled from private.pilot_registration_window where singleton')).rows[0],{enabled:false,smtp_enabled:false});
 const captures=(await db.query(`select m.encrypted_payload,m.created_at from private.pilot_mail_deliveries d join private.isolated_auth_mail m on m.id=d.capture_id
  where d.recipient_hash=$1 and d.state='smtp-accepted' and m.action='signup' order by m.created_at`,[identity.emailHash])).rows;assert.equal(captures.length,2);
 const key=await readPrivateKey({armoredKey:readFileSync('.secrets/auth-mail/private.asc','utf8')}),provider=createClient(target.url,env.TEST_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}),evidence=[];
 for(const [index,capture] of captures.entries()){
  const mail=JSON.parse(String((await decrypt({message:await readMessage({binaryMessage:capture.encrypted_payload}),decryptionKeys:key})).data));
  assert.equal(mail.email,email);assert.equal(mail.userId,identity.userId);assert.equal(mail.type,'signup');assert(/^\d{6}$/.test(mail.code));
  const result=await provider.auth.verifyOtp({email,type:'signup',token:mail.code});
  if(result.data?.session){await provider.auth.signOut({scope:'local'});throw Error('Unexpected synthetic authentication');}
  assert(providerCodeRejected(result));
  evidence.push({kind:index===0?'previous-exposed-code':'fresh-code-replay',providerErrorCode:'otp_expired',providerStatus:403,insideOriginalLifetime:Date.now()-capture.created_at.getTime()<3600000,noSession:true});
 }
 const report={checkedAt:new Date().toISOString(),project:target.projectRef,markerVerified:true,exactVerifiedSyntheticIdentity:true,providerRejections:evidence,smtpAttempts:0,newAccounts:0,developerActions:0,privateValuesPrinted:false};
 writeFileSync('artifacts/controlled-gmail-code-rejections.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch{console.error('Synthetic negative-code verification stopped; private details suppressed');process.exitCode=1;}finally{await db.end();}
