// Read-only managed-Auth inventory. Count rows; never select token/password data.
import {readFileSync,writeFileSync} from 'node:fs';import {parse} from 'dotenv';import pg from 'pg';import assert from 'node:assert/strict';
import {assertTestTarget} from './test-target.mjs';import {testDatabaseConfig} from './postgres-config.mjs';
const config=JSON.parse(readFileSync('config/test-target.json','utf8')),env=parse(readFileSync('.secrets/operator.env')),
 target=assertTestTarget({projectRef:env.TEST_PROJECT_REF,url:env.TEST_SUPABASE_URL,databaseUrl:env.TEST_DATABASE_URL},config),db=new pg.Client(testDatabaseConfig(env.TEST_DATABASE_URL,config));
try {
 await db.connect();await db.query('begin isolation level repeatable read read only');assert.equal((await db.query('select marker from foundation_probe.environment_identity where singleton')).rows[0]?.marker,target.databaseMarker);
 const email=JSON.parse(readFileSync('.secrets/developer-registration.json','utf8')).email.trim().toLowerCase(),manifest=JSON.parse(readFileSync('.secrets/developer-reset/manifest.json','utf8')),
 identities=(await db.query('select id from auth.users where email=$1',[email])).rows;assert.equal(identities.length,1);assert.equal(identities[0].id,manifest.userId);
 const columns=(await db.query("select table_name,column_name,data_type from information_schema.columns where table_schema='auth' and (column_name in ('user_id','session_id','factor_id') or table_name='users' and column_name='id')")).rows;
 const quote=value=>'"'+value.replaceAll('"','""')+'"',counts={};
 for(const table of [...new Set(columns.map(row=>row.table_name))].sort()){
  const fields=columns.filter(row=>row.table_name===table),expressions=[];
  for(const field of fields){const column=quote(field.column_name);
   if(field.column_name==='user_id'||table==='users'&&field.column_name==='id')expressions.push(`${column}::text=$1`);
   if(field.column_name==='session_id')expressions.push(`${column}::text in (select id::text from auth.sessions where user_id=$1::uuid)`);
   if(field.column_name==='factor_id')expressions.push(`${column}::text in (select id::text from auth.mfa_factors where user_id=$1::uuid)`);
  }
  if(expressions.length)counts[`auth.${table}`]=(await db.query(`select count(*)::int n from auth.${quote(table)} where ${expressions.join(' or ')}`,[manifest.userId])).rows[0].n;
 }
 await db.query('commit');const report={checkedAt:new Date().toISOString(),project:target.projectRef,markerVerified:true,privateIdentityMatched:true,counts,
  passwordTokenOrSecretColumnsRead:false,managedAuthRestoreAvailabilityVerified:false,remoteMutations:0};writeFileSync('artifacts/developer-reset-auth-dependencies.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch{try{await db.query('rollback');}catch{}console.error('Read-only Auth dependency inventory stopped; private details suppressed.');process.exitCode=1;}finally{await db.end();}
