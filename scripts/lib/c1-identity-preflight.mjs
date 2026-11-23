import assert from 'node:assert/strict';
const sort=rows=>[...rows].sort((a,b)=>(a.schema+'.'+a.name).localeCompare(b.schema+'.'+b.name));
/** No provider/DB/file access. The correction checks owner reads, not delegation. */
function capabilities(observed,baseline){
 assert.equal(observed.marker,'fireworks-foundation-proof-01a12e38');
 assert.equal(observed.currentUser,'postgres');
 assert.equal(observed.cohorts,0);assert.equal(observed.dispatches,0);assert.equal(observed.persistentIntents,0);assert.equal(observed.refreshTriggers,0);
 assert.deepEqual(observed.operator,baseline.operator);
 assert(observed.operator.canCreatePrivate);assert(observed.ownerCanReplaceFunctions);
 assert.deepEqual(observed.schemas,baseline.schemas);
 assert.deepEqual(observed.managedAuth,baseline.managedAuth);
 assert(observed.schemas.find(s=>s.schema==='auth')?.operatorUsage);
 assert.equal(observed.schemas.find(s=>s.schema==='auth')?.registrationUsage,false);
 assert.equal(observed.identityColumns.length,6);assert(observed.identityColumns.every(c=>c.operatorSelect));
 assert.deepEqual([...observed.identityColumns].sort((a,b)=>a.column.localeCompare(b.column)),[...baseline.identityColumns].sort((a,b)=>a.column.localeCompare(b.column)));
 assert.deepEqual(observed.identityColumns.map(c=>c.column).sort(),['id','email','email_confirmed_at','deleted_at','banned_until','is_anonymous'].sort());
 assert.deepEqual(observed.registrationRole,{superuser:false,bypassRls:false,login:false,createrole:false,createdb:false,inherit:false});
 assert.equal(observed.registrationPrivateCreate,false);
 for(const flag of ['admission_enabled','delivery_enabled','transport_ready','session_policy_ready'])assert.equal(observed.controls[flag],false);
 for(const field of ['approval_generation','worker_id','worker_until','heartbeat_at','terms_id','privacy_id','approved_sender_sha256'])assert.equal(observed.controls[field],null);
 assert.equal(observed.controls.session_policy,'strict');assert(observed.controls.stopped_at);
 assert(observed.gatesClosed&&observed.pilotClosed&&observed.newTablesForcedRls);
}
function migrationPrefix(observed){
 assert.deepEqual(observed.migrations.slice(0,23).map(m=>m.name).slice(-3),['mitsa_persistent_registration_inactive','mitsa_persistent_registration_hooks_inactive','mitsa_persistent_registration_c1_forward_recovery']);
}
export function assertC1IdentityPreflight(observed,baseline){
 capabilities(observed,baseline);assert.equal(observed.helperCollisions,0);
 assert.deepEqual(sort(observed.functions),sort(baseline.functions));migrationPrefix(observed);assert.equal(observed.migrations.length,23);
}
export function assertC1IdentityPostflight(observed,baseline,manifest){
 capabilities(observed,baseline);assert.equal(observed.helperCollisions,1);
 const expected=manifest.functions.map(({result,...f})=>f);
 assert.deepEqual(sort(observed.functions),sort(expected));migrationPrefix(observed);
 assert.equal(observed.migrations.length,24);assert.equal(observed.migrations[23].name,'mitsa_registration_identity_boundary');
}
