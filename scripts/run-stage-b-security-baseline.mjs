// INACTIVE operator test runner. Never invoke --execute without human approval.
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
import {parse} from 'dotenv';
import pg from 'pg';
import {createClient} from '@supabase/supabase-js';
import {readKey,readPrivateKey,readMessage,decrypt,createMessage,encrypt} from 'openpgp';
import {assertTestTarget} from './test-target.mjs';
import {testDatabaseConfig} from './postgres-config.mjs';
import {totp} from '../tests/support/totp.ts';
import {writeEncryptedCheckpoint,acquireStageBRunLock,boundedStageBFailure} from './lib/stage-b-checkpoint.mjs';
import {StageBBudget,validateStageBApproval,validateStageBProposal,validateStageBResumeApproval,validateStageBResumeProposal,validateStageBHardeningApproval,validateStageBHardeningProposal,validateStageBHardeningContinuationProposal,validateStageBHardeningContinuationAuthorization,runStageBBaseline,resumeStageBBaseline,runStageBHardening,continueStageBHardening,stageBProviderCode,assertStageBReadiness,stageBRequestOperation,stageBProject,stageBMarker} from './lib/stage-b-security-protocol.ts';

const root='.secrets/persistent-registration-security',approvalPath=`${root}/approval.json`,checkpointPath=`${root}/checkpoint.pgp`;
const sha=value=>createHash('sha256').update(value).digest('hex');
const json=path=>JSON.parse(readFileSync(path,'utf8'));
const reportPath=`artifacts/stage-b-security-baseline-${Date.now()}-${randomUUID()}.json`;
const writeReport=value=>{writeFileSync(reportPath,JSON.stringify(value,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(value));};
const code=stageBProviderCode;
const check=(result,allowed=[])=>{if(result.error&&!allowed.includes(code(result.error)))throw Error('Fixture provider expectation failed');return result;};
const subjectEmail=email=>/^foundation-session-review-(plain|mfa)-[a-f0-9-]{36}@example\.invalid$/.test(email);
let db,budget,checkpoint,publicKey,cleanup,releaseLock,hardeningMode=false,hardeningAuthorized=false;
const clients={},otherClients={},permits={},lastCodes={},recoveryHashes={},newVerified=new Set();
async function save(){
 const sealed=await encrypt({message:await createMessage({text:JSON.stringify(checkpoint)}),encryptionKeys:publicKey,format:'binary'});
 await writeEncryptedCheckpoint(checkpointPath,sealed);
}
async function preflight(){
 assert.equal((await db.query('select marker from foundation_probe.environment_identity where singleton')).rows[0]?.marker,stageBMarker);
 const row=(await db.query(`select (select not(registration_enabled or external_mail_enabled or eligibility_approved or legal_publication_enabled or disposal_enabled) from private.release_gates where singleton) gates,
 (select not(enabled or smtp_enabled or private.mitsa_pilot_registration_open()) from private.pilot_registration_window where singleton) pilot,
 to_regclass('private.registration_control') is null new_schema_absent,
  (select count(*)::int from private.pilot_mail_deliveries) claims,
  (select count(*)::int from private.isolated_auth_mail) captures`)).rows[0];
 assert(row.gates&&row.pilot&&row.new_schema_absent);assert.equal(row.claims,3);
 const baseline=json('config/persistent-registration-function-baseline.json');
 for(const expected of baseline.functions){
  const actual=(await db.query("select pg_get_functiondef(p.oid) definition,pg_get_userbyid(p.proowner) owner,p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname=$1",[expected.name])).rows;
  assert.equal(actual.length,1);assert.equal(sha(actual[0].definition),expected.sha256);assert.equal(actual[0].owner,expected.owner);assert.equal(actual[0].acl,expected.acl);
 }
 return row;
}
try {
 if(process.argv.length!==3||!['--execute','--resume','--hardening','--hardening-continue'].includes(process.argv[2])){
  console.log('Prepared Stage B runner. Each execution mode requires its separately approved, source-bound private approval record. No credentials loaded or provider contacted.');
 }else{
  // Everything above this guard is public source/configuration only.
  const continuingHardening=process.argv[2]==='--hardening-continue';hardeningMode=process.argv[2]==='--hardening'||continuingHardening;const resuming=process.argv[2]==='--resume',retained=resuming||hardeningMode;
  const proposalPath=hardeningMode?'config/persistent-registration-stage-b-hardening-proposal.json':resuming?'config/persistent-registration-stage-b-resume-proposal.json':'config/persistent-registration-stage-b-test-proposal.json';
  const proposal=hardeningMode?validateStageBHardeningProposal(json(proposalPath)):resuming?validateStageBResumeProposal(json(proposalPath)):validateStageBProposal(json(proposalPath));
  const continuationPath='config/persistent-registration-stage-b-hardening-continuation.json',continuation=continuingHardening?validateStageBHardeningContinuationProposal(json(continuationPath)):null;
  const selectedApproval=continuingHardening?`${root}/hardening-continuation-authorization.json`:hardeningMode?`${root}/hardening-approval.json`:resuming?`${root}/resume-approval.json`:approvalPath;
  assert(existsSync(selectedApproval));
  const expected={proposalSha256:sha(readFileSync(continuingHardening?continuationPath:proposalPath)),runnerSha256:sha(readFileSync('scripts/run-stage-b-security-baseline.mjs')),protocolSha256:sha(readFileSync('scripts/lib/stage-b-security-protocol.ts'))};
  let approval;
  if(continuingHardening){
   const original=json(`${root}/hardening-approval.json`);assert(original.approved===true&&original.hardeningOnly===true&&original.projectRef===stageBProject&&original.databaseMarker===stageBMarker);
   assert.equal(original.proposalSha256,sha(readFileSync(proposalPath)));assert.equal(continuation.originalProposalSha256,original.proposalSha256);
   approval=validateStageBHardeningContinuationAuthorization(json(selectedApproval),{...expected,checkpointSha256:sha(readFileSync(checkpointPath)),checkpointWriterSha256:sha(readFileSync('scripts/lib/stage-b-checkpoint.mjs')),originalApprovalId:original.approvalId});
  }else approval=hardeningMode?validateStageBHardeningApproval(json(selectedApproval),{...expected,checkpointSha256:sha(readFileSync(checkpointPath))}):resuming?validateStageBResumeApproval(json(selectedApproval),{...expected,checkpointSha256:sha(readFileSync(checkpointPath))}):validateStageBApproval(json(selectedApproval),expected);
  hardeningAuthorized=hardeningMode;
  assert.equal(proposal.projectRef,stageBProject);assert.equal(proposal.databaseMarker,stageBMarker);assert.equal(proposal.maxExternalEmails,0);
  assert(!proposal.providerSettingsChanged&&!proposal.migrationsAllowed&&!proposal.workspaceOrMembershipCreationAllowed);
  if(!retained)assert(!existsSync(checkpointPath),'An existing fixture checkpoint requires read-only reconciliation, never automatic recreation');
  else assert.equal(sha(readFileSync(checkpointPath)),continuingHardening?continuation.stoppedCheckpointSha256:proposal.priorCheckpointSha256);
  releaseLock=acquireStageBRunLock(`${root}/active-run.lock`,approval.approvalId);
  const approved=json('config/test-target.json'),operator=parse(readFileSync('.secrets/operator.env'));
  const target=assertTestTarget({projectRef:operator.TEST_PROJECT_REF,url:operator.TEST_SUPABASE_URL,databaseUrl:operator.TEST_DATABASE_URL},approved);assert.equal(target.projectRef,stageBProject);
  db=new pg.Client({...testDatabaseConfig(operator.TEST_DATABASE_URL,approved),statement_timeout:15000});db.on('error',()=>{});await db.connect();
  await db.query('begin read only');const before=await preflight();await db.query('commit');
  const settings=await fetch(`${target.url}/auth/v1/settings`,{headers:{apikey:operator.TEST_PUBLISHABLE_KEY},signal:AbortSignal.timeout(10000)});
  assert(settings.ok);const provider=await settings.json();assert(provider.disable_signup===false&&provider.mailer_autoconfirm===false&&provider.external?.anonymous_users===false);
  const health=await fetch(`${target.url}/auth/v1/health`,{headers:{apikey:operator.TEST_PUBLISHABLE_KEY},signal:AbortSignal.timeout(10000)});assert(health.ok);assert.equal((await health.json()).version,'v2.197.0');
  publicKey=await readKey({armoredKey:readFileSync('.secrets/auth-mail/public.asc','utf8')});
  let priorCounts,priorHardeningCounts;
  if(retained){
   checkpoint=JSON.parse(String((await decrypt({message:await readMessage({binaryMessage:readFileSync(checkpointPath)}),decryptionKeys:await readPrivateKey({armoredKey:readFileSync('.secrets/auth-mail/private.asc','utf8')})})).data));
   assert.equal(checkpoint.approvalId,json(continuingHardening?`${root}/hardening-approval.json`:hardeningMode?`${root}/resume-approval.json`:approvalPath).approvalId);
   assert.equal(checkpoint.phase,continuingHardening?'hardening-stopped':hardeningMode?'complete':'stopped');assert.equal(checkpoint.lastOperation,continuingHardening?'password':hardeningMode?'signOut':'password');
   if(hardeningMode)assert.equal(checkpoint.pending,null);else{assert.equal(checkpoint.pending?.action,'password');assert.equal(checkpoint.pending.fixture,'mfa');}
   assert.deepEqual(checkpoint.counts,proposal.priorCounts);
   if(continuingHardening){assert.deepEqual(checkpoint.hardeningCounts,continuation.priorHardeningCounts);assert.deepEqual(checkpoint.lastPasswordOutcome,{fixture:'mfa',expected:'current_password_required',currentPasswordMode:'missing',hasError:true,providerCode:'current_password_required',status:400});priorHardeningCounts={...checkpoint.hardeningCounts};}
   assert.equal(checkpoint.mailBefore.captures,before.captures);assert.equal(checkpoint.mailBefore.claims,before.claims);
   assert(checkpoint.fixtures.mfa.factors.primary?.id);if(!hardeningMode)assert(!checkpoint.fixtures.mfa.factors.secondary);
   priorCounts={...checkpoint.counts};newVerified.add(checkpoint.fixtures.mfa.factors.primary.id);
   checkpoint.previousApprovalId=checkpoint.approvalId;checkpoint.approvalId=approval.approvalId;checkpoint.phase=hardeningMode?'hardening':'resuming';
  }else{
   checkpoint={approvalId:approval.approvalId,phase:'started',createdAt:new Date().toISOString(),mailBefore:{claims:before.claims,captures:before.captures},fixtures:{}};
   for(const f of ['plain','mfa'])checkpoint.fixtures[f]={email:`foundation-session-review-${f}-${randomUUID()}@example.invalid`,password:randomBytes(48).toString('base64url'),factors:{}};
   mkdirSync(root,{recursive:true});await save();
  }
  budget=new StageBBudget(async counts=>{if(hardeningMode)checkpoint.hardeningCounts=counts;else checkpoint.counts=counts;await save();},hardeningMode?{hardeningOnly:true,...(continuingHardening?{counts:priorHardeningCounts}:{})}:resuming?{counts:priorCounts,additionalPasswordAttemptApproved:true}:undefined);
  const client=key=>createClient(target.url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,debug:false},global:{async fetch(address,init){
   assert(typeof address==='string'||address instanceof URL);const url=String(address),operation=stageBRequestOperation(url,init?.method??'GET');
   if(retained)assert.notEqual(operation,'create');
   if(hardeningMode){assert.notEqual(operation,'enroll');assert.notEqual(init?.method,'DELETE');if(new URL(url).pathname.startsWith('/rest/'))assert(['/rest/v1/rpc/mitsa_security_status','/rest/v1/rpc/mitsa_identity'].includes(new URL(url).pathname));}
   if(new URL(url).pathname.startsWith('/rest/'))assert.equal(new Headers(init?.headers).get('content-profile'),'api');
   if(operation)await budget.reserve(operation);
   if(['create','signin','recovery'].includes(operation)){const body=JSON.parse(String(init?.body));assert(Object.values(checkpoint.fixtures).some(f=>subjectEmail(body.email)&&f.email===body.email));}
   let response;
   try{response=await fetch(address,{...init,redirect:'error',signal:AbortSignal.timeout(15000)});}catch(error){
    checkpoint.lastTransport={operation:operation??'auth-or-rpc-control',status:null,providerCode:null,failure:error?.name==='TimeoutError'?'timeout':'transport-failure'};
    try{await save();}catch{}throw Error('Stage B transport or checkpoint failure');
   }
   let providerCode=null;if(!response.ok){try{const body=await response.clone().json();providerCode=code({code:body.error_code??body.code});}catch{providerCode='other';}}
   checkpoint.lastTransport={operation:operation??'auth-or-rpc-control',status:response.status,providerCode};await save();return response;
  }}});
  const admin=client(operator.TEST_AUTH_ADMIN_KEY);
  async function fixture(f){
   const value=checkpoint.fixtures[f];assert(value&&subjectEmail(value.email));
   if(value.id){const rows=(await db.query('select id,email,email_confirmed_at is not null verified,not is_anonymous and deleted_at is null active from auth.users where id=$1',[value.id])).rows;
    // Identity comes from the unique random email + successful non-upsert
    // create response, not an assumption that provider/host clocks agree.
    assert.equal(rows.length,1);assert.equal(rows[0].email,value.email);assert(rows[0].verified&&rows[0].active);
    assert.equal((await db.query('select count(*)::int n from private.memberships where user_id=$1',[value.id])).rows[0].n,0);
   }return value;
  }
  async function nextCode(which){
   const f=await fixture('mfa'),factor=f.factors[which];assert(factor?.secret&&factor.id);
   assert.equal((await db.query('select count(*)::int n from auth.mfa_factors where user_id=$1 and id=$2',[f.id,factor.id])).rows[0].n,1);
   if(lastCodes[which]===Math.floor(Date.now()/30000))await delay(30000-Date.now()%30000+100);
   lastCodes[which]=Math.floor(Date.now()/30000);return totp(factor.secret);
  }
  if(retained){
   for(const f of ['plain','mfa']){const value=await fixture(f);assert.equal((await db.query('select count(*)::int n from auth.sessions where user_id=$1',[value.id])).rows[0].n,0);}
   const mfa=checkpoint.fixtures.mfa;
   const actual=(await db.query(`select
    (select count(*)::int from auth.mfa_factors where user_id=u.id and status='verified') verified,
    exists(select 1 from auth.mfa_factors where user_id=u.id and id=$2 and status='verified' and factor_type='totp') primary_verified,
    exists(select 1 from private.factor_bindings b join private.account_security s on s.user_id=b.user_id and s.generation=b.generation
     where b.user_id=u.id and b.factor_id=$2 and b.revoked_at is null and s.initialized and not s.recovery_locked) trusted,
    extensions.crypt($3,encrypted_password)=encrypted_password known_password_matches,
    case when $4::text is null then false else extensions.crypt($4,encrypted_password)=encrypted_password end pending_password_matches
    from auth.users u where id=$1`,[mfa.id,mfa.factors.primary.id,mfa.password,checkpoint.pending?.replacement??null])).rows[0];
   assert.equal(actual.verified,1);assert(actual.primary_verified&&actual.trusted&&actual.known_password_matches&&!actual.pending_password_matches);
   checkpoint.pending=null;await save();
  }
  const d={
   async create(f){
    const value=await fixture(f);assert(!value.id);assert.equal((await db.query('select count(*)::int n from auth.users where email=$1',[value.email])).rows[0].n,0);
    checkpoint.pending={action:'create',fixture:f};await save();
    const r=check(await admin.auth.admin.createUser({email:value.email,password:value.password,email_confirm:true}));assert(r.data.user&&r.data.user.email===value.email);value.id=r.data.user.id;
    await fixture(f);checkpoint.pending=null;await save();
   },
   async signIn(f,keepOther=false){
    const value=await fixture(f);const c=client(operator.TEST_PUBLISHABLE_KEY),r=check(await c.auth.signInWithPassword({email:value.email,password:value.password}));assert.equal(r.data.user?.id,value.id);assert(r.data.session);
    if(keepOther)otherClients[f]={client:c,refresh:r.data.session.refresh_token};else clients[f]=c;
   },
   async acceptTestAgreement(){
    await fixture('mfa');const current=check(await clients.mfa.schema('api').rpc('mitsa_current_terms'));assert.equal(current.data?.status,'test');assert(current.data.id);
    check(await clients.mfa.schema('api').rpc('mitsa_accept_terms',{p_version:current.data.id}));
   },
   async password(f,expected,current='missing'){
    const value=await fixture(f),replacement=randomBytes(48).toString('base64url');checkpoint.pending={action:'password',fixture:f,replacement};await save();
    const r=await clients[f].auth.updateUser({password:replacement,...(current==='correct'?{current_password:value.password}:current==='wrong'?{current_password:randomBytes(48).toString('base64url')}:{})});
    checkpoint.lastPasswordOutcome={fixture:f,expected,currentPasswordMode:current,hasError:!!r.error,providerCode:r.error?code(r.error):null,status:Number.isInteger(r.error?.status)?r.error.status:null};await save();
    if(expected==='allowed'){check(r);value.password=replacement;}else assert.equal(code(r.error),expected);
    checkpoint.pending=null;await save();
   },
   async otherSessionProbe(){
    await fixture('plain');const r=await otherClients.plain.client.schema('api').rpc('mitsa_identity');
    const refresh=await client(operator.TEST_PUBLISHABLE_KEY).auth.refreshSession({refresh_token:otherClients.plain.refresh});
    assert(!refresh.data.user||refresh.data.user.id===checkpoint.fixtures.plain.id);
    return {bearerDenied:code(r.error)==='42501',refreshDenied:['refresh_token_not_found','refresh_token_already_used','session_not_found','session_expired'].includes(code(refresh.error))&&!refresh.data.session};
   },
   async prepareFactor(){await fixture('mfa');const r=check(await clients.mfa.schema('api').rpc('mitsa_prepare_enrollment'));assert(r.data);permits.mfa=r.data;},
   async enrollFactor(which,expected){
    const value=await fixture('mfa');const r=await clients.mfa.auth.mfa.enroll({factorType:'totp',friendlyName:`Stage B synthetic ${which}`,issuer:'Mitsa'});
    if(expected==='insufficient_aal'){assert.equal(code(r.error),'insufficient_aal');return;}
    check(r);assert(r.data?.totp?.secret);value.factors[which]={id:r.data.id,secret:r.data.totp.secret};await save();
   },
   async verifyFactor(which){
    const value=await fixture('mfa');if(!newVerified.has(value.factors[which].id)){await budget.reserve('verifyNewFactor');newVerified.add(value.factors[which].id);}
    check(await clients.mfa.auth.mfa.challengeAndVerify({factorId:value.factors[which].id,code:await nextCode(which)}));
   },
   async bindFactor(which,withPermit,expected){
    const value=await fixture('mfa'),r=await clients.mfa.schema('api').rpc('mitsa_bind_factor',{p_factor:value.factors[which].id,p_permit:withPermit?permits.mfa:null});
    if(expected==='allowed')check(r);else assert.equal(code(r.error),'42501');
   },
   async ready(expected,allowSessionDenial=false){
    await fixture('mfa');const r=await clients.mfa.schema('api').rpc('mitsa_security_status');
    assertStageBReadiness(r,expected,allowSessionDenial);
   },
   async removeFactor(which,expected){
    const value=await fixture('mfa');assert.equal((await db.query('select count(*)::int n from auth.mfa_factors where user_id=$1 and id=$2',[value.id,value.factors[which].id])).rows[0].n,1);
    const r=await clients.mfa.auth.mfa.unenroll({factorId:value.factors[which].id});
    if(expected==='allowed')check(r);else assert.equal(code(r.error),'insufficient_aal');
   },
   async recover(f='mfa'){
    const value=await fixture(f);const generated=check(await admin.auth.admin.generateLink({type:'recovery',email:value.email,options:{redirectTo:'http://127.0.0.1:3000/auth/email'}}));assert.equal(generated.data.user?.id,value.id);assert(generated.data.properties?.hashed_token);
    recoveryHashes[f]=generated.data.properties.hashed_token;const c=client(operator.TEST_PUBLISHABLE_KEY),r=check(await c.auth.verifyOtp({type:'recovery',token_hash:recoveryHashes[f]}));assert.equal(r.data.user?.id,value.id);assert(r.data.session);clients[f]=c;
   },
   async replayRecovery(f='mfa'){const r=await client(operator.TEST_PUBLISHABLE_KEY).auth.verifyOtp({type:'recovery',token_hash:recoveryHashes[f]});assert.equal(code(r.error),'otp_expired');assert(!r.data.session);},
   async signOut(f){await fixture(f);check(await clients[f].auth.signOut({scope:'global'}));},
  };
  // Record only the operation name. Arguments can include private auth data.
  for(const [name,operation] of Object.entries(d))if(typeof operation==='function'){
   d[name]=async(...args)=>{checkpoint.lastOperation=name;checkpoint.inFlightOperation={name,...(name==='password'?{fixture:args[0],expected:args[1],currentPasswordMode:args[2]??'missing'}:{})};await save();const result=await operation(...args);checkpoint.completedOperation=checkpoint.inFlightOperation;checkpoint.inFlightOperation=null;await save();return result;};
  }
  cleanup=async()=>{
   let closed=true;
   for(const f of ['plain','mfa']){
    const value=checkpoint.fixtures[f];if(!value.id)continue;
    try {
     await fixture(f);if((await db.query('select count(*)::int n from auth.sessions where user_id=$1',[value.id])).rows[0].n===0)continue;
     let signedOut=false;
     if(clients[f]){try{signedOut=!(await clients[f].auth.signOut({scope:'global'})).error;}catch{}}
     if(!signedOut){
      const candidates=[value.password,...(checkpoint.pending?.action==='password'&&checkpoint.pending.fixture===f?[checkpoint.pending.replacement]:[])];
      for(const password of candidates){
       const c=client(operator.TEST_PUBLISHABLE_KEY),r=await c.auth.signInWithPassword({email:value.email,password});
       if(r.error)continue;assert.equal(r.data.user?.id,value.id);check(await c.auth.signOut({scope:'global'}));break;
      }
     }
     closed&&=(await db.query('select count(*)::int n from auth.sessions where user_id=$1',[value.id])).rows[0].n===0;
    }catch{closed=false;}
   }return closed;
  };
  const result=continuingHardening?await continueStageBHardening(d):hardeningMode?await runStageBHardening(d):resuming?await resumeStageBBaseline(d):await runStageBBaseline(d);
  await db.query('begin read only');const after=await preflight();assert.equal(after.captures,before.captures);for(const f of ['plain','mfa']){const value=await fixture(f);assert.equal((await db.query('select count(*)::int n from auth.sessions where user_id=$1',[value.id])).rows[0].n,0);}await db.query('commit');
  checkpoint.phase=hardeningMode?'hardening-complete':'complete';checkpoint.pending=null;await save();
  writeReport({...result,checkedAt:new Date().toISOString(),project:stageBProject,counts:budget.counts,...(hardeningMode?{priorBaselineCounts:checkpoint.counts}:{}),fixtureSessionsRevoked:true,smtpClaimsVerifiedUnchanged:true,mailCapturesVerifiedUnchanged:true,workspaceMembershipsCreated:0,providerSettingsChanged:hardeningMode,providerSettingsChangedByRunner:false,registrationActivated:false,privateValuesPrinted:false});
 }
}catch(error){
 const failureAtStop={reason:boundedStageBFailure(error),operation:checkpoint?.inFlightOperation??checkpoint?.lastOperation??null,transport:checkpoint?.lastTransport??null,passwordOutcome:checkpoint?.lastPasswordOutcome??null};
 try{if(db)await db.query('rollback');}catch{}
 let fixtureSessionsClosedOnFailure=null;try{if(cleanup)fixtureSessionsClosedOnFailure=await cleanup();}catch{fixtureSessionsClosedOnFailure=false;}
 let smtpClaimsVerifiedUnchanged=null;try{if(db)smtpClaimsVerifiedUnchanged=(await db.query('select count(*)::int n from private.pilot_mail_deliveries')).rows[0].n===3;}catch{}
 if(checkpoint&&publicKey){checkpoint.phase=hardeningMode?'hardening-stopped':'stopped';try{await save();}catch{}}
 // Never retry unknown creates/password/factor mutations or print SDK errors.
 writeReport({status:'stopped-or-not-authorized',project:stageBProject,failureAtStop,lastOperation:checkpoint?.lastOperation??null,lastPasswordOutcome:checkpoint?.lastPasswordOutcome??null,lastTransport:checkpoint?.lastTransport??null,counts:budget?.counts??null,fixtureSessionsClosedOnFailure,smtpClaimsVerifiedUnchanged,newIdentityAfterFailure:false,externalEmailsRequested:0,providerSettingsChangedByRunner:false,providerRollbackReviewRequired:hardeningAuthorized,registrationActivated:false,privateValuesPrinted:false,followup:'Review the exact private checkpoint and fixture sessions before any continuation.'});process.exitCode=1;
}finally{if(db){try{await db.end();}catch{}}try{releaseLock?.();}catch{}}
