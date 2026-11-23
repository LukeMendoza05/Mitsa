import {it,expect,vi} from 'vitest';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createOnboardingMailBridge,onboardingWorkerSql as workerSql} from '../../scripts/lib/onboarding-mail-bridge.mjs';
import {onboardingProbeSql as probes} from '../../scripts/lib/onboarding-probe-sql.mjs';
const uid='10000000-0000-4000-8000-000000000001',generation='20000000-0000-4000-8000-000000000001',workerId='30000000-0000-4000-8000-000000000001',capture='40000000-0000-4000-8000-000000000001';
const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
function fixture(action='signup'){
 const now=Date.UTC(2026,9,27,12),email='offline+e-a@gmail.com',recipientHash=hash(email);
 const state:any={acquired:true,healthy:true,fence:true,shutdown:true,complete:true,transport:true,invalidJobs:0,sent:false,jobState:'queued',hourly:1,daily:1,recent:false,permission:false,dbNow:now,foreign:false,diagnostics:[]};
 const job={id:uid,captureId:capture,action,encryptedPayload:'OFFLINE-ENCRYPTED-CAPTURE',createdAt:new Date(now-1000).toISOString(),databaseNow:new Date(now).toISOString(),expiresAt:new Date(now-1000+3600000).toISOString(),recipientHash};
 const decoded:any={email,userId:uid,type:action,tokenHash:'a'.repeat(64),origin:'http://127.0.0.1:3000',...(action==='signup'?{code:'123456'}:{})};
 const query=vi.fn(async(text:string,args:any[]):Promise<{rows:any[]} >=>{
  if(state.permission)throw Error('PRIVATE-DB-ERROR');
  if(text===workerSql.acquire)return {rows:[{ok:state.acquired}]};
  if(text===workerSql.heartbeat||text===workerSql.shutdown)return {rows:[{ok:text===workerSql.shutdown?state.shutdown:true}]};
  if(text===workerSql.claim){if(state.jobState!=='queued')return {rows:[{job:null}]};state.jobState='claimed';return {rows:[{job}]};}
  if(text===workerSql.authorized)return {rows:[{ok:state.fence}]};
  if(text===workerSql.complete){if(state.complete)state.jobState='smtp-accepted';return {rows:[{ok:state.complete}]};}
  if(text===workerSql.uncertain){state.jobState='unconfirmed';return {rows:[{ok:true}]};}
  if(text===probes.queue)return {rows:[{invalid_jobs:state.invalidJobs}]};
  if(text===probes.health)return {rows:[{healthy:state.healthy}]};
  if(text===probes.dispatch)return {rows:[{id:job.id,intent_id:uid,provider_user_id:state.foreign?'foreign':uid,capture_id:job.captureId,recipient_hash:job.recipientHash,generation,state:state.jobState,action:job.action,created_at:job.createdAt,expires_at:job.expiresAt}]};
  if(text===probes.capacity)return {rows:[{hourly:state.hourly,daily:state.daily,recipient_recent:state.recent,database_now:new Date(state.dbNow).toISOString()}]};
  throw Error('Unreviewed SQL');
 });
 const reservations:any[]=[],jobs=new Set();
 const scope={active:vi.fn(),fixture:(label:string)=>({label,email:'offline+'+label+'@gmail.com'}),assertRecipient:(label:string,value:string)=>value==='offline+'+label+'@gmail.com',reserve:vi.fn((kind:string,options:any={})=>{reservations.push({kind,...options});if(options.job){if(jobs.has(options.job))throw Error('spent');jobs.add(options.job);}}),
  wrapSql:(q:any,{readOnlySql,writeSql}:any)=>async(text:string,args:any[],options:any)=>{expect(readOnlySql.has(text)||writeSql.has(text)).toBe(true);scope.reserve('sqlRequests',options);if(writeSql.has(text))scope.reserve('sqlWriteCalls',options);return q(text,args);}};
 const send=vi.fn(async(input:any,_now:number)=>{expect(await input.authorizeAndClaim()).toBe(true);state.sent=true;return {status:'smtp-accepted'};});
 const d={scope,db:{query},generation,workerId,now:()=>now,assertExecutionReady:vi.fn(async()=>{}),fixtureState:vi.fn(async()=>({userId:uid,intentId:uid})),decryptPayload:vi.fn(async()=>decoded),diagnosticClaims:vi.fn(async()=>state.diagnostics),persistPrivate:vi.fn(async(_data:any)=>{}),verifyTransport:vi.fn(async()=>state.transport),sendSignup:send,sendRecovery:send,closeTransport:vi.fn(async()=>{})};
 return {state,d,job,decoded,reservations,query,send,bridge:createOnboardingMailBridge(d)};
}
it('keeps the SQL allowlist exactly compatible with all seven real worker call sites',()=>{
 const tree=ts.createSourceFile('worker.ts',readFileSync('scripts/lib/persistent-mail-worker.ts','utf8'),ts.ScriptTarget.Latest,true),queries:string[]=[];
 function visit(n:ts.Node){if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='query'){const arg=n.arguments[0];expect(ts.isStringLiteralLike(arg)).toBe(true);queries.push((arg as ts.StringLiteral).text);}ts.forEachChild(n,visit);}visit(tree);
 expect(queries).toHaveLength(7);expect(new Set(queries)).toEqual(new Set(Object.values(workerSql)));
});
it('constructs with no database, SMTP, process or decryption side effects',()=>{
 const f=fixture();expect(f.query).not.toHaveBeenCalled();expect(f.d.verifyTransport).not.toHaveBeenCalled();expect(f.d.decryptPayload).not.toHaveBeenCalled();expect(f.reservations).toHaveLength(0);
});
it('uses the real worker to acquire, verify once, heartbeat, bind and complete a provider capture, but requires independent human receipt',async()=>{
 const f=fixture();expect(await f.bridge.pulse()).toEqual({owned:true,healthy:true});expect(await f.bridge.tick()).toEqual({event:'sent'});
 expect(f.d.verifyTransport).toHaveBeenCalledOnce();expect(f.send).toHaveBeenCalledOnce();expect(f.reservations.filter(r=>r.kind==='emails')).toEqual([{kind:'emails',fixture:'e-a',job:uid}]);
 expect(f.d.persistPrivate.mock.calls[0][0].kind).toBe('mail-before-send');expect(f.bridge.receiptConfirmed('e-a','signup')).toBe(false);
 expect(()=>f.bridge.latestDeliveredMessage('e-a','recovery')).toThrow();await f.bridge.confirmHumanReceipt('e-a','signup',uid);expect(f.bridge.receiptConfirmed('e-a','signup')).toBe(true);
 expect(await f.bridge.tick()).toEqual({event:'waiting'});expect(f.send).toHaveBeenCalledOnce();expect(await f.bridge.stop()).toEqual({logicalShutdown:true,transportClosed:true});expect(f.d.closeTransport).toHaveBeenCalledOnce();
 expect(JSON.stringify(f.bridge.status())).not.toMatch(/123456|offline\+|OFFLINE-ENCRYPTED|aaaaaa/);expect(f.bridge.status().hostedAcceptanceCompleted).toBe(false);
});
it('does not claim or verify SMTP when authority is absent or a foreign job is pending',async()=>{
 const f=fixture();f.d.assertExecutionReady.mockRejectedValue(Error('PRIVATE-APPROVAL'));await expect(f.bridge.pulse()).rejects.toThrow('no automatic retry');expect(f.query).not.toHaveBeenCalled();
 const g=fixture();g.state.invalidJobs=1;await expect(g.bridge.pulse()).rejects.toThrow();expect(g.d.verifyTransport).not.toHaveBeenCalled();expect(g.query.mock.calls.some(([text])=>text===workerSql.claim)).toBe(false);
});
it('does not confuse waiting without acquisition or healthy transport with a successfully owned worker',async()=>{
 for(const property of ['acquired','healthy','transport']){const f=fixture();f.state[property]=false;await expect(f.bridge.pulse()).rejects.toThrow();await expect(f.bridge.pulse()).rejects.toThrow();expect(f.d.verifyTransport.mock.calls.length).toBeLessThanOrEqual(1);expect(f.send).not.toHaveBeenCalled();}
});
it('rejects wrong recipients, identities, actions, codes, origins and lifetimes before SMTP',async()=>{
 for(const alter of [(f:any)=>f.decoded.email='unapproved@example.com',(f:any)=>f.state.foreign=true,(f:any)=>f.decoded.code='12',(f:any)=>f.decoded.origin='https://foreign.example',(f:any)=>f.decoded.type='recovery',(f:any)=>f.job.expiresAt=new Date(Date.parse(f.job.expiresAt)-1000).toISOString()]){
  const f=fixture();alter(f);await f.bridge.pulse();await expect(f.bridge.tick()).rejects.toThrow();expect(f.send).not.toHaveBeenCalled();expect(f.reservations.filter(r=>r.kind==='emails')).toHaveLength(0);
 }
});
it('uses a fresh database clock rather than worker-local time and rejects expired or future provider messages',async()=>{
 const f=fixture();f.state.dbNow=Date.parse(f.job.createdAt)-1;await f.bridge.pulse();await expect(f.bridge.tick()).rejects.toThrow();expect(f.send).not.toHaveBeenCalled();
 const g=fixture();g.state.dbNow=Date.parse(g.job.expiresAt)-1000;await g.bridge.pulse();await expect(g.bridge.tick()).rejects.toThrow();expect(g.send).not.toHaveBeenCalled();
});
it('enforces durable quotas, recipient cooldowns and already consumed diagnostic capacity',async()=>{
 for(const change of [(f:any)=>f.state.hourly=11,(f:any)=>f.state.daily=21,(f:any)=>f.state.recent=true,(f:any)=>{f.state.hourly=10;f.state.diagnostics=[{at:f.state.dbNow-1000,recipientHash:'b'.repeat(64)}];},(f:any)=>f.state.diagnostics=[{at:f.state.dbNow-1000,recipientHash:f.job.recipientHash}]]){
  const f=fixture();change(f);await f.bridge.pulse();await expect(f.bridge.tick()).rejects.toThrow();expect(f.send).not.toHaveBeenCalled();
 }
});
it('keeps an uncertain SMTP attempt spent and never automatically verifies, claims or sends again',async()=>{
 const f=fixture();f.send.mockRejectedValue(Error('PRIVATE-TRANSPORT'));await f.bridge.pulse();await expect(f.bridge.tick()).rejects.toThrow();expect(f.state.jobState).toBe('unconfirmed');await expect(f.bridge.tick()).rejects.toThrow();expect(f.send).toHaveBeenCalledOnce();expect(f.d.verifyTransport).toHaveBeenCalledOnce();expect(f.reservations.filter(r=>r.kind==='emails')).toHaveLength(1);expect(()=>f.bridge.latestDeliveredMessage('e-a','signup')).toThrow();await f.bridge.stop();
});
it('does not publish durable-delivery evidence when SMTP succeeds but database completion does not',async()=>{
 const f=fixture();f.state.complete=false;await f.bridge.pulse();await expect(f.bridge.tick()).rejects.toThrow();expect(f.send).toHaveBeenCalledOnce();expect(()=>f.bridge.latestDeliveredMessage('e-a','signup')).toThrow();await expect(f.bridge.tick()).rejects.toThrow();expect(f.send).toHaveBeenCalledOnce();
});
it('requires encrypted evidence persistence before any real send or mail reservation',async()=>{
 const f=fixture();f.d.persistPrivate.mockRejectedValue(Error('PRIVATE-ENCRYPTION'));await f.bridge.pulse();await expect(f.bridge.tick()).rejects.toThrow();expect(f.send).not.toHaveBeenCalled();expect(f.reservations.filter(r=>r.kind==='emails')).toHaveLength(0);
});
it('honors a fence that closes after acquisition without attempting SMTP',async()=>{
 const f=fixture();await f.bridge.pulse();f.state.fence=false;await expect(f.bridge.tick()).rejects.toThrow();expect(f.send).not.toHaveBeenCalled();
});
it('sends recovery only through its explicit adapter and never fabricates a recovery OTP',async()=>{
 const f=fixture('recovery');await f.bridge.pulse();await f.bridge.tick();const message=f.send.mock.calls[0][0].message;expect(message).not.toHaveProperty('providerCode');expect(f.bridge.latestDeliveredMessage('e-a','recovery')).toMatchObject({providerIssued:true,smtpAccepted:true,tokenHash:'a'.repeat(64)});await expect(f.bridge.confirmHumanReceipt('e-a','recovery','wrong')).rejects.toThrow();
});
it('does not report successful cleanup without the shutdown acknowledgement or transport close',async()=>{
 const f=fixture();await f.bridge.pulse();f.state.shutdown=false;await expect(f.bridge.stop()).rejects.toThrow('cleanup unconfirmed');expect(f.d.closeTransport).toHaveBeenCalledOnce();await expect(f.bridge.stop()).rejects.toThrow('remains unconfirmed');
 const g=fixture();await g.bridge.pulse();g.d.closeTransport.mockRejectedValue(Error('close failed'));await expect(g.bridge.stop()).rejects.toThrow();expect(g.bridge.status().transportClosed).toBe(false);
});
it('suppresses database permission errors and preserves the failed bridge without reacquisition',async()=>{
 const f=fixture();f.state.permission=true;await expect(f.bridge.pulse()).rejects.toThrow(/^Bounded onboarding mail operation failed; private evidence retained; no automatic retry$/);expect(f.d.verifyTransport).not.toHaveBeenCalled();await expect(f.bridge.pulse()).rejects.toThrow();
});
