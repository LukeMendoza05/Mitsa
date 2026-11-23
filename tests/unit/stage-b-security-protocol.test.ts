import {it,expect,vi} from 'vitest';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
import {StageBBudget,validateStageBApproval,validateStageBProposal,validateStageBResumeProposal,validateStageBResumeApproval,validateStageBHardeningProposal,validateStageBHardeningApproval,validateStageBHardeningContinuationProposal,validateStageBHardeningContinuationAuthorization,continueStageBHardening,runStageBHardening,stageBProviderCode,assertStageBReadiness,stageBRequestOperation,runStageBBaseline,resumeStageBBaseline,stageBProject,stageBMarker,type BaselineAdapter} from '../../scripts/lib/stage-b-security-protocol';
const expected={proposalSha256:'a'.repeat(64),runnerSha256:'b'.repeat(64),protocolSha256:'c'.repeat(64)};
const approval=()=>({approved:true,approvalId:crypto.randomUUID(),projectRef:stageBProject,databaseMarker:stageBMarker,...expected,
 providerObservedAt:new Date().toISOString(),providerVersion:'v2.197.0',sendEmailHook:'private.mitsa_isolated_send_email',
 sendEmailHookEnabled:true,beforeUserHook:'private.mitsa_before_user_created',beforeUserHookEnabled:true,
 currentPasswordRequired:false,securePasswordChange:false,globalCaptchaEnabled:false,emailConfirmationRequired:true,smtpClosed:true,registrationClosed:true});
it('rejects changed proposal limits and excluded operations before any execution',()=>{
 const proposal=JSON.parse(readFileSync('config/persistent-registration-stage-b-test-proposal.json','utf8'));
 expect(validateStageBProposal(proposal)).toMatchObject({maxNewSyntheticUsers:2});
 for(const changed of [{maxPasswordUpdates:3},{maxNewSyntheticUsers:3},{maxExternalEmails:1},{providerSettingsChanged:true},{migrationsAllowed:true},{hookChangesAllowed:true},{riskAcceptanceIncluded:true}])expect(()=>validateStageBProposal({...proposal,...changed})).toThrow();
});
it('requires exact human approval, target, reviewed sources and fresh provider observation',()=>{
 expect(validateStageBApproval(approval(),expected)).toMatchObject({approved:true});
 for(const bad of [null,{...approval(),approved:false},{...approval(),projectRef:'different-project'},{...approval(),databaseMarker:'different-marker'},
  {...approval(),runnerSha256:'d'.repeat(64)},{...approval(),providerObservedAt:new Date(Date.now()-901000).toISOString()},
  {...approval(),providerObservedAt:new Date(Date.now()+60000).toISOString()},{...approval(),smtpClosed:false},{...approval(),currentPasswordRequired:true},
  {...approval(),sendEmailHookEnabled:false},{...approval(),globalCaptchaEnabled:true},{...approval(),emailConfirmationRequired:false}])expect(()=>validateStageBApproval(bad,expected)).toThrow();
});
it('requires separate continuation approval bound to the retained encrypted checkpoint',()=>{
 const expectedResume={...expected,checkpointSha256:'d'.repeat(64)},resume={...approval(),resumeOnly:true,checkpointSha256:expectedResume.checkpointSha256};
 expect(validateStageBResumeApproval(resume,expectedResume)).toMatchObject({resumeOnly:true});
 for(const bad of [approval(),{...resume,resumeOnly:false},{...resume,checkpointSha256:'e'.repeat(64)},{...resume,approved:false}])expect(()=>validateStageBResumeApproval(bad,expectedResume)).toThrow();
 const proposal=JSON.parse(readFileSync('config/persistent-registration-stage-b-resume-proposal.json','utf8'));
 expect(validateStageBResumeProposal(proposal)).toMatchObject({maxNewSyntheticUsers:0});
 for(const bad of [{maxNewSyntheticUsers:1},{cumulativeMaxPasswordUpdates:6},{maxAdditionalVerifiedTotpFactors:2},{priorCounts:{...proposal.priorCounts,password:1}},{maxExternalEmails:1}])expect(()=>validateStageBResumeProposal({...proposal,...bad})).toThrow();
});
it('preserves cumulative budgets without refunding the uncertain attempt',async()=>{
 const counts={create:2,password:2,recovery:0,signin:4,refresh:1,enroll:1,verifyNewFactor:1};
 const budget=new StageBBudget(async()=>{},{counts,additionalPasswordAttemptApproved:true});
 await expect(budget.reserve('create')).rejects.toThrow();
 await budget.reserve('password');await budget.reserve('password');await budget.reserve('password');
 await expect(budget.reserve('password')).rejects.toThrow();expect(budget.counts.password).toBe(5);
 expect(()=>new StageBBudget(async()=>{},{counts:{...counts,create:3},additionalPasswordAttemptApproved:true})).toThrow();
});
it('requires separate exact approval for project-wide current-password hardening',()=>{
 const proof={...approval(),currentPasswordRequired:true,hardeningOnly:true,checkpointSha256:'e'.repeat(64)},hashes={...expected,checkpointSha256:'e'.repeat(64)};
 expect(validateStageBHardeningApproval(proof,hashes)).toMatchObject({currentPasswordRequired:true});
 for(const bad of [approval(),{...proof,currentPasswordRequired:false},{...proof,hardeningOnly:false},{...proof,checkpointSha256:'f'.repeat(64)}])expect(()=>validateStageBHardeningApproval(bad,hashes)).toThrow();
 const proposal=JSON.parse(readFileSync('config/persistent-registration-stage-b-hardening-proposal.json','utf8'));
 expect(validateStageBHardeningProposal(proposal)).toMatchObject({maxAdditionalPasswordUpdates:10});
 for(const bad of [{maxAdditionalPasswordUpdates:11},{maxNewSyntheticUsers:1},{maxNewVerifiedTotpFactors:1},{testValue:false},{riskAcceptanceIncluded:true}])expect(()=>validateStageBHardeningProposal({...proposal,...bad})).toThrow();
});
it('hardening uses a separately approved phase budget with no account or factor creation',async()=>{
 const budget=new StageBBudget(async()=>{},{hardeningOnly:true});
 for(const operation of ['create','enroll','verifyNewFactor'] as const)await expect(budget.reserve(operation)).rejects.toThrow();
 for(let i=0;i<10;i++)await budget.reserve('password');await expect(budget.reserve('password')).rejects.toThrow();
 await budget.reserve('recovery');await budget.reserve('recovery');await expect(budget.reserve('recovery')).rejects.toThrow();
 expect(budget.counts).toMatchObject({create:0,password:10,recovery:2,enroll:0,verifyNewFactor:0});
});
it('continues only four remaining attempts without refunding six settled requests',async()=>{
 const counts={create:0,password:6,recovery:1,signin:3,refresh:0,enroll:0,verifyNewFactor:0},budget=new StageBBudget(async()=>{},{hardeningOnly:true,counts});
 for(let i=0;i<4;i++)await budget.reserve('password');await expect(budget.reserve('password')).rejects.toThrow();
 expect(budget.counts.password).toBe(10);expect(budget.counts.recovery).toBe(1);expect(budget.counts.signin).toBe(3);
 expect(()=>new StageBBudget(async()=>{},{hardeningOnly:true,counts:{...counts,password:11}})).toThrow();
});
it('continuation remains tied to the original hardening grant and settled checkpoint',()=>{
 const originalApprovalId=crypto.randomUUID(),hashes={...expected,checkpointSha256:'d'.repeat(64),checkpointWriterSha256:'e'.repeat(64),originalApprovalId};
 const value={...approval(),currentPasswordRequired:true,hardeningOnly:true,continueOnly:true,authorizationSource:'existing-approved-hardening-scope',checkpointSha256:hashes.checkpointSha256,checkpointWriterSha256:hashes.checkpointWriterSha256,originalApprovalId};
 expect(validateStageBHardeningContinuationAuthorization(value,hashes)).toMatchObject({continueOnly:true});
 for(const bad of [{originalApprovalId:crypto.randomUUID()},{checkpointWriterSha256:'f'.repeat(64)},{authorizationSource:'new-unreviewed-scope'},{currentPasswordRequired:false}])expect(()=>validateStageBHardeningContinuationAuthorization({...value,...bad},hashes)).toThrow();
 const proposal=JSON.parse(readFileSync('config/persistent-registration-stage-b-hardening-continuation.json','utf8'));
 expect(validateStageBHardeningContinuationProposal(proposal)).toMatchObject({remainingPasswordAttempts:4});
 for(const bad of [{remainingPasswordAttempts:5},{cumulativeHardeningPasswordLimit:11},{newAccounts:1},{externalEmails:1},{priorHardeningCounts:{...proposal.priorHardeningCounts,password:5}}])expect(()=>validateStageBHardeningContinuationProposal({...proposal,...bad})).toThrow();
});
it('exposes only bounded provider categories and never arbitrary error contents',()=>{
 expect(stageBProviderCode({code:'insufficient_aal',message:'private fixture detail'})).toBe('insufficient_aal');
 for(const bad of [null,'private token',{code:'private token'},{message:'private password'}])expect(stageBProviderCode(bad)).toBe('other');
});
it('requires a successful authenticated readiness response except for the explicit post-removal denial',()=>{
 expect(()=>assertStageBReadiness({data:{ready:false},error:null},false)).not.toThrow();
 for(const code of ['42501','PGRST301','request_timeout'])expect(()=>assertStageBReadiness({data:null,error:{code}},false)).toThrow();
 expect(()=>assertStageBReadiness({data:null,error:{code:'42501'}},false,true)).not.toThrow();
 expect(()=>assertStageBReadiness({data:null,error:{code:'request_timeout'}},false,true)).toThrow();
 expect(()=>assertStageBReadiness({data:null,error:null},false)).toThrow();
 expect(()=>assertStageBReadiness({data:{ready:false},error:null},true)).toThrow();
});
it.each(['insufficient_aal','current_password_required','current_password_invalid'])('the installed Auth SDK retains %s from a simulated provider response without network access',async(errorCode)=>{
 const user={id:crypto.randomUUID(),email:'foundation-sdk-fixture@example.invalid',aud:'authenticated',created_at:new Date().toISOString(),app_metadata:{},user_metadata:{}};
 const requests:string[]=[],fetcher=vi.fn(async(address:RequestInfo|URL,init?:RequestInit)=>{
  const url=new URL(String(address));requests.push(`${init?.method} ${url.pathname}`);
  if(url.pathname==='/auth/v1/token'&&init?.method==='POST')return new Response(JSON.stringify({access_token:'synthetic-access-token',refresh_token:'synthetic-refresh-token',expires_in:3600,token_type:'bearer',user}),{status:200,headers:{'Content-Type':'application/json'}});
  const status=errorCode==='insufficient_aal'?401:400;
  if(url.pathname==='/auth/v1/user'&&init?.method==='PUT')return new Response(JSON.stringify({code:status,error_code:errorCode,msg:'Synthetic authentication denial'}),{status,headers:{'Content-Type':'application/json','X-Supabase-API-Version':'2024-01-01'}});
  throw Error('Unexpected simulated SDK request');
 });
 const client=createClient('https://fixture.invalid','synthetic-publishable-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,debug:false},global:{fetch:fetcher}});
 expect((await client.auth.signInWithPassword({email:user.email!,password:'synthetic-fixture-password'})).error).toBeNull();
 const result=await client.auth.updateUser({password:'synthetic-replacement-password'});
 expect(result.error?.status).toBe(errorCode==='insufficient_aal'?401:400);expect(stageBProviderCode(result.error)).toBe(errorCode);
 expect(requests).toEqual(['POST /auth/v1/token','PUT /auth/v1/user']);
});
it('reserves before side effects and does not refund a failed or uncertain attempt',async()=>{
 const persisted:number[]=[],budget=new StageBBudget(async counts=>{persisted.push(counts.create);});const provider=vi.fn(async()=>{throw Error('Synthetic timeout');});
 await budget.reserve('create');expect(persisted).toEqual([1]);await expect(provider()).rejects.toThrow();
 await budget.reserve('create');await expect(budget.reserve('create')).rejects.toThrow();expect(budget.counts.create).toBe(2);
});
it('serializes durable snapshots and fences later work after persistence failure',async()=>{
 let release!:()=>void;const writes:number[]=[];
 const budget=new StageBBudget(async counts=>{writes.push(counts.signin);if(counts.signin===1)await new Promise<void>(resolve=>{release=resolve;});});
 const first=budget.reserve('signin'),second=budget.reserve('signin');await Promise.resolve();expect(writes).toEqual([1]);release();await Promise.all([first,second]);expect(writes).toEqual([1,2]);
 const broken=new StageBBudget(async()=>{throw Error('Synthetic checkpoint failure');});
 await expect(broken.reserve('create')).rejects.toThrow();await expect(broken.reserve('password')).rejects.toThrow();
});
it.each([['create',2],['password',4],['recovery',2],['signin',12],['refresh',12],['enroll',3],['verifyNewFactor',2]] as const)('enforces the reviewed %s ceiling even across concurrent reservations',async(operation,limit)=>{
 const budget=new StageBBudget(async()=>{}),results=await Promise.allSettled(Array.from({length:limit+2},()=>budget.reserve(operation)));
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(limit);expect(budget.counts[operation]).toBe(limit);
});
const base=`https://${stageBProject}.supabase.co`;
it('admits only the fixed isolated Auth and RPC protocol and classifies actual HTTP attempts',()=>{
 expect(stageBRequestOperation(`${base}/auth/v1/token?grant_type=password`,'POST')).toBe('signin');
 expect(stageBRequestOperation(`${base}/auth/v1/token?grant_type=refresh_token`,'POST')).toBe('refresh');
 expect(stageBRequestOperation(`${base}/auth/v1/admin/users`,'POST')).toBe('create');
 expect(stageBRequestOperation(`${base}/auth/v1/admin/generate_link`,'POST')).toBe('recovery');
 expect(stageBRequestOperation(`${base}/rest/v1/rpc/mitsa_security_status`,'POST')).toBeNull();
 for(const [url,method] of [[base+'/auth/v1/signup','POST'],[base+'/auth/v1/invite','POST'],[base+'/rest/v1/rpc/mitsa_create_workspace','POST'],[base+'/rest/v1/memberships','PATCH'],[base+'/auth/v1/admin/users/someone','DELETE'],[base+'/auth/v1/token?grant_type=client_credentials','POST'],['https://different.supabase.co/auth/v1/admin/users','POST'],[base.replace('https:','http:')+'/auth/v1/user','PUT']])expect(()=>stageBRequestOperation(url,method)).toThrow();
});
function fakeAdapter(fault?:string){
 const events:{name:string;arguments:unknown[]}[]=[];
 const method=(name:string)=>async(...args:unknown[])=>{events.push({name,arguments:args});if(fault===name)throw Error('Synthetic critical mismatch');};
 const adapter:BaselineAdapter={create:method('create'),signIn:method('signIn'),acceptTestAgreement:method('acceptTestAgreement'),password:method('password'),
  otherSessionProbe:async()=>({bearerDenied:true,refreshDenied:true}),prepareFactor:method('prepareFactor'),enrollFactor:method('enrollFactor'),verifyFactor:method('verifyFactor'),
  bindFactor:method('bindFactor'),ready:method('ready'),removeFactor:method('removeFactor'),recover:method('recover'),replayRecovery:method('replayRecovery'),signOut:method('signOut')};
 return {adapter,events};
}
it('keeps the prepared sequence inside the approved fixture and mutation budget',async()=>{
 const {adapter,events}=fakeAdapter(),report=await runStageBBaseline(adapter);
 expect(events.filter(e=>e.name==='create').map(e=>e.arguments)).toEqual([['plain'],['mfa']]);
 expect(events.filter(e=>e.name==='password').map(e=>e.arguments)).toEqual([['plain','allowed'],['mfa','insufficient_aal'],['mfa','insufficient_aal'],['mfa','allowed']]);
 expect(events.filter(e=>e.name==='enrollFactor'&&e.arguments[1]==='allowed')).toHaveLength(2);
 expect(events.filter(e=>e.name==='recover')).toHaveLength(1);expect(events.filter(e=>e.name==='replayRecovery')).toHaveLength(1);
 expect(events.filter(e=>e.name==='signIn').length).toBeLessThanOrEqual(12);
 expect(report).toMatchObject({status:'baseline-observed',strictRefreshReuseResolved:false,securityRiskAccepted:false,externalEmailsRequested:0});
});
it('stops immediately after an unexpected provider result without continuing the mutation sequence',async()=>{
 const {adapter,events}=fakeAdapter('password');await expect(runStageBBaseline(adapter)).rejects.toThrow();
 expect(events.filter(e=>e.name==='password')).toHaveLength(1);expect(events.some(e=>e.name==='enrollFactor'||e.name==='recover')).toBe(false);
});
it('continues only the retained MFA fixture without repeating account creation or primary enrollment',async()=>{
 const {adapter,events}=fakeAdapter(),report=await resumeStageBBaseline(adapter);
 expect(events.some(e=>e.name==='create'||e.name==='acceptTestAgreement')).toBe(false);
 expect(events.filter(e=>e.name==='password')).toHaveLength(3);
 expect(events.filter(e=>e.name==='enrollFactor'&&e.arguments[1]==='allowed').map(e=>e.arguments[0])).toEqual(['secondary']);
 expect(report).toMatchObject({initialBaselineWasPartial:true,strictRefreshReuseResolved:false,securityRiskAccepted:false});
 const allowedDenials=events.filter(e=>e.name==='ready'&&e.arguments[1]===true);expect(allowedDenials).toHaveLength(1);
 const removalIndex=events.findIndex(e=>e.name==='removeFactor'&&e.arguments[1]==='allowed');expect(events[removalIndex+1]).toEqual({name:'ready',arguments:[false,true]});
});
it('hardening tests ordinary and MFA recovery without creating or changing any factor',async()=>{
 const {adapter,events}=fakeAdapter(),result=await runStageBHardening(adapter);
 expect(events.filter(e=>e.name==='password').map(e=>e.arguments)).toEqual([
  ['plain','current_password_required'],['plain','current_password_invalid','wrong'],['plain','allowed','correct'],['plain','allowed'],
  ['mfa','insufficient_aal','correct'],['mfa','current_password_required'],['mfa','current_password_invalid','wrong'],['mfa','allowed','correct'],['mfa','insufficient_aal'],['mfa','allowed']]);
 expect(events.filter(e=>e.name==='recover').map(e=>e.arguments)).toEqual([['plain'],['mfa']]);
 expect(events.some(e=>['create','acceptTestAgreement','prepareFactor','enrollFactor','bindFactor','removeFactor'].includes(e.name))).toBe(false);
 expect(events.filter(e=>e.name==='verifyFactor').every(e=>e.arguments[0]==='primary')).toBe(true);
 expect(result).toMatchObject({currentPasswordEnforcementVerified:true,recoveryWithoutOldPasswordVerified:true,strictRefreshReuseResolved:false,securityRiskAccepted:false});
});
it('hardening stops before recovery on an unexpected current-password response',async()=>{
 const {adapter,events}=fakeAdapter('password');await expect(runStageBHardening(adapter)).rejects.toThrow();
 expect(events.some(e=>e.name==='recover')).toBe(false);
});
it('continues hardening at step seven without repeating ordinary recovery or completed updates',async()=>{
 const {adapter,events}=fakeAdapter(),result=await continueStageBHardening(adapter);
 expect(events.filter(e=>e.name==='password').map(e=>e.arguments)).toEqual([['mfa','current_password_invalid','wrong'],['mfa','allowed','correct'],['mfa','insufficient_aal'],['mfa','allowed']]);
 expect(events.filter(e=>e.name==='recover').map(e=>e.arguments)).toEqual([['mfa']]);
 expect(events.some(e=>e.arguments[0]==='plain'||['create','enrollFactor','removeFactor','bindFactor','prepareFactor'].includes(e.name))).toBe(false);
 expect(result).toMatchObject({resumedSettledBoundary:true,securityRiskAccepted:false});
});
it.each(['--execute','--resume','--hardening','--hardening-continue'])('the actual CLI refuses %s in a scratch directory without approval or operator credentials',(argument)=>{
 // Public fixture/cache only. No private environment or real approval is copied.
 const root=mkdtempSync(join(tmpdir(),'mitsa-stage-b-guard-'));
 mkdirSync(join(root,'config'));mkdirSync(join(root,'artifacts'));
 writeFileSync(join(root,'config','persistent-registration-stage-b-test-proposal.json'),readFileSync('config/persistent-registration-stage-b-test-proposal.json'));
 writeFileSync(join(root,'config','persistent-registration-stage-b-resume-proposal.json'),readFileSync('config/persistent-registration-stage-b-resume-proposal.json'));
 writeFileSync(join(root,'config','persistent-registration-stage-b-hardening-proposal.json'),readFileSync('config/persistent-registration-stage-b-hardening-proposal.json'));
 writeFileSync(join(root,'config','persistent-registration-stage-b-hardening-continuation.json'),readFileSync('config/persistent-registration-stage-b-hardening-continuation.json'));
 const result=spawnSync(process.execPath,[fileURLToPath(new URL('../../scripts/run-stage-b-security-baseline.mjs',import.meta.url)),argument],{
  cwd:root,env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,NODE_ENV:'test'},encoding:'utf8',timeout:15000});
 expect(result.status).toBe(1);expect(result.stderr).toBe('');
 expect(JSON.parse(result.stdout)).toMatchObject({status:'stopped-or-not-authorized',counts:null,fixtureSessionsClosedOnFailure:null,smtpClaimsVerifiedUnchanged:null,externalEmailsRequested:0});
 expect(existsSync(join(root,'.secrets'))).toBe(false);expect(readdirSync(join(root,'artifacts'))).toHaveLength(1);
});
