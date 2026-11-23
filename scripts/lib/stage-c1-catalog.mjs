import pg from 'pg';
import assert from 'node:assert/strict';

export function assertC1AuthGrantCapability(value) {
 assert.equal(value,true,'C1 requires an authorized auth-schema USAGE grantor; stop before installation');
}

// pg returns PostgreSQL name[] as array text; PGlite returns a JS array.
// Use PostgreSQL's text-array parser, preserving each exact role identifier.
export function normalizePolicyRoles(policies) {
 return policies.map(row=>({...row,roles:typeof row.roles==='string'
  ?pg.types.getTypeParser(1009)(row.roles):row.roles}));
}

// PostgreSQL automatically grants ADMIN (without SET/INHERIT) to a
// non-superuser CREATEROLE creator. PGlite's superuser creator has no such row.
export function expectedC1MembershipDelta(beforeRoles,expectedDelta) {
 const creator=beforeRoles.find(r=>r.name==='postgres');
 return {...expectedDelta,added:creator?.createrole&&!creator.superuser
  ?[...expectedDelta.added,{role:'app_registration',member:'postgres',admin:true}]
  :expectedDelta.added};
}
