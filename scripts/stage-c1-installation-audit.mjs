// Approved C1 inspection only. All hosted transactions are READ ONLY.
// Historical original-package audit. The correction uses audit-c1-identity-boundary.mjs.
// Never executes migrations/hooks/Auth operations, acquires a worker or sends mail.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {parse} from 'dotenv';
import pg from 'pg';
import {readKey,readPrivateKey,createMessage,encrypt,readMessage,decrypt} from 'openpgp';
import {assertTestTarget} from './test-target.mjs';
import {testDatabaseConfig} from './postgres-config.mjs';
import {persistentDatabase} from '../tests/support/persistent-database.ts';
import {normalizePolicyRoles,expectedC1MembershipDelta,assertC1AuthGrantCapability} from './lib/stage-c1-catalog.mjs';

const mode=process.argv[2],folder='.secrets/stage-c1';
const json=p=>JSON.parse(readFileSync(p,'utf8'));
const sha=v=>createHash('sha256').update(v).digest('hex');
const quote=v=>'"'+v.replaceAll('"','""')+'"';
const clean=v=>JSON.parse(JSON.stringify(v));
const sort=v=>[...v].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
const newTables=['account_registration_policy','auth_mail_dispatch','registration_control'];
const changedNames=['mitsa_before_user_created','mitsa_current_terms','mitsa_finalize_registration','mitsa_isolated_send_email'];
const intentColumns=['submission_id','submission_fingerprint','privacy_id','creation_deadline','provider_claimed_at','renewed_at','submission_state','approval_generation','registration_profile','registration_session_policy'];
const catalogQueries={
 functions:`select n.nspname schema,p.proname name,pg_get_function_identity_arguments(p.oid) args,pg_get_userbyid(p.proowner) owner,p.prosecdef definer,p.proconfig settings,p.proacl::text acl,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('api','private','foundation_probe') and p.prokind='f' order by 1,2,3`,
 policies:`select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname in ('api','private','foundation_probe','auth') order by 1,2,3`,
 tables:`select n.nspname schema,c.relname name,c.relkind kind,c.relrowsecurity rls,c.relforcerowsecurity forced,pg_get_userbyid(c.relowner) owner from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('api','private','foundation_probe','auth') and c.relkind in ('r','p','v','m','S') order by 1,2`,
 grants:`select n.nspname schema,c.relname name,case when x.grantee=0 then 'PUBLIC' else pg_get_userbyid(x.grantee) end grantee,x.privilege_type privilege,x.is_grantable grantable from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join lateral aclexplode(c.relacl) x where n.nspname in ('api','private','foundation_probe','auth') order by 1,2,3,4`,
 columns:`select n.nspname schema,c.relname name,a.attname column,a.atttypid::regtype::text type,a.attnotnull required,pg_get_expr(d.adbin,d.adrelid) expression from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum where n.nspname in ('private','api','foundation_probe','auth') and c.relkind in ('r','p') and a.attnum>0 and not a.attisdropped order by 1,2,a.attnum`,
 columnGrants:`select table_schema schema,table_name name,column_name column,grantee,privilege_type privilege,is_grantable grantable from information_schema.column_privileges where table_schema in ('private','api','foundation_probe','auth') order by 1,2,3,4,5`,
 // PG18 also catalogs NOT NULL as contype=n; PG17 keeps it in attnotnull.
 // The columns query compares attnotnull independently on both engines.
 constraints:`select n.nspname schema,c.relname name,k.conname constraint,pg_get_constraintdef(k.oid) definition from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('private','api','foundation_probe','auth') and k.contype<>'n' order by 1,2,3`,
 indexes:`select schemaname schema,tablename name,indexname,indexdef from pg_indexes where schemaname in ('private','api','foundation_probe','auth') order by 1,2,3`,
 triggers:`select n.nspname schema,c.relname name,t.tgname trigger,pg_get_triggerdef(t.oid) definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('private','api','foundation_probe','auth') and not t.tgisinternal order by 1,2,3`,
 roles:`select rolname name,rolsuper superuser,rolinherit inherit,rolcreaterole createrole,rolcreatedb createdb,rolcanlogin login,rolreplication replication,rolbypassrls bypassrls from pg_roles order by 1`,
 memberships:`select pg_get_userbyid(roleid) role,pg_get_userbyid(member) member,admin_option admin from pg_auth_members order by 1,2`,
 schemas:`select n.nspname schema,case when x.grantee=0 then 'PUBLIC' else pg_get_userbyid(x.grantee) end grantee,x.privilege_type privilege,x.is_grantable grantable from pg_namespace n cross join lateral aclexplode(n.nspacl) x where n.nspname in ('private','api','auth') order by 1,2,3`,
};
let stage='local-package',db,offline;
async function catalog(client){const result={};for(const [k,q] of Object.entries(catalogQueries))result[k]=clean((await client.query(q)).rows);result.policies=normalizePolicyRoles(result.policies);return result;}
async function snapshot(client){
 const rows={};
 for(const t of (await client.query("select schemaname,tablename from pg_tables where schemaname in ('private','foundation_probe') order by 1,2")).rows)
  rows[`${t.schemaname}.${t.tablename}`]=(await client.query(`select to_jsonb(t) row from ${quote(t.schemaname)}.${quote(t.tablename)} t order by to_jsonb(t)::text`)).rows.map(r=>r.row);
 // Row digests detect credential/factor changes without retrieving their secrets.
 const identities={};for(const t of ['users','mfa_factors'])identities[t]=(await client.query(`select id::text,encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') digest from auth.${t} t order by id`)).rows;
 return clean({rows,identities,catalog:await catalog(client),migrations:(await client.query('select version,name from supabase_migrations.schema_migrations order by version')).rows});
}
function diff(before,after){return {removed:before.filter(r=>!after.some(a=>JSON.stringify(a)===JSON.stringify(r))),added:after.filter(r=>!before.some(a=>JSON.stringify(a)===JSON.stringify(r)))};}
try{
 assert(['--preflight','--postflight','--offline-check','--recovery-check'].includes(mode));assert.equal(process.argv.length,3);
 const reviewed=json('artifacts/persistent-registration-stage-c-manifest.json');
 for(const f of reviewed.files)assert.equal(sha(readFileSync(f.path)),f.sha256,'reviewed file hash drift');
 if(mode==='--offline-check'){
  stage='offline-catalog';offline=await persistentDatabase({installPrepared:false});const before=await catalog(offline);
  for(const f of reviewed.files.filter(f=>f.path.endsWith('_inactive.sql')))await offline.exec(readFileSync(f.path,'utf8'));
  const after=await catalog(offline);assert.equal(after.tables.length-before.tables.length,3);
  console.log(JSON.stringify({offlineCatalogQueriesPassed:true,sourceHashesMatched:true,hostedConnections:0}));
 }else{
 const targetConfig=json('config/test-target.json'),op=parse(readFileSync('.secrets/operator.env'));
 const target=assertTestTarget({projectRef:op.TEST_PROJECT_REF,url:op.TEST_SUPABASE_URL,databaseUrl:op.TEST_DATABASE_URL},targetConfig);
 assert.equal(target.projectRef,'mjtejwafxriwntweussc');assert.equal(target.databaseMarker,'fireworks-foundation-proof-01a12e38');
 const local=parse(readFileSync('.env.local'));assert(local.MITSA_REGISTRATION_ENGINE!=='persistent-v1');assert.equal(local.APP_ORIGIN,'http://127.0.0.1:3000');
 db=new pg.Client({...testDatabaseConfig(op.TEST_DATABASE_URL,targetConfig),statement_timeout:30000,application_name:'mitsa-stage-c1-readonly-audit'});
 stage='readonly-snapshot';await db.connect();await db.query('begin isolation level repeatable read read only');
 assert.equal((await db.query('select marker from foundation_probe.environment_identity where singleton')).rows[0]?.marker,target.databaseMarker);
 const current=await snapshot(db),gates=current.rows['private.release_gates'][0],pilot=current.rows['private.pilot_registration_window'][0];
 for(const k of ['registration_enabled','external_mail_enabled','eligibility_approved','legal_publication_enabled','disposal_enabled'])assert.equal(gates[k],false);
 assert.equal(pilot.enabled,false);assert.equal(pilot.smtp_enabled,false);
 assert.equal(current.catalog.triggers.filter(t=>t.schema==='auth'&&t.name==='refresh_tokens').length,0);
 const privateKey=await readPrivateKey({armoredKey:readFileSync('.secrets/auth-mail/private.asc','utf8')});
 if(mode==='--preflight'){
  stage='preflight-assertions';assert.equal(current.migrations.length,20);
  for(const name of newTables)assert(!current.rows[`private.${name}`]);
  assert(!current.catalog.roles.some(r=>r.name==='app_registration'));
  const baseline=json('config/persistent-registration-function-baseline.json');
  for(const f of baseline.functions){const actual=current.catalog.functions.find(r=>r.schema==='private'&&r.name===f.name);assert(actual);assert.equal(sha(actual.definition),f.sha256);assert.equal(actual.owner,f.owner);assert.equal(actual.acl,f.acl);}
  const names=new Set(reviewed.functions.filter(f=>!['mitsa_current_terms','mitsa_finalize_registration','mitsa_before_user_created','mitsa_isolated_send_email'].includes(f.name)).map(f=>f.schema+'.'+f.name));
  for(const f of current.catalog.functions){assert(!names.has(f.schema+'.'+f.name),'function collision');assert(!changedNames.some(n=>f.name===n+'_legacy'),'legacy copy collision');}
  assert(!current.catalog.columns.some(c=>c.schema==='private'&&c.name==='registration_intents'&&intentColumns.includes(c.column)));
  assert(current.catalog.roles.find(r=>r.name==='postgres')?.createrole);
  assert((await db.query("select has_schema_privilege(current_user,'private','CREATE') p,has_schema_privilege(current_user,'api','CREATE') a,pg_has_role(current_user,'app_workspace','MEMBER') w")).rows.every(r=>r.p&&r.a&&r.w));
  assertC1AuthGrantCapability((await db.query("select has_schema_privilege(current_user,'auth','USAGE WITH GRANT OPTION') allowed")).rows[0].allowed);
  const known=[json('.secrets/developer-registration.json').email,json('.secrets/onboarding-recipient.json').email].map(e=>e.trim().toLowerCase());
  const unknown=(await db.query("select count(*)::int n from auth.users u where lower(u.email)<>all($1::text[]) and coalesce(u.email,'') !~ '@example\\.invalid$' and not exists(select 1 from private.registration_intents i where i.provider_user_id=u.id)",[known])).rows[0].n;
  assert.equal(unknown,0,'unrecognized account outside approved registration/test evidence');
  assert.equal((await db.query("select count(*)::int n from private.businesses where name not in ('D Extacy Fireworks','L.F Fireworks') and name !~ '^Synthetic '")).rows[0].n,0,'unreviewed business data');
  await db.query('commit');
  stage='encrypt-and-verify';const publicKey=await readKey({armoredKey:readFileSync('.secrets/auth-mail/public.asc','utf8')});assert.equal(publicKey.getFingerprint(),privateKey.getFingerprint());
  const payload=JSON.stringify({target,createdAt:new Date().toISOString(),...current}),encrypted=await encrypt({message:await createMessage({text:payload}),encryptionKeys:publicKey,format:'binary'});
  mkdirSync(folder,{recursive:true});const path=`${folder}/preservation-${randomUUID()}.pgp`;writeFileSync(path,encrypted,{flag:'wx',mode:0o600});
  const decoded=String((await decrypt({message:await readMessage({binaryMessage:readFileSync(path)}),decryptionKeys:privateKey})).data);assert.equal(sha(decoded),sha(payload));assert.deepEqual(JSON.parse(decoded),JSON.parse(payload));
  writeFileSync(`${folder}/installation-baseline.json`,JSON.stringify({project:target.projectRef,path,encryptedSha256:sha(encrypted),payloadSha256:sha(payload),createdAt:new Date().toISOString()}),{flag:'wx',mode:0o600});
  const report={checkedAt:new Date().toISOString(),stage:'C1-preflight',passed:true,targetMarkerVerified:true,reviewedFiles:reviewed.files.length,baselineFunctionsVerified:baseline.functions.length,migrations:current.migrations.length,privateTablesPreserved:Object.keys(current.rows).length,fullPrivateRowsSnapshot:true,authAccountAndFactorDigests:true,unrecognizedAccounts:unknown,encryptedSnapshotRoundTripVerified:true,controlsClosed:true,databaseWrites:0,authRequests:0,smtpConnections:0};
  writeFileSync('artifacts/stage-c1-preflight.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 }else{
  stage='decrypt-baseline';const m=json(`${folder}/installation-baseline.json`);assert.equal(m.project,target.projectRef);const cipher=readFileSync(m.path);assert.equal(sha(cipher),m.encryptedSha256);
  const plaintext=String((await decrypt({message:await readMessage({binaryMessage:cipher}),decryptionKeys:privateKey})).data);assert.equal(sha(plaintext),m.payloadSha256);const old=JSON.parse(plaintext);old.catalog.policies=normalizePolicyRoles(old.catalog.policies);
  stage='preservation';assert.deepEqual(current.identities,old.identities);
  for(const [name,rows] of Object.entries(old.rows)){
   let actual=current.rows[name];assert(actual);
   if(name==='private.registration_intents')actual=actual.map(row=>{const r={...row};for(const col of intentColumns){assert.equal(r[col],null);delete r[col];}return r;});
   assert.deepEqual(sort(actual),sort(rows));
  }
  assert.deepEqual(Object.keys(current.rows).filter(n=>!old.rows[n]).sort(),newTables.map(n=>'private.'+n).sort());
  for(const name of ['account_registration_policy','auth_mail_dispatch'])assert.deepEqual(current.rows['private.'+name],[]);
  const control=current.rows['private.registration_control'];assert.equal(control.length,1);
  for(const k of ['admission_enabled','delivery_enabled','session_policy_ready','transport_ready'])assert.equal(control[0][k],false);
  for(const k of ['approval_generation','worker_id','worker_until','heartbeat_at','terms_id','privacy_id','approved_sender_sha256'])assert.equal(control[0][k],null);
  assert.equal(control[0].session_policy,'strict');assert.equal(control[0].hourly_budget,10);assert.equal(control[0].daily_budget,20);
  stage='function-security';
  const recovered=mode==='--recovery-check';
  for(const f of reviewed.functions){if(recovered&&f.schema==='private'&&changedNames.includes(f.name))continue;const a=current.catalog.functions.find(r=>r.schema===f.schema&&r.name===f.name);assert(a);assert.equal(sha(a.definition),f.sha256);for(const k of ['owner','definer','settings','acl'])assert.deepEqual(a[k],f[k]);}
  for(const f of old.catalog.functions){if(!recovered&&f.schema==='private'&&changedNames.includes(f.name))continue;assert.deepEqual(current.catalog.functions.find(a=>a.schema===f.schema&&a.name===f.name&&a.args===f.args),f);}
  const additions=current.catalog.functions.filter(a=>!old.catalog.functions.some(f=>a.schema===f.schema&&a.name===f.name&&a.args===f.args));
  const expectedNew=reviewed.functions.filter(f=>!old.catalog.functions.some(a=>a.schema===f.schema&&a.name===f.name)).map(f=>f.schema+'.'+f.name).concat(changedNames.map(n=>'private.'+n+'_legacy')).sort();
  assert.deepEqual(additions.map(f=>f.schema+'.'+f.name).sort(),expectedNew);
  for(const name of changedNames){const legacy=current.catalog.functions.find(f=>f.schema==='private'&&f.name===name+'_legacy'),baseline=old.catalog.functions.find(f=>f.schema==='private'&&f.name===name);assert(legacy);assert.equal(legacy.definition.replace(`private.${name}_legacy(`,`private.${name}(`),baseline.definition);assert.equal(legacy.owner,baseline.owner);}
  stage='catalog-delta';offline=await persistentDatabase({installPrepared:false});const before=await catalog(offline);
  for(const f of reviewed.files.filter(f=>f.path.endsWith('_inactive.sql')))await offline.exec(readFileSync(f.path,'utf8'));
  if(recovered)await offline.exec(readFileSync('supabase/prepared/persistent-registration-forward-recovery.sql','utf8'));
  const after=await catalog(offline),deltas={};
  for(const name of Object.keys(catalogQueries).filter(k=>k!=='functions')){
   stage='catalog-delta:'+name;let expected=diff(before[name],after[name]);const actual=diff(old.catalog[name],current.catalog[name]);
   if(name==='memberships')expected=expectedC1MembershipDelta(old.catalog.roles,expected);
   // Recovery verifies preservation while recording, not accepting, the C1 defect.
   // The operator could not grant auth USAGE; no corrective grant is authorized.
   if(recovered&&name==='schemas')expected.added=expected.added.filter(r=>!(r.schema==='auth'&&r.grantee==='app_registration'&&r.privilege==='USAGE'));
   const missing=diff(sort(actual.removed),sort(expected.removed)),extra=diff(sort(actual.added),sort(expected.added));
   if(missing.removed.length||missing.added.length||extra.removed.length||extra.added.length){
    // Catalog metadata only, no rows, account identifiers, credentials or payloads.
    writeFileSync('artifacts/stage-c1-catalog-comparison.json',JSON.stringify({catalog:name,expected,actual},null,2)+'\n');
   }
   assert.deepEqual(sort(actual.removed),sort(expected.removed),name+' unexpected removal/change');assert.deepEqual(sort(actual.added),sort(expected.added),name+' unexpected addition/change');deltas[name]={removed:actual.removed.length,added:actual.added.length};
  }
  stage='effective-privileges';
  assert.deepEqual((await db.query("select pg_get_userbyid(grantor) grantor,admin_option admin,inherit_option inherit,set_option set from pg_auth_members where roleid=(select oid from pg_roles where rolname='app_registration') and member=(select oid from pg_roles where rolname='postgres') order by admin_option desc")).rows,[{grantor:'supabase_admin',admin:true,inherit:false,set:false},{grantor:'postgres',admin:false,inherit:true,set:true}]);
  const authUsage=(await db.query("select has_schema_privilege('app_registration','auth','USAGE') allowed")).rows[0].allowed;
  assert.equal(authUsage,!recovered);
  for(const name of newTables){const t=current.catalog.tables.find(t=>t.schema==='private'&&t.name===name);assert(t?.rls&&t.forced);}
  for(const r of ['anon','authenticated','service_role'])for(const t of newTables){assert.equal((await db.query("select has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') allowed",[r,'private.'+t])).rows[0].allowed,false);}
  const workerRights=(await db.query("select p.proname,r.role,has_function_privilege(r.role,p.oid,'EXECUTE') allowed from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join unnest(array['anon','authenticated','service_role']) r(role) where n.nspname='private' and p.proname like 'mitsa_worker_%'")).rows;
  assert.equal(workerRights.length,12);assert(workerRights.every(r=>r.allowed===false));
  const policy=(await db.query('select api.mitsa_persistent_registration_policy() value')).rows[0].value;assert.equal(policy.admission,'closed');assert.equal(policy.delivery,'closed');
  const migrationDelta=current.migrations.filter(m=>!old.migrations.some(o=>o.version===m.version));const migrationNames=['mitsa_persistent_registration_hooks_inactive','mitsa_persistent_registration_inactive'];if(recovered)migrationNames.push('mitsa_persistent_registration_c1_forward_recovery');assert.equal(migrationDelta.length,migrationNames.length);assert.deepEqual(migrationDelta.map(m=>m.name).sort(),migrationNames.sort());
  await db.query('commit');
  const report={checkedAt:new Date().toISOString(),stage:recovered?'C1-forward-recovery-verification':'C1-postflight',passed:!recovered,recoveryPassed:recovered,c1InstallationAccepted:!recovered,knownInstallationFailure:recovered?'app_registration lacks required auth schema USAGE; operator cannot grant it':null,targetMarkerVerified:true,installedFiles:reviewed.files.filter(f=>f.path.endsWith('_inactive.sql')),migrations:migrationDelta,exactManifestFunctionsVerified:reviewed.functions.length-(recovered?4:0),baselineDefinitionsRestored:recovered?5:0,legacyDefinitionsPreserved:4,fullExistingPrivateRowsPreserved:true,authAccountsAndFactorsUnchanged:true,oldPoliciesAndBusinessRlsPreserved:true,catalogDeltaVerification:deltas,newTablesForcedRls:true,browserAndServiceDirectTableAccessDenied:true,workerRpcExecutionDenied:true,policyReadiness:policy,legacyEngineUnchanged:true,newAccounts:0,newCapturedMessages:0,newSmtpClaims:0,controlsDisabled:true,auditDatabaseWrites:0,liveAuthTests:0};
  writeFileSync(recovered?'artifacts/stage-c1-recovery-postflight.json':'artifacts/stage-c1-postflight.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 }
 }
}catch(e){try{await db?.query('rollback');}catch{}console.error(JSON.stringify({status:'C1 read-only audit stopped',stage,code:typeof e?.code==='string'&&/^[0-9A-Z]{5}$/.test(e.code)?e.code:undefined,privateDetailsSuppressed:true,remoteWrites:0}));process.exitCode=1;}
finally{await offline?.close();await db?.end();}
