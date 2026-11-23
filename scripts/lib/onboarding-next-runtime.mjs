// Isolated acceptance-server adapter ONLY. Not the production application server.
// No app import, socket, process, credential read or global patch on import.
import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {createServer} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {countedOnboardingFetch} from './onboarding-counted-fetch.mjs';
const owner=Symbol.for('mitsa.onboarding.fetch-owner');
const labels=['e-a','e-b'];
const hiddenHeaders=['x-mitsa-test-fixture','x-mitsa-test-authorization'];
/** @param {{assertOwnedLaunch:Function,scope:any,bindings:any[],createApplication:Function,fetcher:Function,fixtureTransportFactory?:Function,globals?:any,port?:number,cleanupMs?:number,onFailure?:Function,signal?:AbortSignal}} options */
export async function startOnboardingNext({assertOwnedLaunch,scope,bindings,createApplication,fetcher,fixtureTransportFactory=undefined,globals=globalThis,port=3000,cleanupMs=8000,onFailure=()=>{},signal=undefined}){
 try{await assertOwnedLaunch();scope.active();}catch{throw Error('Isolated Next execution is not authorized');}
 assert(typeof fetcher==='function'&&typeof createApplication==='function','Explicit test adapters required');
 assert(Number.isInteger(port)&&port>=0&&port<=65535);assert(!globals[owner],'An isolated fetch interceptor already owns this process');
 const permits=new Map();for(const b of bindings){assert(labels.includes(b.label)&&/^[a-f0-9]{64}$/.test(b.authorization),'Invalid private browser binding');assert(!permits.has(b.label));permits.set(b.label,b.authorization);}
 assert(permits.size>0&&permits.size<=2);const context=new AsyncLocalStorage(),controller=new AbortController(),pending=new Set(),providerPending=new Set(),liveRequests=new Set();
 const originalFetch=globals.fetch,token={},clients=new Map();let app,server,stopped=false,stopPromise;
 const fail=category=>{try{onFailure(category);}catch{/* Never print an upstream error or private request. */}};
 const wrapped=async(input,init={})=>{
  const bound=context.getStore(),fixture=bound?.fixture;
  if(stopped&&!liveRequests.has(bound?.id))throw Error('Isolated Next is stopped');
  if(!labels.includes(fixture))throw Error('Unbound provider request rejected');
  if(!liveRequests.has(bound.id))throw Error('Finished request cannot start background provider work');
  // Test-console credentials must NEVER reach Supabase or Cloudflare.
  const headers=new Headers(init.headers??input?.headers);for(const name of hiddenHeaders)if(headers.has(name))throw Error('Private test header forwarding rejected');
  if(!clients.has(fixture))clients.set(fixture,fixtureTransportFactory?fixtureTransportFactory(fixture,controller.signal):countedOnboardingFetch({fixture,scope,fetcher,signal:controller.signal}));
  let work;work=Promise.resolve().then(()=>clients.get(fixture)(input,init)).finally(()=>providerPending.delete(work));providerPending.add(work);
  try{return await work;}catch{fail('provider-or-budget');throw Error('Isolated provider response unavailable');}
 };
 const parentStopped=()=>{stopped=true;controller.abort();};if(signal?.aborted)parentStopped();signal?.addEventListener('abort',parentStopped,{once:true});
 globals[owner]=token;globals.fetch=wrapped;
 const bounded=async(operation)=>{let timer;try{return await Promise.race([operation(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Isolated Next cleanup deadline exceeded')),cleanupMs);})]);}finally{clearTimeout(timer);}};
 const closeServer=async()=>{if(!server?.listening)return;await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));};
 const stop=()=>stopPromise??=(async()=>{
  // Close admission first, drain already-counted request/ACK chains, then
  // cancel transports. Aborting those chains before app.close races Next's
  // pending render/IPC cleanup and incorrectly strands a successful child.
  stopped=true;let failed=false,cleanupStage='http-drain';
  try{await bounded(async()=>{const httpClosed=closeServer();await Promise.allSettled([...pending]);await Promise.allSettled([...providerPending]);server?.closeIdleConnections();await httpClosed;cleanupStage='app-close';await app?.close();});}catch{failed=true;fail('cleanup');server?.closeAllConnections();}finally{controller.abort();}
  // On failed cleanup keep the deny-all interceptor installed until the owned
  // child is terminated. Restoring fetch while an app remains alive is unsafe.
  if(failed)throw Object.assign(Error('Isolated Next cleanup unconfirmed'),{cleanupStage,pendingRequests:pending.size,pendingProviderRequests:providerPending.size});
  signal?.removeEventListener('abort',parentStopped);if(globals[owner]===token){globals.fetch=originalFetch;delete globals[owner];}
  return {httpClosed:!server?.listening,appClosed:true,pendingRequests:pending.size,fetchRestored:true};
 })();
 try{
  app=await createApplication({hostname:'127.0.0.1',port,quiet:true});await app.prepare();const handle=app.getRequestHandler();
  server=createServer((request,response)=>{
   response.setHeader('cache-control','private, no-store');response.setHeader('referrer-policy','no-referrer');
   const fixture=request.headers[hiddenHeaders[0]],supplied=request.headers[hiddenHeaders[1]],expected=typeof fixture==='string'?permits.get(fixture):null;
   try{scope.reserve('nextInboundRequests',{...(labels.includes(fixture)?{fixture}:{})});}catch{fail('browser-request-budget');response.writeHead(503).end('Test unavailable');return;}
   const valid=typeof supplied==='string'&&/^[a-f0-9]{64}$/.test(supplied)&&expected&&timingSafeEqual(Buffer.from(supplied),Buffer.from(expected));
   if(stopped||request.headers.host!==`127.0.0.1:${server.address().port}`||!valid){response.writeHead(403).end('Test unavailable');return;}
   // Strip before passing to Next/proxy/RSC. Context stays server-side only.
   for(const name of hiddenHeaders)delete request.headers[name];
   const id=Symbol('owned-request');liveRequests.add(id);
   // Next's handler promise may resolve before its streamed response finishes.
   // Keep the exact request context alive through that terminal HTTP event.
   const finished=new Promise(resolve=>{const done=()=>{response.removeListener('finish',done);response.removeListener('close',done);resolve(true);};response.once('finish',done);response.once('close',done);});
   let work;work=context.run({fixture,id},()=>Promise.resolve().then(()=>handle(request,response)).catch(()=>{fail('application-request');if(!response.headersSent)response.writeHead(503);response.end('Test unavailable');}).then(()=>finished).finally(()=>{pending.delete(work);liveRequests.delete(id);}));
   pending.add(work);
  });
  server.requestTimeout=15000;server.headersTimeout=10000;
  scope.active();assert(!stopped,'Parent stopped during Next startup');await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  return {origin:`http://127.0.0.1:${server.address().port}`,stop,async outsideContextProbe(input,init){return wrapped(input,init);}};
 }catch{let cleanupConfirmed=false;try{await stop();cleanupConfirmed=true;}catch{}throw Object.assign(Error('Isolated Next startup failed; no automatic retry'),{cleanupConfirmed});}
}
