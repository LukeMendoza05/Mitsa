// Explicit, owned disposable browser only. No Playwright import/launch on import.
import assert from 'node:assert/strict';
import {writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {superviseTransportChild} from './registration-transport-lifecycle.mjs';
/** The caller supplies the installed Chromium type. No retained profile, CDP
 * connection, arbitrary executable, extension, recording or existing browser.
 * @param {{scope:any,browserType:any,notAfter:string,signal?:AbortSignal,evidenceMode?:string,startupMs?:number,shutdownMs?:number}} options
 */
export async function launchOnboardingBrowser({scope,browserType,notAfter,signal=undefined,evidenceMode='HOSTED',startupMs=25000,shutdownMs=15000}){
 scope.active();assert(browserType?.name()==='chromium','Approved Chromium browser required');assert(['HOSTED','OFFLINE'].includes(evidenceMode));assert(startupMs>0&&startupMs<=25000&&shutdownMs>0&&shutdownMs<=15000);
 const attempt=join(scope.root,'browser-attempt.json');assert(!existsSync(attempt),'Browser launch already consumed');scope.reserve('browserLaunches');writeFileSync(attempt,JSON.stringify({reviewSha256:scope.reviewSha256,claimedAt:Date.now(),pid:null,evidenceMode}),{flag:'wx',mode:0o600,flush:true});
 let server,browser,child,terminal,startupTimer,stopPromise,stopping=false,startupConfirmed=false;const contexts=new Map();
 const startupDeadline=new Promise((_,reject)=>{startupTimer=setTimeout(()=>reject(Error('Browser startup deadline exceeded')),startupMs);});
 const stop=()=>stopPromise??=(async()=>{
  stopping=true;let timedOut=false,cleanupFailed=false,stopTimer;
  const closeResources=async()=>{for(const context of contexts.values())await context.close();await browser?.close();await server?.close();};
  try{await Promise.race([closeResources(),new Promise((_,reject)=>{stopTimer=setTimeout(()=>{timedOut=true;if(child&&child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');reject(Error('Browser shutdown deadline exceeded'));},shutdownMs);})]);}catch{cleanupFailed=true;if(child&&child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');}
  const t=terminal?await terminal:null;clearTimeout(stopTimer);signal?.removeEventListener('abort',abort);let absent=false;if(child?.pid)try{process.kill(child.pid,0);}catch(e){if(e.code==='ESRCH')absent=true;}
  const result={...t,childAbsent:absent,contextsClosed:!cleanupFailed,startupFailed:!startupConfirmed,watchdog:timedOut||t?.expired===true,privateValuesPrinted:false};
  writeFileSync(join(scope.root,'browser-terminal.json'),JSON.stringify(result),{flag:'wx',mode:0o600,flush:true});
  assert(t?.observedExit&&t.code===0&&t.signal===null&&t.streamsClosed&&!t.streamError&&!result.watchdog&&!cleanupFailed&&absent,'Browser termination unconfirmed');return result;
 })();
 const abort=()=>{void stop().catch(()=>{});};
 const closeLateStartup=async()=>{try{await browser?.close();await server?.close();const t=terminal?await terminal:null;let childAbsent=false;try{process.kill(child.pid,0);}catch(e){if(e.code==='ESRCH')childAbsent=true;}writeFileSync(join(scope.root,'browser-late-terminal.json'),JSON.stringify({...t,childAbsent,startupFailed:true,privateValuesPrinted:false}),{flag:'wx',mode:0o600,flush:true});}catch{/* The original launch stays FAILED; never overwrite its result. */}};
 try{
  assert(!signal?.aborted,'Browser parent already stopped');
  // Keep the actual startup promise so a timeout cannot abandon a late-owned
  // server/browser. Late results close their own resources and stay failed.
  const startup=(async()=>{server=await browserType.launchServer({channel:'msedge',headless:evidenceMode==='OFFLINE',host:'127.0.0.1',timeout:15000,handleSIGINT:false,handleSIGTERM:false,handleSIGHUP:false});
   child=server.process();assert(child?.pid,'Browser process ownership unavailable');writeFileSync(attempt,JSON.stringify({reviewSha256:scope.reviewSha256,pid:child.pid,evidenceMode}),{mode:0o600,flush:true});
   terminal=superviseTransportChild(child,{claimedAt:new Date(scope.executionClock.startedAt).toISOString(),notAfter,maximumMs:scope.limits.runtimeSeconds*1000-15000});
   const endpoint=new URL(server.wsEndpoint());assert(endpoint.protocol==='ws:'&&endpoint.hostname==='127.0.0.1'&&!endpoint.username&&!endpoint.password,'Browser endpoint is not owned loopback');
   if(stopping){await closeLateStartup();throw Error('Browser startup was cancelled');}
   browser=await browserType.connect(endpoint.href,{timeout:10000});assert(browser.contexts().length===0,'Existing browser contexts are forbidden');if(stopping){await closeLateStartup();throw Error('Browser startup was cancelled');}return true;
  })();
  try{await Promise.race([startup,startupDeadline]);startupConfirmed=true;}catch{stopping=true;startup.catch(()=>{});const unknownChild=!child;try{await stop();}catch{}if(unknownChild){let cleanupTimer;try{await Promise.race([startup.catch(()=>{}),new Promise((_,reject)=>{cleanupTimer=setTimeout(()=>reject(Error('Late browser ownership unconfirmed')),shutdownMs);})]);}finally{clearTimeout(cleanupTimer);}}throw Error('Browser startup unconfirmed');}finally{clearTimeout(startupTimer);}
  scope.active();assert(!signal?.aborted);signal?.addEventListener('abort',abort,{once:true});
  return {completion:terminal,async contextFor(label){scope.active();assert(!stopping&&['e-a','e-b'].includes(label)&&!contexts.has(label),'Browser context already consumed or unapproved');const context=await browser.newContext({acceptDownloads:false,ignoreHTTPSErrors:false,viewport:label==='e-a'?{width:1366,height:900}:{width:390,height:844},isMobile:label==='e-b'});contexts.set(label,context);return context;},stop};
 }catch{clearTimeout(startupTimer);try{await stop();}catch{}throw Error('Onboarding browser launch failed; no automatic retry');}
}
