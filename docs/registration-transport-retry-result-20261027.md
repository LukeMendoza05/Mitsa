# Mitsa — B transport retry: FAILED process lifecycle, transport body passed

27 October 2026. Scope `B-transport-retry-v2` is consumed. No automatic retry, second Gmail authentication, second database connection or Stage C execution occurred.

## Authoritative outcome

**Overall Stage B: FAILED.** Real Gmail TLS/authentication, worker acquisition/heartbeat/logical shutdown, rollback and exact encrypted pre/post preservation succeeded. The child did not exit normally after the body completed. The supervisor reached its watchdog and killed the child; a subsequent local PID check confirmed absence. Normal child-exit acceptance therefore failed.

The body took **36.268 seconds**. Recorded overall supervisor duration was **305.610 seconds**, exceeding the approved 300-second limit by **5.610 seconds**. This is a runtime-limit failure, not an allowance extension. The timer currently starts after fork returns instead of deducting startup time. The watchdog terminated the process, but its observed wall time cannot be reported as within the approved bound.

`artifacts/registration-transport-retry-result.json` is the unchanged **body-only** result (`PASSED_TRANSPORT_ONLY`), written before final resource/process cleanup. It must not be used alone to claim overall success. The final combined assessment is `artifacts/registration-transport-retry-supervision-result.json`; private `attempt.json`, `budget.json`, `terminal.json`, approval, and encrypted observations remain under `.secrets/registration-final-v1/B/`.

## Exact sources and reference

- Review manifest: `7d354cffb5f50993167485b803de76d9f6be6cb1178dfa9407b08bfe39a13d55`.
- Executed runner: `scripts/registration-transport-retry.mjs`, SHA-256 `547fdb02f983cd9171211dffae4190a0900fe592760dc34ff41f5284a162ffbf`.
- Accepted A candidate: `05206a18393390f9849ea5c2e3b3ae8a50f2b0e25f86bcdc0056ed02ab77318e`.
- All **109 reviewed sources and 27 historical source/evidence files** still match. The executed runner is archived byte-for-byte in `docs/history/b-transport-retry-v2/registration-transport-retry.mjs.txt`.

## Actual consumption and effects

| Category | Actual | Approved ceiling |
|---|---:|---:|
| DB connections | 1 | 2; second read-only reconciliation only |
| SQL statements | 119 | 180 |
| SELECT-only | 108 | 164 |
| Write-capable calls | 4, all rolled back | 4 |
| Transaction/lock statements | 7 | 12 |
| Supervised hosted worker launches | 1 | 1 |
| Gmail TLS/authentication verifications | 1, successful | 1 |
| Overall seconds | **305.610 — exceeded** | 300 |
| Emails / accounts / Auth / Edge requests | 0 / 0 / 0 / 0 | 0 |
| Committed application changes / provider changes | 0 / 0 | 0 |

The four temporary writes were the reviewed delivery-control update, worker acquisition, heartbeat and shutdown heartbeat. Admission and strict security readiness stayed closed; no job was claimed and no email-send path ran. The write transaction returned a successful ROLLBACK before postflight. The two read-only preservation transactions completed normally. The worker's logical shutdown and transport closure are distinct from the failed normal child-process exit.

One identity-checked local early-stop helper failed without confirmed termination; it made no hosted request and was not retried. The reviewed supervisor subsequently recorded SIGKILL. Child absence is now confirmed. No read-only reconciliation was attempted after the 300-second deadline; unused connection/SQL capacity does not extend that deadline.

## Preservation and disabled controls

Both encrypted observations were independently decrypted and their ciphertext/plaintext digests verified. Comparisons of accepted reference → preflight and accepted reference → postflight are **exact**, with zero findings. This includes all 41 application/foundation tables, whole-row/protected/activity Auth fingerprints, identities, MFA, memberships, ownership, locations, historical records and captured security metadata. No known-activity exception was used.

All 23 corrected C1 function definitions/owners/permissions match; managed Auth privileges remain unchanged, the registration role is not elevated, the three private registration tables retain forced RLS, and the 24-entry migration checkpoint matches. Registration, delivery, transport, security-readiness and release/pilot controls were closed at completed postflight; the queue remained unchanged/empty. No later hosted observation is claimed. No account, MFA or provider-setting change was made. The earlier unexplained historical one-account Auth difference remains unresolved and its evidence is retained.

## Local correction and tests

The runner installs an emergency IPC disconnect listener but never removes it or disconnects the completed child. An isolated process-only fixture reproduces the same hang after a completion message. This establishes a concrete lifecycle defect consistent with the hosted symptom; no hosted active-handle capture was taken to prove it was the only open handle.

Inactive candidate `scripts/lib/registration-transport-lifecycle.mjs` removes only the owned emergency handler, closes IPC after resource cleanup, and calculates remaining runtime from the original claim/approval deadline, including process startup. A reviewable proposed runner is saved as **non-executable text** at `docs/proposals/registration-transport-retry-lifecycle.mjs.txt`; it is not installed into the frozen runner or authorized for hosted execution. Source hashes are in `artifacts/registration-transport-lifecycle-candidate.json`.

**OFFLINE:** ten checks across two files passed, including real process-only reproduction, corrected normal exit, retained failure exit code, handler isolation, startup/deadline accounting and unchanged approval/budget protections. TypeScript passed after correcting two types in the new test fixture. These fixtures contain no mail worker, database, credentials or network operations. No application/UI source changed, so no browser journey or production build was repeated or claimed as new evidence.

## Next boundaries

1. Integrate/review the lifecycle candidate in a **fresh independently budgeted B scope**, with an exact new source manifest, unchanged accepted-reference binding, a fresh private root, and aggregate outcome recorded only after confirmed process exit. Historical B/D attempts remain consumed. Obtain separate approval before any new database/SMTP/worker execution. No repeated A capture or baseline replacement is needed unless a future exact preservation check actually fails.
2. Stage C real-mail execution is **not approved or ready to run**. It requires successful B lifecycle verification, the final source-bound provider/Auth/browser/worker protocol, explicit synthetic recipients/accounts/mail limits and separate approval. SMTP login here is not evidence of inbox delivery, numeric-code verification or persistent-engine onboarding.
3. Under the current approved policy, C–F admission tests additionally need Strict Option A satisfied or an explicitly approved, precisely scoped synthetic-only exception. None has been accepted. Supabase ticket **SU-519045 remains BLOCKED**; no provider experiment, support message, managed Auth modification or workaround occurred.
4. General registration and external delivery remain disabled. C1/C2/C3A/C3B(a) and accepted A remain preserved/PASSED. Real persistent-engine mail, onboarding, recovery and operational acceptance remain pending; final activation is not authorized.
