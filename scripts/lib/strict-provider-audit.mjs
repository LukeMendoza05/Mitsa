// Source-bound diagnostic only. No client, credential read or I/O on import.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
export const strictAuditLimits=Object.freeze({databaseConnections:1,sqlRequests:6,selects:4,transactions:2,healthRequests:1,runtimeSeconds:120});
export const strictAuditSql=Object.freeze({
 begin:'begin isolation level repeatable read read only',
 guard:`select (select marker from foundation_probe.environment_identity where singleton) marker,
 (select not(admission_enabled or delivery_enabled or transport_ready or session_policy_ready) and session_policy='strict' from private.registration_control where singleton) controls_closed,
 (select not(registration_enabled or external_mail_enabled or eligibility_approved or legal_publication_enabled or disposal_enabled) from private.release_gates where singleton) release_closed,
 (select not(enabled or smtp_enabled) from private.pilot_registration_window where singleton) pilot_closed,
 encode(sha256(convert_to(pg_get_functiondef('private.current_actor()'::regprocedure),'UTF8')),'hex') actor_sha256`,
 shape:`select count(*)::int total_sessions,
 count(*) filter(where to_jsonb(s)->>'refresh_token_counter' is not null)::int counter_present,
 count(*) filter(where to_jsonb(s)->>'refresh_token_counter' is null)::int counter_absent from auth.sessions s`,
 invariants:`select (select count(*)::int from auth.users) users,
 (select count(*)::int from auth.mfa_factors) factors,
 (select count(*)::int from auth.identities) identities,
 (select count(*)::int from private.auth_mail_dispatch where state in ('reserved','queued','claimed','unconfirmed')) pending_dispatch,
 (select count(*)::int from pg_trigger t join pg_class r on r.oid=t.tgrelid join pg_namespace n on n.oid=r.relnamespace where n.nspname='auth' and r.relname in ('sessions','refresh_tokens') and not t.tgisinternal) custom_auth_triggers`,
 finish:`select (select not(admission_enabled or delivery_enabled or transport_ready or session_policy_ready) and session_policy='strict' from private.registration_control where singleton) controls_closed,
 (select not(registration_enabled or external_mail_enabled or eligibility_approved or legal_publication_enabled or disposal_enabled) from private.release_gates where singleton) release_closed,
 (select not(enabled or smtp_enabled) from private.pilot_registration_window where singleton) pilot_closed,
 current_setting('transaction_read_only')='on' read_only`,
 rollback:'rollback'
});
const hash=v=>createHash('sha256').update(v).digest('hex');
export function strictAuditAuthority({reviewBytes,authorization,root,now=()=>Date.now()}){
 const review=JSON.parse(String(reviewBytes));
 assert(authorization?.approved===true&&authorization.scope==='G-provider-readonly-v1'&&authorization.evidence?.trim(),'New explicit read-only approval required');
 assert(review.project==='mjtejwafxriwntweussc'&&review.marker==='fireworks-foundation-proof-01a12e38');
 assert(authorization.project===review.project&&authorization.marker===review.marker&&authorization.reviewSha256===hash(reviewBytes));assert.deepEqual(authorization.limits,strictAuditLimits);
 assert(/^[a-f0-9]{64}$/.test(review.actorSha256));assert(review.sources.length>0);
 for(const f of review.sources)assert(hash(readFileSync(f.path))===f.sha256,'Reviewed source differs');
 const active=()=>{const start=Date.parse(authorization.notBefore),end=Date.parse(authorization.notAfter);assert(Number.isFinite(start)&&Number.isFinite(end)&&end>start&&end-start<=1800000&&now()>=start&&now()<end,'Diagnostic authority expired');};active();
 assert(!existsSync(join(root,'attempt.json')),'Diagnostic attempt already consumed');
 let attempted=false,start,sequence=0;const counts={databaseConnections:0,sqlRequests:0,selects:0,transactions:0,healthRequests:0};
 const claim=()=>{active();assert(!attempted);writeFileSync(join(root,'attempt.json'),JSON.stringify({reviewSha256:hash(reviewBytes),claimedAt:now()}),{flag:'wx',mode:0o600,flush:true});attempted=true;start=now();};
 const reserve=kind=>{active();assert(attempted&&now()-start<strictAuditLimits.runtimeSeconds*1000,'Diagnostic deadline reached');assert(Object.hasOwn(counts,kind));const increments=[kind,...(['selects','transactions'].includes(kind)?['sqlRequests']:[])];for(const k of increments)assert(counts[k]<strictAuditLimits[k],'Diagnostic request budget exhausted');writeFileSync(join(root,`request-${String(sequence+1).padStart(3,'0')}.json`),JSON.stringify({reviewSha256:hash(reviewBytes),kinds:increments}),{flag:'wx',mode:0o600,flush:true});sequence++;for(const k of increments)counts[k]++;};
 return {claim,reserve,active,review,counts:()=>({...counts})};
}
export async function runStrictProviderAudit({authority,createClient,fetchHealth,persistPrivate}){
 let client,transaction=false,phase='claim',failure=false;const evidence={};
 const deadline=Date.now()+120000;
 const bounded=async(fn,maximumMs=10000)=>{let timer;try{const remaining=Math.min(maximumMs,deadline-Date.now());assert(remaining>0);return await Promise.race([Promise.resolve().then(fn),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Diagnostic operation deadline')),remaining);})]);}finally{clearTimeout(timer);}};
 try{
  authority.claim();phase='database-connect';authority.reserve('databaseConnections');client=createClient();client.on?.('error',()=>{failure=true;phase='database-async-error';});await bounded(()=>client.connect());
  phase='read-only-transaction';authority.reserve('transactions');await bounded(()=>client.query(strictAuditSql.begin));transaction=true;
  const query=async key=>{phase=key;authority.reserve('selects');return (await bounded(()=>client.query(strictAuditSql[key]))).rows[0];};
  const guard=await query('guard');assert(guard.marker===authority.review.marker&&guard.controls_closed&&guard.release_closed&&guard.pilot_closed&&guard.actor_sha256===authority.review.actorSha256,'Target/control/actor mismatch');
  evidence.shape=await query('shape');assert(evidence.shape.counter_present+evidence.shape.counter_absent===evidence.shape.total_sessions);
  evidence.invariants=await query('invariants');assert(evidence.invariants.custom_auth_triggers===0,'Unreviewed managed Auth trigger');
  phase='health';authority.reserve('healthRequests');const health=await bounded(fetchHealth);assert(health.status===200&&/^v?\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(health.version),'Unverified health response');evidence.reportedVersion=health.version;
  const final=await query('finish');assert(final.controls_closed&&final.release_closed&&final.pilot_closed&&final.read_only,'Read-only/control proof failed');
 }catch{failure=true;}
 finally{
  if(transaction){try{authority.reserve('transactions');await bounded(()=>client.query(strictAuditSql.rollback));transaction=false;}catch{failure=true;phase='rollback-unconfirmed';}}
  try{await bounded(()=>client?.end(),5000);if(client?.connection?.stream)assert(client.connection.stream.destroyed||client.connection.stream.readableEnded,'Database stream remains open');}catch{client?.connection?.stream?.destroy();failure=true;phase='database-close-unconfirmed';}
 }
 // Only approved aggregates/version are persisted, encrypted by the caller.
 const result={status:failure?'FAILED':'PASSED_READONLY_DIAGNOSTIC_NOT_STRICT_ACCEPTANCE',failurePhase:failure?phase:null,counts:authority.counts(),evidence,strictOptionAPassed:false,baselineAccepted:false,hostedMutations:0};
 await persistPrivate(result);return result;
}
