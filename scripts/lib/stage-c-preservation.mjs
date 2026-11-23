import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import {fingerprintSql} from './current-preservation.mjs';
// Explicit fixture-bound additions only. Existing rows may never change.
const filters={
 'auth.users':'t.id=any($2::uuid[])','auth.identities':'t.user_id=any($2::uuid[])',
 'private.registration_intents':'t.id=any($3::uuid[])',
 'private.account_registration_policy':'t.intent_id=any($3::uuid[])',
 'private.auth_mail_dispatch':'t.id=any($4::uuid[])',
 'private.isolated_auth_mail':'t.id=any($5::uuid[])',
 'private.registration_requests':'t.request_hash=any($6::text[])'
};
export async function allowedStageCAdditions(db,{registry,comparisonKey,users,intents,dispatches,captures,requestHashes}) {
 const allowed={};for(const [table,filter] of Object.entries(filters)){
  const r=registry.find(r=>r.schema+'.'+r.table===table);assert(r);
  const sql=fingerprintSql(table,r.keys,{auth:r.schema==='auth'}).replace(' t order by',` t where ${filter} order by`);
  // Keep all bound positions typed even where a particular filter does not use them.
  const typed=sql.replace(' where '," where ($2::uuid[] is not null and $3::uuid[] is not null and $4::uuid[] is not null and $5::uuid[] is not null and $6::text[] is not null) and ");
  allowed[table]=(await db.query(typed,[comparisonKey,users,intents,dispatches,captures,requestHashes])).rows;
 }return allowed;
}
export function assertStageCPreservation(before,after,allowed={}) {
 for(const f of ['format','registry','controls','security'])assert(isDeepStrictEqual(before[f],after[f]),'Security/control/schema drift');
 let added=0;for(const group of ['rows','identities']){
  assert.deepEqual(Object.keys(before[group]),Object.keys(after[group]));
  for(const [table,old] of Object.entries(before[group])){
   const current=after[group][table],map=new Map(current.map(r=>[r.key,r]));assert.equal(map.size,current.length);
   for(const row of old)assert(isDeepStrictEqual(map.get(row.key),row),'Retained row changed or removed');
   const prior=new Set(old.map(r=>r.key)),permitted=new Map((allowed[table]??[]).map(r=>[r.key,r]));
   for(const row of current)if(!prior.has(row.key)){assert(isDeepStrictEqual(permitted.get(row.key),row),'Unapproved addition');added++;}
  }
 }return {retainedRowsUnchanged:true,approvedAdditions:added};
}
