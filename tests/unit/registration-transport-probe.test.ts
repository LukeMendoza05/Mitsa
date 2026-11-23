import {beforeAll,afterAll,it,expect,vi} from 'vitest';
import {readFileSync,existsSync,mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {PersistentMailWorker} from '../../scripts/lib/persistent-mail-worker';
import type {PGlite} from '@electric-sql/pglite';
import {recoveredC1Database,correctionPath} from '../support/stage-c1-correction';
import {assertTransportProbeApproval,transportProbeLimits,probeQueryKind,probeSql,transportProbe,assertTransportBudget,nextTransportBudget,transportDeadline,transportSupervisorDelay,claimTransportAttempt,assertProbeChildStopped,protectedTransportCredentials,protectedSecretMetadata} from '../../scripts/lib/registration-transport-probe.mjs';
import {assertTestTarget} from '../../scripts/test-target.mjs';
const deliverySql=readFileSync('supabase/security-proposals/persistent-registration-delivery-controls.sql.txt','utf8');
const now=Date.now(),reviewSha256='a'.repeat(64);
function approval(){return {approved:true,scope:'D-transport-only-rollback-v1',project:'mjtejwafxriwntweussc',reviewSha256,limits:{...transportProbeLimits},notBefore:new Date(now-1000).toISOString(),notAfter:new Date(now+60000).toISOString(),evidence:'Explicit approval of the exact test'};}
it('accepts only a new source-bound, unexpired explicit approval',()=>{expect(()=>assertTransportProbeApproval(approval(),{reviewSha256,now})).not.toThrow();});
it.each(['missing','scope','project','hash','expired','duration','limits','evidence'])('rejects invalid approval: %s',kind=>{
 const a=approval();if(kind==='missing')a.approved=false;if(kind==='scope')a.scope='D';if(kind==='project')a.project='other';if(kind==='hash')a.reviewSha256='b'.repeat(64);if(kind==='expired')a.notAfter=new Date(now-1).toISOString();if(kind==='duration')a.notAfter=new Date(now+3600000).toISOString();if(kind==='limits')Object.assign(a.limits,{emails:1});if(kind==='evidence')a.evidence='';
 expect(()=>assertTransportProbeApproval(a,{reviewSha256,now})).toThrow();
});
it('forbids probe commit, queue claims, completion, disguised writes and arbitrary SQL',()=>{
 for(const sql of ['commit','select private.mitsa_worker_claim($1,$2) job',"select private.mitsa_worker_complete($1,$2,$3,'smtp-accepted') ok",'select 1; delete from private.auth_mail_dispatch','update private.registration_control set admission_enabled=true'])expect(()=>probeQueryKind(sql,{phase:'probe',deliverySql})).toThrow();
 expect(probeQueryKind(deliverySql,{phase:'probe',deliverySql})).toBe('writeQueries');expect(probeQueryKind(probeSql.heartbeat,{phase:'probe',deliverySql})).toBe('writeQueries');
});
function fixture(){
 const control={admission_enabled:false,delivery_enabled:false,transport_ready:false,session_policy_ready:false,session_policy:'strict',approval_generation:null};let ready=false,dispatches=0,triggers=0,rollback=false;
 const query=vi.fn(async(sql:string,args?:unknown[])=>{
  if(sql===probeSql.inspect)return {rows:[{marker:'fireworks-foundation-proof-01a12e38',control,dispatches,triggers}]};
  if(sql===deliverySql)return {rows:[{admission_enabled:false,delivery_enabled:true,transport_ready:false,session_policy_ready:false}]};
  if(sql===probeSql.acquire)return {rows:[{ok:true}]};
  if(sql===probeSql.heartbeat){ready=args?.[2]===true;return {rows:[{ok:true}]};}
  if(sql===probeSql.shutdown){ready=false;return {rows:[{ok:true}]};}
  if(sql===probeSql.health)return {rows:[{healthy:ready,admission:'closed',ready}]};
  if(sql===probeSql.rollback)rollback=true;
  return {rows:[]};
 });
 const verifyTransport=vi.fn(async()=>true);
 return {query,verifyTransport,expectedControl:structuredClone(control),control,get rolledBack(){return rollback;},setDispatches:(n:number)=>dispatches=n,setTriggers:(n:number)=>triggers=n};
}
const options=(f:ReturnType<typeof fixture>)=>({db:{query:f.query},WorkerClass:PersistentMailWorker,verifyTransport:f.verifyTransport,expectedControl:f.expectedControl,deliverySql,generation:crypto.randomUUID(),senderHash:'a'.repeat(64)});
it('probes once with four bounded write-capable calls and rolls back without queue access',async()=>{
 const f=fixture();expect(await transportProbe(options(f))).toMatchObject({smtpVerified:true,rolledBack:true,committedDatabaseWrites:0,messagesSent:0});
 expect(f.verifyTransport).toHaveBeenCalledTimes(1);expect(f.rolledBack).toBe(true);
 const calls=f.query.mock.calls.map(([sql])=>sql);expect(calls.filter(sql=>probeQueryKind(sql,{phase:'probe',deliverySql})==='writeQueries')).toHaveLength(4);expect(calls).not.toContain('commit');expect(calls.some(sql=>sql.includes('mitsa_worker_claim'))).toBe(false);
});
it.each(['dispatch','trigger','control','smtp','database'])('fails closed and rolls back for %s failure',async kind=>{
 const f=fixture();if(kind==='dispatch')f.setDispatches(1);if(kind==='trigger')f.setTriggers(1);if(kind==='control')f.control.admission_enabled=true;if(kind==='smtp')f.verifyTransport.mockResolvedValue(false);if(kind==='database')f.query.mockRejectedValueOnce(Error('database unavailable'));
 await expect(transportProbe(options(f))).rejects.toThrow();if(kind!=='database')expect(f.rolledBack).toBe(true);if(['dispatch','trigger','control'].includes(kind))expect(f.verifyTransport).not.toHaveBeenCalled();expect(f.verifyTransport.mock.calls.length).toBeLessThanOrEqual(1);
});
let offline:PGlite;
beforeAll(async()=>{offline=await recoveredC1Database();await offline.exec(readFileSync(correctionPath,'utf8'));await offline.exec(readFileSync('supabase/security-proposals/persistent-registration-test-notices.sql.txt','utf8'));},60000);
afterAll(async()=>{await offline?.close();});
const committedControl=async()=>((await offline.query('select to_jsonb(c) value from private.registration_control c')).rows[0] as {value:unknown}).value;
it('executes actual installed worker functions then rolls back every control change',async()=>{
 const before=await committedControl();let verifies=0;
 const result=await transportProbe({db:offline,WorkerClass:PersistentMailWorker,generation:crypto.randomUUID(),senderHash:'a'.repeat(64),deliverySql,expectedControl:before,verifyTransport:async()=>{verifies++;return true;}});
 expect(result.rolledBack).toBe(true);expect(verifies).toBe(1);expect(await committedControl()).toEqual(before);
 expect((await offline.query('select * from private.auth_mail_dispatch')).rows).toHaveLength(0);
 expect((await offline.query('select * from auth.users')).rows).toHaveLength(0);
 expect((await offline.query("select kind,status,approved_at,effective_at from private.legal_versions where version='isolated-persistent-synthetic-v1' order by kind")).rows).toEqual([{kind:'privacy',status:'test',approved_at:null,effective_at:null},{kind:'terms',status:'test',approved_at:null,effective_at:null}]);
});
it('SMTP rejection rolls back actual ownership and delivery readiness',async()=>{
 const before=await committedControl();await expect(transportProbe({db:offline,WorkerClass:PersistentMailWorker,generation:crypto.randomUUID(),senderHash:'a'.repeat(64),deliverySql,expectedControl:before,verifyTransport:async()=>false})).rejects.toThrow();expect(await committedControl()).toEqual(before);
});
it('the real operator refuses run, unsupervised child and reconciliation without approval before creating live state',()=>{
 const cwd=mkdtempSync(join(tmpdir(),'mitsa-old-transport-denial-')),hash=(v:string)=>createHash('sha256').update(v).digest('hex'),root=join(cwd,'.secrets/registration-completion/transport-probe');
 mkdirSync(join(cwd,'config'));mkdirSync(join(cwd,'supabase/security-proposals'),{recursive:true});writeFileSync(join(cwd,'supabase/security-proposals/persistent-registration-delivery-controls.sql.txt'),deliverySql);
 const common=JSON.stringify({sources:[],reviewId:'fixture-generation',privateFixtures:{path:'fixtures.json',sha256:hash('{}')}}),checkpoint=JSON.stringify({passed:true});
 for(const [path,value] of [['fixtures.json','{}'],['checkpoint.json',checkpoint],['preservation.json','{}'],['fixture.txt','inert'],['config/registration-completion-review.json',common]])writeFileSync(join(cwd,path),value);
 writeFileSync(join(cwd,'config/registration-transport-probe-review.json'),JSON.stringify({scope:'D-transport-only-rollback-v1',status:'PREPARED_NOT_APPROVED_NOT_EXECUTED',project:'mjtejwafxriwntweussc',marker:'fireworks-foundation-proof-01a12e38',limits:transportProbeLimits,sources:[{path:'fixture.txt',sha256:hash('inert')}],commonReviewSha256:hash(common),generation:'fixture-generation',preservationCheckpoint:'checkpoint.json',preservationCheckpointSha256:hash(checkpoint),preservationManifest:'preservation.json',preservationManifestSha256:hash('{}')}));
 expect(existsSync(root+'/approval.json')).toBe(false);expect(existsSync(root+'/attempt.json')).toBe(false);
 for(const mode of ['--check','--run','--approved-child','--reconcile']){
  const result=spawnSync(process.execPath,['--conditions=react-server',resolve('scripts/registration-transport-probe.mjs'),mode],{cwd,encoding:'utf8',windowsHide:true,timeout:20000});
  if(mode==='--check'){expect(result.status).toBe(0);expect(result.stdout).toContain('Transport-only package verified locally');expect(result.stdout).toContain('"authorizationPresent":false');}
  else{expect(result.status).not.toBe(0);expect(result.stdout).toContain('Transport-only operation unavailable');}
 }
 expect(existsSync(root+'/attempt.json')).toBe(false);expect(existsSync(root+'/budget.json')).toBe(false);
},90000);
it('bounds every database category and preserves exhaustion across serialized restarts',()=>{
 let state={databaseRequests:0,readQueries:0,writeQueries:0,transactionQueries:0};
 for(const [kind,maximum] of [['readQueries',180],['writeQueries',4],['transactionQueries',8]] as const){
  for(let i=0;i<maximum;i++)state=nextTransportBudget(JSON.parse(JSON.stringify(state)),kind);
  expect(()=>nextTransportBudget(JSON.parse(JSON.stringify(state)),kind)).toThrow('exhausted');
 }
 expect(state.databaseRequests).toBe(192);expect(()=>nextTransportBudget(state,'readQueries')).toThrow();
});
it.each(['negative','nan','fraction','inconsistent','unknown-category'])('rejects damaged counters or invalid reservation: %s',kind=>{
 const state={databaseRequests:0,readQueries:0,writeQueries:0,transactionQueries:0};
 if(kind==='negative')state.readQueries=-1;if(kind==='nan')state.databaseRequests=NaN;if(kind==='fraction')state.writeQueries=.5;if(kind==='inconsistent')state.databaseRequests=1;
 expect(()=>kind==='unknown-category'?nextTransportBudget(state,'smtp'):assertTransportBudget(state)).toThrow();
});
it('limits runtime to five minutes or earlier approval expiry without extending it',()=>{
 const a=approval();expect(transportDeadline(a,now)).toBe(Date.parse(a.notAfter));
 expect(transportDeadline({...a,notAfter:new Date(now+600000).toISOString()},now)).toBe(now+300000);
 expect(()=>transportDeadline({...a,notAfter:new Date(now-1).toISOString()},now)).toThrow();
});
it('wall-clock rollback cannot extend the monotonic five-minute supervisor budget',()=>{
 const times={deadlineAt:now+300000,startedAt:1000,now:now-60000,monotonicNow:2000};
 expect(transportSupervisorDelay(times)).toBe(299000);
 expect(transportSupervisorDelay({...times,monotonicNow:301000})).toBe(0);
 expect(transportSupervisorDelay({...times,now:now+300001})).toBe(0);
});
it('durably consumes the single attempt and rejects repeated execution without overwriting it',()=>{
 const path=join(mkdtempSync(join(tmpdir(),'mitsa-transport-attempt-')),'attempt.json'),record={parentPid:1234,reviewSha256,maximumWorkerLaunches:1};
 claimTransportAttempt(path,record);expect(JSON.parse(readFileSync(path,'utf8'))).toEqual(record);
 expect(()=>claimTransportAttempt(path,record)).toThrow();expect(JSON.parse(readFileSync(path,'utf8'))).toEqual(record);
});
it('refuses reconciliation for a live child even when a terminal file exists',()=>{
 const started={pid:1234,reviewSha256},terminal={pid:1234,reviewSha256,observedExit:true};
 expect(()=>assertProbeChildStopped(started,terminal,{reviewSha256,isRunning:()=>true})).toThrow();
 expect(()=>assertProbeChildStopped(started,null,{reviewSha256,isRunning:()=>false})).not.toThrow();
 expect(()=>assertProbeChildStopped(started,terminal,{reviewSha256,isRunning:()=>{throw Error('status denied');}})).toThrow();
 expect(()=>assertProbeChildStopped({...started,pid:0},terminal,{reviewSha256,isRunning:()=>false})).toThrow();
 expect(()=>assertProbeChildStopped(started,{...terminal,pid:4321},{reviewSha256,isRunning:()=>false})).toThrow();
});
it('rejects an incorrect project/API/database identity before any connection',()=>{
 const approved=JSON.parse(readFileSync('config/test-target.json','utf8'));
 for(const input of [{projectRef:'wrong',url:'https://mjtejwafxriwntweussc.supabase.co'},{projectRef:approved.projectRef,url:'https://other.supabase.co'},{projectRef:approved.projectRef,url:'https://mjtejwafxriwntweussc.supabase.co',databaseUrl:'postgresql://postgres:fixture@db.other.supabase.co/postgres'}])expect(()=>assertTestTarget(input,approved)).toThrow();
});
it('missing management credentials and malformed metadata fail with no raw error disclosure',()=>{
 const sentinel='private-fixture-do-not-report';
 for(const run of [()=>{throw Error(sentinel);},()=>sentinel,()=>JSON.stringify([{name:'X',value:sentinel}]),()=>JSON.stringify([{name:'X',value:'a'.repeat(64)},{name:'X',value:'b'.repeat(64)}])]){
  try{protectedSecretMetadata(run);expect.fail('must reject');}catch(error){expect((error as Error).message).toBe('Management secret metadata unavailable');expect(String(error)).not.toContain(sentinel);}
 }
 expect(protectedSecretMetadata(()=>JSON.stringify([{name:'X',value:'a'.repeat(64)}]))).toEqual([{name:'X',digest:'a'.repeat(64)}]);
});
it('missing or unreadable SMTP credentials fail without reading or exposing secrets',()=>{
 const read=vi.fn(()=>{throw Error('private-fixture-password');});
 expect(()=>protectedTransportCredentials({present:()=>false,read})).toThrow('Protected SMTP configuration unavailable');expect(read).not.toHaveBeenCalled();
 expect(()=>protectedTransportCredentials({present:()=>true,read})).toThrow('Protected SMTP configuration unavailable');
 expect(()=>protectedTransportCredentials({present:()=>true,read:()=>({sender:'invalid',appPassword:'private-fixture-password'})})).toThrow('Protected SMTP configuration unavailable');
});
it('still attempts rollback when shutdown itself throws',async()=>{
 const f=fixture();class FailedShutdown{async pulse(){return 'paused';}async stop(){throw Error('shutdown failed');}}
 await expect(transportProbe({...options(f),WorkerClass:FailedShutdown})).rejects.toThrow('shutdown failed');expect(f.rolledBack).toBe(true);expect(f.verifyTransport).not.toHaveBeenCalled();
});
it('records uncertain rollback as failure and never commits or retries SMTP',async()=>{
 const f=fixture(),original=f.query.getMockImplementation()!;f.query.mockImplementation(async(sql,args)=>{if(sql===probeSql.rollback)throw Error('rollback response lost');return original(sql,args);});
 await expect(transportProbe(options(f))).rejects.toThrow('rollback response lost');expect(f.verifyTransport).toHaveBeenCalledTimes(1);expect(f.query.mock.calls.filter(([sql])=>sql===probeSql.rollback)).toHaveLength(1);expect(f.query.mock.calls.map(([sql])=>sql)).not.toContain('commit');
});
