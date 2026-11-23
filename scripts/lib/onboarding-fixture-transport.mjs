// Acceptance-harness isolation, NOT an application security-policy replacement.
// All provider calls still use real Auth/RPC authorization in hosted acceptance.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {countedOnboardingFetch,onboardingRequestKind} from './onboarding-counted-fetch.mjs';
const origin='http://127.0.0.1:3000',projectOrigin='https://mjtejwafxriwntweussc.supabase.co';
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
const proof=v=>typeof v==='string'&&/^(pkce_)?[a-f0-9]{32,256}$/.test(v);
const readRpcs=new Set(['mitsa_persistent_registration_policy','mitsa_identity','mitsa_security_status','mitsa_current_terms','mitsa_workspace','mitsa_members','mitsa_locations','mitsa_account_profile']);
const anonymousRpcs=new Set(['mitsa_persistent_registration_policy','mitsa_current_terms']);
const commands=new Set(['prepare','claim-signup','submission-status','continue-verification','renew-verification','authorize-mail','mail-status']);
function claims(token){try{const c=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());assert(uuid(c.sub)&&uuid(c.session_id)&&['aal1','aal2'].includes(c.aal)&&Number.isFinite(c.exp));return c;}catch{throw Error('Observed fixture bearer unavailable');}}
async function bodyOf(input,init){
 const raw=init.body??(input instanceof Request&&input.method!=='GET'?await input.clone().text():undefined);
 if(raw===undefined||raw===null||raw==='')return {};
 if(raw instanceof URLSearchParams)return Object.fromEntries(raw);
 assert(typeof raw==='string'&&Buffer.byteLength(raw)<=65536,'Unapproved provider body');
 try{const value=JSON.parse(raw);assert(value&&typeof value==='object'&&!Array.isArray(value));return value;}catch{throw Error('Unapproved provider body');}
}
/** Factory has no network, key loading, file writes or process effects. The
 * controller supplies a PUBLIC-key-only encrypted writer and verifies every
 * newly observed identity against its preservation reference before accepting
 * the first successful provider response. It never forwards retained secrets.
 */
export function onboardingFixtureTransport(d){
 for(const name of ['fetcher','persistPrivate','assertNewIdentity','assertExecutionReady','assertPersistentAdmission','now'])assert(typeof d[name]==='function','Explicit fixture transport port missing');
 assert(d.publicKey?.startsWith('sb_publishable_'),'Publishable test key missing');
 d={...d,notices:Object.freeze({...d.notices}),recoveryPasswords:Object.freeze({...d.recoveryPasswords})};assert(uuid(d.notices.termsId)&&uuid(d.notices.privacyId),'Approved notices missing');
 const states=new Map();let failed=false;
 for(const label of ['e-a','e-b']){const f=Object.freeze({...d.scope.fixture(label)});assert(f.label===label&&d.scope.assertRecipient(label,f.email)&&typeof f.password==='string'&&typeof d.recoveryPasswords?.[label]==='string'&&d.recoveryPasswords[label]!==f.password,'Immutable fixture credentials missing');
  states.set(label,{fixture:f,access:new Set(),refresh:new Set(),factors:new Map(),challenges:new Set(),permits:new Set(),workspaces:new Map(),mail:new Map(),mailJobs:new Set(),dispatches:new Map(),requestHashes:new Set(),recoverySessions:new Set(),sequence:0,recoveryVerifyAttempts:0,passwordUpdateAccepted:false});
  assert(['fullName','businessName','locationName'].every(name=>typeof f[name]==='string'&&f[name].length>0&&f[name].length<=120),'Approved fictional profile missing');
 }
 const ready=async label=>{assert(!failed&&states.has(label),'Fixture transport stopped or unbound');d.scope.active();await d.assertExecutionReady(label);return states.get(label);};
 const snapshot=s=>({userId:s.userId,intentId:s.intentId,accessToken:s.accessToken,refreshToken:s.refreshToken,signupServerChallenge:s.signupServerChallenge===true,usedDeveloperAllowlist:s.usedDeveloperAllowlist,
  lastRecoveryTokenHash:s.lastRecoveryTokenHash,recoveryVerifyAttempts:s.recoveryVerifyAttempts,passwordUpdateAccepted:s.passwordUpdateAccepted,
  knownAccessTokens:[...s.access],knownRefreshTokens:[...s.refresh],factorIds:[...s.factors.keys()],workspaceIds:[...s.workspaces.keys()],requestHashes:[...s.requestHashes]});
 const persist=async(label,s)=>{const observation={kind:'fixture-provider-observation',label,sequence:++s.sequence,...snapshot(s)};await d.persistPrivate(observation);};
 const actor=(s,headers,required)=>{const value=headers.get('authorization');if(!value||value==='Bearer '+d.publicKey){assert(!required,'Fixture bearer required');return null;}
  assert(value.startsWith('Bearer ')&&s.access.has(value.slice(7)),'Unknown or retained bearer rejected before forwarding');const c=claims(value.slice(7));assert(c.sub===s.userId,'Fixture credential mismatch');return c;};
 const correlated=(s,url,action)=>{const value=url.searchParams.get('redirect_to'),target=new URL(value??'https://invalid.invalid'),requestId=target.searchParams.get('request');assert(url.searchParams.size===1&&target.origin===origin&&target.pathname==='/auth/email'&&uuid(requestId)&&target.href===origin+'/auth/email?request='+requestId&&s.dispatches.get(requestId)===action,'Unbound email request correlation');};
 const observeUser=async(label,s,user,{newIdentity=false}={})=>{
  assert(user&&uuid(user.id)&&user.email===s.fixture.email,'Provider returned a different fixture identity');
  if(!s.userId){assert(newIdentity&&await d.assertNewIdentity(label,user.id)===true,'New fixture identity not proven');s.userId=user.id;}
  assert(s.userId===user.id,'Fixture identity changed');s.emailConfirmed=!!user.email_confirmed_at;
  for(const factor of user.factors??[]){assert(s.factors.has(factor.id)&&factor.factor_type==='totp','Unexpected existing factor');s.factors.set(factor.id,factor.status);}
 };
 const observeSession=async(label,s,value,recovery)=>{
  assert(typeof value.access_token==='string'&&typeof value.refresh_token==='string'&&value.refresh_token.length>0,'Provider session incomplete');await observeUser(label,s,value.user);
  const c=claims(value.access_token);assert(c.sub===s.userId,'Provider session belongs to a different user');s.access.add(value.access_token);s.refresh.add(value.refresh_token);s.accessToken=value.access_token;s.refreshToken=value.refresh_token;
  if(recovery)s.recoverySessions.add(c.session_id);
 };
 const request=async(label,input,init={},signal)=>{
  try{
   const s=await ready(label),kind=onboardingRequestKind(input,init),url=new URL(input instanceof Request?input.url:String(input)),method=String(init.method??input?.method??'GET').toUpperCase(),headers=new Headers(init.headers??input?.headers),body=await bodyOf(input,init);
   assert(!headers.has('x-mitsa-test-fixture')&&!headers.has('x-mitsa-test-authorization'),'Private test header forwarding rejected');
   let c,mutation,command;
   if(url.origin===projectOrigin){assert(headers.get('apikey')===d.publicKey,'Unapproved provider API key');
    if(kind==='signedCommands'){
     actor(s,headers,false);assert(body.version===1&&commands.has(body.action)&&body.payload&&typeof body.payload==='object','Unapproved signed command');command=body.action;
     const nonce=headers.get('x-mitsa-nonce'),signedAt=headers.get('x-mitsa-time');assert(/^[a-f0-9]{64}$/.test(nonce??'')&&/^[a-f0-9]{64}$/.test(headers.get('x-mitsa-signature')??'')&&/^\d{10}$/.test(signedAt??'')&&Math.abs(d.now()/1000-Number(signedAt))<=60,'Signed request envelope unavailable');
     s.requestHashes.add(createHash('sha256').update(nonce).digest('hex'));await persist(label,s);
     const p=body.payload;assert(p.email===s.fixture.email,'Signed command recipient mismatch');
     if(command==='prepare'){await d.assertPersistentAdmission(label);assert(s.signupServerChallenge===true&&p.fullName===s.fixture.fullName&&p.termsId===d.notices.termsId&&p.privacyId===d.notices.privacyId&&p.accepted===true&&uuid(p.submissionId),'Unsigned or stale registration context');s.submissionId=p.submissionId;}
     if(p.intentId!==undefined)assert(p.intentId===s.intentId,'Signed intent mismatch');
     if(p.submissionId!==undefined&&command!=='prepare')assert(p.submissionId===s.submissionId,'Submission mismatch');
     if(command==='claim-signup')assert(uuid(s.intentId)&&typeof s.nonce==='string'&&uuid(p.submissionId)&&p.submissionId===s.submissionId,'Prepared signup claim missing');
     if(command==='authorize-mail'){assert(['signup','recovery'].includes(p.action)&&uuid(p.requestKey),'Unapproved mail action');if(p.action==='recovery')assert(s.userId&&s.emailConfirmed&&s.recoveryServerChallenge===true,'Recovery is not authorized');else assert(uuid(s.intentId)&&p.intentId===s.intentId,'Signup mail intent missing');}
    }else if(kind==='resourceRequests'){
     const name=url.pathname.split('/').at(-1);assert(method==='POST'&&!url.search,'Unapproved resource operation');c=actor(s,headers,!anonymousRpcs.has(name));
     assert(readRpcs.has(name)||['mitsa_prepare_enrollment','mitsa_bind_factor','mitsa_finalize_registration','mitsa_create_workspace'].includes(name),'Unapproved fixture mutation');
     if(['mitsa_workspace','mitsa_members','mitsa_locations'].includes(name))assert([...s.workspaces].some(([id,slug])=>name==='mitsa_workspace'?body.p_slug===slug:body.p_business===id),'Runtime request targets another business');
     if(name==='mitsa_bind_factor')assert(s.factors.has(body.p_factor)&&s.permits.has(body.p_permit),'Unbound factor permit');
     if(name==='mitsa_create_workspace'){assert(c.aal==='aal2'&&s.emailConfirmed&&body.p_name===s.fixture.businessName&&body.p_location===s.fixture.locationName&&body.p_kind==='warehouse'&&uuid(body.p_key),'Unapproved workspace creation');mutation='workspace';}
    }else if(kind==='authRequests'){
     const path=url.pathname;
     if(path==='/auth/v1/settings'||path==='/auth/v1/.well-known/jwks.json'){assert(method==='GET'&&!url.search);actor(s,headers,false);}
     else if(path==='/auth/v1/token'){
      assert(method==='POST'&&url.searchParams.size===1);actor(s,headers,false);
      if(url.searchParams.get('grant_type')==='password')assert(s.userId&&body.email===s.fixture.email&&[s.fixture.password,d.recoveryPasswords[label]].includes(body.password),'Unapproved password identity');
      else assert(url.searchParams.get('grant_type')==='refresh_token'&&s.refresh.has(body.refresh_token),'Unknown or retained refresh token rejected before forwarding');
     }else if(path==='/auth/v1/signup'){
      assert(method==='POST'&&body.email===s.fixture.email&&body.password===s.fixture.password&&body.data?.full_name===s.fixture.fullName&&body.data?.registration_nonce===s.nonce&&s.signupClaimed===true,'Signup not bound to its signed claim');actor(s,headers,false);correlated(s,url,'signup');mutation='account';
      assert(Object.keys(body).every(k=>['email','password','data','gotrue_meta_security','code_challenge','code_challenge_method'].includes(k))&&Object.keys(body.data).every(k=>['full_name','registration_nonce'].includes(k)),'Unexpected signup identity fields');
     }else if(path==='/auth/v1/resend'||path==='/auth/v1/recover'){
      assert(method==='POST'&&body.email===s.fixture.email&&s.userId,'Unapproved authentication recipient');actor(s,headers,false);const action=path.endsWith('/recover')?'recovery':'signup';if(action==='signup')assert(body.type==='signup');correlated(s,url,action);
     }else if(path==='/auth/v1/verify'){
      assert(method==='POST'&&!url.search);actor(s,headers,false);assert(['signup','recovery'].includes(body.type),'Unapproved verification action');
      const message=s.mail.get(body.type);assert(message,'Provider message not observed');
      if(body.type==='signup')assert(body.email===s.fixture.email&&body.token===message.code,'Signup proof not bound to captured provider code');
      else{assert(body.token_hash===message.tokenHash&&proof(body.token_hash),'Unknown recovery token rejected before forwarding');s.recoveryVerifyAttempts++;await persist(label,s);}
     }else if(path==='/auth/v1/user'){
      c=actor(s,headers,true);assert(['GET','PUT'].includes(method)&&!url.search,'Unapproved account operation');
      if(method==='PUT'){assert(c.aal==='aal2'&&s.recoverySessions.has(c.session_id)&&body.password===d.recoveryPasswords[label]&&Object.keys(body).every(k=>['password','code_challenge','code_challenge_method'].includes(k)),'Unapproved password or account change');}
     }else if(path==='/auth/v1/logout'){assert(method==='POST'&&url.searchParams.size<=1&&[null,'local','global'].includes(url.searchParams.get('scope')));actor(s,headers,true);}
     else if(path==='/auth/v1/factors'){
      c=actor(s,headers,true);assert(method==='POST'&&!url.search&&body.factor_type==='totp','Only approved TOTP enrollment is allowed');mutation='factor';
     }else{
      c=actor(s,headers,true);const match=path.match(/^\/auth\/v1\/factors\/([^/]+)(?:\/(challenge|verify))?$/);assert(match&&s.factors.has(match[1])&&!url.search,'Unknown factor target');
      if(!match[2])assert(method==='DELETE'&&s.factors.get(match[1])==='unverified','Verified factor removal is outside this test');
      else{assert(method==='POST');if(match[2]==='verify')assert(s.challenges.has(body.challenge_id)&&/^\d{6}$/.test(body.code),'Unbound factor challenge');}
     }
    }
   }else{
    assert(kind==='captchaRequests'&&typeof body.secret==='string'&&typeof body.response==='string','Unapproved CAPTCHA operation');
   }
   if(mutation==='account')d.scope.reserve('newAccounts',{fixture:label});
   if(mutation==='factor')d.scope.reserve('newFactors',{fixture:label});
   if(mutation==='workspace'){d.scope.reserve('newWorkspaces',{fixture:label});d.scope.reserve('newLocations',{fixture:label});}
   const signals=[d.signal,signal].filter(Boolean),transport=countedOnboardingFetch({fixture:label,scope:d.scope,fetcher:d.fetcher,signal:signals.length?AbortSignal.any(signals):undefined});
   const response=await transport(input,init);if(!response.ok)return response;
   let value;try{value=await response.clone().json();}catch{assert(response.status===204,'Provider success body unavailable');return response;}
   if(kind==='captchaRequests'){
    if(value.success===true){const timestamp=Date.parse(value.challenge_ts),now=d.now();assert(value.hostname==='127.0.0.1'&&['signup','recovery'].includes(value.action)&&Number.isFinite(timestamp)&&timestamp<=now+5000&&now-timestamp<300000,'Invalid server-side challenge evidence');s[value.action==='signup'?'signupServerChallenge':'recoveryServerChallenge']=true;}
   }else if(kind==='signedCommands'){
    if(command==='prepare'&&uuid(value.intentId)&&typeof value.nonce==='string'){assert(!s.intentId||s.intentId===value.intentId,'Intent changed');s.intentId=value.intentId;s.nonce=value.nonce;s.usedDeveloperAllowlist=false;}
    if(command==='claim-signup'&&value.claimed===true)s.signupClaimed=true;
    if(command==='authorize-mail'&&uuid(value.requestId))s.dispatches.set(value.requestId,body.payload.action);
   }else if(kind==='authRequests'){
    if(url.pathname==='/auth/v1/signup'){assert(!value.access_token,'Signup unexpectedly established a session');await observeUser(label,s,value.user??value,{newIdentity:true});}
    else if(value.access_token){const recovery=url.pathname==='/auth/v1/verify'&&body.type==='recovery';await observeSession(label,s,value,recovery);}
    else if(url.pathname==='/auth/v1/user'){await observeUser(label,s,value.user??value);if(method==='PUT')s.passwordUpdateAccepted=true;}
    else if(mutation==='factor'){assert(uuid(value.id)&&value.type==='totp','Unexpected enrollment response');s.factors.set(value.id,'unverified');}
    else if(url.pathname.endsWith('/challenge')){assert(uuid(value.id),'Invalid factor challenge');s.challenges.add(value.id);}
    if(url.pathname.includes('/factors/')&&url.pathname.endsWith('/verify')){const factorId=url.pathname.split('/')[4];s.factors.set(factorId,'verified');}
   }else if(kind==='resourceRequests'){
    const name=url.pathname.split('/').at(-1);if(name==='mitsa_prepare_enrollment'){assert(uuid(value),'Enrollment permit missing');s.permits.add(value);}
    if(name==='mitsa_create_workspace'){assert(uuid(value.id)&&value.slug==='workspace-'+value.id,'Workspace result invalid');s.workspaces.set(value.id,value.slug);}
   }
   await persist(label,s);return response;
  }catch{failed=true;throw Error('Fixture provider operation denied or unconfirmed; private values suppressed; no automatic retry');}
 };
 return {forFixture(label,signal){assert(states.has(label),'Unknown fixture');return (input,init)=>request(label,input,init,signal);},
  async registerProviderMessage(label,message){try{const s=await ready(label);assert(message.recipientBound&&message.intentBound&&message.providerIssued&&message.smtpAccepted&&uuid(message.jobId)&&['signup','recovery'].includes(message.action),'Incomplete delivered provider message');assert(message.fixture===label&&!s.mailJobs.has(message.jobId),'Message fixture/replay mismatch');s.mailJobs.add(message.jobId);if(message.action==='signup')assert(/^\d{6}$/.test(message.code));else{assert(proof(message.tokenHash));s.lastRecoveryTokenHash=message.tokenHash;s.recoveryVerifyAttempts=0;}s.mail.set(message.action,{...message});await persist(label,s);}catch{failed=true;throw Error('Private provider-message binding unavailable; no retry');}},
  privateState(label){assert(states.has(label));return structuredClone(snapshot(states.get(label)));},
  stop(){failed=true;},status(){return {stopped:failed,fixtures:states.size,hostedAcceptanceCompleted:false,policyRelaxed:false};}
 };
}
