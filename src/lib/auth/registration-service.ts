import 'server-only';
import {z} from 'zod';
import {componentClient,runtimeConfig} from '@/lib/supabase/server';
import {signRegistrationCommand} from '../../../supabase/functions/_shared/registration-service-auth.ts';
import {validSigningKey} from '../../../supabase/functions/_shared/registration-intent-auth.ts';
import {persistentReadiness,unavailableReadiness,type PersistentReadiness} from './persistent-registration';

export function usesPersistentRegistration() {return process.env.MITSA_REGISTRATION_ENGINE==='persistent-v1';}
/** Absent switch, target or private signer never falls back to an open path. */
export async function registrationCommand(action:string,payload:Record<string,unknown>):Promise<unknown|null> {
 if(!usesPersistentRegistration())return null;
 const env=runtimeConfig(),project=new URL(env.url).hostname.split('.')[0],secret=process.env.MITSA_REGISTRATION_SERVICE_KEY??'';
 if(!validSigningKey(secret))return null;
 const body=JSON.stringify({version:1,action,payload});
 try {
  const response=await fetch(`${env.url}/functions/v1/mitsa-registration-service`,{method:'POST',body,headers:{'content-type':'application/json',apikey:env.key,origin:env.origin,...await signRegistrationCommand(secret,project,body)},cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(response.status===429)return {error:'rate_limited'};
  if(!response.ok)return null;
  return await response.json();
 }catch{return null;} // Never log a command body, provider error or credentials.
}
export async function persistentRegistrationReadiness(client?:Awaited<ReturnType<typeof componentClient>>):Promise<PersistentReadiness> {
 if(!usesPersistentRegistration())return unavailableReadiness;
 try {
  const result=await (client??await componentClient()).schema('api').rpc('mitsa_persistent_registration_policy');
  const parsed=persistentReadiness.safeParse(result.error?null:result.data);
  return parsed.success?parsed.data:unavailableReadiness;
 }catch{return unavailableReadiness;}
}
export const safeMailStatus=z.object({state:z.enum(['requested','processing','sent','unconfirmed','unavailable'])}).strict();
