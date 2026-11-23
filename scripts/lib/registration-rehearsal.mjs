import assert from 'node:assert/strict';
export const rehearsalRecipientFile='.secrets/registration-rehearsal/recipient.json';
export const rehearsalApprovalFile='.secrets/registration-rehearsal/approval.json';
export function verifyRegistrationRehearsalScope(approval,recipientHash) {
 assert.equal(approval?.version,1);assert.equal(approval.project,'mjtejwafxriwntweussc');
 assert.equal(approval.scope,'unallowlisted-synthetic-registration-only');assert.equal(approval.approvedByUser,true);
 assert.equal(approval.unresolvedRefreshReuseAcceptedForSyntheticRehearsalOnly,true);
 assert.equal(approval.generalRegistrationAllowed,false);assert.equal(approval.existingAccountChangesAllowed,false);assert.equal(approval.providerOrHookChangesAllowed,false);
 assert.equal(approval.windowMinutes,30);assert.equal(approval.maxAuthenticationEmailAttempts,2);
 assert(/^[a-f0-9]{64}$/.test(recipientHash));assert.equal(approval.recipientHash,recipientHash);
 return {maxAttempts:2};
}
export function verifyRegistrationRehearsalApproval(approval,recipientHash) {
 const scope=verifyRegistrationRehearsalScope(approval,recipientHash);assert.equal(approval.usedAt,undefined);return scope;
}
