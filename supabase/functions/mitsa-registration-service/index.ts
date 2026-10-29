import {createClient} from '@supabase/supabase-js';
import {registrationServiceHandler} from '../_shared/registration-service.ts';

// INACTIVE Stage A source. No deployment or secrets configuration is authorized.
// A production target requires its separately reviewed deployment manifest.
const project='unconfiguredpreviewx',origin='http://127.0.0.1:3000';
const enabled=Deno.env.get('MITSA_REGISTRATION_SERVICE_ENABLED')==='true'
 && Deno.env.get('SUPABASE_URL')===`https://${project}.supabase.co`
 && Deno.env.get('MITSA_APP_ORIGIN')===origin;
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'',publicKey=Deno.env.get('MITSA_PUBLISHABLE_KEY')??'';
const service=enabled&&serviceKey&&publicKey?createClient(`https://${project}.supabase.co`,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}}):null;
const handler=registrationServiceHandler({enabled:Boolean(service),project,origin,signingKey:Deno.env.get('MITSA_REGISTRATION_SERVICE_KEY')??'',authorizeApiKey:key=>Boolean(publicKey)&&key===publicKey,
 async command(action,payload,proof){
  if(!service)return null;
  const result=await service.schema('api').rpc('mitsa_registration_command',{p_action:action,p_payload:payload,p_request_hash:proof.requestHash,p_signed_at:proof.signedAt});
  if(result.error)throw {code:result.error.code};return result.data;
 }
});
Deno.serve(handler);
