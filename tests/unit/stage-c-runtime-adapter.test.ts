// Actual diagnostic runtime with every external transport denied/replaced.
import {it,expect,vi,beforeEach} from 'vitest';
import {mkdtempSync,writeFileSync,readFileSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const state=vi.hoisted(()=>({temp:'',devTarget:null as any,payload:{format:'mitsa-preservation-v2',registry:[],controls:{},security:{},rows:{},identities:{}},sendFails:false,verify:vi.fn(async()=>true),send:vi.fn(),end:vi.fn(async()=>{}),auth:vi.fn(),externalFetch:vi.fn()}));
vi.mock('node:fs',async original=>{const fs=await original<typeof import('node:fs')>();const map=(p:any)=>typeof p==='string'&&p.startsWith('.secrets/registration-stage-c/shared')?join(state.temp,'shared',p.slice('.secrets/registration-stage-c/shared'.length)):p;
 return {...fs,
  readFileSync:(p:any,...args:any[])=>p==='.secrets/operator.env'?Buffer.from('TEST_PROJECT_REF=mjtejwafxriwntweussc\nTEST_SUPABASE_URL=https://mjtejwafxriwntweussc.supabase.co\nTEST_DATABASE_URL=postgresql://postgres:OFFLINE@db.mjtejwafxriwntweussc.supabase.co:5432/postgres\n'):p==='.env.local'?Buffer.from('MITSA_REGISTRATION_ENGINE=legacy\nMITSA_REGISTRATION_SERVICE_ENABLED=false\n'):p==='.secrets/test/capture.json'?Buffer.from('accepted'):p==='config/test-target.json'?Buffer.from(JSON.stringify(state.devTarget)):(fs.readFileSync as any)(map(p),...args),
  mkdirSync:(p:any,...args:any[])=>(fs.mkdirSync as any)(map(p),...args),
  readdirSync:(p:any,...args:any[])=>(fs.readdirSync as any)(map(p),...args),
  writeFileSync:(p:any,...args:any[])=>(fs.writeFileSync as any)(map(p),...args)
 };
});
vi.mock('../../scripts/lib/preservation-private-evidence.mjs',async original=>{const actual=await original<any>();return {...actual,evidenceKeys:async()=>({}),loadPrivateEvidence:async()=>({payload:state.payload,comparisonKey:Buffer.alloc(32,1).toString('base64')}),savePrivateEvidence:async()=>'.secrets/test/capture.json',readJson:(p:string)=>p==='.secrets/registration-final-v1/A/accepted.json'?{manifest:'.secrets/test/capture.json'}:actual.readJson(p)};});
vi.mock('../../scripts/lib/current-preservation.mjs',async original=>{const actual=await original<any>();return {...actual,collectCurrentPreservation:async(db:any)=>{await db.query(actual.captureGuardSql);for(const r of state.payload.registry as any[])await db.query(actual.fingerprintSql(r.schema+'.'+r.table,r.keys,{auth:r.schema==='auth'}));for(const sql of Object.values(actual.securityQueries))await db.query(sql);return structuredClone(state.payload);}};});
vi.mock('../../scripts/lib/current-preservation-security.mjs',()=>({assertCurrentSecurity:()=>({offline:true})}));
vi.mock('../../scripts/lib/gmail-credentials.mjs',()=>({readProtectedGmailCredentials:()=>({sender:'offline@gmail.com',appPassword:'a'.repeat(16)})}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>{state.auth();throw Error('Auth forbidden in diagnostic selection');}}));
vi.mock('nodemailer',()=>({default:{createTransport:()=>({verify:state.verify,sendMail:async (message:any)=>{state.send(message);if(state.sendFails)throw Error('SMTP uncertain');return {accepted:['offline+fixture0@gmail.com'],rejected:[]};},close:()=>{}})}}));
vi.mock('pg',()=>({default:{Client:class{connection={stream:{destroy(){}}};on(){}async connect(){}async query(sql:string){if(sql.includes('dispatches'))return {rows:[{dispatches:0,triggers:0,control:{}}]};if(sql.includes(' hourly'))return {rows:[{hourly:0,daily:0}]};return {rows:[{now:new Date()}]};}end=state.end;}}}));
vi.mock('../../scripts/lib/stage-c-panel.mjs',()=>({stageCPanel:async (options:any)=>{setTimeout(async()=>{try{await options.operate({action:'send-diagnostic',label:'c3b-a'});await options.operate({action:'receipt',label:'c3b-a'});await options.operate({action:'finish'});}catch{/* Expected failure path already stops runtime. */}},10);return {url:'http://127.0.0.1:3301',close:async()=>{}};}}));
import {runStageC} from '../../scripts/lib/stage-c-runtime.mjs';
import {stageCLimits} from '../../scripts/lib/stage-c-scope.mjs';
import devTarget from '../fixtures/dev-test-target.json';
// The offline adapter exercises the isolated dev target, not the production pin.
state.devTarget=devTarget;
const hash=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex');
beforeEach(()=>{state.temp=mkdtempSync(join(tmpdir(),'mitsa-C-adapter-'));state.payload.registry=[...Array.from({length:41},(_,i)=>({schema:'private',table:'offline_'+i,keys:['id']})),...['users','mfa_factors','identities'].map(table=>({schema:'auth',table,keys:['id']}))] as never[];state.sendFails=false;state.send.mockClear();state.auth.mockClear();state.end.mockClear();state.verify.mockClear();});
function options(){const root=join(state.temp,'run');mkdirSync(root);writeFileSync(root+'/attempt.json',JSON.stringify({claimedAt:new Date().toISOString()}));const fixtureBytes=Buffer.from(JSON.stringify({project:'mjtejwafxriwntweussc',fixtures:[{label:'c3b-a',email:'offline+fixture0@gmail.com'}]})),reviewBytes=Buffer.from(JSON.stringify({project:'mjtejwafxriwntweussc',privateFixtures:{sha256:hash(fixtureBytes)},acceptedCandidateManifestSha256:hash('accepted')}));return {root,selection:'A',reviewBytes,fixtureBytes,authorization:{approved:true,selection:'A',scope:'C-A-v1',project:'mjtejwafxriwntweussc',marker:'fireworks-foundation-proof-01a12e38',reviewSha256:hash(reviewBytes),limits:stageCLimits.A,evidence:'OFFLINE adapter test only',notBefore:new Date(Date.now()-1000).toISOString(),notAfter:new Date(Date.now()+700000).toISOString()},securityEvidence:undefined,signal:new AbortController().signal,emit:()=>{}};}
it('OFFLINE actual adapter sends only a diagnostic through mocks, acknowledges receipt and cleans up',async()=>{
 const f=options(),result=await runStageC(f);expect(result.status).toBe('BODY_PASSED_PENDING_NATURAL_EXIT');expect(result.realOtpTested).toBe(false);expect(result.counts.emails).toBe(1);expect(result.counts.sqlRequests).toBe(111);expect(result.counts.sqlWriteCalls??0).toBe(0);expect(state.send).toHaveBeenCalledOnce();expect(state.auth).not.toHaveBeenCalled();expect(state.end).toHaveBeenCalledOnce();expect(state.send.mock.calls[0][0].text).toContain('contains no verification code');
});
it('OFFLINE actual adapter retains an uncertain SMTP attempt and closes without retry',async()=>{
 const f=options();state.sendFails=true;await expect(runStageC(f)).rejects.toThrow();expect(state.send).toHaveBeenCalledOnce();expect(state.auth).not.toHaveBeenCalled();expect(state.end).toHaveBeenCalledOnce();const result=JSON.parse(readFileSync(f.root+'/body-result.json','utf8'));expect(result.status).toBe('FAILED');expect(result.counts.emails).toBe(1);
});
