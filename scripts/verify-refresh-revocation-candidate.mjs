// Read-only hash, encrypted recovery and deployment-boundary verification.
import {readFileSync,writeFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';import {parse} from 'dotenv';import pg from 'pg';
import {decrypt,readMessage,readPrivateKey} from 'openpgp';
import {assertTestTarget} from './test-target.mjs';import {testDatabaseConfig} from './postgres-config.mjs';
const digest=value=>createHash('sha256').update(value).digest('hex');let db;
try {
 const report=JSON.parse(readFileSync('artifacts/refresh-revocation-preflight.json')),cfg=JSON.parse(readFileSync('config/test-target.json')),env=parse(readFileSync('.secrets/operator.env'));
 const target=assertTestTarget({projectRef:env.TEST_PROJECT_REF,url:env.TEST_SUPABASE_URL,databaseUrl:env.TEST_DATABASE_URL},cfg);assert.equal(target.projectRef,'mjtejwafxriwntweussc');assert.equal(report.project,target.projectRef);
 assert.equal(digest(readFileSync(report.candidate)),report.candidateSha256);
 assert.equal(digest(readFileSync('supabase/prepared/refresh-family-emergency-rollback.sql')),report.emergencyRollbackSha256);
 const encrypted=readFileSync('.secrets/refresh-revocation/catalog-baseline.pgp');assert.equal(digest(encrypted),report.encryptedBaselineSha256);
 const key=await readPrivateKey({armoredKey:readFileSync('.secrets/auth-mail/private.asc','utf8')});
 const payload=String((await decrypt({message:await readMessage({binaryMessage:encrypted}),decryptionKeys:key})).data);assert.equal(digest(payload),report.baselinePayloadSha256);
 const baseline=JSON.parse(payload);assert.equal(baseline.project,target.projectRef);assert.equal(baseline.candidateSha256,report.candidateSha256);
 db=new pg.Client(testDatabaseConfig(env.TEST_DATABASE_URL,cfg));await db.connect();await db.query('begin read only');
 assert.equal((await db.query('select marker from foundation_probe.environment_identity where singleton')).rows[0].marker,target.databaseMarker);
 const current=(await db.query("select pg_get_functiondef(oid) definition,proowner::regrole::text owner,proacl::text acl,proconfig,prosecdef from pg_proc where oid='private.current_actor()'::regprocedure")).rows[0];assert.deepEqual(current,baseline.original);
 assert.equal((await db.query("select to_regclass('private.session_revocations') is null absent")).rows[0].absent,true);
 assert.equal((await db.query("select count(*)::int n from pg_trigger where tgrelid='auth.refresh_tokens'::regclass and not tgisinternal")).rows[0].n,0);
 const closed=(await db.query('select not(enabled or smtp_enabled or private.mitsa_pilot_registration_open()) closed from private.pilot_registration_window')).rows[0].closed;assert.equal(closed,true);
 await db.query('commit');
 const result={checkedAt:new Date().toISOString(),project:target.projectRef,markerVerified:true,candidateHashVerified:true,rollbackHashVerified:true,encryptedRecoveryIntegrityAndDecryptionVerified:true,originalActorOwnerAclDefinitionUnchanged:true,remoteCandidateAbsent:true,registrationAndDeliveryClosed:true,databaseWrites:0,privateValuesPrinted:false};
 writeFileSync('artifacts/refresh-revocation-approval-recheck.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}catch{try{await db?.query('rollback');}catch{}console.error('Refresh candidate verification stopped; private details suppressed. No remote changes.');process.exitCode=1;}finally{await db?.end();}
