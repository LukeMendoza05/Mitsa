# Additional assembled failure acceptance — 28 October 2026

**Eight new OFFLINE negative journeys passed. Full positive acceptance remains FAILED and the hosted runner remains NOT READY.** The original 200-Auth-request limit is unchanged. No approval to increase it has been received or inferred from Goal continuation.

These tests use the real assembled controller, database/control/preservation adapters, mail worker, credential fence, encrypted acknowledgements and, where the failure occurs after startup, real built Mitsa forms in owned Next.js and disposable Edge processes. Only provider, database transport and SMTP are isolated fakes. They do not create hosted users or deliver real mail.

| Injected failure | Verified outcome |
| --- | --- |
| Preflight preservation mismatch | Stops before account creation or SMTP; retained comparison is not silently accepted. |
| Worker acquisition failure | Does not proceed to signup; controls/service are restored and preservation is checked. |
| Provider outage | Stops; unavailable restoration evidence cannot become a passing acceptance result. |
| Captured recipient mismatch | Rejects before mail reservation/submission; keeps the dispatch unconfirmed and does not verify an OTP. |
| Uncertain SMTP send | Retains exactly one consumed email claim and one attempt; no automatic resend, OTP verification or duplicate delivery. |
| Missing human inbox confirmation | SMTP acceptance alone does not permit OTP verification. Cancellation closes the waiting flow and preserves consumed authority. |
| Incorrect workspace ownership | The independent authorization observer rejects the visual workspace result; onboarding is not marked complete. |
| Database cleanup failure | A destroyed stream is not reported as verified successful cleanup; acceptance remains failed. |

Every case compared the durable operation counts with a newly reconstructed scope. Consumption matched and was never refunded/reset. Each fixture used at most the existing 200 Auth calls. These are **passing negative tests of failures**, not proof of a successful registration journey.

Evidence: `artifacts/onboarding-assembled-failures-offline-v1.json` (8/8 passed, zero skipped). Together with the preceding 205 distinct component/process cases, **213 unique OFFLINE cases across 26 passing test files** are verified. The separate full positive journey failure remains in `artifacts/onboarding-assembled-offline-v15.json`; it has not been rerun or relabeled. TypeScript, syntax, private-fixture exposure checks and compiled/source integrity checks passed. Application/build sources were unchanged; the prior successful production build remains exact across all 1,065 pinned compiled files.

Active incomplete source review, version 4: `config/registration-onboarding-review.json`.

SHA-256: `c8392e7ead65d1926ee8dd1deb9537cdc844380ec890f68bf0fb74559dc1f029`.

Immutable copy: `artifacts/onboarding-assembly-review-v4.json`; local verification: `artifacts/onboarding-assembly-failure-review-v4.json`. Version 3's manifest and the exact earlier offline-infrastructure/positive-test bytes were preserved with matching reviewed hashes before advancing the active review. All original 128 frozen C-B sources and 64 historical evidence hashes match. No historical hosted allowance or approved source package changed.

Only offline infrastructure fault injection and test files were added/changed. The positive test, operational runner, security policy and 200-request limit were not weakened. The readiness ledger was archived before adding this evidence. No hosted approval/attempt, account, email, provider change, worker launch, push or deployment occurred.

The next local decision remains the precise **local-only** request in `docs/onboarding-runner-budget-review.md`: permit preparing the future 256-request proposal with four cleanup slots and rerun full offline acceptance. Automatic approval review previously rejected that expansion; it remains unapplied. This decision would not authorize hosted execution or waive Strict Option A.

Managed Supabase/Strict Option A remains blocked under SU-519045. GitHub publication and Vercel preparation remain as documented in `docs/onboarding-assembly-checkpoint-20261028.md` and `docs/onboarding-publication-preview-scope.md`; nothing was published. These eight negative tests add evidence and do not clear any public-registration release gate.
