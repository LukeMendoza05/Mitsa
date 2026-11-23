// Future source-bound process launcher. No launch, environment read or I/O on import.
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {randomBytes,createHash} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {superviseTransportChild} from './registration-transport-lifecycle.mjs';
import {nextParentPrivateChannel} from './onboarding-next-private-channel.mjs';
const sha=v=>createHash('sha256').update(v).digest('hex');
const bootstrap=['SystemRoot','WINDIR','ComSpec','PATH','PATHEXT','TEMP','TMP','USERPROFILE','LOCALAPPDATA','APPDATA'];
const serverSecrets=['AUTH_FLOW_KEY','MFA_ENROLLMENT_KEY','MITSA_REGISTRATION_SERVICE_KEY','MITSA_TURNSTILE_SITE_KEY','MITSA_TURNSTILE_SECRET_KEY'];
/** Build a PRIVATE test-server env. Never inherit operator/admin/SMTP credentials. */
export function onboardingNextEnvironment(values,platform){
 for(const key of ['TEST_AUTH_ADMIN_KEY','TEST_DATABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEY','DATABASE_URL'])assert(!values[key],'Administrative credentials are forbidden in Next');
 assert(values.SUPABASE_URL==='https://mjtejwafxriwntweussc.supabase.co'&&values.APP_ORIGIN==='http://127.0.0.1:3000','Unapproved Next target');
 assert(values.SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_'),'Publishable key required');
 for(const name of ['AUTH_FLOW_KEY','MFA_ENROLLMENT_KEY']){const key=values[name]??'',bytes=Buffer.from(key,'base64url');assert(bytes.length===32&&bytes.toString('base64url')===key,'Private application key unavailable');}
 assert(/^[a-f0-9]{64}$/.test(values.MITSA_REGISTRATION_SERVICE_KEY??''),'Private signer unavailable');
 assert(values.MITSA_PUBLIC_CAPTCHA_PROVIDER==='turnstile'&&values.MITSA_TURNSTILE_SITE_KEY&&values.MITSA_TURNSTILE_SECRET_KEY,'Real server CAPTCHA configuration required');
 const env={};for(const name of bootstrap)if(platform[name])env[name]=platform[name];
 for(const name of serverSecrets)env[name]=values[name];
 return {...env,NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',SUPABASE_URL:values.SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY:values.SUPABASE_PUBLISHABLE_KEY,
  APP_ORIGIN:values.APP_ORIGIN,MITSA_REGISTRATION_ENGINE:'persistent-v1',MITSA_DEPLOYMENT_PROFILE:'isolated-development',MITSA_PUBLIC_CAPTCHA_PROVIDER:'turnstile',MITSA_AUTH_MAIL_MODE:'isolated-capture',MITSA_REGISTRATION_SERVICE_ENABLED:'false'};
}
/** The caller must pass the new reviewed D/E scope; no old launch is reusable.
 * Child entry must wait for the nonce handshake before doing any app work.
 * @param {{scope:any,root:string,entry:string,entrySha256:string,reviewSha256:string,environment:any,claimedAt:string,notAfter:string,bindings:any[],onPrivateObservation?:Function,onPrivateFailure?:Function,spawn?:any,startupMs?:number,shutdownMs?:number}} options
 */
export async function launchOnboardingNext({scope,root,entry,entrySha256,reviewSha256,environment,claimedAt,notAfter,bindings,onPrivateObservation=async()=>false,onPrivateFailure=()=>{},spawn=fork,startupMs=30000,shutdownMs=10000}){
 scope.active();assert.equal(scope.root,root);assert.equal(scope.reviewSha256,reviewSha256);assert.equal(sha(readFileSync(entry)),entrySha256,'Next entry source changed');
 assert(Number.isInteger(startupMs)&&startupMs>0&&startupMs<=30000);assert(Number.isInteger(shutdownMs)&&shutdownMs>0&&shutdownMs<=10000);
 const allowedEnv=new Set([...bootstrap,...serverSecrets,'NODE_ENV','NEXT_TELEMETRY_DISABLED','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','APP_ORIGIN','MITSA_REGISTRATION_ENGINE','MITSA_DEPLOYMENT_PROFILE','MITSA_PUBLIC_CAPTCHA_PROVIDER','MITSA_AUTH_MAIL_MODE','MITSA_REGISTRATION_SERVICE_ENABLED']);
 assert(Object.keys(environment).every(k=>allowedEnv.has(k)),'Unreviewed Next environment variable');
 assert.equal(environment.MITSA_REGISTRATION_ENGINE,'persistent-v1');assert.equal(environment.MITSA_DEPLOYMENT_PROFILE,'isolated-development');
 const path=join(root,'next-attempt.json');assert(!existsSync(path),'Next launch already consumed');
 assert(bindings.length===2&&new Set(bindings.map(b=>b.label)).size===2&&bindings.every(b=>['e-a','e-b'].includes(b.label)&&/^[a-f0-9]{64}$/.test(b.authorization)),'Private fixture bindings unavailable');
 const nonce=randomBytes(32).toString('hex');scope.reserve('nextServerLaunches');
 const attempt={entrySha256,reviewSha256,claimedAt,parentPid:process.pid,nonceSha256:sha(nonce),childPid:null};
 writeFileSync(path,JSON.stringify(attempt),{flag:'wx',mode:0o600,flush:true});
 let child,terminal,startupTimer,privateTimer,privateChannel,privateFailure=false,stopped=false,stopAcknowledged=false;
 try{
  child=spawn(entry,['--child'],{env:{...environment,MITSA_ONBOARDING_NEXT_ROOT:root},execArgv:[],silent:true,windowsHide:true});
  attempt.childPid=child.pid??null;writeFileSync(path,JSON.stringify(attempt),{mode:0o600,flush:true});
  terminal=superviseTransportChild(child,{claimedAt,notAfter,maximumMs:(scope.limits.runtimeSeconds-30)*1000});
  privateChannel=nextParentPrivateChannel({ipc:child,nonce,handle:onPrivateObservation,onFailure:()=>{privateFailure=true;try{onPrivateFailure();}catch{}if(child.connected)child.send({kind:'stop-next',nonce},()=>{});privateTimer??=setTimeout(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');},shutdownMs);}});
  terminal.then(()=>{clearTimeout(privateTimer);privateChannel.close();});
  const ready=new Promise((resolve,reject)=>{
   startupTimer=setTimeout(()=>reject(Error('Next startup deadline exceeded')),startupMs);
   child.once('error',()=>reject(Error('Next spawn unavailable')));
   child.on('message',m=>{if(m?.kind==='next-ready')resolve(m);if(m?.kind==='next-failed')reject(Error('Next startup rejected'));if(m?.kind==='next-stopped'){stopAcknowledged=true;privateChannel.expectDisconnect();}});
   terminal.then(()=>reject(Error('Next exited before readiness')));
  });
  child.send({kind:'start-next',nonce,bindings},()=>{});
  let observed;
  try{observed=await ready;assert.equal(observed.origin,'http://127.0.0.1:3000');}catch{
   if(child.pid&&child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');
   const t=await terminal;writeFileSync(join(root,'next-terminal.json'),JSON.stringify({...t,startupFailed:true,privateValuesPrinted:false}),{flag:'wx',mode:0o600,flush:true});
   throw Error('Next startup unconfirmed; launch remains spent');
  }finally{clearTimeout(startupTimer);}
  let result;
  return {origin:observed.origin,completion:terminal.then(t=>({...t,privateFailure})),async deliverProviderMessage(label,message){scope.active();assert(['e-a','e-b'].includes(label)&&message?.fixture===label,'Private message fixture mismatch');return privateChannel.request({label,message});},async stop(){
   if(result)return result;
   result=(async()=>{let stopTimedOut=false;const stopTimer=setTimeout(()=>{stopTimedOut=true;if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');},shutdownMs);
    if(!stopped){stopped=true;if(child.connected)child.send({kind:'stop-next',nonce},()=>{});}
    const t=await terminal;clearTimeout(stopTimer);let absent=false;try{process.kill(child.pid,0);}catch(e){if(e.code==='ESRCH')absent=true;}
    const r={...t,stopAcknowledged,stopTimedOut,childAbsent:absent,privateFailure,privateValuesPrinted:false};writeFileSync(join(root,'next-terminal.json'),JSON.stringify(r),{flag:'wx',mode:0o600,flush:true});
    assert(t.observedExit&&t.code===0&&t.signal===null&&t.streamsClosed&&!t.streamError&&!t.expired&&!stopTimedOut&&!privateFailure&&stopAcknowledged&&absent,'Next termination unconfirmed');return r;
   })();return result;
  }};
 }catch{clearTimeout(startupTimer);clearTimeout(privateTimer);privateChannel?.close();if(child?.pid&&child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');if(terminal)await terminal;throw Error('Onboarding Next launch failed; no automatic retry');}
}
