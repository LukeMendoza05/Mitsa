import {it,expect,vi} from 'vitest';
import {mkdtempSync,writeFileSync,readFileSync,readdirSync,existsSync,mkdirSync,rmdirSync} from 'node:fs';
import {Worker} from 'node:worker_threads';
import {once} from 'node:events';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {onboardingExecutionScope,onboardingLimits,offlineOnboardingLimits} from '../../scripts/lib/onboarding-execution-scope.mjs';
import {strictSurfaces} from '../../scripts/lib/strict-session-acceptance.mjs';
const hash=(v:any)=>createHash('sha256').update(v).digest('hex');
function fixture(){
 const tmp=mkdtempSync(join(tmpdir(),'mitsa-DE-offline-')),source=join(tmp,'reviewed-source.txt');writeFileSync(source,'OFFLINE test source, no execution');let time=1000000;
 const fixtureBytes=Buffer.from(JSON.stringify({project:'mjtejwafxriwntweussc',fixtures:[{label:'e-a',email:'offline+e-a@gmail.com'},{label:'e-b',email:'offline+e-b@gmail.com'}]}));
 const trace={format:'mitsa-strict-session-trace-v1',environment:'HOSTED_SYNTHETIC',policy:'Strict Option A',prohibitedAncestorOutsideExceptions:true,terminalReuseRejected:true,terminalSessionInvalidated:true,formerlyCurrentRefreshDeniedImmediately:true,allRetainedRefreshTokensDenied:true,formerJwtOtherwiseUnexpired:true,independentSessionStillWorks:true,legitimateParentRetryWorks:true,concurrentRefreshWorks:true,mfaRecoveryCompatible:true,retainedAccountsPreserved:true,
 observations:strictSurfaces.map(surface=>({surface,identityCorrelated:true,sameAffectedSession:true,startedAfterTerminalResponse:true,beforeAnyExpiryOrCutoff:true,outcome:'SESSION_REVOKED',authorizationDecision:'DENY',noSideEffect:true}))};
 const strictEvidence={status:'PASSED',policy:'Strict Option A',project:'mjtejwafxriwntweussc',humanReviewed:true,traceSha256:hash(JSON.stringify(trace)),checks:Object.fromEntries(['terminalReuseDenial','noFurtherRenewal','immediateProtectedResourceDenial','directApiBoundary','legitimateMfaRecovery','directAuthAndFactors'].map(k=>[k,true]))};
 const reviewBytes=Buffer.from(JSON.stringify({project:'mjtejwafxriwntweussc',marker:'fireworks-foundation-proof-01a12e38',origin:'http://127.0.0.1:3000',fixtureSha256:hash(fixtureBytes),noticesSha256:'a'.repeat(64),sources:[{path:source,sha256:hash(readFileSync(source))}]}));
 const authorization={approved:true,scope:'D-E-journey-v1',project:'mjtejwafxriwntweussc',marker:'fireworks-foundation-proof-01a12e38',limits:{...onboardingLimits} as Record<string,number>,reviewSha256:hash(reviewBytes),fixtureSha256:hash(fixtureBytes),securityPolicy:'strict-proven',strictEvidenceSha256:hash(JSON.stringify(strictEvidence)),noticesSha256:'a'.repeat(64),notBefore:new Date(time-1000).toISOString(),notAfter:new Date(time+7199000).toISOString()};
 return {root:join(tmp,'ledger'),reviewBytes,fixtureBytes,authorization,strictEvidence,strictTrace:trace,now:()=>time,setTime:(v:number)=>{time=v;},source};
}
function offlineFixture(){const f=fixture(),review={...JSON.parse(String(f.reviewBytes)),evidenceMode:'OFFLINE'};f.reviewBytes=Buffer.from(JSON.stringify(review));Object.assign(f.authorization,{scope:'D-E-offline-v1',evidenceMode:'OFFLINE',limits:{...offlineOnboardingLimits},reviewSha256:hash(f.reviewBytes)});return {...f,evidenceMode:'OFFLINE' as const};}
it('keeps hosted at 200 and selects 256 only for explicitly bound temporary offline fixtures',()=>{expect(onboardingLimits.authRequests).toBe(200);expect(offlineOnboardingLimits.authRequests).toBe(256);const s=onboardingExecutionScope(offlineFixture());expect(s.evidenceMode).toBe('OFFLINE');expect(s.limits.authRequests).toBe(256);expect(onboardingExecutionScope(fixture()).limits.authRequests).toBe(200);});
it('rejects offline authority in a hosted execution or a non-temporary directory before creating a ledger',()=>{const f=offlineFixture();expect(()=>onboardingExecutionScope({...f,evidenceMode:'HOSTED'})).toThrow();expect(existsSync(f.root)).toBe(false);const g=offlineFixture(),outside=join(process.cwd(),'.secrets','OFFLINE-NOT-AUTHORIZED-'+crypto.randomUUID());expect(()=>onboardingExecutionScope({...g,root:outside})).toThrow('temporary');expect(existsSync(outside)).toBe(false);});
it('reserves the final four offline Auth slots for fixture-local-signout and preserves all 256 consumed records across reconstruction',()=>{const f=offlineFixture(),s=onboardingExecutionScope(f);for(let i=0;i<252;i++)s.reserve('authRequests',{fixture:i%2?'e-a':'e-b'});expect(()=>s.reserve('authRequests',{fixture:'e-a'})).toThrow('cleanup reserve');expect(()=>s.reserve('authRequests',{fixture:'e-a',cleanup:true,operation:'signup'})).toThrow('Cleanup');for(let i=0;i<4;i++)s.reserve('authRequests',{fixture:i%2?'e-a':'e-b',cleanup:true,operation:'fixture-local-signout'});expect(()=>s.reserve('authRequests',{fixture:'e-a',cleanup:true,operation:'fixture-local-signout'})).toThrow('exhausted');expect(onboardingExecutionScope(f).counts().authRequests).toBe(256);expect(readdirSync(f.root).filter(n=>/^op-/.test(n))).toHaveLength(256);});
it('refuses an offline ceiling beyond 256 and never upgrades an existing 200-request authority',()=>{const f=offlineFixture();f.authorization.limits.authRequests=257;expect(()=>onboardingExecutionScope(f)).toThrow();expect(existsSync(f.root)).toBe(false);const g=fixture(),s=onboardingExecutionScope(g);s.reserve('authRequests',{fixture:'e-a'});expect(()=>onboardingExecutionScope({...g,evidenceMode:'OFFLINE'})).toThrow();expect(s.counts().authRequests).toBe(1);expect(s.limits.authRequests).toBe(200);});
it.each(['approval','scope','project','review','fixture','limits','strict','trace','notice','source','expiry'])('rejects %s mismatch before creating a ledger',kind=>{
 const f=fixture();if(kind==='approval')f.authorization.approved=false;if(kind==='scope')f.authorization.scope='old';if(kind==='project')f.authorization.project='wrong';if(kind==='review')f.authorization.reviewSha256='bad';if(kind==='fixture')f.authorization.fixtureSha256='bad';if(kind==='limits')f.authorization.limits={...onboardingLimits,emails:7};if(kind==='strict')f.authorization.securityPolicy='one-hour';if(kind==='trace')f.strictTrace.observations.pop();if(kind==='notice')f.authorization.noticesSha256='bad';if(kind==='source')writeFileSync(f.source,'CHANGED');if(kind==='expiry')f.setTime(9000000);
 expect(()=>onboardingExecutionScope(f)).toThrow();expect(existsSync(f.root)).toBe(false);
});
it('rejects unresolved Strict A and resource-only evidence, not just missing approval',()=>{
 const f=fixture();f.strictEvidence.checks.directAuthAndFactors=false;f.authorization.strictEvidenceSha256=hash(JSON.stringify(f.strictEvidence));expect(()=>onboardingExecutionScope(f)).toThrow();expect(existsSync(f.root)).toBe(false);
});
it('never refunds failed operations or renews a used authority across reconstruction',()=>{
 const f=fixture(),s=onboardingExecutionScope(f);s.reserve('authRequests',{fixture:'e-a'});expect(onboardingExecutionScope(f).counts().authRequests).toBe(1);
 const changed={...f,authorization:{...f.authorization,notAfter:new Date(8000000).toISOString()}};expect(()=>onboardingExecutionScope(changed)).toThrow('authority changed');
});
it('rejects retained identities, wrong recipients and duplicate email claims without exposing private arguments',()=>{
 const f=fixture(),s=onboardingExecutionScope(f);expect(()=>s.reserve('newAccounts',{fixture:'Yuno'})).toThrow();expect(()=>s.assertRecipient('e-a','wrong@example.com')).toThrow();
 expect(s.assertRecipient('e-a','offline+e-a@gmail.com')).toBe(true);s.reserve('emails',{fixture:'e-a',job:'PRIVATE-DISPATCH-ID'});expect(()=>s.reserve('emails',{fixture:'e-a',job:'PRIVATE-DISPATCH-ID'})).toThrow();expect(s.counts().emails).toBe(1);
 const all=readdirSync(f.root).filter(n=>n.endsWith('.json')).map(n=>readFileSync(join(f.root,n),'utf8')).join('');expect(all).not.toContain('gmail.com');expect(all).not.toContain('PRIVATE-DISPATCH-ID');
});
it('enforces account/factor/workspace caps and cleanup cannot create accounts or send mail',()=>{
 const s=onboardingExecutionScope(fixture());for(const kind of ['newAccounts','newFactors','newWorkspaces','newLocations']){s.reserve(kind,{fixture:'e-a'});s.reserve(kind,{fixture:'e-b'});expect(()=>s.reserve(kind,{fixture:'e-a'})).toThrow('exhausted');}
 expect(()=>s.reserve('emails',{fixture:'e-a',cleanup:true})).toThrow('Cleanup');expect(()=>s.reserve('browserLaunches',{cleanup:true})).toThrow('Cleanup');
});
it('stops new work before the deadline and retains bounded cleanup time without extending authority',()=>{
 const f=fixture(),s=onboardingExecutionScope(f);f.setTime(1000000+5280000);expect(()=>s.reserve('authRequests',{fixture:'e-a'})).toThrow('cleanup margin');
 s.reserve('sqlRequests',{cleanup:true});s.reserve('authRequests',{fixture:'e-a',cleanup:true,operation:'fixture-local-signout'});expect(()=>s.reserve('authRequests',{fixture:'e-a',cleanup:true})).toThrow('Cleanup');
 f.setTime(1000000+5400000);expect(()=>s.reserve('sqlRequests',{cleanup:true})).toThrow('runtime expired');
});
it('allows only exact reviewed SQL and counts mutators and transaction statements before dispatch',async()=>{
 const s=onboardingExecutionScope(fixture()),query=vi.fn(async(_sql:string,_args:any)=>({rows:[]}));
 const sql=s.wrapSql(query,{readOnlySql:new Set(['select 1']),writeSql:new Set(['select private.reviewed_test_mutator()'])});
 await expect(sql('delete from auth.users',[])).rejects.toThrow('not in the reviewed');expect(query).not.toHaveBeenCalled();
 await sql('begin',[]);await sql('select 1',[]);await sql('select private.reviewed_test_mutator()',[]);await sql('rollback',[]);
 expect(s.counts()).toMatchObject({sqlRequests:4,transactionStatements:2,sqlWriteCalls:1});expect(query).toHaveBeenCalledTimes(4);
});
it('waits for the other producer to release its owned journal lock without stealing it or losing a consumed slot',async()=>{const f=fixture(),s=onboardingExecutionScope(f),path=join(f.root,'reservation.lock');mkdirSync(path);const w=new Worker(`const {parentPort,workerData}=require('node:worker_threads');const fs=require('node:fs');parentPort.postMessage('waiting');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,400);fs.rmdirSync(workerData);`,{eval:true,workerData:path});const exit=once(w,'exit');await once(w,'message');s.reserve('authRequests',{fixture:'e-a'});await exit;expect(s.counts().authRequests).toBe(1);expect(onboardingExecutionScope(f).counts().authRequests).toBe(1);expect(existsSync(path)).toBe(false);});
it('fails on a stuck journal lock without removing it or issuing/refunding a provider slot',()=>{const f=fixture(),s=onboardingExecutionScope(f),path=join(f.root,'reservation.lock');mkdirSync(path);try{expect(()=>s.reserve('authRequests',{fixture:'e-a'})).toThrow('journal lock unavailable');expect(existsSync(path)).toBe(true);expect(readdirSync(f.root).filter(n=>/^op-/.test(n))).toHaveLength(0);}finally{rmdirSync(path);}expect(s.counts().authRequests).toBeUndefined();});
it('checks immutable records against the append mirror and never repairs a partially persisted or changed consumption',()=>{const f=fixture(),s=onboardingExecutionScope(f);s.reserve('authRequests',{fixture:'e-a'});const op=join(f.root,'op-000001.json'),old=readFileSync(op,'utf8');writeFileSync(op,old.replace('authRequests','resourceRequests'));expect(()=>s.counts()).toThrow('differs from mirror');expect(()=>onboardingExecutionScope(f)).toThrow();const g=fixture(),t=onboardingExecutionScope(g);t.reserve('authRequests',{fixture:'e-a'});writeFileSync(join(g.root,'journal.ndjson'),'');expect(()=>t.reserve('authRequests',{fixture:'e-a'})).toThrow();expect(readdirSync(g.root).filter(n=>/^op-/.test(n))).toHaveLength(1);});
