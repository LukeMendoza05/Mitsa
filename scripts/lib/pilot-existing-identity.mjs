import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {readPrivateKey,readMessage,decrypt} from 'openpgp';
export function existingPilotBinding(row, record, senderHash, termsId, now=Date.now()) {
 assert(record.project==='mjtejwafxriwntweussc'&&record.purpose==='dedicated-sender-self-test');
 assert(row&&row.id===record.userId&&row.emailHash===record.emailHash&&row.emailHash===senderHash);
 assert(row.fullName==='Synthetic Mitsa Gmail delivery test'&&row.unverified===true&&row.active===true);
 assert(row.memberships===0&&row.factors===0&&row.finalized===false&&row.termsId===termsId);
 assert(row.createdAt>=Date.parse(record.approvedAt)&&row.createdAt<=Date.parse(record.expiresAt));
 assert(row.intentExpiresAt>now+30*60000&&/^[0-9a-f-]{36}$/.test(row.intentId));
 return {userId:row.id,intentId:row.intentId};
}
export async function readExistingPilot(db,sender,termsId,now=Date.now()) {
 const record=JSON.parse(readFileSync('.secrets/pilot-relay/self-test-identity.json','utf8'));
 const rows=(await db.query(`select u.id,encode(sha256(convert_to(u.email,'UTF8')),'hex') "emailHash",u.raw_user_meta_data->>'full_name' "fullName",
  u.email_confirmed_at is null unverified,u.deleted_at is null and (u.banned_until is null or u.banned_until<=statement_timestamp()) active,
  u.created_at "createdAt",i.id "intentId",i.terms_id "termsId",i.expires_at "intentExpiresAt",i.finalized_at is not null finalized,
  (select count(*)::int from private.memberships where user_id=u.id) memberships,(select count(*)::int from auth.mfa_factors where user_id=u.id) factors
  from auth.users u join private.registration_intents i on i.provider_user_id=u.id and i.email=u.email where u.id=$1 and u.email=$2`,[record.userId,sender])).rows;
 assert.equal(rows.length,1);const row=rows[0],binding=existingPilotBinding({...row,createdAt:row.createdAt.getTime(),intentExpiresAt:row.intentExpiresAt.getTime()},record,createHash('sha256').update(sender).digest('hex'),termsId,now);
 const key=await readPrivateKey({armoredKey:readFileSync('.secrets/auth-mail/private.asc','utf8')});
 const account=JSON.parse(String((await decrypt({message:await readMessage({binaryMessage:readFileSync('.secrets/pilot-relay/self-test-account.pgp')}),decryptionKeys:key})).data));
 assert(account.project===record.project&&account.purpose===record.purpose&&account.email===sender&&account.fullName===row.fullName&&typeof account.password==='string'&&account.password.length>=8);
 return {binding,password:account.password}; // Private memory only; never report.
}
