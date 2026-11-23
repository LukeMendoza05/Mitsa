import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readPrivateKey,readMessage,decrypt} from 'openpgp';
export function priorPilotDeliveryBinding(rows,report,senderHash,userId){
 assert.equal(report.project,'mjtejwafxriwntweussc');assert.equal(report.scope,'dedicated-sender-self-test-resume');
 assert.equal(report.windowClosed,true);assert.equal(report.failureStage,'normal-browser-resend');assert.equal(report.attempts,1);
 assert.equal(report.smtpAccepted,true);assert.equal(report.inboxReceipt,'User confirmed first message');
 assert.equal(report.actualProviderCodeVerified,false);assert.equal(report.personalAccountModified,false);assert.equal(report.publicRegistrationEnabled,false);
 assert.equal(rows.length,1);const row=rows[0];
 assert.equal(row.state,'smtp-accepted');assert.equal(row.recipient_hash,senderHash);assert.equal(row.user_id,userId);assert.equal(row.action,'signup');
 assert(row.created_at.getTime()>=Date.parse(report.windowStartedAt)&&row.created_at.getTime()<=Date.parse(report.windowExpiresAt));
 assert(/^[a-zA-Z0-9_-]{1,100}$/.test(row.capture_id));return row.capture_id;
}
export async function readPriorPilotDelivery(db,senderHash,userId){
 const report=JSON.parse(readFileSync('artifacts/history/controlled-gmail-received-before-resend.json','utf8'));
 const rows=(await db.query(`select d.capture_id,d.recipient_hash,d.state,d.created_at,m.action,m.encrypted_payload,i.provider_user_id user_id
  from private.pilot_mail_deliveries d join private.isolated_auth_mail m on m.id=d.capture_id
  join private.registration_intents i on encode(sha256(convert_to(i.email,'UTF8')),'hex')=d.recipient_hash`)).rows;
 const captureId=priorPilotDeliveryBinding(rows,report,senderHash,userId);
 const key=await readPrivateKey({armoredKey:readFileSync('.secrets/auth-mail/private.asc','utf8')});
 const mail=JSON.parse(String((await decrypt({message:await readMessage({binaryMessage:rows[0].encrypted_payload}),decryptionKeys:key})).data));
 assert.equal(mail.userId,userId);assert.equal(createHash('sha256').update(mail.email).digest('hex'),senderHash);assert.equal(mail.type,'signup');assert.equal(mail.origin,'http://127.0.0.1:3000');assert(/^\d{6}$/.test(mail.code));
 return {captureId,code:mail.code,issuedAt:rows[0].created_at.getTime(),report}; // Private memory; the exposed code is never used to authenticate.
}
