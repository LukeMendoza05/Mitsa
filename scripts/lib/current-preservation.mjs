// v2 preservation: database-side fingerprints only; never return secret columns.
import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
export const activityFields=Object.freeze(['last_sign_in_at','updated_at']);
const ident=v=>{assert(/^[a-z_][a-z0-9_]*$/.test(v));return '"'+v+'"';};
const relation=v=>{const parts=v.split('.');assert.equal(parts.length,2);return parts.map(ident).join('.');};
export const preservedSchemas="('private','foundation_probe','auth')";
export const captureGuardSql=`select
 (select marker from foundation_probe.environment_identity where singleton) marker,
 (select jsonb_build_object('admission',admission_enabled,'delivery',delivery_enabled,'transport',transport_ready,'security',session_policy_ready,'policy',session_policy,'termsSelected',terms_id is not null,'privacySelected',privacy_id is not null) from private.registration_control where singleton) controls,
 (select not(registration_enabled or external_mail_enabled or legal_publication_enabled or eligibility_approved or disposal_enabled) from private.release_gates where singleton) release_closed,
 (select not(enabled or smtp_enabled) from private.pilot_registration_window where singleton) pilot_closed,
 has_schema_privilege('app_registration','auth','USAGE') registration_auth_usage,
 has_schema_privilege('app_registration','private','CREATE') registration_private_create,
 coalesce(has_function_privilege(to_regprocedure('extensions.hmac(bytea,bytea,text)'),'EXECUTE'),false) hmac_available,
 (select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'position',a.attnum) order by a.attnum) from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),'keys',coalesce((select jsonb_agg(a.attname::text order by k.position) from pg_index i cross join lateral unnest(i.indkey) with ordinality k(attnum,position) join pg_attribute a on a.attrelid=c.oid and a.attnum=k.attnum where i.indrelid=c.oid and i.indisprimary),'[]'::jsonb)) order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p') and (n.nspname in ('private','foundation_probe') or (n.nspname='auth' and c.relname in ('users','mfa_factors','identities')))) registry`;
export const securityQueries=Object.freeze({
 policies:`select to_jsonb(p) p from pg_policies p where schemaname in ${preservedSchemas} order by schemaname,tablename,policyname`,
 relations:`select n.nspname schema,c.relname name,pg_get_userbyid(c.relowner) owner,c.relacl::text acl,c.relrowsecurity rls,c.relforcerowsecurity forced from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ${preservedSchemas} and c.relkind in ('r','p') order by 1,2`,
 columnAcls:`select n.nspname schema,c.relname name,a.attname column,a.attacl::text acl from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ${preservedSchemas} and c.relkind in ('r','p') and a.attnum>0 and not a.attisdropped order by 1,2,a.attnum`,
 functions:`select n.nspname schema,p.proname name,pg_get_function_identity_arguments(p.oid) signature,pg_get_userbyid(p.proowner) owner,p.prosecdef definer,p.proconfig settings,p.proacl::text acl,encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') digest from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','api','foundation_probe') and p.prokind in ('f','p') order by 1,2,3`,
 roles:`select r.rolname name,r.rolsuper superuser,r.rolbypassrls bypassrls,r.rolcanlogin login,r.rolcreaterole createrole,r.rolcreatedb createdb,r.rolinherit inherit,(select coalesce(jsonb_agg(pg_get_userbyid(m.roleid) order by m.roleid),'[]'::jsonb) from pg_auth_members m where m.member=r.oid) memberships from pg_roles r where r.rolname in ('app_registration','app_workspace','anon','authenticated','service_role','supabase_auth_admin','postgres') order by r.rolname`,
 migrations:'select version,name from supabase_migrations.schema_migrations order by version',
 schemaGrants:`select jsonb_build_object('schemas',(select jsonb_agg(jsonb_build_object('name',nspname,'owner',pg_get_userbyid(nspowner),'acl',nspacl::text) order by nspname) from pg_namespace where nspname in ('private','foundation_probe','auth','api','extensions')),'defaults',(select coalesce(jsonb_agg(jsonb_build_object('owner',pg_get_userbyid(defaclrole),'schema',coalesce(n.nspname,''),'kind',defaclobjtype,'acl',defaclacl::text) order by defaclrole,defaclnamespace,defaclobjtype),'[]'::jsonb) from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace)) grants`
});
const keyed=expr=>`encode(extensions.hmac(convert_to(${expr},'UTF8'),$1::bytea,'sha256'),'hex')`;
export function fingerprintSql(table,keys,{auth=false}={}){
 const name=relation(table);assert(Array.isArray(keys));for(const key of keys)ident(key);
 const identity=keys.length?`jsonb_build_array(${keys.map(k=>'t.'+ident(k)).join(',')})::text`:'to_jsonb(t)::text';
 const columns=[`${keyed(identity)} key`,`${keyed('to_jsonb(t)::text')} digest`];
 if(auth){
  assert(['auth.users','auth.mfa_factors','auth.identities'].includes(table));
  columns.push("encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') legacy_digest");
  if(table==='auth.users'){
   columns.push(`${keyed("(to_jsonb(t)-array['last_sign_in_at','updated_at']::text[])::text")} protected_digest`);
   columns.push(`${keyed("jsonb_build_array(t.last_sign_in_at,t.updated_at)::text")} activity_digest`);
  }
 }
 return `select ${columns.join(',')} from ${name} t order by 1,2 limit 10001`;
}
export function assertRegistry(registry,expected){
 assert(Array.isArray(registry));const actual=registry.map(r=>r.schema+'.'+r.table);assert.equal(new Set(actual).size,actual.length);
 assert.deepEqual(actual.filter(t=>!t.startsWith('auth.')),expected.applicationTables);
 assert.deepEqual(actual.filter(t=>t.startsWith('auth.')),['auth.identities','auth.mfa_factors','auth.users']);
 for(const r of registry){const table=r.schema+'.'+r.table,names=r.columns.map(c=>c.name);assert.deepEqual(names,expected.columns[table]);assert(r.keys.every(k=>names.includes(k)));}
}
export async function collectCurrentPreservation(db,{expected,comparisonKey,marker='fireworks-foundation-proof-01a12e38'}){
 assert(Buffer.isBuffer(comparisonKey)&&comparisonKey.length===32);
 const guard=(await db.query(captureGuardSql)).rows[0];assert.equal(guard.marker,marker);assert.equal(guard.hmac_available,true);assert.equal(guard.release_closed,true);assert.equal(guard.pilot_closed,true);assert.equal(guard.registration_auth_usage,false);assert.equal(guard.registration_private_create,false);
 assert.deepEqual(guard.controls,{admission:false,delivery:false,transport:false,security:false,policy:'strict',termsSelected:false,privacySelected:false});
 assertRegistry(guard.registry,expected);
 const rows={},identities={};for(const r of guard.registry){const table=r.schema+'.'+r.table,digests=(await db.query(fingerprintSql(table,r.keys,{auth:r.schema==='auth'}),[comparisonKey])).rows;
  assert(digests.length<=10000,'capture row ceiling exceeded; never accept truncation');for(const d of digests)for(const value of Object.values(d))assert(/^[a-f0-9]{64}$/.test(value));
  (r.schema==='auth'?identities:rows)[table]=digests;
 }
 const security={};for(const [name,sql] of Object.entries(securityQueries))security[name]=(await db.query(sql)).rows;
 return {format:'mitsa-preservation-v2',registry:guard.registry,controls:guard.controls,rows,identities,security};
}
export function compareCurrentPreservation(before,after){
 assert.equal(before.format,'mitsa-preservation-v2');assert.equal(after.format,before.format);
 const findings=[];for(const field of ['registry','controls','security'])if(!isDeepStrictEqual(before[field],after[field]))findings.push({category:field});
 for(const group of ['rows','identities'])for(const table of new Set([...Object.keys(before[group]),...Object.keys(after[group])])){
  const old=before[group][table],current=after[group][table];if(isDeepStrictEqual(old,current))continue;
  if(!old||!current){findings.push({category:'table-presence',table});continue;}
  // Registry/key changes already fail above. Tables without PK retain multiset
  // fingerprints and are conservatively added/removed, never guessed updates.
  const b=new Map(old.map(r=>[r.key,r])),a=new Map(current.map(r=>[r.key,r]));
  if(b.size!==old.length||a.size!==current.length){
   const counts=rows=>{const m=new Map();for(const r of rows){const key=JSON.stringify(r);m.set(key,(m.get(key)??0)+1);}return m;},bc=counts(old),ac=counts(current);
   findings.push({category:'protected-or-unclassified-change',table,added:[...ac].reduce((n,[key,count])=>n+Math.max(0,count-(bc.get(key)??0)),0),removed:[...bc].reduce((n,[key,count])=>n+Math.max(0,count-(ac.get(key)??0)),0),changed:0});continue;
  }
  const added=current.filter(r=>!b.has(r.key)).length,removed=old.filter(r=>!a.has(r.key)).length;
  const changed=current.filter(r=>b.has(r.key)&&!isDeepStrictEqual(b.get(r.key),r));
  const activityOnly=table==='auth.users'&&added===0&&removed===0&&changed.length>0&&changed.every(r=>{const prior=b.get(r.key);return prior.protected_digest===r.protected_digest&&prior.activity_digest!==r.activity_digest;});
  findings.push({category:activityOnly?'known-activity-fields-only':'protected-or-unclassified-change',table,added,removed,changed:changed.length});
 }
 return {exactMatch:isDeepStrictEqual(before,after),findings,automaticallyAccepted:false};
}
