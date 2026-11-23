// OFFLINE ONLY infrastructure, never imported by the hosted entry. Provider,
// DB transport and SMTP are isolated in memory; application/forms are real.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {randomUUID,randomInt,createHash} from 'node:crypto';
import {createMessage,encrypt} from 'openpgp';
import {captureGuardSql,securityQueries} from '../../scripts/lib/current-preservation.mjs';
import {onboardingControlSql} from '../../scripts/lib/onboarding-database.mjs';
import {onboardingProbeSql as probes} from '../../scripts/lib/onboarding-probe-sql.mjs';
import {onboardingWorkerSql as w} from '../../scripts/lib/onboarding-mail-bridge.mjs';
import {cSql} from '../../scripts/lib/stage-c-sql.mjs';
import {verifyRegistrationCommand} from '../../supabase/functions/_shared/registration-service-auth.ts';
import {totp} from './totp.ts';
const hash=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
const deny=()=>Response.json({code:'42501',message:'OFFLINE authorization denied'},{status:403});
export async function offlineOnboardingInfrastructure(d){
 const users=new Map(),sessions=new Map(),refresh=new Map(),jobs=[],intents=new Map(),signedNonces=new Set(),requests=[],sqlCalls=[],smtp=[],faults=d.faults??{};let enabled=false,workerId,connected=false;
 const original={singleton:true,profile:'isolated-development',project_ref:'mjtejwafxriwntweussc',origin:'http://127.0.0.1:3000',session_policy:'strict',admission_enabled:false,delivery_enabled:false,session_policy_ready:false,transport_ready:false,approval_generation:null,terms_id:null,privacy_id:null};let control=structuredClone(original);
 const metadata=structuredClone(d.metadata),registry=d.registry,basePayload={format:'mitsa-preservation-v2',registry,controls:{admission:false,delivery:false,transport:false,security:false,policy:'strict',termsSelected:false,privacySelected:false},rows:{},identities:{},security:metadata};
 for(const r of registry)(r.schema==='auth'?basePayload.identities:basePayload.rows)[r.schema+'.'+r.table]=[];
 const getRows=table=>{const all=[...users.values()],items=[];
  for(const u of all){let values=[];if(table==='auth.users')values=[{id:u.id,email:u.email,verified:u.verified,password:u.password}];
   if(table==='auth.identities')values=[{id:u.identity,user:u.id}];if(table==='auth.mfa_factors'&&u.factor)values=[u.factor];
   if(['private.account_profiles','private.account_security'].includes(table)&&u.verified)values=[{id:u.id,verified:u.verified,bound:u.bound??false}];
   if(table==='private.factor_bindings'&&u.bound)values=[{id:u.factor.id,bound:true}];if(table==='private.security_permits'&&u.permit)values=[{id:u.permit}];
   if(table==='private.account_registration_policy')values=[{id:u.id,intent:u.intent}];
   if(table==='private.legal_acceptances'&&u.verified)values=d.notices.map(n=>({id:u.id+n.id}));
   if(['private.businesses','private.memberships','private.shops'].includes(table)&&u.business)values=[{id:table==='private.shops'?u.location:u.business,owner:u.id,name:u.businessName}];
   if(table==='private.access_commands'&&u.business)values=[{id:u.business,user:u.id}];
   for(const item of values){const row={key:hash(item.id),digest:hash(item)};if(table.startsWith('auth.'))Object.assign(row,{legacy_digest:hash(item),...(table==='auth.users'?{protected_digest:hash(item),activity_digest:hash('OFFLINE-ACTIVITY')}:{})});items.push(row);}
  }
  if(table==='private.registration_intents')for(const i of intents.values())items.push({key:hash(i.id),digest:hash(i)});
  if(['private.auth_mail_dispatch','private.isolated_auth_mail'].includes(table))for(const j of jobs)items.push({key:hash(table.endsWith('dispatch')?j.id:j.captureId),digest:hash(j)});
  if(table==='private.registration_requests')for(const value of signedNonces)items.push({key:hash(value),digest:hash(value)});
  return items.sort((a,b)=>a.key.localeCompare(b.key));
 };
 const actor=headers=>{const v=new Headers(headers).get('authorization')?.slice(7),s=sessions.get(v);return s?.live?{...s,user:users.get(s.email)}:null;};
 const publicUser=u=>({id:u.id,email:u.email,aud:'authenticated',role:'authenticated',app_metadata:{provider:'email',providers:['email']},user_metadata:{full_name:u.fullName},created_at:new Date().toISOString(),...(u.verified?{email_confirmed_at:new Date().toISOString()}:{}),factors:u.factor?[{id:u.factor.id,factor_type:'totp',status:u.factor.status,friendly_name:'OFFLINE authenticator'}]:[]});
 const session=(u,aal='aal1',existing)=>{const sid=existing?.sid??randomUUID(),seconds=Math.floor(Date.now()/1000),token=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:u.id,session_id:sid,aal,aud:'authenticated',exp:seconds+3600,iat:seconds,amr:[{method:'password',timestamp:seconds},...(aal==='aal2'?[{method:'totp',timestamp:seconds}]:[])]})).toString('base64url')+'.OFFLINE';
  const rt=randomUUID(),s={sid,email:u.email,aal,live:true,token,rt};sessions.set(token,s);refresh.set(rt,s);return {access_token:token,refresh_token:rt,token_type:'bearer',expires_in:3600,user:publicUser(u)};};
 const identity=a=>({userId:a.user.id,email:a.user.email,verified:a.user.verified,mfaReady:a.aal==='aal2'&&a.user.bound===true,workspaces:a.user.business?[{id:a.user.business,slug:'workspace-'+a.user.business,name:a.user.businessName,role:'owner',requiresMfa:a.aal!=='aal2'}]:[]});
 const policy=()=>({version:1,admission:control.admission_enabled?'available':'closed',delivery:control.delivery_enabled?'available':'closed',policy:{termsId:d.notices[0].id,privacyId:d.notices[1].id,termsVersion:'isolated-persistent-synthetic-v1',privacyVersion:'isolated-persistent-synthetic-v1',termsContent:d.notices[0].content,privacyContent:d.notices[1].content,termsHash:d.notices[0].sha256,privacyHash:d.notices[1].sha256,status:'test'}});
 const queue=async(u,action,requestId)=>{const createdAt=new Date().toISOString(),code=String(randomInt(100000,1000000)),tokenHash=hash(randomUUID()),captureId=randomUUID(),decoded={email:u.email,userId:u.id,type:action,tokenHash,origin:original.origin,...(action==='signup'?{code}:{})};
  if(faults.recipient)decoded.email='unapproved@offline.invalid';
  const cipher=await encrypt({message:await createMessage({text:JSON.stringify(decoded)}),encryptionKeys:d.publicKey,format:'binary'});jobs.push({id:requestId,captureId,action,encryptedPayload:Buffer.from(cipher).toString('base64'),createdAt,databaseNow:createdAt,expiresAt:new Date(Date.parse(createdAt)+3600000).toISOString(),recipientHash:hash(u.email),email:u.email,userId:u.id,intent:u.intent,code,tokenHash,state:'queued'});};
 const fetcher=async(input,init={})=>{
  const url=new URL(input instanceof Request?input.url:String(input)),method=init.method??'GET',headers=new Headers(init.headers),text=init.body?String(init.body):'',body=text?/^[{\[]/.test(text)?JSON.parse(text):Object.fromEntries(new URLSearchParams(text)):{},a=actor(headers);requests.push({host:url.hostname,path:url.pathname,method,phase:d.phase?.()??'not-recorded'});
  if(faults.provider)throw Error('OFFLINE injected provider failure');
  if(url.hostname==='api.supabase.com'){if(method==='POST')enabled=JSON.parse(text)[0].value==='true';return Response.json(method==='GET'?[{name:'MITSA_REGISTRATION_SERVICE_ENABLED',value:String(enabled)}]:{});}
  if(url.hostname==='challenges.cloudflare.com')return Response.json({success:true,hostname:'127.0.0.1',action:String(body.response).includes('recovery')?'recovery':'signup',challenge_ts:new Date().toISOString()});
  if(url.pathname.endsWith('mitsa-registration-service')){
   assert(enabled);const verified=await verifyRegistrationCommand(d.signingKey,'mjtejwafxriwntweussc',headers,new TextEncoder().encode(text));if(!verified)return deny();
   const nonce=headers.get('x-mitsa-nonce'),nonceHash=hash(nonce);if(signedNonces.has(nonceHash))return deny();signedNonces.add(nonceHash);
   const p=body.payload,label=d.fixtures.find(f=>f.email===p.email)?.label;assert(label);let i=intents.get(p.email);
   if(body.action==='prepare'){assert(control.admission_enabled&&!i);i={id:randomUUID(),submissionId:p.submissionId,email:p.email,nonce:hash(randomUUID()),claimed:false};intents.set(p.email,i);return Response.json({submissionId:p.submissionId,intentId:i.id,nonce:i.nonce,state:'prepared',creationDeadline:new Date(Date.now()+600000).toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString()});}
   if(body.action==='claim-signup'){assert(i&&!i.claimed);i.claimed=true;return Response.json({claimed:true});}
   if(body.action==='authorize-mail'){assert(i);i.requestId=randomUUID();i.action=p.action;return Response.json({requestId:i.requestId,sendAllowed:true,expiresAt:new Date(Date.now()+3600000).toISOString()});}
   if(body.action==='mail-status')return Response.json({state:'sent'});
   if(body.action==='submission-status')return Response.json({state:users.get(p.email)?.verified?'verified':'pending-verification'});
   throw Error('OFFLINE unknown signed command');
  }
  if(url.pathname==='/auth/v1/settings')return Response.json({disable_signup:false,mailer_autoconfirm:false});
  if(url.pathname==='/auth/v1/.well-known/jwks.json')return Response.json({keys:[]});
  if(url.pathname==='/auth/v1/signup'){
   const f=d.fixtures.find(f=>f.email===body.email),i=intents.get(body.email);assert(f&&i?.claimed&&body.data.registration_nonce===i.nonce&&!users.has(f.email));const u={...f,id:randomUUID(),identity:randomUUID(),intent:i.id,verified:false};users.set(f.email,u);await queue(u,'signup',i.requestId);return Response.json(publicUser(u));
  }
  if(url.pathname==='/auth/v1/recover'){const u=users.get(body.email);assert(u?.verified);await queue(u,'recovery',intents.get(u.email).requestId);return Response.json({});}
  if(url.pathname==='/auth/v1/verify'){
   const j=jobs.find(j=>body.type===j.action&&(body.type==='signup'?j.email===body.email&&j.code===body.token:j.tokenHash===body.token_hash));
   if(!j||j.used||Date.now()>=Date.parse(j.expiresAt))return Response.json({error_code:'otp_expired',msg:'OFFLINE expired proof'},{status:403});j.used=true;const u=users.get(j.email);u.verified=true;return Response.json(session(u));
  }
  if(url.pathname==='/auth/v1/token'){
   if(url.searchParams.get('grant_type')==='refresh_token'){const s=refresh.get(body.refresh_token);return s?.live?Response.json(session(users.get(s.email),s.aal,s)):Response.json({error_code:'refresh_token_not_found',msg:'OFFLINE revoked'},{status:400});}
   const u=users.get(body.email);if(!u?.verified||body.password!==u.password)return Response.json({error_code:'invalid_credentials',msg:'OFFLINE invalid'},{status:400});return Response.json(session(u));
  }
  if(url.pathname==='/auth/v1/logout'){if(!a)return new Response(null,{status:401});for(const s of sessions.values())if(s.sid===a.sid||url.searchParams.get('scope')==='global'&&s.email===a.email)s.live=false;return new Response(null,{status:204});}
  if(url.pathname==='/auth/v1/user'){if(!a)return deny();if(method==='PUT'){assert(a.aal==='aal2'&&body.password===d.recoveryPasswords[a.user.label]);a.user.password=body.password;}return Response.json(publicUser(a.user));}
  if(url.pathname==='/auth/v1/factors'){assert(a);a.user.factor={id:randomUUID(),secret:'JBSWY3DPEHPK3PXP',status:'unverified'};return Response.json({id:a.user.factor.id,type:'totp',totp:{secret:a.user.factor.secret,uri:'otpauth://totp/OFFLINE?secret='+a.user.factor.secret,qr_code:'<svg/>'}});}
  if(url.pathname.includes('/factors/')){assert(a&&url.pathname.includes(a.user.factor.id));if(url.pathname.endsWith('/challenge')){a.user.challenge=randomUUID();return Response.json({id:a.user.challenge,type:'totp',expires_at:Math.floor(Date.now()/1000)+300});}assert(body.challenge_id===a.user.challenge&&body.code===totp(a.user.factor.secret));a.user.factor.status='verified';return Response.json(session(a.user,'aal2',a));}
  if(url.pathname==='/rest/v1/businesses')return Response.json([]);
  const name=url.pathname.split('/').at(-1);
  if(name==='mitsa_persistent_registration_policy')return Response.json(policy());
  if(!a)return deny();const u=a.user,own=identity(a);
  if(name==='mitsa_identity')return Response.json(own);
  if(name==='mitsa_current_terms')return Response.json({accepted:u.verified,id:d.notices[0].id});
  if(name==='mitsa_finalize_registration')return Response.json(true);
  if(name==='mitsa_security_status')return Response.json({ready:own.mfaReady,recent:true,initialized:!!u.bound,factors:u.bound?[{id:u.factor.id,active:true}]:[],pendingRemovals:[],currentFactorId:u.bound?u.factor.id:null});
  if(name==='mitsa_prepare_enrollment'){u.permit=randomUUID();return Response.json(u.permit);}
  if(name==='mitsa_bind_factor'){assert(a.aal==='aal2'&&body.p_permit===u.permit&&body.p_factor===u.factor.id);u.bound=true;return Response.json({ok:true});}
  if(name==='mitsa_create_workspace'){assert(own.mfaReady&&!u.business);u.business=randomUUID();u.location=randomUUID();u.businessName=body.p_name;u.locationName=body.p_location;return Response.json({id:u.business,slug:'workspace-'+u.business});}
  if(['mitsa_workspace','mitsa_members','mitsa_locations'].includes(name)){
   if(!own.mfaReady||!u.business||(name==='mitsa_workspace'?body.p_slug!=='workspace-'+u.business:body.p_business!==u.business))return deny();
   if(name==='mitsa_workspace')return Response.json({id:u.business,name:u.businessName,slug:'workspace-'+u.business,role:'owner',locations:[{id:u.location,name:u.locationName,kind:'warehouse'}],canViewFinancial:true,adminFinancialAccess:null,country:'PH',currency:'PHP',timezone:'Asia/Manila'});return Response.json([]);
  }
  if(name==='mitsa_member_update')return deny();
  if(name==='mitsa_account_profile')return Response.json({fullName:u.fullName});
  throw Error('OFFLINE unsupported RPC '+name);
 };
 const workspace=u=>u.business?[{id:u.business,slug:'workspace-'+u.business,role:'owner',active:true,primaryOwner:!faults.owner,locationMatches:true,digest:hash(u.business),membershipProtected:hash(u.business+u.id)}]:[];
 const query=async(sql,args=[])=>{sqlCalls.push(sql);assert(connected);let rows=[];
  if(sql.startsWith('begin')||['commit','rollback'].includes(sql))return {rows};
  if(sql===captureGuardSql)rows=[{marker:original.project_ref==='mjtejwafxriwntweussc'?'fireworks-foundation-proof-01a12e38':'WRONG',hmac_available:true,release_closed:true,pilot_closed:true,registration_auth_usage:false,registration_private_create:false,controls:basePayload.controls,registry}];
  else if(Object.values(securityQueries).includes(sql))rows=metadata[Object.keys(securityQueries).find(k=>securityQueries[k]===sql)];
  else if(sql.includes('extensions.hmac')&&sql.includes(' t order by')||sql.includes('extensions.hmac')&&sql.includes(' t where')){const m=sql.match(/from "([a-z_]+)"\."([a-z_]+)" t/);assert(m);rows=getRows(m[1]+'.'+m[2]);if(faults.preservation&&m[1]==='auth'&&m[2]==='users'&&!sql.includes(' where '))rows=[...rows,{key:hash('unexpected'),digest:hash('unexpected')}];}
  else if(sql===onboardingControlSql.inspect)rows=[{control:structuredClone(control),pending:jobs.filter(j=>!['smtp-accepted','unconfirmed'].includes(j.state)).length,custom_auth_triggers:0}];
  else if(sql===onboardingControlSql.admission)rows=[{...control,healthy:!!workerId}];
  else if(sql===onboardingControlSql.cohort)rows=[...intents.values()].map(i=>({id:users.get(i.email)?.id??null,intent_id:i.id,submission_id:i.submissionId}));
  else if(sql===onboardingControlSql.dispatches)rows=jobs.map(j=>({id:j.id,capture_id:j.captureId}));
  else if(sql===onboardingControlSql.businesses)rows=[...users.values()].filter(u=>u.business).map(u=>({id:u.business}));
  else if(sql===cSql.notices)rows=d.notices.map(n=>({...n,content_hash:n.sha256,version:'isolated-persistent-synthetic-v1',status:'test'}));
  else if(sql===probes.absent)rows=users.has(args[0])?[{id:users.get(args[0]).id}]:[];
  else if(sql===probes.registration){const u=users.get(args[0]);rows=u?[{id:u.id,email_confirmed:u.verified,active:true,super_admin:false,is_anonymous:false,intent_id:u.intent,terms_id:d.notices[0].id,privacy_id:d.notices[1].id,session_policy:'strict',emergency_blocked:false,intent_bound:true,generation_bound:true,profile_bound:true,memberships:u.business?1:0,platform_operator:false}]:[];}
  else if(sql===probes.session){const s=[...sessions.values()].findLast(s=>s.sid===args[0]&&users.get(s.email).id===args[1]&&s.live);rows=[{live:!!s,aal:s?.aal,database_seconds:Math.floor(Date.now()/1000)}];}
  else if(sql===probes.mfa){const u=[...users.values()].find(u=>u.id===args[0]);rows=[{factors:u.factor?[{id:u.factor.id,type:'totp',status:u.factor.status,trusted:!!u.bound,protected:hash(u.factor),bindingProtected:hash(u.bound??false),accountProtected:hash(u.bound??false)}]:[]}];}
  else if(sql===probes.workspace)rows=[{workspaces:workspace([...users.values()].find(u=>u.id===args[0]))}];
  else if(sql===probes.queue)rows=[{invalid_jobs:0}];
  else if(sql===probes.health)rows=[{healthy:!!workerId&&control.transport_ready}];
  else if(sql===probes.capacity)rows=[{hourly:jobs.length,daily:jobs.length,recipient_recent:false,database_now:new Date().toISOString()}];
  else if(sql===probes.dispatch){const j=jobs.find(j=>j.id===args[0]);rows=j?[{id:j.id,intent_id:j.intent,provider_user_id:j.userId,capture_id:j.captureId,recipient_hash:j.recipientHash,generation:d.generation,state:j.state,action:j.action,created_at:j.createdAt,expires_at:j.expiresAt}]:[];}
  else if(sql===w.acquire){workerId=args[1];rows=[{ok:!faults.worker}];}
  else if(sql===w.heartbeat){control.transport_ready=!!args[2];rows=[{ok:!faults.worker}];}
  else if(sql===w.shutdown){control.transport_ready=false;rows=[{ok:true}];}
  else if(sql===w.claim){const j=jobs.find(j=>j.state==='queued');if(j)j.state='claimed';rows=[{job:j?Object.fromEntries(['id','captureId','action','encryptedPayload','createdAt','databaseNow','expiresAt','recipientHash'].map(k=>[k,j[k]])):null}];}
  else if(sql===w.authorized)rows=[{ok:control.delivery_enabled&&jobs.find(j=>j.id===args[2])?.state==='claimed'}];
  else if(sql===w.complete||sql===w.uncertain){jobs.find(j=>j.id===args[2]).state=sql===w.complete?'smtp-accepted':'unconfirmed';rows=[{ok:true}];}
  else if(sql===d.controlSources.delivery){Object.assign(control,{delivery_enabled:true,approval_generation:d.generation});rows=[structuredClone(control)];}
  else if(sql===d.controlSources.admission){Object.assign(control,{admission_enabled:true,session_policy_ready:true});rows=[structuredClone(control)];}
  else if(sql===d.controlSources.stop){Object.assign(control,{admission_enabled:false,delivery_enabled:false,transport_ready:false,session_policy_ready:false});rows=[{stopped_controls:control.approval_generation?1:0}];}
  else if(sql===cSql.restore){control=JSON.parse(args[0]);rows=[structuredClone(control)];}
  else throw Error('OFFLINE unmodeled SQL');return {rows};
 };
 const client={on(){},connect:async()=>{assert(!connected);connected=true;},query,end:async()=>{if(!faults.cleanup)connected=false;},connection:{stream:{get destroyed(){return !connected;},destroy(){connected=false;}}}};
 const makeSmtpTransport=()=>({verify:async()=>{if(faults.smtp)throw Error('OFFLINE SMTP failure');return true;},sendMail:async m=>{assert(m.envelope.to.length===1&&d.fixtures.some(f=>f.email===m.envelope.to[0]));smtp.push({recipient:m.envelope.to[0],subject:m.subject});if(faults.smtp||faults.smtpSend)throw Error('OFFLINE uncertain delivery');return {accepted:[m.envelope.to[0]],rejected:[]};},close(){}});
 const server=createServer(async(req,res)=>{try{const chunks=[];for await(const c of req)chunks.push(c);const data=JSON.parse(Buffer.concat(chunks).toString());const r=await fetcher(data.url,{method:data.method,headers:data.headers,...(data.body?{body:data.body}:{})});res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));}catch{res.writeHead(500,{'content-type':'application/json'});res.end('{"error":"OFFLINE infrastructure request failed"}');}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {client,fetcher,makeSmtpTransport,basePayload,faults,users,jobs,smtp,sqlCalls,requests,serverOrigin:'http://127.0.0.1:'+server.address().port,status:()=>({connected,enabled,controlsDisabled:!control.admission_enabled&&!control.delivery_enabled&&!control.transport_ready&&!control.session_policy_ready}),close:async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}
