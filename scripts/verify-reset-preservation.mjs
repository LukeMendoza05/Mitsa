// Read-only: compare the real developer's state with its encrypted baseline.
import {readFileSync,writeFileSync} from 'node:fs';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';import {parse} from 'dotenv';import pg from 'pg';import {readPrivateKey,readMessage,decrypt} from 'openpgp';
import {assertTestTarget} from './test-target.mjs';import {testDatabaseConfig} from './postgres-config.mjs';
const approved=JSON.parse(readFileSync('config/test-target.json','utf8')),env=parse(readFileSync('.secrets/operator.env')),target=assertTestTarget({projectRef:env.TEST_PROJECT_REF,url:env.TEST_SUPABASE_URL,databaseUrl:env.TEST_DATABASE_URL},approved),db=new pg.Client(testDatabaseConfig(env.TEST_DATABASE_URL,approved));
const hash=value=>createHash('sha256').update(value).digest('hex');
try {
 const manifest=JSON.parse(readFileSync('.secrets/developer-reset/manifest.json','utf8')),binary=readFileSync(manifest.snapshot);assert.equal(hash(binary),manifest.snapshotSha256);assert.equal(manifest.project,target.projectRef);
 const key=await readPrivateKey({armoredKey:readFileSync('.secrets/auth-mail/private.asc','utf8')}),payload=String((await decrypt({message:await readMessage({binaryMessage:binary}),decryptionKeys:key})).data);assert.equal(hash(payload),manifest.payloadSha256);const baseline=JSON.parse(payload);
 const email=JSON.parse(readFileSync('.secrets/developer-registration.json','utf8')).email.trim().toLowerCase();assert.equal(hash(email),manifest.emailHash);
 await db.connect();await db.query('begin isolation level repeatable read read only');assert.equal((await db.query('select marker from foundation_probe.environment_identity where singleton')).rows[0]?.marker,target.databaseMarker);
 const identity=(await db.query('select id,email,email_confirmed_at,created_at,deleted_at,banned_until from auth.users where email=$1',[email])).rows;assert.equal(identity.length,1);assert.deepEqual(JSON.parse(JSON.stringify(identity[0])),baseline.account);
 const factors=(await db.query('select id,factor_type,status,created_at from auth.mfa_factors where user_id=$1',[manifest.userId])).rows;assert.deepEqual(JSON.parse(JSON.stringify(factors)),baseline.factors);
 let rowsChecked=0;for(const [table,filter,parameters,select] of [
  ['private.businesses','id=any($1::uuid[])',[manifest.ownedIds],row=>manifest.ownedIds.includes(row.id)],
  ['private.shops','business_id=any($1::uuid[])',[manifest.ownedIds],row=>manifest.ownedIds.includes(row.business_id)],
  ['private.memberships','user_id=$1',[manifest.userId],row=>row.user_id===manifest.userId],
  ...['account_profiles','account_security','factor_bindings','security_permits','legal_acceptances'].map(t=>[`private.${t}`,'user_id=$1',[manifest.userId],row=>row.user_id===manifest.userId]),
  ['private.access_audit','business_id=any($1::uuid[])',[manifest.ownedIds],row=>manifest.ownedIds.includes(row.business_id)],
  ['private.access_commands','actor_id=$1',[manifest.userId],row=>row.actor_id===manifest.userId],
 ]) {
  const rows=(await db.query(`select to_jsonb(t) row from ${table} t where ${filter} order by to_jsonb(t)::text`,parameters)).rows.map(row=>row.row),expected=baseline.rows[table].filter(select);assert.deepEqual(rows,expected);rowsChecked+=rows.length;
 }
 const gates=(await db.query('select * from private.release_gates where singleton')).rows[0];assert(['registration_enabled','eligibility_approved','legal_publication_enabled','external_mail_enabled','disposal_enabled'].every(k=>gates[k]===false));await db.query('commit');
 const report={checkedAt:new Date().toISOString(),project:target.projectRef,markerVerified:true,privateIdentityMatched:true,existingAccountAndVerifiedMfaUnchanged:true,existingWorkspaceMembershipLocationAndHistoryUnchanged:true,applicationRowsCompared:rowsChecked,releaseGatesClosed:true,remoteChanges:0,privateValuesPrinted:false};writeFileSync('artifacts/developer-reset-preservation.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch{try{await db.query('rollback');}catch{}console.error('Preservation check failed; private details suppressed. No remote changes made.');process.exitCode=1;}finally{await db.end();}
