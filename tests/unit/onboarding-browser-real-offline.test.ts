import {it,expect,vi} from 'vitest';
import {chromium,type Route} from '@playwright/test';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {launchOnboardingBrowser} from '../../scripts/lib/onboarding-browser-process.mjs';
it('OFFLINE actual disposable Edge server opens a blank routed context and terminates naturally without retained profiles',async()=>{
 const scope={root:mkdtempSync(join(tmpdir(),'mitsa-edge-owned-')),reviewSha256:'a'.repeat(64),executionClock:{startedAt:Date.now()},limits:{runtimeSeconds:90},active:vi.fn(),reserve:vi.fn()};
 const browser=await launchOnboardingBrowser({scope,browserType:chromium,notAfter:new Date(Date.now()+90000).toISOString(),evidenceMode:'OFFLINE'});
 try{const context=await browser.contextFor('e-a');await context.route('**/*',(route:Route)=>route.abort());const page=await context.newPage();expect(page.url()).toBe('about:blank');expect(await context.cookies()).toEqual([]);}finally{expect(await browser.stop()).toMatchObject({observedExit:true,code:0,signal:null,childAbsent:true,contextsClosed:true,watchdog:false});}
 expect(scope.reserve).toHaveBeenCalledOnce();
},30000);
