import {it,expect} from 'vitest';
import {inspectApprovedQueries} from '../../.tools/run-auth-metadata-inspection.mjs';
import {queries} from '../../scripts/lib/registration-auth-metadata-review.mjs';
const account='00000000-0000-4000-8000-000000000001';
const review={marker:'fixture-marker',transactionSql:{begin:'begin isolation level repeatable read read only',success:'commit',failure:'rollback'},evidenceWindow:{start:'2026-10-24T00:00:00Z',end:'2026-10-27T00:00:00Z'}};
function mock({audit=true,wrongMarker=false,denied=false,failSql='',commitFails=false}={}){
 const calls:{sql:string,args:unknown}[]=[],sealed:unknown[]=[];
 const read=async(sql:string,args:unknown)=>{calls.push({sql,args});if(sql===failSql||(commitFails&&sql==='commit'))throw Error('Private details must never be emitted');
 if(sql===queries.guard)return {rows:[{marker:wrongMarker?'wrong':review.marker,controls_closed:true,release_closed:true,pilot_closed:true,columns:[{relation:'auth.users',required:true,present:true,readable:!denied},...['payload','created_at'].map(column=>({relation:'auth.audit_log_entries',column,required:false,present:audit,readable:audit}))]}]};
 if(sql===queries.user)return {rows:[{is_anonymous:false}]};
 return {rows:[]};};
 return {calls,sealed,args:{read,account,review,seal:async(value:unknown)=>{sealed.push(structuredClone(value));}}};
}
it('uses exactly the six reviewed statements with only private bound identity parameters',async()=>{
 const m=mock();await inspectApprovedQueries(m.args);expect(m.calls.map(c=>c.sql)).toEqual([review.transactionSql.begin,queries.guard,queries.user,queries.factors,queries.audit,'commit']);expect(m.calls[2].args).toEqual([account]);expect(m.calls[4].args).toEqual([account,review.evidenceWindow.start,review.evidenceWindow.end]);expect(m.sealed).toHaveLength(4);
});
it('skips unavailable audit storage without substitutes or extra requests',async()=>{
 const m=mock({audit:false});const result=await inspectApprovedQueries(m.args);expect(m.calls).toHaveLength(5);expect(result.audit).toBeNull();expect(m.calls.some(c=>c.sql===queries.audit)).toBe(false);
});
it.each([{wrongMarker:true},{denied:true}])('guard failures stop before account reads and roll back once: %o',async options=>{
 const m=mock(options);await expect(inspectApprovedQueries(m.args)).rejects.toThrow();expect(m.calls.map(c=>c.sql)).toEqual([review.transactionSql.begin,queries.guard,'rollback']);
});
it('does not retry failed SELECTs',async()=>{
 const m=mock({failSql:queries.factors});await expect(inspectApprovedQueries(m.args)).rejects.toThrow();expect(m.calls).toHaveLength(5);expect(m.calls.at(-1)?.sql).toBe('rollback');expect(m.calls.filter(c=>c.sql===queries.factors)).toHaveLength(1);
});
it('never adds a seventh statement when COMMIT response is uncertain',async()=>{
 const m=mock({commitFails:true});await expect(inspectApprovedQueries(m.args)).rejects.toThrow();expect(m.calls).toHaveLength(6);expect(m.calls.filter(c=>c.sql==='rollback')).toHaveLength(0);
});
it('a failed BEGIN is not retried and does not issue a needless terminal statement',async()=>{
 const m=mock({failSql:review.transactionSql.begin});await expect(inspectApprovedQueries(m.args)).rejects.toThrow();expect(m.calls).toHaveLength(1);
});
