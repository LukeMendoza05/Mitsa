import {it,expect,vi,beforeAll,afterAll} from 'vitest';
import {mkdtempSync,readFileSync,writeFileSync,readdirSync,mkdirSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {StageCEngine} from '../../scripts/lib/stage-c-engine.mjs';
import {stageCScope,stageCLimits} from '../../scripts/lib/stage-c-scope.mjs';
import {assertStageCPreservation} from '../../scripts/lib/stage-c-preservation.mjs';
import {acceptanceProtocol} from '../../scripts/lib/registration-acceptance-protocol.mjs';
import {recoveredC1Database,correctionPath} from '../support/stage-c1-correction';
import {cSql} from '../../scripts/lib/stage-c-sql.mjs';
import {stageCManagement} from '../../scripts/lib/stage-c-management.mjs';
import {stageCPanel} from '../../scripts/lib/stage-c-panel.mjs';
const hash=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
function scopeFixture(selection:'A'|'B'='A'){
 const fixtureBytes=Buffer.from(JSON.stringify({project:'mjtejwafxriwntweussc',fixtures:['c3b-a','c3b-b'].map((label,i)=>({label,email:`offline+fixture${i}@gmail.com`,fictionalName:'Fictional test'}))}));
 const reviewBytes=Buffer.from(JSON.stringify({project:'mjtejwafxriwntweussc',privateFixtures:{sha256:hash(fixtureBytes)},acceptanceLimits:acceptanceProtocol.C}));
 const securityEvidence={status:'PASSED',policy:'Strict Option A',project:'mjtejwafxriwntweussc',humanReviewed:true,checks:Object.fromEntries(['terminalReuseDenial','noFurtherRenewal','immediateProtectedResourceDenial','directApiBoundary','legitimateMfaRecovery'].map(k=>[k,true]))};
 const now=Date.now(),authorization={approved:true,selection,scope:`C-${selection}-v1`,project:'mjtejwafxriwntweussc',marker:'fireworks-foundation-proof-01a12e38',reviewSha256:hash(reviewBytes),limits:stageCLimits[selection],evidence:'OFFLINE simulated authority; not live approval',notBefore:new Date(now-1000).toISOString(),notAfter:new Date(now+100000).toISOString(),securityPolicy:'strict-proven',securityEvidenceSha256:hash(JSON.stringify(securityEvidence))};
 return {root:join(mkdtempSync(join(tmpdir(),'mitsa-C-offline-')),'ledger'),selection,reviewBytes,fixtureBytes,authorization,securityEvidence,now:()=>now};
}
it.each(['missing','scope','target','hash','fixture','limits','expired'])('denies %s authority before ledger creation',kind=>{
 const f=scopeFixture();if(kind==='missing')f.authorization.approved=false;if(kind==='scope')f.authorization.scope='C-old';if(kind==='target')f.authorization.project='other';if(kind==='hash')f.authorization.reviewSha256='other';if(kind==='fixture')f.fixtureBytes=Buffer.from('{}');if(kind==='limits')f.authorization.limits={...f.authorization.limits,emails:2};if(kind==='expired')f.authorization.notAfter=new Date(0).toISOString();
 expect(()=>stageCScope(f)).toThrow();expect(existsSync(f.root)).toBe(false);
});
it('no-account selection works without asserting any strict-policy success',()=>{
 const f=scopeFixture();expect(()=>stageCScope({...f,securityEvidence:undefined})).not.toThrow();
});
it('real signup refuses unresolved Strict A and unapproved exceptions before state creation',()=>{
 for(const policy of ['strict-unresolved','bounded-development-1h','separately-approved-development-exception']){const f=scopeFixture('B');f.authorization.securityPolicy=policy;expect(()=>stageCScope(f)).toThrow();expect(existsSync(f.root)).toBe(false);}
 const f=scopeFixture('B');f.securityEvidence.checks.noFurtherRenewal=false;expect(()=>stageCScope(f)).toThrow();
});
it('failed requests and duplicate message claims remain consumed across restart',async()=>{
 const f=scopeFixture(),s=stageCScope(f);s.reserve(['emails'],{label:'c3b-a',job:'immutable-job'});
 expect(()=>stageCScope(f).reserve(['emails'],{label:'c3b-a',job:'immutable-job'})).toThrow();expect(stageCScope(f).counts().emails).toBe(1);
 const text=readdirSync(f.root).filter(p=>p.endsWith('.json')).map(p=>readFileSync(join(f.root,p),'utf8')).join('');expect(text).not.toContain('gmail.com');
});
it('wrong recipients and unknown SQL never gain authority',async()=>{
 const f=scopeFixture(),s=stageCScope(f),call=vi.fn();expect(()=>s.assertRecipient('c3b-a','unapproved@example.invalid')).toThrow();expect(()=>s.assertRecipient('Yuno','offline+fixture0@gmail.com')).toThrow();
 await expect(s.sql(call)('select private.mutator()')).rejects.toThrow();expect(call).not.toHaveBeenCalled();
});
it('worker launch, Auth and Edge budgets persist and cannot be refunded',()=>{
 const f=scopeFixture('B'),s=stageCScope(f);s.reserve(['workerLaunches']);expect(()=>stageCScope(f).reserve(['workerLaunches'])).toThrow();
 for(let i=0;i<30;i++)s.reserve(['authRequests'],{label:'c3b-a'});expect(()=>stageCScope(f).reserve(['authRequests'],{label:'c3b-a'})).toThrow();
 expect(s.counts().authRequests).toBe(30);
});
it('management requests count before dispatch and change only the single flag',async()=>{
 const reserve=vi.fn(),fetcher=vi.fn(async(_url:unknown,init:any)=>new Response(JSON.stringify(init.method==='GET'?[{name:'MITSA_REGISTRATION_SERVICE_ENABLED',value:hash('false')}]:{}),{status:200}));
 const service=stageCManagement({scope:{reserve},token:'OFFLINE-TOKEN-NEVER-A-CREDENTIAL'.repeat(2),project:'mjtejwafxriwntweussc',fetcher});
 await service.assertDisabled();await service.setEnabled(true);await service.setEnabled(false);await service.assertDisabled();expect(reserve).toHaveBeenCalledTimes(4);
 expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual([{name:'MITSA_REGISTRATION_SERVICE_ENABLED',value:'true'}]);
 expect(fetcher.mock.calls.every(c=>c[1].redirect==='error')).toBe(true);
});
it('management permission failure is not retried or disclosed',async()=>{
 const fetcher=vi.fn(async()=>{throw Error('PRIVATE-TOKEN-SENTINEL');}),reserve=vi.fn();
 const service=stageCManagement({scope:{reserve},token:'OFFLINE-TOKEN-NEVER-A-CREDENTIAL'.repeat(2),project:'mjtejwafxriwntweussc',fetcher});
 await expect(service.setEnabled(true)).rejects.toThrow('Management request unconfirmed');expect(fetcher).toHaveBeenCalledOnce();expect(reserve).toHaveBeenCalledOnce();
});
function engineFixture(){
 let n=0,claim=false,current='123456',used=false,clock=1000;const intent=randomUUID(),user=randomUUID();
 const d={termsId:randomUUID(),privacyId:randomUUID(),fixture:(label:string)=>['c3b-a','c3b-b'].includes(label)?{email:`offline+${label}@gmail.com`,fictionalName:'Fictional test'}:undefined,
  challenge:vi.fn(async()=>true),assertRecipient:vi.fn((label:string,email:string)=>{expect(email).toBe(`offline+${label}@gmail.com`);}),
  command:vi.fn(async(action:string)=>{if(action==='prepare')return {intentId:intent,nonce:'a'.repeat(64)};if(action==='claim-signup'){const prior=claim;claim=true;return {claimed:!prior};}return {requestId:`00000000-0000-4000-8000-${String(++n).padStart(12,'0')}`,sendAllowed:true};}),
  pulse:vi.fn(async()=>{}),signup:vi.fn(async()=>({error:null,data:{user:{id:user},session:null}})),resend:vi.fn(async()=>{current='654321';return {error:null};}),
  verify:vi.fn(async(_f:unknown,code:string)=>code===current&&!used&&clock<4000?(used=true,{error:null,data:{user:{id:user},session:{access_token:'OFFLINE'}}}):{error:{code:'otp_expired'},data:{session:null}}),
  signout:vi.fn(async()=>{}),databaseNow:async()=>clock,persist:vi.fn(async()=>{}),deniedMail:vi.fn(async()=>true),stop:vi.fn(async()=>{})};
 const engine=new StageCEngine(d);
 const deliver=async(label='c3b-a',code=current)=>{const f=engine.fixtures.get(label);await engine.capture({id:f.dispatchId,intentId:f.intentId,userId:f.userId,email:f.email,recipientHash:hash(f.email),action:'signup',origin:'http://127.0.0.1:3000',code,tokenHash:'b'.repeat(64),captureId:randomUUID(),issuedAt:1000,expiresAt:4000});engine.sentJobs.add(f.dispatchId);};
 return {engine,d,deliver,setClock:(v:number)=>{clock=v;}};
}
it('OFFLINE real protocol requires receipt, supersedes code, verifies once and rejects replay',async()=>{
 const f=engineFixture();await f.engine.signup('c3b-a','proof',true);await f.deliver();await expect(f.engine.verify('c3b-a')).rejects.toThrow();f.engine.receipt('c3b-a');await f.engine.cooldown('c3b-a');await f.engine.resend('c3b-a');await f.deliver();f.engine.receipt('c3b-a');await f.engine.verify('c3b-a');
 expect(f.engine.checks).toMatchObject({wrongCode:true,supersededCode:true,replayedCode:true,emailVerified:true,serverCooldown:true});expect(f.d.signup).toHaveBeenCalledOnce();expect(f.d.signout).toHaveBeenCalledOnce();
 expect(JSON.stringify(f.engine.status())).not.toContain('gmail.com');expect(JSON.stringify(f.engine.status())).not.toContain('654321');
});
it('does not equate encrypted capture or SMTP acceptance with inbox receipt',async()=>{
 const f=engineFixture();await f.engine.signup('c3b-a','proof',true);await f.deliver();f.engine.sentJobs.clear();expect(()=>f.engine.receipt('c3b-a')).toThrow();f.engine.sentJobs.add(f.engine.fixtures.get('c3b-a').dispatchId);expect(f.engine.status().fixtures[0].inboxConfirmed).toBe(false);
});
it('CAPTCHA failure cannot create an intent or account',async()=>{
 const f=engineFixture();f.d.challenge.mockResolvedValue(false);await expect(f.engine.signup('c3b-a','bad',true)).rejects.toThrow();expect(f.d.command).not.toHaveBeenCalled();expect(f.d.signup).not.toHaveBeenCalled();
});
it('missing account permission stops after one durably recorded provider attempt',async()=>{
 const f=engineFixture();f.d.signup.mockResolvedValue({error:{code:'not_authorized'} as never,data:{user:null as never,session:null}});await expect(f.engine.signup('c3b-a','proof',true)).rejects.toThrow();expect(f.engine.fixtures.get('c3b-a').providerAttempted).toBe(true);await expect(f.engine.signup('c3b-a','proof',true)).rejects.toThrow();expect(f.d.signup).toHaveBeenCalledOnce();expect(f.d.persist).toHaveBeenCalled();
});
it('expiration needs actual elapsed provider time and explicit OTP rejection',async()=>{
 const f=engineFixture();await f.engine.signup('c3b-b','proof',true);await f.deliver('c3b-b');f.engine.receipt('c3b-b');await expect(f.engine.expire('c3b-b')).rejects.toThrow();f.setClock(4001);await f.engine.expire('c3b-b');expect(f.engine.checks.expiredCode).toBe(true);
});
it('provider outage is not misreported as negative-OTP success',async()=>{
 const f=engineFixture();await f.engine.signup('c3b-a','proof',true);f.d.verify.mockResolvedValue({error:{code:'service_unavailable'},data:{session:null}} as never);await expect(f.engine.rejectCode(f.engine.fixtures.get('c3b-a'),'000000')).rejects.toThrow();expect(f.engine.checks.wrongCode).not.toBe(true);
});
it('preservation permits only proven fixture additions and detects every retained-row change',()=>{
 const before={format:'mitsa-preservation-v2',registry:[],controls:{closed:true},security:{},rows:{'private.businesses':[{key:'old',digest:'same'}]},identities:{'auth.users':[]}},after=structuredClone(before);after.identities['auth.users'].push({key:'new',digest:'fixture'} as never);
 expect(()=>assertStageCPreservation(before,after)).toThrow();expect(assertStageCPreservation(before,after,{'auth.users':after.identities['auth.users']})).toMatchObject({retainedRowsUnchanged:true});after.rows['private.businesses'][0].digest='changed';expect(()=>assertStageCPreservation(before,after,{'auth.users':after.identities['auth.users']})).toThrow();
});
let database:Awaited<ReturnType<typeof recoveredC1Database>>;
beforeAll(async()=>{database=await recoveredC1Database();await database.exec(readFileSync(correctionPath,'utf8'));await database.exec(readFileSync('supabase/security-proposals/persistent-registration-test-notices.sql.txt','utf8'));},60000);
afterAll(async()=>{await database?.close();});
it('OFFLINE exact stop/restore SQL restores controls and keeps notices unpublished',async()=>{
 const original=((await database.query('select to_jsonb(c) v from private.registration_control c')).rows[0] as {v:unknown}).v;
 const generation=randomUUID(),sender='a'.repeat(64);await database.query(readFileSync('supabase/security-proposals/persistent-registration-delivery-controls.sql.txt','utf8'),[generation,sender]);
 const stopped=await database.query(readFileSync('supabase/security-proposals/persistent-registration-operational-stop.sql.txt','utf8'),[generation]);expect(stopped.rows[0]).toMatchObject({stopped_controls:1});expect((await database.query(cSql.restore,[JSON.stringify(original),sender])).rows).toHaveLength(1);
 expect(((await database.query('select to_jsonb(c) v from private.registration_control c')).rows[0] as {v:unknown}).v).toEqual(original);expect((await database.query(cSql.quota)).rows).toHaveLength(1);expect((await database.query(cSql.notices,[[ '98b7abf1-bca4-474f-aee4-e851b4f28d84','40714378-eb52-46cf-a7cf-760db4100456']])).rows.every((r:any)=>r.status==='test')).toBe(true);
});
it('OFFLINE conditional restore cannot reenable admission from a poisoned input',async()=>{
 const original=((await database.query('select to_jsonb(c) v from private.registration_control c')).rows[0] as {v:Record<string,unknown>}).v;
 const generation=randomUUID(),sender='a'.repeat(64);await database.query(readFileSync('supabase/security-proposals/persistent-registration-delivery-controls.sql.txt','utf8'),[generation,sender]);await database.query(readFileSync('supabase/security-proposals/persistent-registration-operational-stop.sql.txt','utf8'),[generation]);
 expect((await database.query(cSql.restore,[JSON.stringify({...original,admission_enabled:true}),sender])).rows).toHaveLength(0);
 expect((await database.query(cSql.restore,[JSON.stringify(original),sender])).rows).toHaveLength(1);
});
it('LOOPBACK ONLY operator form requires exact Origin and its random nonce',async()=>{
 const operate=vi.fn(async()=>{}),panel=await stageCPanel({selection:'A',siteKey:'',agreement:'Test only',port:0,operate,status:()=>({safe:true}),reserve:()=>{}});
 try{const page=await fetch(panel.url);expect(page.headers.get('content-security-policy')).toContain("form-action 'self'");const html=await page.text(),token=html.match(/name="csrf" value="([a-f0-9]+)"/)![1];
  const send=(origin:string,csrf:string)=>fetch(panel.url+'/control',{method:'POST',headers:{origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({action:'receipt',label:'c3b-a',csrf}),redirect:'manual'});
  expect((await send('https://unapproved.invalid',token)).status).toBe(403);expect((await send(panel.url,'bad')).status).toBe(403);expect(operate).not.toHaveBeenCalled();expect((await send(panel.url,token)).status).toBe(303);expect(operate).toHaveBeenCalledOnce();
 }finally{await panel.close();}
});
it('real Stage C CLI refuses unapproved A/B and unsupervised child before live state',()=>{
 const cwd=mkdtempSync(join(tmpdir(),'mitsa-C-cli-'));mkdirSync(join(cwd,'config'));writeFileSync(join(cwd,'fixtures.json'),JSON.stringify({project:'mjtejwafxriwntweussc',fixtures:[]}));
 writeFileSync(join(cwd,'config/registration-stage-c-review.json'),JSON.stringify({project:'mjtejwafxriwntweussc',marker:'fireworks-foundation-proof-01a12e38',limits:stageCLimits,sources:[],historicalEvidence:[],privateFixtures:{path:'fixtures.json',sha256:hash(readFileSync(join(cwd,'fixtures.json')))}}));
 for(const mode of ['--run','--child'])for(const selection of ['A','B']){
  const p=spawnSync(process.execPath,[resolve('scripts/registration-stage-c.mjs'),mode,selection],{cwd,encoding:'utf8',windowsHide:true,timeout:15000});expect(p.status).toBe(1);expect(p.stderr).toContain('STAGE_C_STOPPED_NO_AUTOMATIC_RETRY');
 }
 expect(existsSync(join(cwd,'.secrets/registration-stage-c'))).toBe(false);
},60000);
