import {it,expect,vi} from 'vitest';
import {mkdtempSync,readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {runOnboardingController} from '../../scripts/lib/onboarding-controller.mjs';
function fixture(){
 const root=mkdtempSync(join(tmpdir(),'mitsa-controller-offline-')),events:string[]=[],drivers=new Map(),terminal:any[]=[];
 const processHandle=(kind:string)=>{let resolve:any;const completion=new Promise(r=>{resolve=r;});terminal.push({kind,resolve});return {completion,stop:vi.fn(async()=>{events.push(kind+'-stop');const result={observedExit:true,streamsClosed:true,streamError:false,signal:null,childAbsent:true,stopAcknowledged:true,code:0,stopTimedOut:false,expired:false,privateFailure:false,watchdog:false};resolve(result);return result;})};};
 const next=processHandle('next'),browser=processHandle('browser'),worker={pulse:vi.fn(async()=>{events.push('pulse');return {owned:true,healthy:true};}),stop:vi.fn(async()=>{events.push('worker-stop');return {logicalShutdown:true,transportClosed:true};})},database={close:vi.fn(async()=>{events.push('database-close');return {connectionClosed:true,streamClosed:true};})};
 const d:any={evidenceMode:'OFFLINE',cleanupMarginMs:100,pulseMs:50,notAfter:new Date(Date.now()+60000).toISOString(),scope:{root,reviewSha256:'a'.repeat(64),executionClock:{startedAt:Date.now()},limits:{runtimeSeconds:60},active:vi.fn(),counts:()=>({})},
 assertAuthority:vi.fn(async()=>{}),assertOwnedController:vi.fn(async()=>{}),openDatabase:vi.fn(async()=>database),preflight:vi.fn(async()=>({targetMatched:true,sourceHashesMatched:true,controlsDisabled:true,queueSafe:true,preservationExact:true,strictProven:true,fixturesAbsent:true,noticesMatched:true})),enablePrivateService:vi.fn(async()=>{events.push('service-enable');}),openControls:vi.fn(async()=>{events.push('controls-open');}),openAdmission:vi.fn(async()=>{events.push('admission-open');}),startWorker:vi.fn(async()=>worker),startNext:vi.fn(async()=>next),startBrowser:vi.fn(async()=>browser),makeDriverDependencies:vi.fn(async(label:string)=>({label})),
 driverFactory:({label}:any)=>{const checks:any={},driver:any={status:()=>({checks})};for(const [step,key] of Object.entries({signup:'signup',verifyEmail:'emailVerified',enrollMfa:'trustedMfa',createWorkspace:'workspaceOwner',logout:'logout',returningLogin:'returningMfaLogin',recoverPassword:'passwordRecovery'})){driver[step]=vi.fn(async()=>{events.push(label+'-'+step);checks[key]=true;});}drivers.set(label,driver);return driver;},
 authorizationTests:vi.fn(async()=>({crossTenantResources:true,anonymousResources:true,aal1WorkspaceDenied:true,roleEscalationDenied:true,trustedOwnership:true,directApiAuthorization:true})),signOutFixtures:vi.fn(async()=>{events.push('fixture-signout');}),stopNewWork:vi.fn(async()=>{events.push('work-stopped');}),closeControls:vi.fn(async()=>{events.push('controls-close');return true;}),restorePrivateService:vi.fn(async()=>{events.push('service-restore');return true;}),postflight:vi.fn(async()=>({preserved:true,controlsDisabled:true,privateServiceDisabled:true,onlyApprovedFixtureEffects:true,noUnauthorizedDelivery:true})),persistPrivate:vi.fn(async(_data:any)=>{})};
 return {d,root,events,drivers,next,browser,worker,database,terminal};
}
it('orchestrates both full journeys, direct authorization and recovery, then closes processes/controls before preservation',async()=>{
 const f=fixture(),r=await runOnboardingController(f.d);expect(r.status).toBe('PASSED_OFFLINE_CONTROLLER');expect(r.hostedAcceptanceCompleted).toBe(false);expect(r.checks).toMatchObject({'e-a-onboarding':true,'e-b-onboarding':true,'e-a-recovery':true,'e-b-recovery':true,authorization:true,preservation:true,nextCleanup:true,browserCleanup:true,databaseCleanup:true});
 expect(f.events.indexOf('e-b-returningLogin')).toBeLessThan(f.events.indexOf('e-a-recoverPassword'));expect(f.events.slice(-7)).toEqual(['work-stopped','fixture-signout','worker-stop','next-stop','browser-stop','controls-close','service-restore','database-close'].slice(-7));expect(f.d.postflight).toHaveBeenCalledOnce();expect(f.next.stop).toHaveBeenCalledOnce();expect(f.worker.stop).toHaveBeenCalledOnce();
 expect(JSON.parse(readFileSync(join(f.root,'controller-body-result.json'),'utf8')).status).toBe('PASSED_OFFLINE_CONTROLLER');expect(JSON.parse(JSON.stringify(r))).toEqual(r);expect(Object.hasOwn(r,'failurePhase')).toBe(false);await expect(runOnboardingController(f.d)).rejects.toThrow();expect(f.d.openDatabase).toHaveBeenCalledOnce();
});
it('denies absent authority and owned-launch proof before making an attempt or opening a database',async()=>{
 for(const key of ['assertAuthority','assertOwnedController']){const f=fixture();f.d[key].mockRejectedValue(Error('PRIVATE-APPROVAL'));await expect(runOnboardingController(f.d)).rejects.toThrow();expect(f.d.openDatabase).not.toHaveBeenCalled();expect(existsSync(join(f.root,'controller-attempt.json'))).toBe(false);}
});
it('requires all preflight evidence and never opens a service/control/worker after a strict or preservation failure',async()=>{
 for(const key of ['strictProven','preservationExact','fixturesAbsent','queueSafe']){const f=fixture(),proof=await f.d.preflight();proof[key]=false;f.d.preflight.mockResolvedValue(proof);const r=await runOnboardingController(f.d);expect(r.status).toBe('FAILED');expect(f.d.enablePrivateService).not.toHaveBeenCalled();expect(f.d.openControls).not.toHaveBeenCalled();expect(f.d.startWorker).not.toHaveBeenCalled();expect(f.database.close).toHaveBeenCalledOnce();}
});
it('closes potentially changed controls and the service after an uncertain setup failure without retry',async()=>{
 const f=fixture();f.d.openControls.mockRejectedValue(Error('PRIVATE-DATABASE'));const r=await runOnboardingController(f.d);expect(r.status).toBe('FAILED');expect(f.d.closeControls).toHaveBeenCalledOnce();expect(f.d.restorePrivateService).toHaveBeenCalledOnce();expect(f.d.startWorker).not.toHaveBeenCalled();expect(f.d.openControls).toHaveBeenCalledOnce();
});
it('cancels a suspended browser step when the child exits unexpectedly and proceeds to cleanup',async()=>{
 const f=fixture(),original=f.d.driverFactory;f.d.driverFactory=(deps:any)=>{const driver=original(deps);if(deps.label==='e-a')driver.signup.mockImplementation(async()=>{f.terminal.find(t=>t.kind==='next').resolve({code:0});await Promise.resolve();});return driver;};const r=await runOnboardingController(f.d);expect(r.status).toBe('FAILED');expect(f.drivers.has('e-b')).toBe(false);expect(f.d.closeControls).toHaveBeenCalledOnce();
});
it.each(['stopAcknowledged','childAbsent','streamsClosed'])('never accepts clean exit code without %s',async key=>{
 const f=fixture(),original=f.next.stop.getMockImplementation()!;f.next.stop.mockImplementation(async()=>({...await original(),[key]:false}));const r=await runOnboardingController(f.d);expect(r.status).toBe('FAILED');expect(r.checks.nextCleanup).toBeUndefined();
});
it.each(['privateFailure','expired','stopTimedOut'])('keeps %s failure failed even if the process reports code zero',async key=>{
 const f=fixture(),original=f.next.stop.getMockImplementation()!;f.next.stop.mockImplementation(async()=>({...await original(),[key]:true}));const r=await runOnboardingController(f.d);expect(r.status).toBe('FAILED');
});
it('does not convert missing driver or authorization acceptance into a pass',async()=>{
 const f=fixture(),original=f.d.driverFactory;f.d.driverFactory=(deps:any)=>{const driver=original(deps);driver.enrollMfa.mockImplementation(async()=>{});return driver;};expect((await runOnboardingController(f.d)).status).toBe('FAILED');
 const g=fixture();g.d.authorizationTests.mockResolvedValue({crossTenantResources:true});expect((await runOnboardingController(g.d)).status).toBe('FAILED');expect(g.drivers.get('e-a').recoverPassword).not.toHaveBeenCalled();
});
it('requires rollback/preservation and database resource evidence before passing',async()=>{
 const f=fixture();f.d.postflight.mockResolvedValue({preserved:false});expect((await runOnboardingController(f.d)).status).toBe('FAILED');expect(f.database.close).toHaveBeenCalledOnce();
 const g=fixture();g.database.close.mockResolvedValue({connectionClosed:true,streamClosed:false});expect((await runOnboardingController(g.d)).status).toBe('FAILED');
});
it('stops when the worker heartbeat fails instead of repeatedly reacquiring or retrying transport',async()=>{
 const f=fixture();f.worker.pulse.mockRejectedValue(Error('PRIVATE-WORKER'));expect((await runOnboardingController(f.d)).status).toBe('FAILED');expect(f.worker.pulse).toHaveBeenCalledOnce();expect(f.d.startNext).not.toHaveBeenCalled();expect(f.worker.stop).toHaveBeenCalledOnce();
});
it('rejects a disconnected parent before the attempt and aborts an active operation when parent IPC is lost',async()=>{const f=fixture(),abort=new AbortController();f.d.signal=abort.signal;abort.abort();await expect(runOnboardingController(f.d)).rejects.toThrow('parent already disconnected');expect(f.d.openDatabase).not.toHaveBeenCalled();const g=fixture(),active=new AbortController();g.d.signal=active.signal;g.d.makeDriverDependencies.mockImplementation(async()=>{active.abort();throw Error('OFFLINE IPC lost');});expect((await runOnboardingController(g.d)).status).toBe('FAILED');expect(g.d.closeControls).toHaveBeenCalledOnce();expect(g.database.close).toHaveBeenCalledOnce();});
it('refuses a hosted run with weakened deadlines and an expired execution window before creating state',async()=>{
 const f=fixture();f.d.evidenceMode='HOSTED';await expect(runOnboardingController(f.d)).rejects.toThrow('deadlines changed');expect(f.d.openDatabase).not.toHaveBeenCalled();const g=fixture();g.d.notAfter=new Date(Date.now()-1).toISOString();await expect(runOnboardingController(g.d)).rejects.toThrow('execution window');expect(existsSync(join(g.root,'controller-attempt.json'))).toBe(false);
});
