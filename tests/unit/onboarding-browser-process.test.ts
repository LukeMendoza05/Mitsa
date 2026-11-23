import {it,expect,vi} from 'vitest';
import {fork} from 'node:child_process';
import {once} from 'node:events';
import {mkdtempSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {launchOnboardingBrowser} from '../../scripts/lib/onboarding-browser-process.mjs';
function fixture(){
 const root=mkdtempSync(join(tmpdir(),'mitsa-browser-offline-')),scope={root,reviewSha256:'a'.repeat(64),executionClock:{startedAt:Date.now()},limits:{runtimeSeconds:60},active:vi.fn(),reserve:vi.fn()},contexts:any[]=[],events:string[]=[];let child:any,exited:Promise<any>;
 const browser={contexts:()=>[],newContext:vi.fn(async(_options:any)=>{const context={close:vi.fn(async()=>{events.push('context-close');})};contexts.push(context);return context;}),close:vi.fn(async()=>{events.push('browser-close');})};
 const server={process:()=>child,wsEndpoint:()=> 'ws://127.0.0.1:12345/PRIVATE-OFFLINE-ENDPOINT',close:vi.fn(async()=>{events.push('server-close');if(child.connected)child.send({kind:'stop-next',nonce:'offline'});await exited;})};
 const browserType={name:()=> 'chromium',launchServer:vi.fn(async(_options:any)=>{events.push('launch');child=fork(fileURLToPath(new URL('../support/onboarding-next-process-fixture.mjs',import.meta.url)),['--child','normal'],{silent:true,windowsHide:true} as any);exited=once(child,'exit');const ready=once(child,'message');child.send({kind:'start-next',nonce:'offline'});await ready;return server;}),connect:vi.fn(async(_url:any,_options:any)=>browser)};
 const options={scope,browserType,notAfter:new Date(Date.now()+60000).toISOString(),evidenceMode:'OFFLINE'};return {root,scope,contexts,events,browser,server,browserType,options,get child(){return child;}};
}
it('reserves before launch, creates separate fresh desktop/mobile contexts and confirms natural process absence',async()=>{
 const f=fixture(),handle=await launchOnboardingBrowser(f.options);expect(f.scope.reserve).toHaveBeenCalledWith('browserLaunches');await handle.contextFor('e-a');await handle.contextFor('e-b');expect(f.browser.newContext.mock.calls[0][0]).toMatchObject({acceptDownloads:false,ignoreHTTPSErrors:false,isMobile:false});expect(f.browser.newContext.mock.calls[1][0]).toMatchObject({isMobile:true,viewport:{width:390,height:844}});await expect(handle.contextFor('e-a')).rejects.toThrow();
 const result=await handle.stop();expect(result).toMatchObject({observedExit:true,code:0,signal:null,childAbsent:true,contextsClosed:true,watchdog:false,startupFailed:false});expect(await handle.stop()).toBe(result);expect(f.contexts.every(c=>c.close.mock.calls.length===1)).toBe(true);expect(JSON.stringify(result)).not.toContain('PRIVATE-OFFLINE');await expect(launchOnboardingBrowser(f.options)).rejects.toThrow('consumed');
});
it('rejects absent authority or a retained-browser connector before any launch',async()=>{
 const f=fixture();f.scope.active.mockImplementation(()=>{throw Error('not approved');});await expect(launchOnboardingBrowser(f.options)).rejects.toThrow();expect(f.browserType.launchServer).not.toHaveBeenCalled();
 const g=fixture();await expect(launchOnboardingBrowser({...g.options,browserType:{...g.browserType,name:()=> 'retained-cdp'}})).rejects.toThrow();expect(g.scope.reserve).not.toHaveBeenCalled();
});
it('treats unexpected process exit as terminal and cannot turn it into successful cleanup',async()=>{
 const f=fixture(),handle=await launchOnboardingBrowser(f.options);f.child.kill('SIGKILL');const terminal:any=await handle.completion;expect(terminal.signal).not.toBeNull();await expect(handle.stop()).rejects.toThrow('termination unconfirmed');
});
it('kills a hung owned shutdown as a failure and preserves the spent browser launch',async()=>{
 const f=fixture(),handle=await launchOnboardingBrowser({...f.options,shutdownMs:100});f.browser.close.mockImplementation(()=>new Promise(()=>{}));await expect(handle.stop()).rejects.toThrow('termination unconfirmed');const result=JSON.parse(readFileSync(join(f.root,'browser-terminal.json'),'utf8'));expect(result).toMatchObject({watchdog:true,childAbsent:true,contextsClosed:false});expect(f.scope.reserve).toHaveBeenCalledOnce();
});
it('cancels startup, closes an already-owned server, and does not wait indefinitely for the connector',async()=>{
 const f=fixture();f.browserType.connect.mockImplementation(()=>new Promise(()=>{}));await expect(launchOnboardingBrowser({...f.options,startupMs:100})).rejects.toThrow('launch failed');expect(f.server.close).toHaveBeenCalled();expect(()=>process.kill(f.child.pid,0)).toThrow();
});
it('responds to the parent abort by closing contexts and the owned process',async()=>{
 const f=fixture(),abort=new AbortController(),handle=await launchOnboardingBrowser({...f.options,signal:abort.signal});await handle.contextFor('e-a');abort.abort();const result=await handle.stop();expect(result.childAbsent).toBe(true);expect(f.contexts[0].close).toHaveBeenCalledOnce();
});
