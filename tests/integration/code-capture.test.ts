import {beforeAll,describe,it,expect} from "vitest";
import {randomUUID,createHash} from "node:crypto";
import {readFileSync,writeFileSync} from "node:fs";
import {parse} from "dotenv";
import {decrypt,readMessage,readPrivateKey} from "openpgp";
import {database,publicClient,hostedConfig} from "../support/hosted";
import {capturedSignupCode,ageSyntheticConfirmation} from "../support/email-code";
import {signIntentRequest} from "../../supabase/functions/_shared/registration-intent-auth";
import {emailVerificationCodeLength} from '../../src/lib/auth/email-code-settings';
describe("Approved encrypted signup code capture",()=>{
 const user={email:`foundation-code-capture-${randomUUID()}@example.invalid`,password:`M1!${randomUUID()}`,fullName:"Synthetic captured-code verification"};
 let id:string,initialCode:string;
 beforeAll(async()=>{
  const db=await database();try{expect((await db.query("select registration_enabled or external_mail_enabled or eligibility_approved or legal_publication_enabled or disposal_enabled opened from private.release_gates where singleton")).rows[0].opened).toBe(false);await db.query("insert into private.registration_test_recipients(email,enabled) values($1,true)",[user.email]);}finally{await db.end();}
  const cfg=hostedConfig(),key=parse(readFileSync('.env.local')).MITSA_REGISTRATION_INTENT_KEY,policy=(await publicClient().schema('api').rpc('mitsa_registration_policy')).data;
  const body=JSON.stringify({email:user.email,fullName:user.fullName,termsVersion:policy.id,accepted:true});
  const response=await fetch(`${cfg.url}/functions/v1/mitsa-registration-intent`,{method:'POST',body,headers:{apikey:cfg.publishableKey,origin:'http://127.0.0.1:3000','content-type':'application/json',...await signIntentRequest(key,body)}});if(!response.ok)throw Error('Synthetic intent unavailable; private details omitted');
  const intent=await response.json(),signup=await publicClient().auth.signUp({email:user.email,password:user.password,options:{data:{registration_nonce:intent.nonce,full_name:user.fullName},emailRedirectTo:'http://127.0.0.1:3000/auth/email'}});
  if(signup.error||!signup.data.user)throw Error('Synthetic native signup unavailable; private details omitted');expect(signup.data.session===null).toBe(true);id=signup.data.user.id;initialCode=await capturedSignupCode(user);
 },120000);
 it("retains the provider code only inside decryptable, recipient-bound ciphertext",async()=>{
  const db=await database();try{
   const row=(await db.query("select encrypted_payload from private.isolated_auth_mail where recipient_hash=$1 and action='signup' order by created_at desc limit 1",[createHash('sha256').update(user.email).digest('hex')])).rows[0];expect(Boolean(row)).toBe(true);expect(Buffer.from(row.encrypted_payload).includes(Buffer.from(initialCode))).toBe(false);
   const key=await readPrivateKey({armoredKey:readFileSync('.secrets/auth-mail/private.asc','utf8')}),mail=JSON.parse(String((await decrypt({message:await readMessage({binaryMessage:row.encrypted_payload}),decryptionKeys:key})).data));
   expect(mail.email===user.email&&mail.userId===id&&mail.type==='signup'&&mail.origin==='http://127.0.0.1:3000').toBe(true);expect(mail.code===initialCode&&new RegExp(`^\\d{${emailVerificationCodeLength}}$`).test(mail.code)).toBe(true);expect(mail.password===undefined&&mail.access_token===undefined).toBe(true);
   for(const role of ['anon','authenticated','service_role','app_workspace']){await db.query('begin');try{await db.query(`set local role ${role}`);let denied=false;try{await db.query('select encrypted_payload from private.isolated_auth_mail limit 1');}catch(error){denied=(error as {code?:string}).code==='42501';}expect(denied).toBe(true);}finally{await db.query('rollback');}}
  }finally{await db.end();}
 });
 it("rejects unauthorized direct signup and enforces the provider resend cooldown",async()=>{
  const unknown=`foundation-unapproved-code-${randomUUID()}@example.invalid`,result=await publicClient().auth.signUp({email:unknown,password:user.password,options:{emailRedirectTo:'http://127.0.0.1:3000/auth/email'}});expect(Boolean(result.error)).toBe(true);
  const db=await database();try{expect((await db.query('select count(*)::int n from auth.users where email=$1',[unknown])).rows[0].n).toBe(0);}finally{await db.end();}
  const result2=await publicClient().auth.resend({type:'signup',email:user.email,options:{emailRedirectTo:'http://127.0.0.1:3000/auth/email'}});expect(result2.error?.status).toBe(429);
 });
 it("expires captured codes, replaces them on resend, confirms once and grants no workspace",async()=>{
  await ageSyntheticConfirmation(user,3601);const expired=await publicClient().auth.verifyOtp({type:'signup',email:user.email,token:initialCode});expect(Boolean(expired.error)).toBe(true);
  const resend=await publicClient().auth.resend({type:'signup',email:user.email,options:{emailRedirectTo:'http://127.0.0.1:3000/auth/email'}});expect(Boolean(resend.error)).toBe(false);
  const latest=await capturedSignupCode(user);expect(latest===initialCode).toBe(false);expect(Boolean((await publicClient().auth.verifyOtp({type:'signup',email:user.email,token:initialCode})).error)).toBe(true);
  const client=publicClient(),confirmed=await client.auth.verifyOtp({type:'signup',email:user.email,token:latest});expect(Boolean(!confirmed.error&&confirmed.data.session&&confirmed.data.user?.id===id)).toBe(true);expect((await client.schema('api').rpc('mitsa_finalize_registration')).data).toBe(true);
  expect(Boolean((await publicClient().auth.verifyOtp({type:'signup',email:user.email,token:latest})).error)).toBe(true);
  const db=await database();try{expect((await db.query('select count(*)::int n from private.memberships where user_id=$1',[id])).rows[0].n).toBe(0);expect((await db.query("select count(*)::int n from private.legal_acceptances where user_id=$1 and source='registration'",[id])).rows[0].n).toBe(1);}finally{await db.end();}
  writeFileSync('artifacts/code-capture-hosted-tests.json',JSON.stringify({checkedAt:new Date().toISOString(),project:hostedConfig().projectRef,capturedProviderCodeLength:latest.length,encryptedRecipientBoundCapture:true,unprivilegedCiphertextReadsDenied:true,unauthorizedSignupDenied:true,providerCooldownEnforced:true,codeExpiredAfterSyntheticAgeSeconds:3601,oldCodeRejectedAfterResend:true,oneTimeReplayDenied:true,confirmationFinalizesTerms:true,workspaceRolesGranted:0,adminCodeGenerationUsed:false,externalEmailsSent:0,privateValuesPrinted:false},null,2)+'\n');
 },120000);
});
