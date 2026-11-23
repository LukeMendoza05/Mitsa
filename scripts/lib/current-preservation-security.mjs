import assert from 'node:assert/strict';
export function assertCurrentSecurity(payload,baseline,manifest){
 for(const expected of manifest.functions){
  const rows=payload.security.functions.filter(r=>r.schema===expected.schema&&r.name===expected.name);assert.equal(rows.length,1);
  const row=rows[0];for(const name of ['owner','definer','settings','acl'])assert.deepEqual(row[name],expected[name]);assert.equal(row.digest,expected.sha256);
 }
 const role=payload.security.roles.find(r=>r.name==='app_registration');assert(role);for(const name of ['superuser','bypassrls','login','createrole','createdb','inherit'])assert.equal(role[name],false);
 for(const name of ['registration_control','account_registration_policy','auth_mail_dispatch']){const table=payload.security.relations.find(r=>r.schema==='private'&&r.name===name);assert(table?.rls&&table?.forced);}
 const grants=payload.security.schemaGrants[0]?.grants;assert(grants);const auth=grants.schemas.find(r=>r.name==='auth');assert.equal(auth.owner,baseline.managedAuth.schema.owner);assert.equal(auth.acl,baseline.managedAuth.schema.acl);
 const users=payload.security.relations.find(r=>r.schema==='auth'&&r.name==='users');assert(users);for(const name of ['owner','acl','rls','forced'])assert.deepEqual(users[name],baseline.managedAuth.users[name]);
 const columns=payload.security.columnAcls.filter(r=>r.schema==='auth'&&r.name==='users').map(r=>({column:r.column,acl:r.acl}));assert.deepEqual(columns,baseline.managedAuth.userColumnAcls);
 assert.equal(payload.security.migrations.length,24);assert.equal(payload.security.migrations[23].name,'mitsa_registration_identity_boundary');
 return {c1FunctionsVerified:manifest.functions.length,managedAuthPrivilegesMatch:true,customRoleNotElevated:true,privateTablesForcedRls:true,migrationCheckpointMatches:true};
}
