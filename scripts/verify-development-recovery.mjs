// Read-only verification of the exact approved candidate and encrypted rollback.
import {readFileSync,writeFileSync} from 'node:fs';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {parse} from 'dotenv';import pg from 'pg';import {readPrivateKey,readMessage,decrypt} from 'openpgp';
import {assertTestTarget} from './test-target.mjs';import {testDatabaseConfig} from './postgres-config.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const reviewed='b6ea3b2c922ed2f9fd88fe518839ce49e3c0d6f5b9c04bdf13f16958f9918822';
const postflight=process.argv.includes('--postflight');let db;
try {
 const manifest=JSON.parse(readFileSync('artifacts/development-recovery-preflight.json')),config=JSON.parse(readFileSync('config/test-target.json')),env=parse(readFileSync('.secrets/operator.env'));
 const target=assertTestTarget({projectRef:env.TEST_PROJECT_REF,url:env.TEST_SUPABASE_URL,databaseUrl:env.TEST_DATABASE_URL},config);assert.equal(target.projectRef,'mjtejwafxriwntweussc');
 assert.equal(manifest.project,target.projectRef);assert.equal(manifest.candidateSha256,reviewed);assert.equal(hash(readFileSync(manifest.candidate)),reviewed);
 const binary=readFileSync('.secrets/isolated-registration/recovery-baseline.pgp');assert.equal(hash(binary),manifest.baselineSha256);
 const key=await readPrivateKey({armoredKey:readFileSync('.secrets/auth-mail/private.asc','utf8')}),payload=String((await decrypt({message:await readMessage({binaryMessage:binary}),decryptionKeys:key})).data);
 assert.equal(hash(payload),manifest.payloadSha256);const baseline=JSON.parse(payload);assert.equal(baseline.project,target.projectRef);
 db=new pg.Client(testDatabaseConfig(env.TEST_DATABASE_URL,config));await db.connect();await db.query('begin isolation level repeatable read read only');
 assert.equal((await db.query('select marker from foundation_probe.environment_identity where singleton')).rows[0]?.marker,target.databaseMarker);
 const state=(await db.query('select enabled,smtp_enabled,private.mitsa_pilot_registration_open() open from private.pilot_registration_window')).rows[0];assert.equal(state.enabled,false);assert.equal(state.smtp_enabled,false);assert.equal(state.open,false);
 const gates=(await db.query('select * from private.release_gates where singleton')).rows[0];assert(['registration_enabled','external_mail_enabled','eligibility_approved','legal_publication_enabled','disposal_enabled'].every(k=>gates[k]===false));
 for(const original of baseline.functions){
  const current=(await db.query('select oid::regprocedure::text signature,pg_get_functiondef(oid) definition,proowner::regrole::text owner,proacl::text acl,prosecdef,proconfig from pg_proc where oid=$1::regprocedure',[original.signature])).rows[0];
  let expected=original.definition;
  if(postflight&&original.signature==='private.mitsa_isolated_send_email(jsonb)'){
   const guard="not (private.mitsa_test_recipient_allowed(recipient) or (event->'email_data'->>'email_action_type'='signup' and private.mitsa_pilot_registration_open()))";
   assert(expected.includes(guard));expected=expected.replace(guard,"not (private.mitsa_test_recipient_allowed(recipient) or (event->'email_data'->>'email_action_type'='signup' and private.mitsa_pilot_registration_open()) or (event->'email_data'->>'email_action_type'='recovery' and private.mitsa_development_recovery_allowed(uid,recipient)))");
  }
  assert.deepEqual(current,{...original,definition:expected});
 }
 const helper=(await db.query("select prosecdef,proconfig from pg_proc where oid=to_regprocedure('private.mitsa_development_recovery_allowed(uuid,text)')")).rows;
 assert.equal(helper.length,postflight?1:0);
 if(postflight){
  assert.equal(helper[0].prosecdef,false);assert(helper[0].proconfig.includes('row_security=on'));assert(helper[0].proconfig.includes('search_path=""'));
  for(const role of ['anon','authenticated','service_role','app_workspace','supabase_auth_admin'])assert.equal((await db.query("select has_function_privilege($1,'private.mitsa_development_recovery_allowed(uuid,text)','EXECUTE') allowed",[role])).rows[0].allowed,role==='supabase_auth_admin');
  assert.equal((await db.query("select private.mitsa_development_recovery_allowed(gen_random_uuid(),'synthetic-unknown@example.invalid') allowed")).rows[0].allowed,false);
 }
 await db.query('commit');
 const report={checkedAt:new Date().toISOString(),project:target.projectRef,markerVerified:true,reviewedHashVerified:true,rollbackSnapshotIntegrityAndDecryptionVerified:true,
  unchangedOriginalSignupFunctions:true,hookOwnerAndAclPreserved:true,exactCapturePredicateVerified:postflight,helperPresent:postflight,helperInvokerAndScopedGrantsVerified:postflight,
  pilotAndDeliveryClosed:true,productionGatesClosed:true,databaseWrites:0,privateValuesPrinted:false};
 writeFileSync(`artifacts/development-recovery-${postflight?'postflight':'approval-recheck'}.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch{try{await db?.query('rollback');}catch{}console.error('Recovery verification failed; private details suppressed. No remote writes.');process.exitCode=1;}finally{await db?.end();}
