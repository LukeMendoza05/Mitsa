import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { closedFreeSitePlan, reviewFreeBackendAdoption, freeOnlyPolicy as p } from './lib/free-only-production-plan.mjs';
let tests = 0;
const test = fn => { fn(); tests++; };
const input = {
  backend: { organizationId:p.organizationId, projectRef:p.candidateProject, plan:'free', monthlyChargeUsd:0, inactiveVerified:true },
  source: { sha:'1'.repeat(40), ordinaryProjectRef:p.candidateProject, inventoryVerified:true },
  hosting: { plan:'hobby', use:'personal-noncommercial-evaluation', eligibilityVerified:true, deploymentProtection:'all' },
  domain: { origin:p.origin, projectId:p.projectId, verified:true },
  authority: { closedStagingBindingApproved:true, paidChangesAllowed:false },
};
test(() => assert.throws(() => closedFreeSitePlan()));
for (const [section,key,value] of [
  ['backend','projectRef',p.preservedProject],['backend','projectRef','x'.repeat(20)],
  ['backend','organizationId','another-org'],['backend','plan','pro'],
  ['backend','monthlyChargeUsd',1],['backend','inactiveVerified',false],
  ['authority','closedStagingBindingApproved',false],['authority','paidChangesAllowed',true],
  ['source','sha','ec4a96bef0ea77e3553513b37931076f288cc204'],['source','sha','main'],
  ['source','ordinaryProjectRef',p.preservedProject],['source','inventoryVerified',false],
  ['hosting','plan','pro'],['hosting','use','commercial'],['hosting','eligibilityVerified',false],
  ['hosting','deploymentProtection','preview'],['domain','origin','https://another.vercel.app'],
  ['domain','projectId','another-project'],['domain','verified',false],
]) test(() => { const c=structuredClone(input); c[section][key]=value; assert.throws(() => closedFreeSitePlan(c)); });
test(() => { const plan=closedFreeSitePlan(input); assert.equal(plan.executionAuthorized,false); assert.equal(plan.formalProductionAdoptionIncluded,false); assert.equal(plan.publicRegistrationIncluded,false); assert.equal(plan.productionEnvironmentNames.length,10); assert.equal(plan.inheritPreviewSecrets,false); assert.equal(plan.closedValues.MITSA_REGISTRATION_MODE,'disabled'); assert.equal(plan.billingChanges,0); });
const adoption = { projectRef:p.candidateProject };
const flags=['exactAdoptionApproved','hostedOtpMfaOnboardingPassed','hostedRecoveryAndTenantTestsPassed','strictOptionAHostedPassed','legalAndDeliveryReady','operationsAndRestoreDrillPassed','fixtureDispositionReviewed','allPreviewBackendAccessRetiredAndVerified','productionSecretsAndOriginReviewed','commercialHostingTermsSatisfied','originalProjectPreserved','freeQuotaCapacityReviewed'];
for (const flag of flags) adoption[flag]=true;
for (const flag of flags) test(() => assert.throws(() => reviewFreeBackendAdoption({...adoption,[flag]:false})));
test(() => assert.throws(() => reviewFreeBackendAdoption({...adoption,projectRef:p.preservedProject})));
test(() => assert.deepEqual(reviewFreeBackendAdoption(adoption),{executionAuthorized:false,candidateEligibleForSeparateActivationReview:true,publicRegistrationEnabled:false,billingChanges:0,projectCreations:0}));
const archived=JSON.parse(readFileSync('artifacts/superseded-paid-r1-20261031/index.json','utf8'));
test(() => { for (const f of archived.files) assert.equal(createHash('sha256').update(readFileSync(f.archivePath)).digest('hex'),f.sha256); });
console.log(JSON.stringify({OFFLINE:'PASSED',tests,providerRequests:0,paidChanges:0,adoptedBackend:false,secretsRead:0}));
