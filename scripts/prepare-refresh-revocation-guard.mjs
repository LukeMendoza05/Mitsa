// Read-only remote preparation. Produces a LOCAL candidate and encrypted
// catalog rollback snapshot. Never applies DDL or reads authentication secrets.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {parse} from 'dotenv';import pg from 'pg';
import {readKey,createMessage,encrypt} from 'openpgp';
import {assertTestTarget} from './test-target.mjs';import {testDatabaseConfig} from './postgres-config.mjs';
const candidate='supabase/prepared/20261015123215_mitsa_refresh_family_revocation_guard.sql';
const digest=value=>createHash('sha256').update(value).digest('hex');
let db;
try {
 const cfg=JSON.parse(readFileSync('config/test-target.json')),env=parse(readFileSync('.secrets/operator.env'));
 const target=assertTestTarget({projectRef:env.TEST_PROJECT_REF,url:env.TEST_SUPABASE_URL,databaseUrl:env.TEST_DATABASE_URL},cfg);assert.equal(target.projectRef,'mjtejwafxriwntweussc');
 db=new pg.Client(testDatabaseConfig(env.TEST_DATABASE_URL,cfg));await db.connect();await db.query('begin read only');
 assert.equal((await db.query('select marker from foundation_probe.environment_identity where singleton')).rows[0].marker,target.databaseMarker);
 assert.equal((await db.query("select to_regclass('private.session_revocations') is null absent")).rows[0].absent,true);
 const original=(await db.query("select pg_get_functiondef(oid) definition,proowner::regrole::text owner,proacl::text acl,proconfig,prosecdef from pg_proc where oid='private.current_actor()'::regprocedure")).rows[0];
 const originalHash=digest(original.definition);assert.equal(originalHash,'587affbee9b5b7bf9cfd3b8bf343eda75626ec0fb9b886b9f3c370995182d652');assert.equal(original.owner,'postgres');
 assert.equal((await db.query("select count(*)::int n from pg_trigger where tgrelid='auth.refresh_tokens'::regclass and not tgisinternal")).rows[0].n,0);
 await db.query('commit');
 assert(original.definition.includes('and (s.not_after is null or s.not_after > pg_catalog.statement_timestamp())'));
 const preflight=`-- UNAPPLIED REVIEW CANDIDATE. Requires separate explicit approval.\n-- Approved isolated target only; no account, factor or business-data mutation.\ndo $$ begin\n assert current_user='postgres','approved operator required';\n assert (select marker='fireworks-foundation-proof-01a12e38' from foundation_probe.environment_identity where singleton),'isolated target marker mismatch';\n assert (select encode(sha256(convert_to(pg_get_functiondef(oid),'UTF8')),'hex')='${originalHash}' from pg_proc where oid='private.current_actor()'::regprocedure),'actor definition differs from reviewed baseline';\n assert to_regclass('private.session_revocations') is null,'revocation ledger already exists';\n assert not exists(select 1 from pg_trigger where tgrelid='auth.refresh_tokens'::regclass and not tgisinternal),'Auth refresh trigger set changed';\nend $$;\n`;
 const observer=`create function private.mitsa_expire_revoked_refresh_family() returns trigger\nlanguage plpgsql security definer set search_path='' set row_security=on as $$ begin\n if TG_TABLE_SCHEMA<>'auth' or TG_TABLE_NAME<>'refresh_tokens' or TG_OP<>'UPDATE' then raise exception 'invalid trigger context' using errcode='42501'; end if;\n if NEW.session_id is not null\n and not exists(select 1 from auth.refresh_tokens r where r.session_id=NEW.session_id and not r.revoked) then\n  -- A fixed expired instant avoids provider/application clock skew reopening\n  -- the already-revoked session. This does not change code or JWT lifetimes.\n  update auth.sessions s set not_after='1970-01-01 00:00:00+00'::timestamptz\n   where s.id=NEW.session_id and s.user_id::text=NEW.user_id::text\n   and (s.not_after is null or s.not_after>'1970-01-01 00:00:00+00'::timestamptz);\n end if;\n return NEW;\nend $$;\nrevoke all on function private.mitsa_expire_revoked_refresh_family() from public,anon,authenticated,service_role,supabase_auth_admin,app_workspace,app_authz,app_command;\n-- Deferred until the provider transaction completes: normal rotation has a\n-- replacement token; family revocation commits with none. No token value is read.\ncreate constraint trigger mitsa_refresh_family_revocation\nafter update on auth.refresh_tokens deferrable initially deferred\nfor each row when (OLD.revoked=false and NEW.revoked=true)\nexecute function private.mitsa_expire_revoked_refresh_family();\n`;
 const sql=preflight+'\n'+observer;writeFileSync(candidate,sql);
 const rollback=`-- Close registration/delivery before rollback.\n-- Remove only the new Auth write dependency. Keep already-expired sessions\n-- expired: restoring revoked access is not a valid rollback. New password\n-- sign-in creates an independent session using the existing authenticator.\ndrop trigger if exists mitsa_refresh_family_revocation on auth.refresh_tokens;\ndrop function if exists private.mitsa_expire_revoked_refresh_family();\n`;
 writeFileSync('supabase/prepared/refresh-family-emergency-rollback.sql',rollback);
 const snapshot=JSON.stringify({project:target.projectRef,original,candidateSha256:digest(sql),emergencyRollbackSha256:digest(rollback)});
 // Use the established public capture key. No decryption secret is needed here.
 const key=await readKey({armoredKey:readFileSync('.secrets/auth-mail/public.asc','utf8')});
 const encrypted=await encrypt({message:await createMessage({text:snapshot}),encryptionKeys:key,format:'binary'});
 mkdirSync('.secrets/refresh-revocation',{recursive:true});writeFileSync('.secrets/refresh-revocation/catalog-baseline.pgp',encrypted,{mode:0o600});
 const report={checkedAt:new Date().toISOString(),project:target.projectRef,markerVerified:true,candidate,candidateSha256:digest(sql),originalActorSha256:originalHash,encryptedBaselineSha256:digest(encrypted),baselinePayloadSha256:digest(snapshot),emergencyRollbackSha256:digest(rollback),newTables:0,actorDefinitionChanged:false,remoteChanges:0,applied:false,privateValuesPrinted:false};
 writeFileSync('artifacts/refresh-revocation-preflight.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch{try{await db?.query('rollback');}catch{}console.error('Refresh guard preparation stopped; private details suppressed. No remote changes.');process.exitCode=1;}finally{await db?.end();}
