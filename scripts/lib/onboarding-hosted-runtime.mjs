// Concrete assembly. Factory construction performs no hosted operation.
// Hosted entry must validate its exact scope/review/strict proof before calling.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {readMessage,decrypt} from 'openpgp';
import {createOnboardingDatabase,onboardingControlSql} from './onboarding-database.mjs';
import {onboardingProbeSql} from './onboarding-probe-sql.mjs';
import {onboardingObservationReceiver} from './onboarding-observation-receiver.mjs';
import {createOnboardingObservers} from './onboarding-hosted-observers.mjs';
import {createOnboardingMailBridge} from './onboarding-mail-bridge.mjs';
import {onboardingReceipts} from './onboarding-receipts.mjs';
import {bindOnboardingBrowser} from './onboarding-browser-binding.mjs';
import {launchOnboardingNext,onboardingNextEnvironment} from './onboarding-next-process.mjs';
import {launchOnboardingBrowser} from './onboarding-browser-process.mjs';
import {probeOnboardingAuthorization} from './onboarding-authorization.mjs';
import {stageCManagement} from './stage-c-management.mjs';
import {runOnboardingController} from './onboarding-controller.mjs';
import {awaitOnboardingRecoveryCapacity} from './onboarding-recovery-capacity.mjs';
const hash=v=>createHash('sha256').update(v).digest('hex'),origin='http://127.0.0.1:3000',base='https://mjtejwafxriwntweussc.supabase.co';
export function assembleOnboardingRuntime(d){
 assert(['HOSTED','OFFLINE'].includes(d.evidenceMode));assert(d.scope.project==='mjtejwafxriwntweussc'&&d.scope.origin===origin);assert(d.review.fixtureTransportVersion==='bound-provider-v1');
 assert(d.scope.evidenceMode===d.evidenceMode,'Runtime/scope evidence mode mismatch');
 assert(d.credentials.sender.endsWith('@gmail.com')&&/^[a-z]{16}$/i.test(d.credentials.appPassword));
 for(const label of ['e-a','e-b']){const f=d.scope.fixture(label);assert(d.scope.assertRecipient(label,f.email)&&f.email.split('@')[0].split('+')[0]===d.credentials.sender.toLowerCase().split('@')[0],'Approved sender alias mismatch');}
 assert(d.evidenceMode==='OFFLINE'||!d.configureOfflineContext,'Offline browser substitution is forbidden in hosted mode');
 const drivers=new Map(),aal1=new Set(),sent=[],notified=new Set(),smtpInFlight=new Set(),pendingFailures=new AbortController();let next,browser,worker,serviceDisabled=false,managementCleanup=false;
 const diagnosticDirectory=d.diagnosticDirectory??'.secrets/registration-stage-c/shared';if(d.evidenceMode==='HOSTED')assert(resolve(diagnosticDirectory)===resolve('.secrets/registration-stage-c/shared'));
 const fail=category=>{pendingFailures.abort();const safe=typeof category==='string'&&/^[a-z-]{1,64}$/.test(category)?category:'operation-unconfirmed';void d.persistPrivate({kind:'runtime-failure',category:safe}).catch(()=>{});};
 const db=createOnboardingDatabase({...d,hash,senderHash:hash(d.credentials.sender.trim().toLowerCase()),onFailure:fail});
 const assertReady=async()=>{d.scope.active();assert(!pendingFailures.signal.aborted,'Onboarding runtime stopped');};
 const decryptCipher=async cipher=>JSON.parse(String((await decrypt({message:await readMessage({binaryMessage:cipher}),decryptionKeys:d.keys.privateKey})).data));
 // Acknowledging already-encrypted observations during cleanup is mandatory;
 // stopping new provider work must not lose evidence or strand the child IPC.
 const receiver=onboardingObservationReceiver({root:d.scope.root,decryptCipher,assertNewIdentity:(label,id)=>db.assertNewIdentity(label,id),assertPersistentAdmission:()=>db.assertAdmission(),persistPrivate:d.persistPrivate,assertExecutionReady:async()=>d.scope.active()});
 const publicKey=d.appEnvironment.SUPABASE_PUBLISHABLE_KEY;
 const observers=createOnboardingObservers({scope:db.scope,db:db.raw,publicKey,comparisonKey:db.comparisonKey,generation:d.review.generation,notices:d.review.noticeIds,fixture:label=>d.scope.fixture(label),privateState:label=>receiver.privateState(label),fetcher:d.fetcher,persistPrivate:d.persistPrivate,assertExecutionReady:assertReady,expectedWorkspaceSlug:label=>drivers.get(label)?.workspaceSlug});
 const management=stageCManagement({scope:{reserve:names=>{assert(names.length===1);d.scope.reserve(names[0],{cleanup:managementCleanup});}},token:d.managementToken,project:d.scope.project,fetcher:d.fetcher});
 const receipt=onboardingReceipts({root:d.scope.root,scope:d.scope,persistPrivate:d.persistPrivate,notAfter:d.notAfter,emit:d.emit});
 const membershipSnapshot=async()=>{const values=[];for(const label of ['e-a','e-b']){const s=receiver.privateState(label);assert(s.userId);values.push((await db.query(onboardingProbeSql.workspace,[s.userId,d.scope.fixture(label).locationName,db.comparisonKey])).rows[0]);}return values;};
 const send=kind=>async(input,now)=>{
  const label=['e-a','e-b'].find(label=>d.scope.fixture(label).email===input.message.recipient);assert(label,'Unapproved SMTP recipient');
  // A failed/uncertain SMTP operation still consumes its irreversible claim.
  const attempt={label,eventKey:input.message.eventKey,recipientHash:hash(input.message.recipient),accepted:false};sent.push(attempt);
  const operation=randomUUID();smtpInFlight.add(operation);try{const {deliverSignupCodeWithGmail,deliverRecoveryWithGmail}=await import('../../src/lib/mail/smtp.ts');const response=await(kind==='signup'?deliverSignupCodeWithGmail:deliverRecoveryWithGmail)({...input,authorization:{externalMailEnabled:true,senderApproved:true,approvedSender:d.credentials.sender,approvedOrigin:origin,providerExpirySeconds:3600},appPassword:d.credentials.appPassword},now);
   attempt.accepted=true;return response;
  }finally{smtpInFlight.delete(operation);}
 };
 const api={
  ...d,scope:d.scope,assertAuthority:async()=>{d.scope.active();assert(d.review.sources.every(f=>hash(readFileSync(f.path))===f.sha256),'Reviewed runtime source changed');},
  assertOwnedController:async()=>{const attempt=JSON.parse(readFileSync(d.scope.root+'/worker-attempt.json'));assert(attempt.childPid===process.pid&&attempt.parentPid===process.ppid&&attempt.reviewSha256===d.scope.reviewSha256&&attempt.nonceSha256===hash(d.ownedLaunchNonce),'Owned controller process not proven');},
  openDatabase:()=>db.open(),preflight:()=>db.preflight(),
  async enablePrivateService(){await management.assertDisabled();await management.setEnabled(true);serviceDisabled=false;},
  openControls:()=>db.delivery(),openAdmission:()=>db.admission(),
  async startWorker(){worker=createOnboardingMailBridge({scope:db.scope,db:db.raw,generation:d.review.generation,workerId:randomUUID(),assertExecutionReady:assertReady,fixtureState:label=>receiver.privateState(label),decryptPayload:async cipher=>decryptCipher(Buffer.from(cipher,'base64')),persistPrivate:d.persistPrivate,
    diagnosticClaims:async()=>readdirSync(diagnosticDirectory).filter(n=>n.startsWith('diagnostic-')).map(n=>JSON.parse(readFileSync(diagnosticDirectory+'/'+n))),verifyTransport:async()=>{const id=randomUUID(),t=d.makeSmtpTransport();smtpInFlight.add(id);try{return await t.verify();}finally{try{t.close();}finally{smtpInFlight.delete(id);}}},sendSignup:send('signup'),sendRecovery:send('recovery'),closeTransport:async()=>{assert(smtpInFlight.size===0,'SMTP cleanup still in flight');}});return worker;},
  async startNext({signal}){next=await launchOnboardingNext({scope:d.scope,root:d.scope.root,entry:d.review.nextEntry,entrySha256:d.review.nextEntrySha256,reviewSha256:d.scope.reviewSha256,environment:onboardingNextEnvironment(d.appEnvironment,process.env),claimedAt:new Date(d.scope.executionClock.startedAt).toISOString(),notAfter:d.notAfter,bindings:d.bindings,onPrivateObservation:m=>receiver.accept(m),onPrivateFailure:fail});const stop=()=>{void next.stop().catch(fail);};if(signal.aborted)stop();else signal.addEventListener('abort',stop,{once:true});next.completion.then(()=>signal.removeEventListener('abort',stop));return next;},
  async startBrowser({signal}){browser=await launchOnboardingBrowser({scope:d.scope,browserType:d.browserType,notAfter:d.notAfter,signal,evidenceMode:d.evidenceMode});return browser;},
  async makeDriverDependencies(label,{signal,withWorker}){
   const context=await browser.contextFor(label),binding=d.bindings.find(b=>b.label===label);assert(binding);await bindOnboardingBrowser({context,fixture:label,authorization:binding.authorization,scope:d.scope,onFailure:fail});if(d.configureOfflineContext)await d.configureOfflineContext(context,label);
   const page=await context.newPage();page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(20000);
   return {label,origin,page,fixture:d.scope.fixture(label),recoveryPassword:d.recoveryPasswords[label],notices:d.review.noticeIds,privacy:{screenshots:false,traces:false,videos:false},now:()=>Date.now(),assertRecipient:(l,e)=>d.scope.assertRecipient(l,e),assertExecutionReady:assertReady,assertFixtureAbsent:l=>observers.assertFixtureAbsent(l),assertMutationAllowed:async()=>{await assertReady();},
    persistPrivate:async state=>{await d.persistPrivate({kind:'browser-driver-state',label,state});drivers.set(label,structuredClone(state));},
    inspectRegistration:l=>observers.inspectRegistration(l),inspectSession:l=>observers.inspectSession(l),identifyExactSession:l=>observers.identifyExactSession(l),verifyExactLogout:l=>observers.verifyExactLogout(l),snapshotRecoveryInvariants:l=>observers.snapshotRecoveryInvariants(l),recoveryTokenUnusedBeforePost:l=>observers.recoveryTokenUnusedBeforePost(l),inspectRecoveryEffects:l=>observers.inspectRecoveryEffects(l),
    awaitRecoveryCapacity:l=>awaitOnboardingRecoveryCapacity({scope:d.scope,query:db.query,label:l,diagnosticClaims:async()=>readdirSync(diagnosticDirectory).filter(n=>n.startsWith('diagnostic-')).map(n=>JSON.parse(readFileSync(diagnosticDirectory+'/'+n))),signal}),
    workspaceDeniedAtAal1:async l=>{const result=await observers.workspaceDeniedAtAal1(l);if(result)aal1.add(l);return result;},
    waitForHumanTurnstile:async()=>{await page.waitForFunction(()=>{const value=document.querySelector('input[name="captchaToken"]');return value instanceof HTMLInputElement&&value.value.length>0;},undefined,{timeout:120000});},
    confirmInbox:async(l,action)=>{
     let message;for(let i=0;i<30;i++){await assertReady();assert(!signal.aborted);try{message=worker.latestDeliveredMessage(l,action);break;}catch{}await withWorker(w=>w.tick());try{message=worker.latestDeliveredMessage(l,action);break;}catch{}await new Promise(resolve=>setTimeout(resolve,500));}
     assert(message,'Provider dispatch did not complete');if(!notified.has(message.jobId)){await next.deliverProviderMessage(l,message);notified.add(message.jobId);}
     assert(await receipt.wait(l,action,message,signal)===true);await worker.confirmHumanReceipt(l,action,message.jobId);return worker.receiptConfirmed(l,action);
    },latestDeliveredMessage:(l,a)=>worker.latestDeliveredMessage(l,a)};
  },
  authorizationTests:({signal})=>probeOnboardingAuthorization({scope:d.scope,observers,publicKey,fetcher:d.fetcher,signal,privateState:l=>receiver.privateState(l),protectedMembershipSnapshot:membershipSnapshot,aal1EvidenceComplete:()=>aal1.size===2}),
  async stopNewWork(){pendingFailures.abort();db.beginCleanup();},
  async signOutFixtures(){for(const label of ['e-a','e-b']){const s=receiver.privateState(label);if(!s.accessToken)continue;d.scope.reserve('authRequests',{fixture:label,cleanup:true,operation:'fixture-local-signout'});const r=await d.fetcher(base+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:publicKey,authorization:'Bearer '+s.accessToken},redirect:'error',signal:AbortSignal.timeout(10000)});assert(r.status===204||r.status===401&&!(await db.query(onboardingProbeSql.session,[JSON.parse(Buffer.from(s.accessToken.split('.')[1],'base64url').toString()).session_id,s.userId])).rows[0].live,'Fixture cleanup logout unconfirmed');}},
  closeControls:()=>db.stopControls(),
  async restorePrivateService(){managementCleanup=true;await management.setEnabled(false);await management.assertDisabled();serviceDisabled=true;return true;},
  async postflight(){const r=await db.postflight(['e-a','e-b'].map(l=>receiver.privateState(l)));assert(serviceDisabled);assert(sent.length===(d.scope.counts().emails??0)&&sent.every(s=>s.recipientHash===hash(d.scope.fixture(s.label).email)),'SMTP claim/recipient audit mismatch');return {...r,privateServiceDisabled:true,noUnauthorizedDelivery:true};}
 };
 return {run:()=>runOnboardingController(api),privateState:label=>receiver.privateState(label)};
}
