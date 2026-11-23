// Inactive local planning guards: no network, filesystem, credentials or SDKs.
import assert from 'node:assert/strict';
export const freeOnlyPolicy = Object.freeze({
  organizationId: 'zejvpgnesxiwavwgcsme', preservedProject: 'mjtejwafxriwntweussc',
  candidateProject: 'geuttbanjqdapcubjrnn', projectId: 'prj_kd0rBsWC3pzvbY6LGeTUGUEwxiDD',
  origin: 'https://mitsa-fireworksinventory.vercel.app',
  supabaseMonthlyCeilingUsd: 0, projectCreations: 0, billingChanges: 0,
});

// A Vercel Production-target CLOSED staging site is not real-user adoption.
export function closedFreeSitePlan({ backend, source, hosting, domain, authority } = {}) {
  assert.equal(backend?.organizationId, freeOnlyPolicy.organizationId, 'Wrong organization');
  assert.equal(backend?.projectRef, freeOnlyPolicy.candidateProject, 'Only existing candidate may be proposed');
  assert.equal(backend?.plan, 'free', 'Free only');
  assert.equal(backend?.monthlyChargeUsd, 0, 'No charge permitted');
  assert.equal(backend?.inactiveVerified, true, 'Closed backend evidence required');
  assert.equal(authority?.closedStagingBindingApproved, true, 'Separate closed-site backend binding approval required');
  assert.equal(authority?.paidChangesAllowed, false, 'Paid changes prohibited');
  assert.match(source?.sha ?? '', /^[a-f0-9]{40}$/, 'Exact reviewed source required');
  assert.notEqual(source.sha, 'ec4a96bef0ea77e3553513b37931076f288cc204', 'Original source has no ordinary Production binding');
  assert.equal(source.ordinaryProjectRef, freeOnlyPolicy.candidateProject, 'Source/backend mismatch');
  assert.equal(source.inventoryVerified, true, 'Source review required');
  assert.equal(hosting?.plan, 'hobby', 'Changed hosting plan needs new review');
  assert.equal(hosting?.use, 'personal-noncommercial-evaluation', 'Hobby commercial use is not eligible');
  assert.equal(hosting?.eligibilityVerified, true, 'Do not assume protected business evaluation is Hobby-eligible');
  assert.equal(hosting?.deploymentProtection, 'all', 'All Deployments authentication required');
  assert.equal(domain?.origin, freeOnlyPolicy.origin, 'Exact clean address required');
  assert.equal(domain?.projectId, freeOnlyPolicy.projectId, 'Wrong Vercel project');
  assert.equal(domain?.verified, true, 'Verified existing domain binding required');
  return {
    executionAuthorized: false, formalProductionAdoptionIncluded: false,
    publicRegistrationIncluded: false, billingChanges: 0, projectCreations: 0,
    target: 'production', use: 'protected-closed-staging',
    backendProject: freeOnlyPolicy.candidateProject, sourceSha: source.sha,
    origin: freeOnlyPolicy.origin,
    generateFreshIndependentProductionKeys: ['AUTH_FLOW_KEY', 'MFA_ENROLLMENT_KEY'],
    productionEnvironmentNames: ['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','APP_ORIGIN',
      'AUTH_FLOW_KEY','MFA_ENROLLMENT_KEY','MITSA_REGISTRATION_ENGINE',
      'MITSA_REGISTRATION_MODE','MITSA_AUTH_MAIL_MODE',
      'MITSA_REGISTRATION_SERVICE_ENABLED','MITSA_EMAIL_OTP_LENGTH'],
    closedValues: { MITSA_REGISTRATION_ENGINE:'legacy', MITSA_REGISTRATION_MODE:'disabled',
      MITSA_AUTH_MAIL_MODE:'disabled', MITSA_REGISTRATION_SERVICE_ENABLED:'false', MITSA_EMAIL_OTP_LENGTH:'6' },
    inheritPreviewSecrets: false, automaticDeployments: false, protection: 'all',
  };
}

// Separate future real-user adoption review. This never authorizes live changes.
export function reviewFreeBackendAdoption(input = {}) {
  assert.equal(input.projectRef, freeOnlyPolicy.candidateProject, 'Wrong adoption candidate');
  for (const key of [
    'exactAdoptionApproved','hostedOtpMfaOnboardingPassed','hostedRecoveryAndTenantTestsPassed',
    'strictOptionAHostedPassed','legalAndDeliveryReady','operationsAndRestoreDrillPassed',
    'fixtureDispositionReviewed','allPreviewBackendAccessRetiredAndVerified',
    'productionSecretsAndOriginReviewed','commercialHostingTermsSatisfied',
    'originalProjectPreserved','freeQuotaCapacityReviewed',
  ]) assert.equal(input[key], true, 'Missing adoption prerequisite: ' + key);
  return { executionAuthorized:false, candidateEligibleForSeparateActivationReview:true,
    publicRegistrationEnabled:false, billingChanges:0, projectCreations:0 };
}
