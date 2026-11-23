// Inactive orchestration core. The real hosted adapter must supply every port;
// there is no default client, process launcher, authority or activation path.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {OnboardingBrowserDriver} from './onboarding-browser-driver.mjs';
const labels=['e-a','e-b'];
const required=['assertAuthority','assertOwnedController','openDatabase','preflight','enablePrivateService','openControls','openAdmission','startWorker','startNext','startBrowser','makeDriverDependencies','authorizationTests','signOutFixtures','stopNewWork','closeControls','restorePrivateService','postflight','persistPrivate'];
/** The controller is single-use even after an uncertain failure. OFFLINE mode
 * labels fake-port evidence explicitly; it cannot create a hosted pass report.
 */
export async function runOnboardingController(d){
 for(const key of required)assert(typeof d[key]==='function','Explicit onboarding controller port missing');
 assert(['OFFLINE','HOSTED'].includes(d.evidenceMode),'Controller evidence mode missing');
 const now=d.now??Date.now,margin=d.cleanupMarginMs??120000,pulseMs=d.pulseMs??5000;
 assert(d.evidenceMode==='OFFLINE'||margin===120000&&pulseMs===5000,'Hosted lifecycle deadlines changed');assert(margin>=50&&pulseMs>=10);
 await d.assertAuthority();await d.assertOwnedController();d.scope.active();assert(!d.signal?.aborted,'Controller parent already disconnected');
 const deadline=Math.min(d.scope.executionClock.startedAt+d.scope.limits.runtimeSeconds*1000,Date.parse(d.notAfter)),workUntil=deadline-margin;assert(Number.isFinite(deadline)&&workUntil>now(),'Insufficient controller execution window');
 writeFileSync(join(d.scope.root,'controller-attempt.json'),JSON.stringify({reviewSha256:d.scope.reviewSha256,claimedAt:now(),evidenceMode:d.evidenceMode}),{flag:'wx',mode:0o600,flush:true});
 const abort=new AbortController(),pending=new Set(),checks=/** @type {Record<string,boolean>} */({}),drivers=new Map();let database,worker,next,browser,controlsAttempted=false,serviceAttempted=false,bodyPassed=false,failed=false,phase='initial',failurePhase,timer,pulseTimer,pulseTask,workerTail=Promise.resolve(),stopping=false;
 const failureEvidence=[];
 const fail=error=>{failed=true;failurePhase??=phase;abort.abort();if(error instanceof Error)failureEvidence.push(d.persistPrivate({kind:'controller-private-failure',phase,category:error.name,detail:String(error.message).slice(0,4096)}).catch(()=>{}));};
 d.signal?.addEventListener('abort',fail,{once:true});
 const ready=()=>{assert(!abort.signal.aborted&&now()<workUntil,'Controller work deadline reached');d.scope.active();};
 const withWorker=(fn,{cleanup=false}={})=>{const p=workerTail.then(()=>{if(!cleanup)ready();return fn(worker);});workerTail=p.then(()=>{},()=>{});return p;};
 const work=async(name,fn)=>{ready();phase=name;await d.persistPrivate({kind:'controller-phase-attempt',phase:name});let p;p=Promise.resolve().then(fn).finally(()=>pending.delete(p));pending.add(p);
  let stop;const interrupted=new Promise((_,reject)=>{stop=()=>reject(Error('Controller interrupted'));abort.signal.addEventListener('abort',stop,{once:true});});
  try{return await Promise.race([p,interrupted]);}finally{abort.signal.removeEventListener('abort',stop);}
 };
 const pulse=()=>{if(stopping)return;pulseTask=withWorker(w=>w.pulse()).then(()=>{if(!stopping)pulseTimer=setTimeout(pulse,pulseMs);}).catch(fail);};
 timer=setTimeout(fail,Math.max(0,workUntil-now()));
 const monitor=handle=>{assert(handle?.completion&&typeof handle.completion.then==='function','Authoritative process completion handle required');handle.completion.then(()=>{if(!stopping)fail(Error('Owned process exited before controller cleanup'));},fail);};
 try{
  database=await work('database-open',()=>d.openDatabase({signal:abort.signal}));
  const proof=await work('preflight',()=>d.preflight({database,signal:abort.signal}));
  for(const key of ['targetMatched','sourceHashesMatched','controlsDisabled','queueSafe','preservationExact','strictProven','fixturesAbsent','noticesMatched'])assert(proof?.[key]===true,'Controller preflight is incomplete');checks.preflight=true;
  serviceAttempted=true;await work('enable-private-service',()=>d.enablePrivateService({database,signal:abort.signal}));
  controlsAttempted=true;await work('open-reviewed-controls',()=>d.openControls({database,signal:abort.signal}));
  worker=await work('start-worker',()=>d.startWorker({database,signal:abort.signal}));await work('owned-worker-health',()=>withWorker(w=>w.pulse()));pulseTimer=setTimeout(pulse,pulseMs);
  await work('open-reviewed-admission',()=>d.openAdmission({database,signal:abort.signal}));
  next=await work('start-next',()=>d.startNext({database,signal:abort.signal}));monitor(next);
  browser=await work('start-browser',()=>d.startBrowser({next,signal:abort.signal}));monitor(browser);
  for(const label of labels){const dependencies=await work(label+'-driver',()=>d.makeDriverDependencies(label,{database,worker,next,browser,signal:abort.signal,withWorker}));const driver=(d.driverFactory??(deps=>new OnboardingBrowserDriver(deps)))(dependencies);drivers.set(label,driver);
   for(const step of ['signup','verifyEmail','enrollMfa','createWorkspace','logout','returningLogin'])await work(label+'-'+step,()=>driver[step]());
   const status=driver.status();for(const key of ['signup','emailVerified','trustedMfa','workspaceOwner','logout','returningMfaLogin'])assert(status.checks[key]===true,'Actual driver journey evidence incomplete');checks[label+'-onboarding']=true;
  }
  const authorization=await work('direct-authorization',()=>d.authorizationTests({database,drivers,signal:abort.signal}));
  for(const key of ['crossTenantResources','anonymousResources','aal1WorkspaceDenied','roleEscalationDenied','trustedOwnership','directApiAuthorization'])assert(authorization?.[key]===true,'Authorization acceptance incomplete');checks.authorization=true;
  for(const label of labels){await work(label+'-recovery',()=>drivers.get(label).recoverPassword());assert(drivers.get(label).status().checks.passwordRecovery===true,'Real recovery evidence incomplete');checks[label+'-recovery']=true;}
  bodyPassed=true;
 }catch(error){fail(error);}
 finally{
  stopping=true;d.signal?.removeEventListener('abort',fail);clearTimeout(timer);clearTimeout(pulseTimer);abort.abort();
  const unfinishedCleanup=new Set();
  const cleanup=async(name,fn)=>{phase=name;let timeout,task;try{assert(now()<deadline,'Cleanup deadline reached');task=Promise.resolve().then(fn).finally(()=>unfinishedCleanup.delete(task));unfinishedCleanup.add(task);return await Promise.race([task,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Cleanup operation deadline reached')),Math.min(15000,deadline-now()));})]);}catch(error){failed=true;failurePhase??=name;try{await d.persistPrivate({kind:'cleanup-private-failure',phase:name,category:error?.name??'Error',detail:String(error?.message??'Unavailable').slice(0,4096)});}catch{}return null;}finally{clearTimeout(timeout);}};
  await cleanup('stop-new-work',()=>d.stopNewWork({database,worker,next,browser}));
  // Ports must cancel their owned transports. A pending operation is never
  // silently abandoned while a success report or preservation capture runs.
  const settled=await cleanup('settle-pending-operations',async()=>{let t;try{await Promise.race([Promise.allSettled([...pending]),new Promise((_,reject)=>{t=setTimeout(()=>reject(Error('Pending operations did not settle')),15000);})]);return true;}finally{clearTimeout(t);}});
  await cleanup('settle-worker-pulse',async()=>{await pulseTask;await workerTail;await Promise.allSettled(failureEvidence);return true;});
  if(database&&settled)await cleanup('fixture-local-signout',()=>d.signOutFixtures({database,drivers,cleanup:true}));
  if(worker)await cleanup('stop-worker',async()=>{const r=await withWorker(w=>w.stop(),{cleanup:true});assert(r.logicalShutdown&&r.transportClosed,'Worker cleanup unconfirmed');checks.workerCleanup=true;});
  if(next)await cleanup('stop-next',async()=>{const r=await next.stop();assert(r.observedExit&&r.streamsClosed&&!r.streamError&&r.signal===null&&r.childAbsent&&r.stopAcknowledged&&r.code===0&&!r.stopTimedOut&&!r.expired&&!r.privateFailure,'Next cleanup unconfirmed');checks.nextCleanup=true;});
  if(browser)await cleanup('stop-browser',async()=>{const r=await browser.stop();assert(r.observedExit&&r.childAbsent&&r.code===0&&r.signal===null&&!r.watchdog,'Browser cleanup unconfirmed');checks.browserCleanup=true;});
  if(controlsAttempted)await cleanup('close-controls',async()=>{assert(await d.closeControls({database,cleanup:true})===true);checks.controlsClosed=true;});
  if(serviceAttempted)await cleanup('restore-private-service',async()=>{assert(await d.restorePrivateService({cleanup:true})===true);checks.serviceRestored=true;});
  if(database&&settled&&unfinishedCleanup.size===0)await cleanup('postflight',async()=>{const r=await d.postflight({database,drivers,cleanup:true});for(const key of ['preserved','controlsDisabled','privateServiceDisabled','onlyApprovedFixtureEffects','noUnauthorizedDelivery'])assert(r?.[key]===true,'Postflight incomplete');checks.preservation=true;});
  if(database)await cleanup('close-database',async()=>{const r=await database.close();assert(r.connectionClosed&&r.streamClosed,'Database cleanup unconfirmed');checks.databaseCleanup=true;});
  if(now()>=deadline){failed=true;failurePhase??='overall-deadline';}
  const result={status:!failed&&bodyPassed?(d.evidenceMode==='HOSTED'?'BODY_PASSED_PENDING_NATURAL_EXIT':'PASSED_OFFLINE_CONTROLLER'):'FAILED',evidenceMode:d.evidenceMode,checks,...(failurePhase===undefined?{}:{failurePhase}),counts:d.scope.counts(),hostedAcceptanceCompleted:false,privateValuesPrinted:false};
  await d.persistPrivate({kind:'controller-result',result});writeFileSync(join(d.scope.root,'controller-body-result.json'),JSON.stringify(result),{flag:'wx',mode:0o600,flush:true});
  return result;
 }
}
