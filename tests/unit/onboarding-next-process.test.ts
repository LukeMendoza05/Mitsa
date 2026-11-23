import {it,expect,vi} from 'vitest';
import {fork} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,mkdtempSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {launchOnboardingNext,onboardingNextEnvironment} from '../../scripts/lib/onboarding-next-process.mjs';
const values={SUPABASE_URL:'https://mjtejwafxriwntweussc.supabase.co',APP_ORIGIN:'http://127.0.0.1:3000',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_OFFLINE_ONLY',AUTH_FLOW_KEY:'A'.repeat(43),MFA_ENROLLMENT_KEY:'A'.repeat(43),MITSA_REGISTRATION_SERVICE_KEY:'a'.repeat(64),MITSA_PUBLIC_CAPTCHA_PROVIDER:'turnstile',MITSA_TURNSTILE_SITE_KEY:'OFFLINE-SITE',MITSA_TURNSTILE_SECRET_KEY:'OFFLINE-SECRET'};
function fixture(mode='normal'){
 const root=mkdtempSync(join(tmpdir(),'mitsa-next-process-')),entry=fileURLToPath(new URL('../support/onboarding-next-process-fixture.mjs',import.meta.url)),reviewSha256='b'.repeat(64),events:string[]=[];
 const scope={root,reviewSha256,active:vi.fn(),reserve:vi.fn((kind:string)=>events.push(kind)),limits:{runtimeSeconds:60}},environment=onboardingNextEnvironment(values,process.env);
 const spawn=vi.fn((path:any,args:any,options:any)=>{events.push('fork');return fork(path,[...args,mode],options);});
 return {root,entry,entrySha256:createHash('sha256').update(readFileSync(entry)).digest('hex'),reviewSha256,scope,environment,claimedAt:new Date().toISOString(),notAfter:new Date(Date.now()+60000).toISOString(),bindings:[{label:'e-a',authorization:'c'.repeat(64)},{label:'e-b',authorization:'d'.repeat(64)}],spawn,events};
}
it('filters operator/admin/SMTP credentials and NODE_OPTIONS out of the test-server environment',()=>{
 const env=onboardingNextEnvironment({...values,GMAIL_APP_PASSWORD:'PRIVATE-UNUSED',SUPABASE_MANAGEMENT_TOKEN:'PRIVATE-UNUSED'},{PATH:'OFFLINE',NODE_OPTIONS:'--import PRIVATE',TEST_AUTH_ADMIN_KEY:'PRIVATE'});
 expect(env).toMatchObject({MITSA_REGISTRATION_ENGINE:'persistent-v1',MITSA_DEPLOYMENT_PROFILE:'isolated-development',NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1'});
 for(const key of ['GMAIL_APP_PASSWORD','SUPABASE_MANAGEMENT_TOKEN','NODE_OPTIONS','TEST_AUTH_ADMIN_KEY'])expect(Object.hasOwn(env,key)).toBe(false);
 expect(()=>onboardingNextEnvironment({...values,DATABASE_URL:'PRIVATE'},{})).toThrow('Administrative');
});
it.each([{SUPABASE_URL:'https://wrong.invalid'},{APP_ORIGIN:'https://public.example.com'},{MITSA_REGISTRATION_SERVICE_KEY:''},{AUTH_FLOW_KEY:''},{MITSA_TURNSTILE_SECRET_KEY:''}])('refuses missing/wrong private runtime configuration: %j',change=>expect(()=>onboardingNextEnvironment({...values,...change},{})).toThrow());
it('reserves before fork, observes acknowledgement and natural child exit, and never reuses the attempt',async()=>{
 const f=fixture(),server=await launchOnboardingNext(f);expect(f.events).toEqual(['nextServerLaunches','fork']);const r=await server.stop();expect(r).toMatchObject({observedExit:true,code:0,signal:null,expired:false,stopAcknowledged:true,stopTimedOut:false,childAbsent:true,streamsClosed:true});expect(await server.stop()).toBe(r);
 const record=JSON.parse(readFileSync(join(f.root,'next-attempt.json'),'utf8'));expect(record.childPid).toBeGreaterThan(0);expect(JSON.stringify(record)).not.toContain(values.AUTH_FLOW_KEY);await expect(launchOnboardingNext(f)).rejects.toThrow('consumed');expect(f.spawn).toHaveBeenCalledTimes(1);
});
it('rejects changed source, scope and unreviewed environment before fork or attempt creation',async()=>{
 for(const change of ['source','scope','environment']){const f=fixture();if(change==='source')f.entrySha256='0'.repeat(64);if(change==='scope')f.scope.reviewSha256='wrong';if(change==='environment')(f.environment as any).NODE_OPTIONS='--import PRIVATE';await expect(launchOnboardingNext(f)).rejects.toThrow();expect(f.spawn).not.toHaveBeenCalled();expect(existsSync(join(f.root,'next-attempt.json'))).toBe(false);}
});
it('records startup failure without retry or refunded launch',async()=>{
 const f=fixture('failed-start');await expect(launchOnboardingNext(f)).rejects.toThrow('no automatic retry');expect(f.spawn).toHaveBeenCalledOnce();const terminal=JSON.parse(readFileSync(join(f.root,'next-terminal.json'),'utf8'));expect(terminal).toMatchObject({startupFailed:true,observedExit:true,code:7});
});
it('kills an owned startup hang as a failure and preserves its spent launch',async()=>{
 const f=fixture('hung-start');await expect(launchOnboardingNext({...f,startupMs:100})).rejects.toThrow('no automatic retry');const terminal=JSON.parse(readFileSync(join(f.root,'next-terminal.json'),'utf8'));expect(terminal.startupFailed).toBe(true);expect(terminal.signal).not.toBeNull();expect(f.spawn).toHaveBeenCalledOnce();
});
it('never turns forced shutdown into passing cleanup',async()=>{
 const f=fixture('hung-stop'),server=await launchOnboardingNext({...f,shutdownMs:100});await expect(server.stop()).rejects.toThrow('termination unconfirmed');const terminal=JSON.parse(readFileSync(join(f.root,'next-terminal.json'),'utf8'));expect(terminal.stopTimedOut).toBe(true);expect(terminal.childAbsent).toBe(true);expect(terminal.signal).not.toBeNull();
});
it('requires a real child IPC observation acknowledgement, delivers a privately bound message and observes natural exit',async()=>{
 const f=fixture('private-normal'),observation=vi.fn(async(m:any)=>m.path==='OFFLINE-CIPHERTEXT-REFERENCE'),server=await launchOnboardingNext({...f,onPrivateObservation:observation});expect(observation).toHaveBeenCalledOnce();
 await server.deliverProviderMessage('e-a',{fixture:'e-a',jobId:'offline-job',code:'PRIVATE-OFFLINE-CODE'});const result=await server.stop();expect(result).toMatchObject({code:0,childAbsent:true,privateFailure:false,stopAcknowledged:true});expect(JSON.stringify(result)).not.toContain('PRIVATE-OFFLINE');expect((await server.completion).code).toBe(0);
});
it('fails startup instead of bypassing missing parent approval for a private observation',async()=>{
 const f=fixture('private-normal');await expect(launchOnboardingNext(f)).rejects.toThrow('no automatic retry');expect(f.spawn).toHaveBeenCalledOnce();
});
it('keeps a channel failure failed even if the child completes logical shutdown afterward',async()=>{
 const f=fixture('private-normal'),failure=vi.fn(),server=await launchOnboardingNext({...f,onPrivateObservation:async()=>true,onPrivateFailure:failure});
 await expect(server.deliverProviderMessage('e-a',{fixture:'e-a',jobId:'reject'})).rejects.toThrow();const completed=await server.completion;expect(completed.privateFailure).toBe(true);expect(failure).toHaveBeenCalledOnce();await expect(server.stop()).rejects.toThrow('termination unconfirmed');
});
it('rejects a natural zero-code exit when the required shutdown acknowledgement is absent',async()=>{
 const f=fixture('no-stop-ack'),server=await launchOnboardingNext(f);await expect(server.stop()).rejects.toThrow('termination unconfirmed');const terminal=JSON.parse(readFileSync(join(f.root,'next-terminal.json'),'utf8'));expect(terminal).toMatchObject({code:0,observedExit:true,stopAcknowledged:false,childAbsent:true});
});
