import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {decrypt,readMessage,readPrivateKey} from "openpgp";
import {database} from "./hosted";
import type {JourneyIdentity} from "./journeys";
import {emailVerificationCodeLength} from '../../src/lib/auth/email-code-settings';
// Operator/test only. Read the actual provider-issued signup code from encrypted
// capture; no admin code-generation fallback, real account or external delivery.
export async function capturedSignupCode(user:JourneyIdentity) {
 if(!/^foundation-[a-zA-Z0-9-]+@example\.invalid$/.test(user.email))throw Error("Synthetic identity required");
 const db=await database();try{
  const row=(await db.query("select u.id,(select m.encrypted_payload from private.isolated_auth_mail m where m.recipient_hash=$2 and m.action='signup' order by m.created_at desc limit 1) payload from auth.users u join private.registration_intents i on i.provider_user_id=u.id where u.email=$1 and u.email_confirmed_at is null and i.finalized_at is null and i.expires_at>now()",[user.email,createHash('sha256').update(user.email).digest('hex')])).rows[0];if(!row?.payload)throw Error("Registered synthetic captured mail required");
  const key=await readPrivateKey({armoredKey:readFileSync('.secrets/auth-mail/private.asc','utf8')}),mail=JSON.parse(String((await decrypt({message:await readMessage({binaryMessage:row.payload}),decryptionKeys:key})).data));
  if(mail.email!==user.email||mail.userId!==row.id||mail.type!=='signup'||mail.origin!=='http://127.0.0.1:3000'||!new RegExp(`^\\d{${emailVerificationCodeLength}}$`).test(mail.code??''))throw Error('Synthetic capture binding failed; private details omitted');
  return mail.code as string;
 }finally{await db.end();}
}
export async function ageSyntheticConfirmation(user:JourneyIdentity,seconds:number) {
 if(!/^foundation-[a-zA-Z0-9-]+@example\.invalid$/.test(user.email)||!Number.isInteger(seconds)||seconds<61||seconds>172800)throw Error("Invalid synthetic expiry fixture");
 const db=await database();try{const result=await db.query("update auth.users set confirmation_sent_at=now()-make_interval(secs=>$2) where email=$1 and email_confirmed_at is null",[user.email,seconds]);if(result.rowCount!==1)throw Error("Pending synthetic fixture required");}finally{await db.end();}
}
