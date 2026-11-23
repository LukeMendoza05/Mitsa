// Read-only database audit + encrypted local rollback snapshot. Never applies
// the candidate, changes a setting, opens signup, creates an account or mails.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {parse} from 'dotenv';import pg from 'pg';
import {readKey,createMessage,encrypt,readPrivateKey,readMessage,decrypt} from 'openpgp';
import {assertTestTarget} from './test-target.mjs';import {testDatabaseConfig} from './postgres-config.mjs';
const candidate='supabase/prepared/20261015052446_mitsa_development_recovery_eligibility.sql';
const hash=value=>createHash('sha256').update(value).digest('hex');
let db;
try {
 const approved=JSON.parse(readFileSync('config/test-target.json')),env=parse(readFileSync('.secrets/operator.env'));
 const target=assertTestTarget({projectRef:env.TEST_PROJECT_REF,url:env.TEST_SUPABASE_URL,databaseUrl:env.TEST_DATABASE_URL},approved);
 assert.equal(target.projectRef,'mjtejwafxriwntweussc');db=new pg.Client(testDatabaseConfig(env.TEST_DATABASE_URL,approved));await db.connect();await db.query('begin isolation level repeatable read read only');
 assert.equal((await db.query('select marker from foundation_probe.environment_identity where singleton')).rows[0]?.marker,target.databaseMarker);
 assert.equal((await db.query('select private.mitsa_pilot_registration_open() open')).rows[0].open,false);
 const functions=(await db.query("select oid::regprocedure::text signature,pg_get_functiondef(oid) definition,proowner::regrole::text owner,proacl::text acl,prosecdef,proconfig from pg_proc where oid in ('private.mitsa_isolated_send_email(jsonb)'::regprocedure,'private.mitsa_before_user_created(jsonb)'::regprocedure,'private.mitsa_registration_intent(text,text,uuid,text,boolean)'::regprocedure)")).rows;
 const privileges=(await db.query("select has_table_privilege('supabase_auth_admin','auth.users','SELECT') users_read,has_table_privilege('supabase_auth_admin','private.registration_intents','SELECT') intents_read,has_schema_privilege('supabase_auth_admin','auth','USAGE') auth_usage")).rows[0];assert(Object.values(privileges).every(value=>value===true));
 const helperAbsent=(await db.query("select to_regprocedure('private.mitsa_development_recovery_allowed(uuid,text)') is null absent")).rows[0].absent;assert(helperAbsent);
 const payload=JSON.stringify({project:target.projectRef,marker:target.databaseMarker,functions,privileges,helperAbsent,checkedAt:new Date().toISOString()});
 await db.query('commit');
 const privateKey=await readPrivateKey({armoredKey:readFileSync('.secrets/auth-mail/private.asc','utf8')}),publicKey=await readKey({armoredKey:privateKey.toPublic().armor()});
 const binary=await encrypt({message:await createMessage({text:payload}),encryptionKeys:publicKey,format:'binary'});
 assert.equal(String((await decrypt({message:await readMessage({binaryMessage:binary}),decryptionKeys:privateKey})).data),payload);
 mkdirSync('.secrets/isolated-registration',{recursive:true});writeFileSync('.secrets/isolated-registration/recovery-baseline.pgp',binary,{mode:0o600});
 const report={checkedAt:new Date().toISOString(),project:target.projectRef,markerVerified:true,candidate,candidateSha256:hash(readFileSync(candidate)),baselineSha256:hash(binary),payloadSha256:hash(payload),rollbackDecryptionVerified:true,existingAuthPrivilegesSufficient:true,pilotClosed:true,databaseWrites:0,candidateApplied:false,privateValuesPrinted:false};
 writeFileSync('artifacts/development-recovery-preflight.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch{try{await db?.query('rollback');}catch{}console.error('Recovery preparation stopped; private details suppressed. No remote writes.');process.exitCode=1;}finally{await db?.end();}
