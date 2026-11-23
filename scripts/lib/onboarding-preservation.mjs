// Exact retained-row preservation plus explicitly bound NEW cohort additions.
// No connection, capture, acceptance or baseline replacement occurs on import.
import assert from 'node:assert/strict';
import {fingerprintSql} from './current-preservation.mjs';
import {assertStageCPreservation} from './stage-c-preservation.mjs';
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
export const onboardingAdditionFilters=Object.freeze({
 'auth.users':'t.id=any($2::uuid[])',
 'auth.identities':'t.user_id=any($2::uuid[])',
 'auth.mfa_factors':'t.user_id=any($2::uuid[])',
 'private.registration_intents':'t.id=any($3::uuid[])',
 'private.account_registration_policy':'t.user_id=any($2::uuid[]) and t.intent_id=any($3::uuid[])',
 'private.auth_mail_dispatch':'t.id=any($4::uuid[]) and t.intent_id=any($3::uuid[]) and (t.provider_user_id is null or t.provider_user_id=any($2::uuid[]))',
 'private.isolated_auth_mail':'t.id=any($5::uuid[])',
 'private.registration_requests':'t.request_hash=any($6::text[])',
 'private.account_profiles':'t.user_id=any($2::uuid[])',
 'private.account_security':'t.user_id=any($2::uuid[])',
 'private.factor_bindings':'t.user_id=any($2::uuid[])',
 'private.security_permits':'t.user_id=any($2::uuid[])',
 'private.legal_acceptances':'t.user_id=any($2::uuid[]) and t.version_id=any($8::uuid[])',
 'private.businesses':'t.id=any($7::uuid[]) and t.primary_owner_id=any($2::uuid[])',
 'private.memberships':'t.user_id=any($2::uuid[]) and t.business_id=any($7::uuid[])',
 'private.shops':'t.business_id=any($7::uuid[])',
 'private.access_commands':'t.actor_id=any($2::uuid[])',
 'private.access_audit':'t.actor_id=any($2::uuid[]) and (t.business_id is null or t.business_id=any($7::uuid[]))'
});
export function onboardingAdditionQueries(registry){
 const queries={};for(const [table,filter] of Object.entries(onboardingAdditionFilters)){const r=registry.find(r=>r.schema+'.'+r.table===table);assert(r,'Required cohort relation missing');const sql=fingerprintSql(table,r.keys,{auth:r.schema==='auth'}).replace(' t order by',` t where ${filter} order by`);
  // Explicit positions remain typed even when this table does not use them.
  queries[table]=sql.replace(' where '," where ($2::uuid[] is not null and $3::uuid[] is not null and $4::uuid[] is not null and $5::uuid[] is not null and $6::text[] is not null and $7::uuid[] is not null and $8::uuid[] is not null) and ");
 }return queries;
}
export async function collectOnboardingAdditions(db,{registry,comparisonKey,users,intents,dispatches,captures,requestHashes,businesses,notices}){
 assert(Buffer.isBuffer(comparisonKey)&&comparisonKey.length===32);for(const values of [users,intents,dispatches,captures,businesses,notices])assert(Array.isArray(values)&&values.every(uuid),'Unbound cohort IDs');assert(users.length<=2&&intents.length<=2&&dispatches.length<=6&&captures.length<=6&&businesses.length<=2&&notices.length===2);assert(Array.isArray(requestHashes)&&requestHashes.length<=120&&requestHashes.every(v=>/^[a-f0-9]{64}$/.test(v)));
 const allowed={},args=[comparisonKey,users,intents,dispatches,captures,requestHashes,businesses,notices];for(const [table,text] of Object.entries(onboardingAdditionQueries(registry))){const rows=(await db.query(text,args)).rows;assert(rows.length<=10000,'Cohort preservation cannot accept truncated results');allowed[table]=rows;}return allowed;
}
export function assertOnboardingPreservation(before,after,allowed){
 // Existing rows, Auth WHOLE rows, metadata, controls, schema and ACLs must
 // match exactly. Activity-only differences are not silently excluded.
 return {...assertStageCPreservation(before,after,allowed),historicalBaselineReplaced:false};
}
