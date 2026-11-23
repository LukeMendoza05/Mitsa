import {it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {createHmac} from 'node:crypto';
import {fingerprintSql} from '../../scripts/lib/current-preservation.mjs';
import {compareLegacyToCurrent} from '../../scripts/lib/legacy-preservation-bridge.mjs';
it('bridges historical JSON records to keyed v2 rows without treating Auth drift as harmless',async()=>{
 const key=Buffer.alloc(32,7),db=new PGlite({extensions:{pgcrypto}});try{
 await db.exec("create schema extensions;create extension pgcrypto with schema extensions;create schema private;create table private.example(id uuid primary key,details jsonb,created_at timestamptz);insert into private.example values('00000000-0000-4000-8000-000000000001','{\"longer\":null,\"x\":[3,true]}','2026-10-27T00:00:00Z')");
 const rows=(await db.query('select to_jsonb(t) r from private.example t')).rows as any[];
 const current={registry:[{schema:'private',table:'example',keys:['id']}],rows:{'private.example':(await db.query(fingerprintSql('private.example',['id']),[key])).rows},identities:{'auth.users':[{key:createHmac('sha256',key).update(JSON.stringify(['00000000-0000-4000-8000-000000000001'])).digest('hex'),legacy_digest:'new'}],'auth.mfa_factors':[]},security:{policies:[],relations:[],columnAcls:[]}};
 const legacy={rows:{'private.example':rows.map(r=>r.r)},identities:{users:[{id:'00000000-0000-4000-8000-000000000001',digest:'old'}],mfa_factors:[]},security:current.security};
 const result=await compareLegacyToCurrent(legacy,current,key);expect(result.tableDifferences).toEqual([]);expect(result.auth[0]).toMatchObject({added:0,removed:0,changed:1});expect(result.securityDifferences).toEqual([]);expect(result.newlyCoveredAuthIdentitiesNotHistoricallyProven).toBe(true);
 }finally{await db.close();}
},30000);
