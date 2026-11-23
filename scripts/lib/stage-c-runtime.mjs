// Real adapters. No work on import; the approved, supervised child calls this.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {parse} from 'dotenv';
import pg from 'pg';
import nodemailer from 'nodemailer';
import {createClient} from '@supabase/supabase-js';
import {readMessage,decrypt} from 'openpgp';
import {z} from 'zod';
import {StageCEngine} from './stage-c-engine.mjs';
import {stageCManagement} from './stage-c-management.mjs';
import {stageCPanel} from './stage-c-panel.mjs';
import {cSql} from './stage-c-sql.mjs';
import {stageCScope} from './stage-c-scope.mjs';
import {evidenceKeys,loadPrivateEvidence,savePrivateEvidence,readJson,sha256} from './preservation-private-evidence.mjs';
import {captureGuardSql,securityQueries,fingerprintSql,collectCurrentPreservation} from './current-preservation.mjs';
import {assertCurrentSecurity} from './current-preservation-security.mjs';
import {assertStageCPreservation,allowedStageCAdditions} from './stage-c-preservation.mjs';
import {probeSql} from './registration-transport-probe.mjs';
import {PersistentMailWorker} from './persistent-mail-worker.ts';
import {readProtectedGmailCredentials} from './gmail-credentials.mjs';
import {cleanupTransportResources} from './registration-transport-lifecycle.mjs';
import {signRegistrationCommand} from '../../supabase/functions/_shared/registration-service-auth.ts';
import {assertTestTarget} from '../test-target.mjs';
import {testDatabaseConfig} from '../postgres-config.mjs';
const sha=v=>createHash('sha256').update(v).digest('hex');
const messageSchema=z.object({email:z.email(),userId:z.uuid(),type:z.literal('signup'),tokenHash:z.string(),code:z.string().regex(/^\d{6}$/),origin:z.literal('http://127.0.0.1:3000')}).strict();
export async function runStageC({selection,root,reviewBytes,fixtureBytes,authorization,securityEvidence,signal,emit=()=>{}}){
 const review=JSON.parse(String(reviewBytes)),scope=stageCScope({root:root+'/ledger',selection,reviewBytes,fixtureBytes,authorization,securityEvidence});
 let db,worker,panel,engine,original,controlAttempted=false,flagAttempted=false,stop=false,failed=false,tail=Promise.resolve(),wake,timer,sent=false,received=false,phase='preflight',failure;
 const recordFailure=error=>{failure??={phase,category:error?.name==='AssertionError'?'assertion':error?.name==='AbortError'?'timeout':'operation',...(Number.isInteger(error?.safeHttpStatus)?{httpStatus:error.safeHttpStatus}:{}),...(/^[a-z_]{1,60}$/.test(error?.safeProviderCode??'')?{providerCode:error.safeProviderCode}:{}),...(/^[0-9A-Z]{5}$/.test(error?.code??'')?{sqlState:error.code}:{})};};
 const clients=new Map(),keys=await evidenceKeys(),accepted=readJson('.secrets/registration-final-v1/A/accepted.json');
 assert.equal(sha256(readFileSync(accepted.manifest)),review.acceptedCandidateManifestSha256);const reference=await loadPrivateEvidence(accepted.manifest,keys),comparisonKey=Buffer.from(reference.comparisonKey,'base64');
 const op=parse(readFileSync('.secrets/operator.env')),env=parse(readFileSync('.env.local'));
 assertTestTarget({projectRef:op.TEST_PROJECT_REF,url:op.TEST_SUPABASE_URL,databaseUrl:op.TEST_DATABASE_URL},readJson('config/test-target.json'));assert.equal(env.MITSA_REGISTRATION_SERVICE_ENABLED,'false');assert(!env.MITSA_REGISTRATION_ENGINE||env.MITSA_REGISTRATION_ENGINE==='legacy');
 const origin='http://127.0.0.1:3000',url=`https://${review.project}.supabase.co`,publicKey=op.TEST_PUBLISHABLE_KEY??env.SUPABASE_PUBLISHABLE_KEY;
 const readOnlySql=new Set([captureGuardSql,...Object.values(securityQueries),...Object.values(cSql).filter(s=>/^select\b/.test(s)),probeSql.inspect,probeSql.health,...reference.payload.registry.map(r=>fingerprintSql(r.schema+'.'+r.table,r.keys,{auth:r.schema==='auth'}))]);
 const exclusive=fn=>{const p=tail.then(fn);tail=p.catch(()=>{});return p;};
 const privateState=async()=>{if(engine){const manifest=await savePrivateEvidence(root+'/evidence',{engine:{fixtures:[...engine.fixtures],receipts:[...engine.receipts],requests:engine.requests,checks:engine.checks},reviewSha256:sha(reviewBytes)},keys);writeFileSync(root+'/latest-encrypted-state.json',JSON.stringify({manifest,sha256:sha256(readFileSync(manifest))}),{mode:0o600,flush:true});}};
 const end=()=>{stop=true;clearTimeout(timer);wake?.();};
 signal?.addEventListener('abort',()=>{failed=true;end();},{once:true});
 const capture=async()=>{await db.query('begin isolation level repeatable read read only');try{const p=await collectCurrentPreservation(db,{expected:review.expectedRegistry,comparisonKey});await db.query('commit');assertCurrentSecurity(p,readJson('config/stage-c1-identity-boundary-baseline.json'),readJson('artifacts/stage-c1-identity-boundary-manifest.json'));await savePrivateEvidence(root+'/evidence',{payload:p,comparisonKey:reference.comparisonKey},keys);return p;}catch(e){try{await db.query('rollback');}catch{}throw e;}};
 let management;
 const edgeState=async expected=>{for(let n=0;n<3;n++){scope.reserve(['edgeRequests'],{label:'c3b-a'});const r=await fetch(url+'/functions/v1/mitsa-registration-service',{method:'GET',redirect:'error',signal:AbortSignal.timeout(15000)});if(r.status===expected)return;assert.equal(r.status,expected===405?503:405,'Unexpected private service response');await new Promise(resolve=>setTimeout(resolve,1000));}throw Error('Private service state unconfirmed');};
 const shared='.secrets/registration-stage-c/shared';mkdirSync(shared,{recursive:true,mode:0o700});mkdirSync(root+'/evidence',{recursive:true,mode:0o700});
 const diagnosticClaims=()=>readdirSync(shared).filter(n=>n.startsWith('diagnostic-')).map(n=>readJson(shared+'/'+n));
 const capacity=async(recipientHash,diagnostic=false)=>{const now=(await db.query(cSql.clock)).rows[0].now.getTime(),q=(await db.query(cSql.quota)).rows[0],prior=diagnosticClaims();assert(Number(q.hourly)+prior.filter(r=>now-r.at<3600000).length+(diagnostic?1:0)<=10);assert(Number(q.daily)+prior.filter(r=>now-r.at<86400000).length+(diagnostic?1:0)<=20);assert(!prior.some(r=>r.recipientHash===recipientHash&&now-r.at<60000));return now;};
 let before,credentials,senderHash,result;
 try{
  scope.reserve(['databaseConnections']);const client=new pg.Client({...testDatabaseConfig(op.TEST_DATABASE_URL,readJson('config/test-target.json')),connectionTimeoutMillis:10000,statement_timeout:15000,idle_in_transaction_session_timeout:30000});client.on('error',()=>{failed=true;end();});
  db={query:scope.sql(client.query.bind(client),{readOnlySql}),end:()=>client.end(),connection:client.connection};phase='database-connect';await client.connect();phase='initial-preservation';before=await capture();assertStageCPreservation(reference.payload,before);
  const inspected=(await db.query(probeSql.inspect)).rows[0];assert.equal(inspected.dispatches,0);assert.equal(inspected.triggers,0);original=inspected.control;
  credentials=readProtectedGmailCredentials();senderHash=sha(credentials.sender.trim().toLowerCase());
  for(const f of scope.fixtures)assert.equal(f.email.split('@')[0].split('+')[0],credentials.sender.toLowerCase().split('@')[0],'Recipient is not an approved sender alias');
  const transportVerify=async()=>{scope.reserve(['smtpVerifications']);const t=nodemailer.createTransport({host:'smtp.gmail.com',port:465,secure:true,pool:false,auth:{user:credentials.sender,pass:credentials.appPassword},tls:{servername:'smtp.gmail.com',minVersion:'TLSv1.2',rejectUnauthorized:true},logger:false,debug:false,connectionTimeout:8000,greetingTimeout:8000,socketTimeout:8000});try{return await t.verify();}finally{t.close();}};
  if(selection==='B'){
   assert(!signal?.aborted);
   assert.equal((await db.query(cSql.users,[scope.fixtures.map(f=>f.email)])).rows.length,0,'Fixture already exists');assert(/^[a-f0-9]{64}$/.test(env.MITSA_REGISTRATION_SERVICE_KEY??''));
   const notices=(await db.query(cSql.notices,[review.notices.map(n=>n.id)])).rows;assert.equal(notices.length,2);for(const n of notices){const expected=review.notices.find(e=>e.id===n.id);assert(expected&&n.kind===expected.kind&&n.content_hash===expected.sha256&&sha(n.content)===expected.sha256&&n.status==='test'&&n.version==='isolated-persistent-synthetic-v1');}
   const {signupChallengeConfig,verifySignupChallenge}=await import('../../src/lib/auth/signup-challenge.ts');const config=signupChallengeConfig(env);assert(config,'Real Turnstile configuration missing');
   const credentialRef=readJson('.secrets/registration-stage-c/management-ref.json');assert.equal(sha256(readFileSync(credentialRef.manifest)),authorization.managementManifestSha256);const credential=await loadPrivateEvidence(credentialRef.manifest,keys);management=stageCManagement({scope,token:credential.token,project:review.project});
   phase='configure-private-service';await management.assertDisabled();flagAttempted=true;await management.setEnabled(true);await edgeState(405);
   phase='configure-delivery';controlAttempted=true;assert.equal((await db.query(readFileSync('supabase/security-proposals/persistent-registration-delivery-controls.sql.txt','utf8'),[review.generation,senderHash])).rows.length,1);
   const command=async(action,payload,label,{bad=false,replay=false,expectRate=false}={})=>{
    const body=JSON.stringify({version:1,action,payload}),headers=await signRegistrationCommand(bad?'0'.repeat(64):env.MITSA_REGISTRATION_SERVICE_KEY,review.project,body);const requestHash=sha(headers['x-mitsa-nonce']);engine.requests.push(requestHash);
    const call=async()=>{scope.reserve(['edgeRequests'],{label});return fetch(url+'/functions/v1/mitsa-registration-service',{method:'POST',body,headers:{'content-type':'application/json',apikey:publicKey,origin,...headers},redirect:'error',signal:AbortSignal.timeout(15000)});};
    const response=await call();if(bad){assert.equal(response.status,401);return null;}if(expectRate){assert.equal(response.status,429);assert.equal((await response.json()).error,'rate_limited');return {rateLimited:true};}assert(response.ok,'Private registration service unavailable');const value=await response.json();
    if(replay){const again=await call();assert.equal(again.status,503);assert.equal((await db.query(cSql.replay,[requestHash])).rows[0].n,1);engine.checks.signedReplay=true;}
    return value;
   };
   const auth=label=>{if(!clients.has(label))clients.set(label,createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(input,init)=>{const u=new URL(input instanceof Request?input.url:String(input));assert.equal(u.origin,url);assert(['/auth/v1/signup','/auth/v1/resend','/auth/v1/verify','/auth/v1/logout'].includes(u.pathname));scope.reserve(['authRequests'],{label});const response=await fetch(input,{...init,redirect:'error',signal:AbortSignal.timeout(15000)});if(u.pathname==='/auth/v1/logout')assert.equal(response.status,204,'Logout response unconfirmed');return response;}}}));return clients.get(label).auth;};
   const dependencies={
    fixture:label=>scope.fixtures.find(f=>f.label===label),termsId:original.terms_id??'98b7abf1-bca4-474f-aee4-e851b4f28d84',privacyId:'40714378-eb52-46cf-a7cf-760db4100456',
    challenge:async proof=>{scope.reserve(['captchaRequests']);return verifySignupChallenge(proof,origin,config);},assertRecipient:scope.assertRecipient,
    command:async(action,payload,label)=>{if(action==='prepare'&&!engine.checks.invalidSigner){await command(action,payload,label,{bad:true});engine.checks.invalidSigner=true;}return command(action,payload,label,{replay:action==='prepare'&&!engine.checks.signedReplay});},
    signup:async f=>{scope.reserve(['newAccounts'],{label:f.label});return auth(f.label).signUp({email:f.email,password:f.password,options:{emailRedirectTo:`${origin}/auth/email?request=${f.dispatchId}`,data:{full_name:f.fullName,registration_nonce:f.nonce}}});},
    resend:f=>auth(f.label).resend({type:'signup',email:f.email,options:{emailRedirectTo:`${origin}/auth/email?request=${f.dispatchId}`}}),
    verify:async(f,token)=>{const r=await auth(f.label).verifyOtp({type:'signup',email:f.email,token});if(r.data?.session){const claims=JSON.parse(Buffer.from(r.data.session.access_token.split('.')[1],'base64url').toString());assert.equal(claims.aal,'aal1');}return r;},
    signout:async f=>{const r=await auth(f.label).signOut({scope:'local'});assert(!r.error);},
    pulse:async()=>{assert.equal(await worker.pulse(),'waiting');},databaseNow:async()=>(await db.query(cSql.clock)).rows[0].now.getTime(),persist:privateState,
    deniedMail:async f=>(await command('authorize-mail',{email:f.email,intentId:f.intentId,requestKey:randomUUID(),action:'signup'},f.label,{expectRate:true})).rateLimited===true,stop:async()=>{end();}
   };
   engine=new StageCEngine(dependencies);
   const {deliverSignupCodeWithGmail}=await import('../../src/lib/mail/smtp.ts');
   worker=new PersistentMailWorker({db,generation:review.generation,transportReady:transportVerify,send:async(job,stillAuthorized)=>{
    phase='dispatch-binding';const row=(await db.query(cSql.dispatch,[job.id,review.generation])).rows[0];assert(row&&row.state==='claimed');
    const decoded=messageSchema.parse(JSON.parse(String((await decrypt({message:await readMessage({binaryMessage:Buffer.from(job.encryptedPayload,'base64')}),decryptionKeys:keys.privateKey})).data)));
    const f=await engine.capture({id:job.id,intentId:row.intent_id,userId:decoded.userId,email:decoded.email,recipientHash:job.recipientHash,action:job.action,origin:decoded.origin,code:decoded.code,tokenHash:decoded.tokenHash,captureId:job.captureId,issuedAt:Date.parse(job.createdAt),expiresAt:Date.parse(job.expiresAt)});
    const now=await capacity(job.recipientHash);assert(now>=Date.parse(job.createdAt)&&now+60000<Date.parse(job.expiresAt));
    scope.reserve(['emails'],{label:f.label,job:job.id});
    phase='dispatch-send';try{await deliverSignupCodeWithGmail({message:{eventKey:job.id,recipient:decoded.email,providerCode:decoded.code,providerTokenHash:decoded.tokenHash,issuedAt:Date.parse(job.createdAt)},authorization:{externalMailEnabled:true,senderApproved:true,approvedSender:credentials.sender,approvedOrigin:origin,providerExpirySeconds:3600},appPassword:credentials.appPassword,authorizeAndClaim:async()=>{scope.active();return stillAuthorized();}},now);engine.sentJobs.add(job.id);}catch(error){recordFailure(error);failed=true;end();throw Error('Delivery unconfirmed; no retry');}
   }});
   assert.equal(await worker.pulse(),'waiting');assert(!signal?.aborted);assert.equal((await db.query(readFileSync('supabase/security-proposals/persistent-registration-admission-controls.sql.txt','utf8'),[review.generation])).rows.length,1);
   panel=await stageCPanel({selection,siteKey:config.siteKey,agreement:notices.map(n=>`${n.kind.toUpperCase()} — ${n.version}: ${n.content}`).join('\n\n'),status:()=>engine.status(),reserve:()=>scope.reserve(['operatorRequests']),operate:input=>exclusive(async()=>{if(input.action==='stop'){failed=true;end();return;}
    if(input.action==='finish'){end();return;}assert(scope.fixtures.some(f=>f.label===input.label));
    phase='operator-step';try{if(input.action==='signup')await engine.signup(input.label,input.proof,input.accepted);else if(input.action==='receipt'){engine.receipt(input.label);await privateState();}else if(input.action==='resend')await engine.resend(input.label);else if(input.action==='verify')await engine.verify(input.label);else if(input.action==='expire')await engine.expire(input.label);else if(input.action==='cooldown')await engine.cooldown(input.label);else throw Error('Action denied');}
    catch(error){recordFailure(error);failed=true;end();throw Error('Test stopped; private details withheld');}
   })});
  }else{
   panel=await stageCPanel({selection,status:()=>({diagnosticSent:sent,inboxReceiptConfirmed:received,otpOrRegistrationTested:false}),reserve:()=>scope.reserve(['operatorRequests']),operate:input=>exclusive(async()=>{
    phase='diagnostic-operator-step';try{
    if(input.action==='send-diagnostic'){
     assert(!sent);const f=scope.fixtures[0];scope.assertRecipient(f.label,f.email);const recipientHash=sha(f.email),at=await capacity(recipientHash,true);assert(await transportVerify());
     const id=randomUUID();scope.reserve(['emails'],{label:f.label,job:id});writeFileSync(`${shared}/diagnostic-${id}.json`,JSON.stringify({at,recipientHash,uncertain:true}),{flag:'wx',mode:0o600,flush:true});
     const t=nodemailer.createTransport({host:'smtp.gmail.com',port:465,secure:true,pool:false,auth:{user:credentials.sender,pass:credentials.appPassword},tls:{servername:'smtp.gmail.com',rejectUnauthorized:true},logger:false,debug:false,disableFileAccess:true,disableUrlAccess:true,connectionTimeout:10000,socketTimeout:15000});
     try{const r=await t.sendMail({from:{name:'Mitsa',address:credentials.sender},to:f.email,envelope:{from:credentials.sender,to:[f.email]},subject:'Mitsa — diagnostic delivery check',text:'Mitsa delivery check. This is an approved no-account diagnostic email. It contains no verification code and does not create or verify an account.',messageId:`<mitsa.diagnostic.${id}@gmail.com>`});assert.equal(r.accepted.length,1);assert.equal(r.accepted[0],f.email);assert.equal(r.rejected.length,0);sent=true;}finally{t.close();}
    }else if(input.action==='receipt'){assert(sent);received=true;await savePrivateEvidence(root+'/evidence',{receipt:'HUMAN_CONFIRMED',kind:'DIAGNOSTIC_NO_OTP',at:Date.now()},keys);}else if(input.action==='finish')end();else throw Error('Action denied');
    }catch(error){recordFailure(error);failed=true;end();throw Error('Diagnostic failed; no retry');}
   })});
  }
  emit({operatorUrl:panel.url,selection,containsSecrets:false});
  const deadline=Math.min(Date.parse(authorization.notAfter)-120000,Date.parse(readJson(root+'/attempt.json').claimedAt)+(scope.limits.runtimeSeconds-120)*1000);
  while(!stop&&Date.now()<deadline){scope.active();if((scope.counts().sqlRequests??0)>scope.limits.sqlRequests-(selection==='A'?58:85))break;
   if(worker)await exclusive(async()=>{const p=await worker.pulse();assert.equal(p,'waiting');const tick=await worker.tick();if(['unconfirmed','paused','stopped'].includes(tick)){failed=true;end();}});
   if(!stop)await new Promise(resolve=>{wake=resolve;timer=setTimeout(resolve,5000);});
  }
 }catch(error){recordFailure(error);failed=true;}
 finally{
  end();try{phase='stop-worker';await panel?.close();await tail;await worker?.stop();
   try{phase='close-controls';if(controlAttempted){const closed=await db.query(readFileSync('supabase/security-proposals/persistent-registration-operational-stop.sql.txt','utf8'),[review.generation]);if(closed.rows[0].stopped_controls===1)assert.equal((await db.query(cSql.restore,[JSON.stringify(original),senderHash])).rows.length,1);}}
   catch(error){recordFailure(error);throw error;}
   finally{phase='restore-private-service';if(flagAttempted){await management.setEnabled(false);await management.assertDisabled();await edgeState(503);}}
   if(before){phase='post-preservation';const after=await capture();let allowed={};if(engine){const users=(await db.query(cSql.users,[scope.fixtures.map(f=>f.email)])).rows;assert(users.length<=2);if(engine.checks.emailVerified)assert(users.find(u=>u.id===engine.fixtures.get('c3b-a')?.userId)?.email_confirmed_at);if(engine.checks.expiredCode)assert.equal(users.find(u=>u.id===engine.fixtures.get('c3b-b')?.userId)?.email_confirmed_at,null);allowed=await allowedStageCAdditions(db,{registry:after.registry,comparisonKey,users:users.map(f=>f.id),intents:[...engine.fixtures.values()].map(f=>f.intentId).filter(Boolean),dispatches:engine.dispatches,captures:engine.captures,requestHashes:engine.requests});}const preservation=assertStageCPreservation(before,after,allowed);
    const checks=engine?.checks??{},complete=selection==='A'?sent&&received:engine.fixtures.size===2&&engine.fixtures.get('c3b-a')?.verified===true&&engine.fixtures.get('c3b-b')?.verified!==true&&engine.receipts.size>=3&&['beforeUserCreated','sixDigitProviderCapture','emailVerified','wrongCode','replayedCode','supersededCode','expiredCode','serverCooldown','signedReplay','invalidSigner','singleCreationClaim','recipientIntentBinding'].every(k=>checks[k]===true);
    result={status:!failed&&complete?'BODY_PASSED_PENDING_NATURAL_EXIT':failed?'FAILED':'INCONCLUSIVE',selection,scope:`C-${selection}-v1`,counts:scope.counts(),preservation,checks,diagnosticSent:sent,receiptConfirmed:selection==='A'?received:engine.receipts.size>=3,realOtpTested:selection==='B'&&checks.emailVerified===true,strictOptionA:selection==='A'?'BLOCKED_SU-519045':'REQUIRED_PROVEN_BEFORE_EXECUTION',faultInjection:'OFFLINE_ONLY_HOSTED_F_PENDING',privateValuesPrinted:false};
   }
  }catch(error){recordFailure(error);failed=true;result={status:'FAILED_CLEANUP_OR_PRESERVATION_UNCONFIRMED',selection,counts:scope.counts(),privateValuesPrinted:false};}
  finally{clearTimeout(timer);try{await cleanupTransportResources({database:db});}catch(error){recordFailure(error);failed=true;}if(failed&&result)result.status='FAILED';if(result)result.failure=failure;writeFileSync(root+'/body-result.json',JSON.stringify(result??{status:'FAILED_PREFLIGHT',selection,counts:scope.counts(),failure}),{flag:'wx',mode:0o600,flush:true});}
 }
 assert(result?.status==='BODY_PASSED_PENDING_NATURAL_EXIT','Stage C did not pass');return result;
}
