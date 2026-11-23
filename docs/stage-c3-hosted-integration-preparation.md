# Mitsa — C3 hosted integration preparation

Prepared locally after corrective C1. **Not approved and not executed.** C2 deployment/private configuration must pass first. No hosted account or Auth request is included in C2.

## C3A proposed minimal no-account protocol

Purpose: prove that the deployed private service reaches the corrected hosted command and its replay/permission boundary without admitting a user, reserving mail or assigning a policy. This can be reviewed independently of the unresolved provider session issue. It cannot satisfy Strict Option A or prove signup.

Target only `mjtejwafxriwntweussc`, exact marker, reviewed C2 source graph, legacy runtime. Preconditions: C2 accepted; preserved-account/data baseline verified; all database admission/delivery/transport/session-readiness and release/pilot gates false, zero persistent cohorts/dispatches; no worker/generation/policy assignment. Confirm at action time. Stop on drift.

**Separately proposed hosted changes:** temporarily set only `MITSA_REGISTRATION_SERVICE_ENABLED=true` for this integration test, with the existing approved signer/origin/public key. Database gates remain false and Next stays legacy. Set it back to false in a finally/recovery path even on failure. This is not opening new registration and is not an expiring signup lease. This provider-secret change needs separate explicit approval; C2 approval does not include it.

Maximum **eight requests**, no automatic retries, no cookies or retained-user bearer credentials:

| Slot | Request | Required result |
|---|---|---|
| 1 | POST with syntactically valid envelope and no private signature | 401, no command execution. |
| 2 | Same harmless `submission-status` shape signed for a foreign project | 401, no command execution. |
| 3 | Same shape signed outside the permitted timestamp bound | 401, no command execution. |
| 4 | Correctly signed envelope with unsupported action | 400, no command execution. |
| 5 | Valid signed `submission-status` for a fresh random submission UUID and synthetic `.invalid` address with no account | 200/null; exactly one durable replay-ledger row. |
| 6 | Exact replay of slot 5's body/envelope | Generic 503; no replacement ledger row, account or dispatch. |
| 7 | Newly signed independent harmless status lookup | 200/null; at most one more ledger row. |
| 8 | Direct Data API invocation of the command with public/anonymous credentials only, same harmless lookup shape | PostgREST permission denial (42501); no application-command execution or ledger row. A gateway-only 401 does not establish database denial and is inconclusive for this case. |

No `prepare`, `claim-signup`, `authorize-mail`, password-proven continuation, provider signup/recovery call, legal-version change or account creation. No verification message or SMTP connection. A timeout consumes its slot; no replacement budget is implied. Do not use a synthetic fixture with a real existing identity or read another business's data.

Expected database delta is at most two retained request-ledger hash/time rows, consistent with existing audit/retention rules; they are not deleted as rollback. Hashes/envelope values remain private. Account/MFA/business rows and consent/policy/cohort/dispatch data must stay identical. Negative cases must not expose provider errors or identifier details. Use bounded sanitized response categories and counts, not bodies/headers/tokens in logs.

End by restoring service enabled=false and verifying generic unavailable behavior only if a separately approved request budget covers that extra request; otherwise inspect secret metadata and rely on C2's prior fail-closed proof. The eight-slot budget has no hidden ninth smoke request. Confirm control/legacy/ownership/RLS and preservation metadata SELECT-only. Stop if the endpoint admitted an account, queued mail, altered business data, returned unexpected detail or failed restoration; no ad hoc account deletion/provider reset follows.

## C3B pending provider evidence

Real Before User Created and Send Email round trips, redirect query preservation, actual provider-generated OTP/resend/recovery, consent finalization and hosted encryption/queue behavior still require a new approved fixture/action protocol. Existing offline corrected-hook and bridge tests are preparation only. Existing hosted crypto proof and Yuno onboarding are historical, distinct scopes.

Do not mark security readiness true, relax private permissions, broaden callbacks or introduce a test-only account-creation bypass to obtain this evidence before the approved strict policy is satisfied. While Strict Option A remains unresolved, C3B operations requiring admitted accounts remain gated. Once supported provider guidance arrives, prepare disposable fixtures with exact account/factor/sign-in/refresh/email/workspace budgets, recipient consent and rollback/retention boundaries; request approval before live actions. No previous expired fixture budget or Gmail window carries over.

## D–F preparation remains independent

Persistent-control, queue, fencing, SMTP uncertainty, worker supervision, policy snapshots, recovery/verification continuation and restart behavior are implemented and covered offline. Their live operational proof requires separate sender/generation/worker/recipient approval after the relevant gates pass. A source-ready worker is not a running mail service, and SMTP acceptance is not inbox receipt. Closing admission must not revoke pending verification/recovery permission; a deliberate full delivery stop still prevents mail.

Strict Option A remains blocked under SU-519045. A provider acknowledgement is not a correction. Retained developer/Yuno accounts, authenticators and both business workspaces are never disposable fixtures for these tests.
