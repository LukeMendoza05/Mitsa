// OFFLINE bridge: replay historical JSON through PostgreSQL canonicalization.
// No hosted connection; old snapshots are never rewritten or reinterpreted as v2.
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {createHmac} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import assert from 'node:assert/strict';
export async function compareLegacyToCurrent(legacy,current,key){
 const db=new PGlite({extensions:{pgcrypto}});try{
  await db.exec('create schema extensions;create extension pgcrypto with schema extensions');
  const tableDifferences=[];
  for(const [table,rows] of Object.entries(legacy.rows)){
   const spec=current.registry.find(r=>r.schema+'.'+r.table===table);assert(spec);
   const identity=spec.keys.length?`jsonb_build_array(${spec.keys.map(k=>{assert(/^[a-z_][a-z0-9_]*$/.test(k));return "r->'"+k+"'";}).join(',')})::text`:'r::text';
   const expected=(await db.query(`select encode(extensions.hmac(convert_to(${identity},'UTF8'),$2::bytea,'sha256'),'hex') key,encode(extensions.hmac(convert_to(r::text,'UTF8'),$2::bytea,'sha256'),'hex') digest from jsonb_array_elements($1::jsonb) r order by 1,2`,[JSON.stringify(rows),key])).rows;
   if(!isDeepStrictEqual(expected,current.rows[table]))tableDifferences.push(table);
  }
  const auth=[];for(const name of ['users','mfa_factors']){
   const expected=new Map(legacy.identities[name].map(r=>[createHmac('sha256',key).update(JSON.stringify([r.id])).digest('hex'),r.digest]));
   const actual=current.identities['auth.'+name],seen=new Set(actual.map(r=>r.key));
   auth.push({table:name,added:actual.filter(r=>!expected.has(r.key)).length,removed:[...expected.keys()].filter(k=>!seen.has(k)).length,changed:actual.filter(r=>expected.has(r.key)&&expected.get(r.key)!==r.legacy_digest).length});
  }
  const securityDifferences=['policies','relations','columnAcls'].filter(k=>!isDeepStrictEqual(legacy.security[k],current.security[k]));
  return {applicationTablesCompared:Object.keys(legacy.rows).length,tableDifferences,auth,securityDifferences,newlyCoveredAuthIdentitiesNotHistoricallyProven:true,canonicalizationLimit:'Historical JSON numeric precision/representation cannot be reconstructed beyond what the original collector retained; any mismatch stops acceptance.'};
 }finally{await db.close();}
}
