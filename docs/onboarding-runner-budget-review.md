# One local decision: complete the unapproved onboarding budget proposal

The assembled OFFLINE test completed both signup/OTP/MFA/workspace/logout/returning-login journeys, direct tenant/role denials and the first recovery. During the second recovery it exhausted the unchanged 200 actual Auth-request limit. It stopped rather than issuing an unbudgeted request. Four isolated fake emails and two in-memory users were involved; no hosted identity or real message was created.

The full runner is **NOT READY**. The positive integration test remains FAILED; the passing component tests are not a replacement for it. The recovery race, journal contention and missing own-profile read were independently corrected. All old attempt records, the frozen C-B source manifest and historical evidence remain unchanged.

## Proposed local-only correction, NOT applied

In `scripts/lib/onboarding-execution-scope.mjs`, request approval to change the **future, unapproved** D/E proposal:

```diff
- authRequests:200,
+ authRequests:256,
```

Also reserve its last four Auth slots exclusively for the already constrained `fixture-local-signout` cleanup operation:

```js
if(kind==='authRequests'&&!cleanup)
  assert(used<onboardingLimits.authRequests-4,'Auth cleanup reserve reached');
```

Every Auth call still counts before dispatch, including SSR calls. Source and exact-limit matching would reject any old 200-request authorization; the change grants no hosted permission. No D/E human approval or hosted worker attempt currently exists. This does not change the already approved/consumed C-B/A/B/C-A budgets or any provider rate limit. The final exact future hosted budget would be reviewed again after the complete offline journey passes.

Automatic approval review rejected this change twice, including after verification that it is a future proposal. Its stated reason was that increasing the durable 200-request limit is a persistent expansion requiring separate approval. The limit remains 200. No alternate execution path or larger mock budget has been used to bypass that rejection.

## Exact approval requested

> Approve the local D/E proposal change from 200 to 256 actual Auth requests, with four slots reserved for fixture-local-signout cleanup, and rerun the complete OFFLINE journey. This authorizes source changes and isolated local tests only. It authorizes zero hosted requests, new hosted accounts, real emails, provider changes, session-risk exceptions, public pushes or deployments.

After approval: apply only that source correction, test the cleanup reserve and restart persistence, rerun the same real-form integration, fix any remaining demonstrated defects, then create a new immutable source review. Do not label the full runner READY until both recoveries, all acceptance checks, clean process exits and preservation pass. Preserve this 200-request failure as evidence.

Hosted execution remains separately conditional on proven Strict Option A under SU-519045, a successful separately approved C-B provider-issued OTP test and its reviewed preservation transition, exact unused D/E fixtures and an explicit source-bound hosted authorization. Public release, legal readiness, transactional-mail capacity and protected deployment remain separate decisions.
