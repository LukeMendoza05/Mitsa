// READ ONLY hosted preflight. No function execution, migrations, Auth API or mail.
import {readFileSync,writeFileSync} from 'node:fs';
import {parse} from 'dotenv';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
import {assertTestTarget} from './test-target.mjs';
import {testDatabaseConfig} from './postgres-config.mjs';
import {assertC1IdentityPreflight,assertC1IdentityPostflight} from './lib/c1-identity-preflight.mjs';
const json=p=>JSON.parse(readFileSync(p,'utf8'));
let db,stage='source';
try{
 const review=json('artifacts/stage-c1-identity-boundary-manifest.json');
 const post=process.argv[2]==='--postflight';assert.equal(process.argv.length,post?3:2);
 for(const f of review.files)assert.equal(createHash('sha256').update(readFileSync(f.path)).digest('hex'),f.sha256);
 const baseline=json('config/stage-c1-identity-boundary-baseline.json'),approved=json('config/test-target.json'),op=parse(readFileSync('.secrets/operator.env'));
 const target=assertTestTarget({projectRef:op.TEST_PROJECT_REF,url:op.TEST_SUPABASE_URL,databaseUrl:op.TEST_DATABASE_URL},approved);assert.equal(target.projectRef,'mjtejwafxriwntweussc');
 const local=parse(readFileSync('.env.local'));assert(local.MITSA_REGISTRATION_ENGINE!=='persistent-v1');
 db=new pg.Client({...testDatabaseConfig(op.TEST_DATABASE_URL,approved),statement_timeout:15000});stage='catalog';await db.connect();await db.query('begin isolation level repeatable read read only');
 const observed={marker:(await db.query('select marker from foundation_probe.environment_identity where singleton')).rows[0]?.marker,
 currentUser:(await db.query('select current_user name')).rows[0].name,
 managedAuth:(await db.query("select jsonb_build_object('schema',(select jsonb_build_object('owner',pg_get_userbyid(nspowner),'acl',nspacl::text) from pg_namespace where nspname='auth'),'users',(select jsonb_build_object('owner',pg_get_userbyid(relowner),'acl',relacl::text,'rls',relrowsecurity,'forced',relforcerowsecurity) from pg_class where oid='auth.users'::regclass),'userColumnAcls',(select jsonb_agg(jsonb_build_object('column',attname,'acl',attacl::text) order by attnum) from pg_attribute where attrelid='auth.users'::regclass and attnum>0 and not attisdropped)) acl")).rows[0].acl,
 schemas:(await db.query("select n.nspname schema,pg_get_userbyid(n.nspowner) owner,has_schema_privilege(current_user,n.oid,'USAGE') \"operatorUsage\",has_schema_privilege(current_user,n.oid,'USAGE WITH GRANT OPTION') \"operatorGrantOption\",has_schema_privilege('app_registration',n.oid,'USAGE') \"registrationUsage\" from pg_namespace n where n.nspname in ('auth','private') order by 1")).rows,
 operator:(await db.query("select rolname name,rolsuper superuser,rolbypassrls \"bypassRls\",has_schema_privilege(current_user,'private','CREATE') \"canCreatePrivate\" from pg_roles where rolname=current_user")).rows[0],
 ownerCanReplaceFunctions:(await db.query("select pg_has_role(current_user,'app_registration','MEMBER') and pg_has_role(current_user,'app_workspace','MEMBER') ok")).rows[0].ok,
 registrationPrivateCreate:(await db.query("select has_schema_privilege('app_registration','private','CREATE') allowed")).rows[0].allowed,
 registrationRole:(await db.query("select rolsuper superuser,rolbypassrls \"bypassRls\",rolcanlogin login,rolcreaterole createrole,rolcreatedb createdb,rolinherit inherit from pg_roles where rolname='app_registration'")).rows[0],
 identityColumns:(await db.query("select a.attname column,has_column_privilege(current_user,c.oid,a.attnum,'SELECT') \"operatorSelect\",has_column_privilege('app_registration',c.oid,a.attnum,'SELECT') \"registrationSelect\" from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid where n.nspname='auth' and c.relname='users' and a.attname=any($1::text[]) order by a.attnum",[['id','email','email_confirmed_at','deleted_at','banned_until','is_anonymous']])).rows,
 controls:(await db.query('select * from private.registration_control where singleton')).rows[0],
 cohorts:(await db.query('select count(*)::int n from private.account_registration_policy')).rows[0].n,
 dispatches:(await db.query('select count(*)::int n from private.auth_mail_dispatch')).rows[0].n,
 persistentIntents:(await db.query('select count(*)::int n from private.registration_intents where submission_id is not null')).rows[0].n,
 helperCollisions:(await db.query("select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('api','private') and p.proname='mitsa_registration_identity'")).rows[0].n,
 refreshTriggers:(await db.query("select count(*)::int n from pg_trigger where tgrelid='auth.refresh_tokens'::regclass and not tgisinternal")).rows[0].n,
 newTablesForcedRls:(await db.query("select count(*)=3 and bool_and(c.relrowsecurity and c.relforcerowsecurity) ok from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname in ('registration_control','account_registration_policy','auth_mail_dispatch')")).rows[0].ok,
 gatesClosed:(await db.query('select not(registration_enabled or external_mail_enabled or eligibility_approved or legal_publication_enabled or disposal_enabled) ok from private.release_gates where singleton')).rows[0].ok,
 pilotClosed:(await db.query('select not(enabled or smtp_enabled) ok from private.pilot_registration_window where singleton')).rows[0].ok,
 functions:(await db.query("select n.nspname schema,p.proname name,pg_get_userbyid(p.proowner) owner,p.prosecdef definer,p.proconfig settings,p.proacl::text acl,encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') sha256 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','api') and p.proname=any($1::text[]) order by 1,2",[[...baseline.functions.map(f=>f.name),'mitsa_registration_identity']])).rows,
 migrations:(await db.query('select version,name from supabase_migrations.schema_migrations order by version')).rows};
 stage='assertions';if(post)assertC1IdentityPostflight(observed,baseline,review);else assertC1IdentityPreflight(observed,baseline);await db.query('commit');
 const report={checkedAt:new Date().toISOString(),project:target.projectRef,status:post?'corrective-inactive-postflight-passed':'correction-prepared-not-installed',passed:true,reviewedSources:review.files.length,functionsMatched:observed.functions.length,ownerReadsConfirmed:observed.identityColumns.every(c=>c.operatorSelect),ownerCannotDelegateAuthUsage:!observed.schemas.find(s=>s.schema==='auth').operatorGrantOption,customRoleAuthUsage:false,managedAuthOwnershipOrGrantsChanged:false,controlsRemainDisabled:true,helperAbsent:!post,localEngineLegacy:true,functionsExecuted:0,databaseWrites:0,authRequests:0,smtpConnections:0};
 writeFileSync(post?'artifacts/stage-c1-identity-boundary-postflight.json':'artifacts/stage-c1-identity-boundary-preflight.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch(e){try{await db?.query('rollback');}catch{}console.error(JSON.stringify({status:'Corrective preflight stopped',stage,code:typeof e?.code==='string'&&/^[0-9A-Z]{5}$/.test(e.code)?e.code:undefined,databaseWrites:0,privateDetailsSuppressed:true}));process.exitCode=1;}finally{await db?.end();}
