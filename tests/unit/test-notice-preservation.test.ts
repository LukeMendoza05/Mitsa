import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {reviewedTestNotices,assertTestNoticeDelta} from '../../scripts/lib/test-notice-preservation.mjs';
const sql=readFileSync('supabase/security-proposals/persistent-registration-test-notices.sql.txt','utf8');
const time={databaseStartedAt:'2026-10-24T01:00:00Z',databaseEndedAt:'2026-10-24T01:00:01Z'};
function fixture(){
 const notices=reviewedTestNotices(sql),before={rows:{'private.legal_versions':[{id:'old',status:'test'}],'private.registration_requests':[{request_hash:'prior-c3a'}]},identities:{users:[{id:'existing',digest:'unchanged'}]},security:{rls:true}};
 const after=structuredClone(before) as any;after.rows['private.legal_versions'].push(...notices.map(n=>({...n,created_at:time.databaseStartedAt})));
 return {before,after,notices};
}
it('accepts exactly the two reviewed inactive notices while preserving the C3A ledger',()=>{
 const f=fixture();expect(assertTestNoticeDelta(f.before,f.after,f.notices,time)).toEqual({noticeRowsAdded:2,allOtherPreserved:true,existingC3ALedgerRowsPreserved:true});
});
it('rejects changed SQL before deriving expected content',()=>{expect(()=>reviewedTestNotices(sql+' ')).toThrow('SQL changed');});
it.each(['status','content','content_hash','approved_at','extra'])('rejects notice field drift: %s',field=>{
 const f=fixture();f.after.rows['private.legal_versions'][1][field]='changed';expect(()=>assertTestNoticeDelta(f.before,f.after,f.notices,time)).toThrow();
});
it('rejects any retained identity, ledger, permission or extra-row change',()=>{
 const f=fixture();f.after.identities.users[0].digest='changed';expect(()=>assertTestNoticeDelta(f.before,f.after,f.notices,time)).toThrow();
 const g=fixture();g.after.rows['private.registration_requests']=[];expect(()=>assertTestNoticeDelta(g.before,g.after,g.notices,time)).toThrow();
 const h=fixture();h.after.security.rls=false;expect(()=>assertTestNoticeDelta(h.before,h.after,h.notices,time)).toThrow();
 const i=fixture();i.after.rows['private.legal_versions'].push({id:'unapproved'});expect(()=>assertTestNoticeDelta(i.before,i.after,i.notices,time)).toThrow();
});
