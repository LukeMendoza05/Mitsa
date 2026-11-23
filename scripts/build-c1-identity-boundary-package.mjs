// Offline PGlite only. Never imports private operator configuration.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {recoveredC1Database,correctionPath,correctionRecoveryPath} from '../tests/support/stage-c1-correction.ts';
const hash=v=>createHash('sha256').update(v).digest('hex');
const clean=v=>JSON.parse(JSON.stringify(v));
const baseline=JSON.parse(readFileSync('config/stage-c1-identity-boundary-baseline.json','utf8'));
const files=[correctionPath,correctionRecoveryPath,'config/stage-c1-identity-boundary-baseline.json','scripts/prepare-c1-identity-boundary.mjs','scripts/audit-c1-identity-boundary.mjs','scripts/preserve-c1-identity-boundary.mjs','scripts/build-c1-identity-boundary-package.mjs','scripts/lib/c1-identity-preflight.mjs','tests/support/stage-c1-correction.ts','tests/unit/stage-c1-identity-boundary.test.ts','tests/unit/stage-c1-correction-lifecycle.test.ts','tests/unit/stage-c1-correction-recovery.test.ts','tests/unit/stage-c1-identity-preflight.test.ts'];
const changed=['mitsa_registration_command','mitsa_before_user_created','mitsa_isolated_send_email','mitsa_current_terms','mitsa_finalize_registration'];
const check=process.argv[2]==='--check';assert.equal(process.argv.length,check?3:2);
const path='artifacts/stage-c1-identity-boundary-manifest.json';let db;
try{
 if(check){const reviewed=JSON.parse(readFileSync(path,'utf8'));assert.deepEqual(reviewed.files.map(f=>f.path),files);for(const f of reviewed.files)assert.equal(hash(readFileSync(f.path)),f.sha256);}
 db=await recoveredC1Database();
 const functions=async()=>clean((await db.query("select n.nspname schema,p.proname name,pg_get_userbyid(p.proowner) owner,p.prosecdef definer,p.proconfig settings,p.proacl::text acl,pg_get_function_result(p.oid) result,encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') sha256 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('api','private') and (p.proname='mitsa_registration_identity' or p.proname=any($1::text[])) order by 1,2",[baseline.functions.map(f=>f.name)])).rows);
 const security=async()=>clean({policies:(await db.query("select to_jsonb(p) p from pg_policies p where schemaname in ('private','foundation_probe') order by schemaname,tablename,policyname")).rows,authAcl:(await db.query("select nspacl::text acl from pg_namespace where nspname='auth'")).rows,authTableAcl:(await db.query("select relacl::text acl from pg_class where oid='auth.users'::regclass")).rows,authColumnAcl:(await db.query("select attname,attacl::text acl from pg_attribute where attrelid='auth.users'::regclass and attnum>0 order by attnum")).rows,role:(await db.query("select rolcanlogin,rolsuper,rolbypassrls,rolinherit,rolcreaterole from pg_roles where rolname='app_registration'")).rows});
 const rows=async()=>{const result={};for(const t of (await db.query("select schemaname,tablename from pg_tables where schemaname in ('private','foundation_probe') order by 1,2")).rows){result[t.schemaname+'.'+t.tablename]=clean((await db.query(`select to_jsonb(t) r from ${t.schemaname}.${t.tablename} t order by to_jsonb(t)::text`)).rows.map(r=>r.r));}return result;};
 const before=await functions(),oldSecurity=await security(),oldRows=await rows();
 await db.exec(readFileSync(correctionPath,'utf8'));const installed=await functions();
 assert.equal(installed.length,before.length+1);assert.deepEqual(await security(),oldSecurity);assert.deepEqual(await rows(),oldRows);
 for(const f of before)if(f.schema!=='private'||!changed.includes(f.name))assert.deepEqual(installed.find(r=>r.schema===f.schema&&r.name===f.name),f);
 const helper=installed.find(f=>f.name==='mitsa_registration_identity');assert.equal(helper.owner,'postgres');assert.equal(helper.definer,true);assert.deepEqual(helper.settings,['search_path=""','row_security=on']);assert.equal(helper.result,'TABLE(user_id uuid, intent_id uuid)');assert.equal(helper.acl,'{postgres=X/postgres,app_registration=X/postgres}');
 await db.exec('set role app_registration');assert.deepEqual((await db.query("select * from private.mitsa_registration_identity('recovery','unknown@example.invalid')")).rows,[]);await db.exec('reset role');
 assert.equal((await db.query("select has_schema_privilege('app_registration','auth','USAGE') allowed")).rows[0].allowed,false);
 const controls=clean((await db.query('select * from private.registration_control')).rows[0]);
 for(const k of ['admission_enabled','delivery_enabled','session_policy_ready','transport_ready'])assert.equal(controls[k],false);
 await db.exec(readFileSync(correctionRecoveryPath,'utf8'));const recovered=await functions();for(const f of before)assert.deepEqual(recovered.find(r=>r.schema===f.schema&&r.name===f.name),f);
 assert.deepEqual(await security(),oldSecurity);assert.equal((await db.query("select has_function_privilege('app_registration','private.mitsa_registration_identity(text,text,uuid,uuid)','EXECUTE') allowed")).rows[0].allowed,false);
 const afterRows=await rows();for(const [table,data] of Object.entries(oldRows)){if(table==='private.registration_control'){const strip=rows=>rows.map(({stopped_at,...r})=>r);assert.deepEqual(strip(afterRows[table]),strip(data));}else assert.deepEqual(afterRows[table],data);}
 const manifest={checkedAt:new Date().toISOString(),status:'prepared-not-approved-not-installed',project:'mjtejwafxriwntweussc',databaseMarker:baseline.marker,files:files.map(path=>({path,sha256:hash(readFileSync(path))})),functions:installed,initialControls:{...controls,stopped_at:'existing-recovery-stop-preserved'},authOwnershipAndPrivilegesUnchanged:true,customRoleAuthSchemaUsage:false,registrationCommandDirectAuthReadsRemoved:true,helperReturnsOnlyMatchedIds:true,priorPoliciesAndBusinessRlsUnchanged:true,allRetainedRowsPreserved:true,recoveryRestoresBaselineDefinitionsOwnersAndAcls:true,recoveryHelperInert:true,noNewTablesOrRoles:true,scope:'Offline PGlite policy/SQL tests, not hosted provider/MFA/OTP or cryptographic interoperability. PGlite bootstrap owner remains superuser; hosted owner permissions were inspected read-only.',hostedConnections:0,smtpConnections:0};
 if(check){const {checkedAt,...expected}=JSON.parse(readFileSync(path,'utf8'));const {checkedAt:_,...actual}=manifest;assert.deepEqual(actual,expected);}else writeFileSync(path,JSON.stringify(manifest,null,2)+'\n');
 console.log(JSON.stringify({mode:check?'check':'prepare',files:files.length,functions:installed.length,onlyMatchedIdentityIds:true,managedAuthGrantsUnchanged:true,sourceAndRecoveryVerified:true,hostedChanges:0}));
}catch(e){console.error(JSON.stringify({status:'Offline corrective package failed',message:e.message,hostedChanges:0}));process.exitCode=1;}finally{await db?.close();}
