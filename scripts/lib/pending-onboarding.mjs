import assert from 'node:assert/strict';
// Identity-only snapshot; no password, nonce, code, QR or session is read.
export async function pendingOnboardingBinding(db,email,baseline) {
 const rows=(await db.query(`select u.id user_id,i.id intent_id,u.email_confirmed_at,u.deleted_at,
  (u.banned_until is not null and u.banned_until>statement_timestamp()) banned,
  i.finalized_at,i.expires_at>statement_timestamp() intent_live,i.terms_id,
  (select count(*)::int from private.registration_intents other where other.provider_user_id=u.id) intents,
  (select count(*)::int from private.memberships where user_id=u.id) memberships,
  (select count(*)::int from auth.mfa_factors where user_id=u.id) factors,
  (select count(*)::int from private.factor_bindings where user_id=u.id and revoked_at is null) bindings,
  (select count(*)::int from private.legal_acceptances where user_id=u.id) acceptances
  from auth.users u join private.registration_intents i on i.provider_user_id=u.id and i.email=u.email where u.email=$1`,[email])).rows;
 assert.equal(rows.length,1,'Pending onboarding identity unavailable');const row=rows[0];
 assert(row.email_confirmed_at===null&&row.deleted_at===null&&!row.banned&&row.finalized_at===null&&row.intent_live&&row.intents===1&&row.memberships===0&&row.factors===0&&row.bindings===0&&row.acceptances===0,'Pending onboarding prerequisites changed');
 if(baseline)assert(row.user_id===baseline.userId&&row.intent_id===baseline.intentId&&row.terms_id===baseline.termsId,'Pending onboarding binding changed');
 return {userId:row.user_id,intentId:row.intent_id,termsId:row.terms_id};
}
