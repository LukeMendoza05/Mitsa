import assert from 'node:assert/strict';

// Review boundaries only. This module has no filesystem, provider or DB access.
export const stageCInstallSources = [
 'supabase/prepared/20261016004927_mitsa_persistent_registration_inactive.sql',
 'supabase/prepared/20261016005221_mitsa_persistent_registration_hooks_inactive.sql',
];

export function assertInactiveRegistrationProposal(proposal) {
 assert.equal(proposal.status, 'prepared-not-approved-not-installed');
 assert.equal(proposal.projectRef, 'mjtejwafxriwntweussc');
 assert.equal(proposal.databaseMarker, 'fireworks-foundation-proof-01a12e38');
 assert.deepEqual(proposal.migrationOrder, stageCInstallSources);
 assert.deepEqual(proposal.initialControls, {admissionEnabled:false, deliveryEnabled:false, sessionPolicyReady:false, approvalGeneration:null, workerId:null, transportReady:false, termsId:null, privacyId:null});
 assert.equal(proposal.privateService.enabled, false);
 assert.equal(proposal.privateService.enabledValueAtInstallation, 'false');
 assert.equal(proposal.authProvider.redirectAllowlistAdditionCandidate, null);
 assert.equal(proposal.authProvider.preserveExistingRedirectEntries, true);
 assert.deepEqual(proposal.localRuntimeAtInstallation, {MITSA_REGISTRATION_ENGINE:'legacy', MITSA_DEPLOYMENT_PROFILE:'isolated-development', persistentWorkerStarted:false});
}

export function assertReviewedRegistrationManifest(reviewed, actual) {
 // A verification timestamp may differ. Source, permissions, recovery evidence
 // and every remaining field must match the previously reviewed manifest.
 const {checkedAt: _reviewedTime, ...expected} = reviewed;
 const {checkedAt: _actualTime, ...observed} = actual;
 assert.deepEqual(observed, expected);
}

export function assertRegistrationReviewPaths(reviewed, paths) {
 // Validate the complete source list before any manifest-directed file read.
 assert.deepEqual(reviewed.files.map(file=>file.path), paths);
}
