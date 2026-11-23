import "server-only";
import { z } from "zod";
import { componentClient, runtimeConfig } from "@/lib/supabase/server";
import { signIntentRequest, validSigningKey } from "../../../supabase/functions/_shared/registration-intent-auth.ts";
import {registrationErrorCode,type RegistrationErrorCode} from "./feedback";
import {registrationPolicyMode,registrationIntentionallyClosed} from "./registration-policy";
import {signupChallengeConfig,requiresSignupChallenge} from './signup-challenge';
import {developmentRegistrationRuntime} from './development-registration';
import {usesPersistentRegistration,persistentRegistrationReadiness} from './registration-service';

const policySchema = z.object({ id: z.uuid(), version: z.string(), content: z.string(), hash: z.string(), status: z.enum(["test", "published"]), publicRegistration: z.boolean(), pilotRegistration: z.boolean().optional() });
export async function registrationContext(client?: Awaited<ReturnType<typeof componentClient>>) {
  const connection = client ?? await componentClient();
  if(usesPersistentRegistration()) {
    const persistent=await persistentRegistrationReadiness(connection),challenge=signupChallengeConfig();
    let providerReady=false;
    try{const env=runtimeConfig(),response=await fetch(`${env.url}/auth/v1/settings`,{headers:{apikey:env.key},cache:'no-store',signal:AbortSignal.timeout(10000)});const value=await response.json();providerReady=response.ok&&value.disable_signup===false&&value.mailer_autoconfirm===false;}catch{/* fail closed */}
    const bundle=persistent.policy;
    const policy=bundle?{id:bundle.termsId,version:bundle.termsVersion,content:bundle.termsContent,hash:bundle.termsHash,status:bundle.status,publicRegistration:false}:null;
    const enabled=persistent.admission==='available'&&providerReady&&Boolean(challenge);
    return {persistent,policy,isTest:false,isPilot:false,isDevelopmentOpen:false,requiresChallenge:true,developmentRuntime:null,
      captchaSiteKey:challenge?.siteKey,emailDeliveryEnabled:persistent.delivery==='available'&&providerReady,
      enabled,availability:enabled?'available':persistent.admission==='available'?'unavailable':persistent.admission};
  }
  const result = await connection.schema("api").rpc("mitsa_registration_policy");
  const parsed = result.error ? null : policySchema.safeParse(result.data);
  const policy = parsed?.success ? parsed.data : null;
  const mode = process.env.MITSA_REGISTRATION_MODE ?? "disabled";
  const {isTest, isDevelopmentOpen, allowed} = registrationPolicyMode(mode, policy, runtimeConfig().origin,process.env.NODE_ENV==='development');
  const developmentRuntime=isDevelopmentOpen?await developmentRegistrationRuntime(runtimeConfig().origin):null;
  let providerReady = false;
  if (allowed && validSigningKey(process.env.MITSA_REGISTRATION_INTENT_KEY ?? "")) {
    const env = runtimeConfig();
    try {
      const response = await fetch(`${env.url}/auth/v1/settings`, { headers: { apikey: env.key }, cache: "no-store", signal: AbortSignal.timeout(10000) });
      const settings = await response.json();
      providerReady = response.ok && settings.disable_signup === false && settings.mailer_autoconfirm === false;
    } catch { /* Missing/uncertain provider configuration stays closed. */ }
  }
  const needsChallenge=isDevelopmentOpen||(mode==='public'&&requiresSignupChallenge(policy)),challenge=needsChallenge?signupChallengeConfig():null;
  const ready=Boolean(allowed && providerReady && (!isDevelopmentOpen||developmentRuntime) && (!needsChallenge||challenge));
  const enabled=ready&&developmentRuntime?.registrationAllowed!==false;
  const availability=enabled?'available':registrationIntentionallyClosed(mode,policy,runtimeConfig().origin)||ready&&developmentRuntime?.registrationAllowed===false?'closed':
   allowed&&providerReady&&validSigningKey(process.env.MITSA_REGISTRATION_INTENT_KEY??'')&&(!needsChallenge||challenge)&&isDevelopmentOpen&&!developmentRuntime?'paused':'unavailable';
  return { persistent:null,policy, isTest: Boolean(isTest), isPilot: allowed && mode === "controlled-pilot", isDevelopmentOpen,
   requiresChallenge:needsChallenge, developmentRuntime, captchaSiteKey:challenge?.siteKey,
   emailDeliveryEnabled:ready,enabled,availability };
}

export async function createRegistrationIntent(input: { email: string; fullName: string; termsVersion: string }):Promise<{ok:true;intent:{intentId:string;nonce:string;termsVersion:string}}|{ok:false;code:RegistrationErrorCode}> {
  const env = runtimeConfig();
  const body = JSON.stringify({ ...input, accepted: true });
  const signingKey = process.env.MITSA_REGISTRATION_INTENT_KEY ?? "";
  if (!validSigningKey(signingKey)) return {ok:false,code:"unavailable"};
  try {
    const response = await fetch(`${env.url}/functions/v1/mitsa-registration-intent`, { method: "POST", body,
      headers: { "content-type": "application/json", origin: env.origin, apikey: env.key, ...await signIntentRequest(signingKey, body) }, cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!response.ok) {
      // Only a bounded, known code may cross from the private endpoint to UI.
      // Never log the signed envelope, nonce, email or provider error message.
      const detail=z.object({code:registrationErrorCode}).safeParse(await response.json().catch(()=>null));
      const code=detail.success?detail.data.code:response.status===429?"rate_limited":"unavailable";
      console.warn("Mitsa registration intent unavailable",{status:response.status,code});return {ok:false,code};
    }
    const parsed = z.object({ intentId: z.uuid(), nonce: z.string().regex(/^[0-9a-f]{64}$/), termsVersion: z.uuid() }).strict().safeParse(await response.json());
    return parsed.success&&parsed.data.termsVersion===input.termsVersion?{ok:true,intent:parsed.data}:{ok:false,code:"unavailable"};
  } catch (error) { console.warn("Mitsa registration intent connection failed", { kind: error instanceof Error ? error.name : "unknown" }); return {ok:false,code:"network"}; }
}
