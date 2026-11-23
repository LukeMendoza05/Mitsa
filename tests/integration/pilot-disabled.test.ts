import {describe,it,expect} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';import {parse} from 'dotenv';
import {assertClosedPilotEvidence,assertClosedOnboardingEvidence,assertClosedRehearsalEvidence} from '../../scripts/lib/closed-pilot-evidence.mjs';
import {database,publicClient,hostedConfig} from '../support/hosted';
import {signIntentRequest} from '../../supabase/functions/_shared/registration-intent-auth';

describe('Approved disabled isolated pilot schema',()=>{
 it('keeps public/pilot registration closed and private configuration/ledger writes inaccessible',async()=>{
  const db=await database();try{
   const window=(await db.query('select enabled,smtp_enabled,approved_at,expires_at,provider_otp_expiry_seconds,approved_sender_sha256,private.mitsa_pilot_registration_open() open from private.pilot_registration_window where singleton')).rows[0];
   const execution=existsSync('artifacts/controlled-gmail-test-results.json')?JSON.parse(readFileSync('artifacts/controlled-gmail-test-results.json','utf8')):null;
   const sender=execution?JSON.parse(readFileSync('.secrets/pilot-relay/credential-readiness.json','utf8')).senderSha256:null;
   try{
    if(existsSync('artifacts/controlled-onboarding-results.json')) {
     const onboarding=JSON.parse(readFileSync('artifacts/controlled-onboarding-results.json','utf8')),approval=JSON.parse(readFileSync('artifacts/controlled-verification-resume-approval.json','utf8')),runtime=JSON.parse(readFileSync('.secrets/isolated-registration/runtime.json','utf8'));
     const deliveries=(await db.query('select d.recipient_hash,d.state,d.created_at,m.action from private.pilot_mail_deliveries d join private.isolated_auth_mail m on m.id=d.capture_id')).rows;
     expect(deliveries.length).toBe((await db.query('select count(*)::int n from private.pilot_mail_deliveries')).rows[0].n);
     const rehearsal=existsSync('.secrets/registration-rehearsal/approval.json')?JSON.parse(readFileSync('.secrets/registration-rehearsal/approval.json','utf8')):null;
     if(rehearsal?.usedAt){const snapshot=JSON.parse(readFileSync('.secrets/registration-rehearsal/prior-window.json','utf8')),prior={...snapshot,runtime:JSON.parse(readFileSync('.secrets/registration-rehearsal/prior-runtime.json','utf8'))};assertClosedRehearsalEvidence(window,rehearsal,runtime,prior,execution,onboarding,approval,sender,deliveries);}
     else assertClosedOnboardingEvidence(window,execution,onboarding,approval,runtime,sender,deliveries);
    }else{assertClosedPilotEvidence(window,execution,sender);expect((await db.query('select count(*)::int n from private.pilot_mail_deliveries')).rows[0].n).toBe(execution?.attempts??0);}
   }catch{throw Error('Closed pilot evidence mismatch; private details suppressed');}
   // Hosted postgres cannot SET ROLE to the provider-managed Auth role. Check
   // its effective privileges below without granting impersonation rights.
   for(const role of ['anon','authenticated','service_role','app_workspace']) {
    for(const table of ['pilot_registration_window','pilot_mail_deliveries']) {
     await db.query('begin');try{
      await db.query(`set local role ${role}`);let denied=false;
      try{await db.query(`update private.${table} set ${table==='pilot_registration_window'?'enabled=enabled':"state=state"}`);}catch(error){denied=(error as {code?:string}).code==='42501';}
      expect(denied).toBe(true);
     }finally{await db.query('rollback');}
    }
   }
   for(const table of ['pilot_registration_window','pilot_mail_deliveries']) {
    expect((await db.query("select has_table_privilege('supabase_auth_admin',$1,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') allowed",[`private.${table}`])).rows[0].allowed).toBe(false);
    expect((await db.query("select has_table_privilege('supabase_auth_admin',$1,'SELECT') allowed",[`private.${table}`])).rows[0].allowed).toBe(table==='pilot_registration_window');
   }
   for(const role of ['anon','authenticated','service_role']) {
    expect((await db.query("select has_function_privilege($1,'private.mitsa_pilot_registration_open()','EXECUTE') allowed",[role])).rows[0].allowed).toBe(false);
    for(const table of ['pilot_registration_window','pilot_mail_deliveries'])expect((await db.query("select has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE') allowed",[role,`private.${table}`])).rows[0].allowed).toBe(false);
   }
  }finally{await db.end();}
  const policy=await publicClient().schema('api').rpc('mitsa_registration_policy');expect(Boolean(policy.error)).toBe(false);
  expect(policy.data.status).toBe('test');expect(policy.data.publicRegistration).toBe(false);expect(policy.data.pilotRegistration).toBe(false);
 });
 it('rejects a signed unapproved valid-address intent and forged direct signup without user or capture creation',async()=>{
  const initial=await database();let deliveryCount:number;try{deliveryCount=(await initial.query('select count(*)::int n from private.pilot_mail_deliveries')).rows[0].n;}finally{await initial.end();}
  const email=`mitsa-disabled-pilot-${crypto.randomUUID()}@example.com`,cfg=hostedConfig(),key=parse(readFileSync('.env.local')).MITSA_REGISTRATION_INTENT_KEY;
  const policy=(await publicClient().schema('api').rpc('mitsa_registration_policy')).data;
  const body=JSON.stringify({email,fullName:'Synthetic disabled-pilot denial',termsVersion:policy.id,accepted:true});
  const response=await fetch(`${cfg.url}/functions/v1/mitsa-registration-intent`,{method:'POST',body,headers:{apikey:cfg.publishableKey,origin:'http://127.0.0.1:3000','content-type':'application/json',...await signIntentRequest(key,body)},signal:AbortSignal.timeout(15000)});
  expect(response.status).toBe(403);
  const denied=await publicClient().auth.signUp({email,password:`Synthetic!${crypto.randomUUID()}`,options:{emailRedirectTo:'http://127.0.0.1:3000/auth/email',data:{registration_nonce:'0'.repeat(64),role:'owner'}}});expect(Boolean(denied.error)).toBe(true);expect(denied.data.session===null).toBe(true);
  const db=await database();try{
   for(const table of ['auth.users','private.registration_intents'])expect((await db.query(`select count(*)::int n from ${table} where email=$1`,[email])).rows[0].n).toBe(0);
   expect((await db.query("select count(*)::int n from private.isolated_auth_mail where recipient_hash=encode(sha256(convert_to($1,'UTF8')),'hex')",[email])).rows[0].n).toBe(0);
   expect((await db.query('select count(*)::int n from private.pilot_mail_deliveries')).rows[0].n).toBe(deliveryCount);
  }finally{await db.end();}
 });
});
