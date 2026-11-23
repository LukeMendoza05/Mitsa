// Pure review/comparison only. No database, secrets, network or publication.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const approvedTestNoticeSha256='ced89e0a97f9b96cb25902ce6ed4ae97a2b8c15df520ab81beab9e22c6f16538';
const sha=value=>createHash('sha256').update(value).digest('hex');
export function reviewedTestNotices(sql){
 assert.equal(sha(sql),approvedTestNoticeSha256,'approved notice SQL changed');
 const result=[...sql.matchAll(/\('([0-9a-f-]{36})','(terms|privacy)',\s*'([^']*)'\)/g)].map(([,id,kind,content])=>({id,kind,version:'isolated-persistent-synthetic-v1',content,content_hash:sha(content),status:'test',approved_at:null,effective_at:null}));
 assert.deepEqual(result.map(r=>({id:r.id,kind:r.kind})),[{id:'98b7abf1-bca4-474f-aee4-e851b4f28d84',kind:'terms'},{id:'40714378-eb52-46cf-a7cf-760db4100456',kind:'privacy'}]);
 return result;
}
export function assertTestNoticeDelta(before,after,notices,{databaseStartedAt,databaseEndedAt}){
 const table='private.legal_versions',old=before.rows[table],current=after.rows[table];
 assert.equal(current.length,old.length+2,'expected exactly two notice additions');
 assert(notices.every(n=>!old.some(r=>r.id===n.id||r.version===n.version)),'notice collision in baseline');
 for(const n of notices){
  const row=current.find(r=>r.id===n.id);assert(row,'expected notice missing');
  const {created_at,...content}=row;assert.deepEqual(content,n,'installed notice differs from exact reviewed text/status');
  assert(Number.isFinite(Date.parse(created_at))&&Date.parse(created_at)>=Date.parse(databaseStartedAt)&&Date.parse(created_at)<=Date.parse(databaseEndedAt),'unexpected notice creation timestamp');
 }
 const copy=structuredClone(after);copy.rows[table]=current.filter(r=>!notices.some(n=>n.id===r.id));
 assert.deepEqual(copy,before,'unapproved account/business/control/security/history delta');
 return {noticeRowsAdded:2,allOtherPreserved:true,existingC3ALedgerRowsPreserved:true};
}
