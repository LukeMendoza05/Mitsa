import {it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {onboardingAdditionFilters,onboardingAdditionQueries,collectOnboardingAdditions,assertOnboardingPreservation} from '../../scripts/lib/onboarding-preservation.mjs';
const u='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002',i='20000000-0000-4000-8000-000000000001',b='30000000-0000-4000-8000-000000000001';
const registry=Object.keys(onboardingAdditionFilters).map(t=>({schema:t.split('.')[0],table:t.split('.')[1],keys:['id']}));
it('executes all 18 exact cohort queries in offline PostgreSQL and excludes another identity/tenant',async()=>{
 const db=new PGlite({extensions:{pgcrypto}});try{
  await db.exec('create schema extensions;create extension pgcrypto with schema extensions;create schema auth;create schema private;');
  for(const r of registry)await db.exec(`create table ${r.schema}.${r.table}(id uuid primary key,user_id uuid,intent_id uuid,provider_user_id uuid,primary_owner_id uuid,business_id uuid,version_id uuid,actor_id uuid,request_hash text,last_sign_in_at timestamptz,updated_at timestamptz,private_fixture_value text)`);
  for(const r of registry)await db.query(`insert into ${r.schema}.${r.table}(id,user_id,intent_id,provider_user_id,primary_owner_id,business_id,version_id,actor_id,request_hash,private_fixture_value) values($1,$1,$2,$1,$1,$3,$2,$1,$4,'OFFLINE-PRIVATE'),($5,$5,$5,$5,$5,$5,$5,$5,'foreign','FOREIGN')`,[u,i,b,'a'.repeat(64),other]);
  const args={registry,comparisonKey:Buffer.alloc(32,9),users:[u],intents:[i,u],dispatches:[u],captures:[u],requestHashes:['a'.repeat(64)],businesses:[b,u],notices:[i,other]};
  const additions=await collectOnboardingAdditions(db,args);expect(Object.keys(additions)).toHaveLength(18);
  // Registration-intent's id must itself be bound, not its email alone.
  for(const rows of Object.values(additions) as any[])expect(rows).toHaveLength(1);
  expect(JSON.stringify(additions)).not.toContain('OFFLINE-PRIVATE');expect(JSON.stringify(additions)).not.toContain('FOREIGN');expect(JSON.stringify(additions)).not.toContain(u);
  expect(Object.values(onboardingAdditionQueries(registry)).every((sql:any)=>sql.startsWith('select '))).toBe(true);
 }finally{await db.close();}
},30000);
it('refuses malformed or oversized cohort bounds before querying',async()=>{let called=false;const db={query:async()=>{called=true;return {rows:[]};}},args={registry,comparisonKey:Buffer.alloc(32,9),users:[u],intents:[i],dispatches:[],captures:[],requestHashes:[],businesses:[b],notices:[i,other]};await expect(collectOnboardingAdditions(db,{...args,users:[u,other,u]})).rejects.toThrow();await expect(collectOnboardingAdditions(db,{...args,requestHashes:['invalid']})).rejects.toThrow();expect(called).toBe(false);});
it('preserves whole-row Auth and unknown schema/security changes; approved additions never waive existing drift',()=>{const before={format:'mitsa-preservation-v2',registry:[],controls:{},security:{},rows:{},identities:{'auth.users':[{key:'a',digest:'old',protected_digest:'p',activity_digest:'old'}]}};for(const change of ['digest','activity_digest']){const after=structuredClone(before);after.identities['auth.users'][0][change as 'digest']='new';expect(()=>assertOnboardingPreservation(before,after,{})).toThrow();}const after=structuredClone(before);after.identities['auth.users'].push({key:'b',digest:'new',protected_digest:'p',activity_digest:'new'});expect(assertOnboardingPreservation(before,after,{'auth.users':[after.identities['auth.users'][1]]})).toMatchObject({retainedRowsUnchanged:true,approvedAdditions:1,historicalBaselineReplaced:false});});
