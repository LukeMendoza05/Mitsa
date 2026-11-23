# Mitsa — resumed registration readiness, 22 October 2026

## Current checkpoint

The user submitted the private Supabase ticket today; support access was left **OFF**. Awaiting Auth-team technical guidance. Strict Option A is unchanged, no session-risk exception is accepted, and the original strict terminal-reuse regression is still failed. See `supabase-support-status.md` for the required provider reply and acceptance criteria.

Stage A's shared contracts, inactive service adapter, durable signup/mail authorization, independent admission/delivery controls, pending verification/recovery, worker ownership/fencing and existing MFA/workspace architecture are present and pass the current local checks. Registration is not operational under the new engine. This continuation changed no application authentication/session logic, SQL candidate, provider setting, secret, account, factor, workspace, ownership, membership, business RLS or hosted resource. No external delivery, provider Auth experiment, deployment or duplicate ticket occurred.

The working tree was preserved. Earlier landing completion was not reopened. Two artifacts referenced by that earlier chat (`src/components/site/PreviewAnalytics.tsx` and `docs/independent-landing-workstream.md`) are absent in the current filesystem; their removal provenance is unknown. They were not recreated or used as current verification evidence. This registration pass made no landing or business-module changes.

## Completed local work

| Files | Result |
|---|---|
| `scripts/build-registration-stage-c-package.mjs`, `scripts/lib/registration-package-review.mjs` | Adds `--check`: verifies the exact inactive target/source list and executes the unchanged SQL/recovery offline, comparing source hashes and all manifest fields except the audit timestamp. It leaves the reviewed manifest unchanged and rejects inactive-control/target/source/permission drift. No provider/private configuration is imported by this verifier. |
| `tests/unit/registration-package-review.test.ts`, `tests/unit/stage-c-installation-guards.test.ts`, `tests/support/persistent-database.ts` | Seventeen new cases: inactive proposal boundaries, excluded one-hour/extra SQL, manifest integrity and allowed file paths, wrong/missing target, object collision and hook definition/owner drift. The in-memory fixture can now stop before the prepared candidates. Tests prove original actor and prior policies remain, and enumerate exactly the six new private infrastructure policies. |
| `tests/visual/persistent-registration.spec.ts`, `tests/e2e/ui-refinement.spec.ts` | Optional dated screenshot/evidence destinations preserve historical captures. Existing security/data mocks and all network restrictions are retained. No application UI implementation changed. |
| Support status, submission/security/readiness/checkpoint docs | Records the submitted ticket, disabled support access, Strict Option A decision and obsolete historical status. Submitted request text is unchanged. |
| `persistent-registration-stage-c-database-only-approval.md` | Exact C1 database/hook-body scope, SQL hashes, privileges, required fresh preflight, inactive acceptance and scoped recovery; deployment/secrets/live tests/activation excluded. |

## Current verification

| Check | Result / evidence |
|---|---|
| Unit suite | **424 passed, zero failed**, including seventeen new installation/package cases. `artifacts/registration-resume-unit-final-20261022.json`. The prior 423-case pass preceded the final path-guard regression. |
| TypeScript | `npm run typecheck` passed after correcting new test query-result types. |
| Production build | `npm run build` passed; local compilation only, not deployment or live onboarding. |
| Persistent-registration browser fixtures | **9 passed**: signup, code entry/renewal, recovery, interrupted submission, explicit new-request recovery, delivery-state wording, native markup/enlarged text; 320/390/768/1024/1440px and automated WCAG checks. `artifacts/registration-browser-scope-20261022.json`. |
| Existing account/MFA/onboarding UI fixtures | **7 passed** across login, password reset, onboarding, security status/setup/enrollment/challenge; seven widths from 320 to 1440px and automated WCAG checks. These use synthetic data and block provider requests. |
| Stage C package | `node scripts/build-registration-stage-c-package.mjs --check` passed: eleven source/config/Edge files, seventeen effective functions, three FORCE-RLS tables, disabled defaults, no cohort backfill, original actor and zero-cohort recovery preserved. Existing retained-cohort recovery tests also passed. All SQL/config/Edge hashes remain unchanged. |
| Local source/safety | Pinned historical provider source and reviewed SQL match; legacy engine remains selected, configured secrets/identities absent from 42 public asset files, private files ignored/untracked. Zero provider requests, SMTP connections or live changes. `artifacts/persistent-registration-local-safety.json`. |
| Visual / whitespace | Signup mobile, verification desktop and masked synthetic MFA enrollment captures inspected; no overlapping fields/controls. `git diff --check` passed with preexisting line-ending notices. No lint script is configured. |

Initial new test issues were corrected: a preservation assertion initially treated the six documented new private infrastructure policies as forbidden changes; it now compares every existing policy verbatim and requires exactly those six additions. TypeScript required explicit PGlite row types. The first full sandbox run lost Vite cache files and blocked a synthetic Windows file-lock case; the established local environment passed the complete suite unchanged. The sandbox browser fixture stopped before becoming reachable; its runner was cancelled after checking the missing listener/process, then the same offline suite passed in the established environment. No security assertion or production code was relaxed to pass.

Fresh browser artifacts are under `docs/previews/registration-readiness-20261022/`; historical screenshot directories were not overwritten. These are fixture/serialized-markup tests, not real Turnstile, inbox receipt, provider TOTP, hosted RLS or assistive-technology certification. No hosted test was repeated.

## Authorization and operational coverage reviewed

| Boundary | Existing current coverage | What remains unproved by these local passes |
|---|---|---|
| Actor/session | 26 actor SQL cases cover exact adapter, role/audience/expiry/context, matching active session/user, missing/expired row and SQL claim injection. | Terminal family revocation retaining an active row still defeats the required immediate-denial guarantee. No local green suite changes that historical failure. |
| Workspace/RBAC/tenant | 22 workspace SQL cases cover verified/trusted-MFA binding, atomic workspace/Owner invariants, direct-role/table denial and other workspace/recovery protections. Historical catalog evidence maps 42 protected RPC paths and shop/resource RLS to the actor. | Not fresh signed-JWT execution of every RPC branch or all hosted services; no ownership or current tenant record was queried/changed here. Existing application RLS cannot compensate for a provider session that falsely remains active. |
| Signup and mail correlation | Persistent SQL/service/submission/status cases cover signed request replay, immutable intent, provider single claim, wrong callback/recipient/action, permits, quotas, policy persistence and continuation during closed admission. | Actual hosted callback round trip, provider issuance and new hook/dispatch/worker integration require approved live fixtures. No invented production callback or widened allowlist. |
| Recovery/MFA | Recovery routes keep eligibility responses generic, require correct challenge/CSRF/rate budget, reject duplicate/uncertain requests; code routes enforce identity/finalization and cooldowns. MFA state and workspace SQL protect trusted bindings and assurance. | New-engine real recovery inbox, expired/replayed recovery proof through the browser and returned recovery-session binding still need approved live integration. Historical Admin-link compatibility is not that evidence. |
| Worker lifecycle | Seven worker cases and an actual synthetic child-process crash cover stale/null heartbeat, ownership loss, transport outage/recovery, DB outage, at-most-once claim and no replay after uncertain SMTP/completion. SQL separates admission shutdown from eligible delivery and enforces rolling capacity. | Supervised hosted/operator process and real SMTP outage/restart behavior are later activation tests. No worker, SMTP connection or startup task was launched here. |

## Additional supported-provider review

The official [session documentation](https://supabase.com/docs/guides/auth/sessions) still distinguishes parent/concurrent grace exceptions from terminal reuse, and documents session-row validation after explicit logout. That supported validation remains useful but cannot detect a terminal event that leaves the row active.

The [current upstream token service](https://github.com/supabase/auth/blob/master/internal/tokens/service.go) still has a legacy `RevokeTokenFamily` path and a newer-format `LogoutSession` path; the [family helper](https://github.com/supabase/auth/blob/master/internal/models/refresh_token.go) updates revocation timestamps. This is public source inspection dated 22 October, not a hosted binary or rollout attestation. The [release page](https://github.com/supabase/auth/releases) lists v2.198.0-rc.25 as a prerelease; its existence is not evidence of a supported correction for Mitsa. No newly verified hosted solution was identified. Keep the newer-format managed rollout or a provider-supported legacy fix as questions in the existing ticket. Do not change algorithm flags, shorten JWTs, wrap the client, poll revocation tables or install a managed-Auth trigger as a substitute.

The [changelog](https://supabase.com/changelog) was reviewed; no relevant new hosted terminal-reuse correction was established. Upcoming Data API exposure changes are a later compatibility preflight item, not a reason to broaden grants now. No dependency/provider upgrade or configuration change was performed.

## Remaining work, classified

1. **Approval boundary — C1:** the exact inactive database/hook-body package is ready for review. Fresh target/marker, baseline permissions, migration history/object-collision and encrypted preservation checks are mandatory immediately before installation. October 16 hosted observations are historical, not current installation evidence. Do not install until approved.
2. **Separate approval — service and integration:** private disabled service deployment/secret setup, provider callback/OTP/encryption/recovery compatibility, and explicit synthetic side-effect/recipient budgets. Do not reuse consumed fixture grants. These are not included in C1.
3. **External dependency — Strict Option A:** awaiting Supabase Auth-team guidance. Require an exact supported correction and separately approved hosted protocol. No risk exception accepted; no full registration sign-off.
4. **Dependent activation/E2E/stability:** only after security and compatibility pass: reviewed policies, worker supervision/budgets, persistent admission/delivery, genuine full signup/MFA/workspace/recovery/returning-access flow and restart/outage/tenant tests. No activation, public deployment or internal business modules in this pass.

All independently achievable local checks in this scope are complete. Do not rerun them without changed code, failed evidence or a specific new requirement. The next user decision is approve or defer C1; the separate provider dependency waits for the user's non-sensitive technical reply. No duplicate ticket or project support access is needed or authorized.
