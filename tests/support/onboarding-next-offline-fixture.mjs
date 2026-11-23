// OFFLINE actual-framework fixture. Never load real provider credentials.
import net from 'node:net';
import {syncBuiltinESMExports} from 'node:module';
import {startOnboardingNext} from '../../scripts/lib/onboarding-next-runtime.mjs';
import {onboardingFixtureTransport} from '../../scripts/lib/onboarding-fixture-transport.mjs';
import {disconnectCompletedTransportChild} from '../../scripts/lib/registration-transport-lifecycle.mjs';
const originalConnect=net.Socket.prototype.connect;let outsideAttempts=0;
net.Socket.prototype.connect=function(...args){
 let value=args[0];if(Array.isArray(value))value=value[0];
 const host=typeof value==='object'&&value!==null?value.host??value.hostname:typeof value==='number'?args[1]:null;
 const localPipe=typeof value==='object'&&typeof value.path==='string'||typeof value==='string'&&(/^(?:\\\\\.\\pipe\\|\/)/.test(value));
 if(!localPipe&&host!==undefined&&!['127.0.0.1','localhost','::1'].includes(String(host))){outsideAttempts++;throw Error('OFFLINE external socket denied');}
 if(!localPipe&&host===null){outsideAttempts++;throw Error('OFFLINE unknown socket denied');}
 return originalConnect.apply(this,args);
};
syncBuiltinESMExports();
Object.assign(process.env,{NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',SUPABASE_URL:'https://mjtejwafxriwntweussc.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_OFFLINE_FRAMEWORK_ONLY',APP_ORIGIN:'http://127.0.0.1:3000',MITSA_REGISTRATION_ENGINE:'persistent-v1',MITSA_DEPLOYMENT_PROFILE:'isolated-development',MITSA_REGISTRATION_SERVICE_ENABLED:'false',MITSA_REGISTRATION_SERVICE_KEY:'0'.repeat(64),MITSA_PUBLIC_CAPTCHA_PROVIDER:'turnstile',MITSA_TURNSTILE_SITE_KEY:'',MITSA_TURNSTILE_SECRET_KEY:'',AUTH_FLOW_KEY:'A'.repeat(43),MFA_ENROLLMENT_KEY:'A'.repeat(43)});
for(const name of ['TEST_AUTH_ADMIN_KEY','TEST_DATABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEY','DATABASE_URL'])delete process.env[name];
let server,fixtureTransport,privateObservations=0,closed=false,phase='import-next';const counts={},failures=[];
const close=async()=>{if(closed)return;closed=true;try{await server?.stop();fixtureTransport?.stop();}catch{process.exitCode=1;failures.push('cleanup');}finally{
 if(process.connected)process.send({kind:'stopped',counts,failures,outsideAttempts,privateObservations,credentialGuardStopped:fixtureTransport?.status().stopped===true},()=>disconnectCompletedTransportChild(process,emergency));else disconnectCompletedTransportChild(process,emergency);
}};
const emergency=()=>{process.exitCode=1;void close();};process.once('disconnect',emergency);
try{
 const next=(await import('next')).default;
 const fakeProvider=async(input)=>{
  const url=new URL(typeof input==='string'?input:input.url);
  if(url.pathname==='/auth/v1/settings')return Response.json({disable_signup:false,mailer_autoconfirm:false});
  if(url.pathname==='/rest/v1/rpc/mitsa_persistent_registration_policy')return Response.json({version:1,admission:'closed',delivery:'closed',policy:null});
  throw Error('OFFLINE unapproved provider fixture');
 };
 const scope={active(){},reserve(kind){counts[kind]=(counts[kind]??0)+1;},fixture(label){return {label,email:'offline+'+label+'@gmail.com',password:'OFFLINE-ONLY',fullName:'Synthetic',businessName:'Synthetic Business',locationName:'Synthetic Warehouse'};},assertRecipient(label,email){return email==='offline+'+label+'@gmail.com';}};
 fixtureTransport=onboardingFixtureTransport({scope,publicKey:process.env.SUPABASE_PUBLISHABLE_KEY,fetcher:fakeProvider,now:()=>Date.now(),persistPrivate:async()=>{privateObservations++;},assertNewIdentity:async()=>false,assertExecutionReady:async()=>{},assertPersistentAdmission:async()=>{throw Error('OFFLINE registration stays closed');},notices:{termsId:'10000000-0000-4000-8000-000000000001',privacyId:'10000000-0000-4000-8000-000000000002'},recoveryPasswords:{'e-a':'OFFLINE-REPLACEMENT-A','e-b':'OFFLINE-REPLACEMENT-B'}});
 phase='prepare-next';server=await startOnboardingNext({assertOwnedLaunch:async()=>{},scope,bindings:[{label:'e-a',authorization:'c'.repeat(64)}],fetcher:fakeProvider,fixtureTransportFactory:(label,signal)=>fixtureTransport.forFixture(label,signal),
  createApplication:options=>next({...options,dev:false,dir:process.cwd()}),port:0,onFailure:category=>failures.push(category)});
 phase='ready';process.once('message',async message=>{if(message?.kind!=='stop')process.exitCode=1;await close();});
 process.send?.({kind:'ready',origin:server.origin});
}catch{process.exitCode=1;if(process.connected)process.send({kind:'failed',phase,counts,failures,outsideAttempts});await close();}
