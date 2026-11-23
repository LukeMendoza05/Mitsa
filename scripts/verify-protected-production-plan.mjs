import assert from 'node:assert/strict';
import { protectedProductionPlan } from './lib/protected-production-plan.mjs';
assert.throws(() => protectedProductionPlan(), /SUPERSEDED_BY_FREE_ONLY_STRATEGY/);
assert.throws(() => protectedProductionPlan({ backend: { billingApproved: true } }), /SUPERSEDED_BY_FREE_ONLY_STRATEGY/);
console.log(JSON.stringify({ OFFLINE: 'PASSED', tests: 2, paidR1Disabled: true, hostedRequests: 0 }));
