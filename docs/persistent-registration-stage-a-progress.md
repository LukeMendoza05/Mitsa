# Mitsa — Stage A implementation checkpoint

16 October 2026. **Stage A completed; stopped at the next approval boundary.** The authoritative final workset, results, preservation scope and remaining gates are in [the completion report](persistent-registration-stage-a-report.md). Final checks: 351 unit tests in 53 files, TypeScript, production build, 9 new and 34 existing browser cases, 3 read-only hosted checks, both preservation audits, offline SQL/recovery package and private-asset safety audit passed. No live activation or migration occurred. Earlier checkpoint evidence and worklist below are historical, superseded by that report.

## Non-negotiable boundaries

- No live migrations, installed hook/provider changes, account creation, external messages, registration activation, risk acceptance or deployment.
- Preserve developer/D Extacy Fireworks and Yuno/L.F Fireworks, all factors, memberships, locations, ownership, agreements and history. Retained accounts are never disposable fixtures.
- Keep the rejected managed-Auth trigger absent. Do not implement the one-hour actor policy in runtime code. Its exact review-only proposal is a `.sql.txt` file outside the migration bundle.
- Final product supports real ordinary-address users/businesses. Isolation is a validation stage, not a permanent synthetic-only product architecture. No production target or URL is invented.
- Preserve the substantial preexisting working tree. No commit/reset/cleanup of unrelated files.

## Implemented locally

1. `src/lib/auth/persistent-registration.ts`: shared versioned policy, submission/readiness/dispatch contracts and strict correlation URL parser.
2. `registration-service.ts`: inactive-by-default server adapter. The new engine requires `MITSA_REGISTRATION_ENGINE=persistent-v1`; no local environment was changed. DB readiness is authoritative. Missing schema/service/key stays closed.
3. `deployment-profile.ts` and `config/registration-deployments.json`: explicit deployment stage independent of NODE_ENV, approved isolated target/origin, no approved production/pilot target. Cookie/CSP integration only changes behavior when the persistent engine is selected.
4. New private Edge source `supabase/functions/mitsa-registration-service`: versioned HMAC audience separate from the legacy endpoint, bounded request streaming, strict per-command payloads, deterministic domain-separated submission nonce, durable SQL replay ledger. Disabled without explicit configuration; not deployed.
5. `persistent-signup.ts` + register route: stable ID, canonical non-password fingerprint, durable mail reservation BEFORE atomic provider claim, only one provider signup attempt, sealed uncertain-result context, status endpoint, pending continuation without automatic resend. Existing legacy routes remain selected by default.
6. Signed password-proven pending continuation in login, verification renewal with fresh CAPTCHA/agreement, separate resend authorization, own-flow delivery status. Historical OTP/MFA architecture remains.
7. Recovery form and request route: recovery-specific Turnstile action, private one-use mail authorization, generic eligibility response, cooldown, no automatic retry after uncertain provider result.
8. Signup UX: stable UUID storage only (no password/email storage in sessionStorage), bounded submission wait, status/retry of same request, persistent labels, versioned notice disclosure, clear disabled-CAPTCHA guidance. Challenge has bounded loading and explicit retry without discarding fields. Existing typography/palette preserved.
9. `scripts/lib/persistent-mail-worker.ts`: separately injected transport, DB ownership fencing, heartbeat, at-most-once claim, uncertain-outcome retention, transport recovery. Prepared operator runner and PowerShell supervisor have no activation command; closed/missing controls cannot connect to SMTP. No runner was started.

## Exact proposals prepared — NOT installed

- `supabase/prepared/20261016004927_mitsa_persistent_registration_inactive.sql`: three private FORCE-RLS tables, additive nullable intent extensions, separate admission/delivery, capacity reservations, private commands, worker fencing, emergency stop. All controls disabled and session-security readiness false. No existing-user backfill or Auth write.
- `supabase/prepared/20261016005221_mitsa_persistent_registration_hooks_inactive.sql`: exact installed-definition hash/owner guards; legacy compatibility copies; strict new-cohort before-user/email branches; one-use canonical callback correlation; cohort-aware Terms and finalization. Hook pointers are unchanged. Recovery relies on durable verified policy assignment, not prunable finalized intents.
- `supabase/prepared/persistent-registration-forward-recovery.sql`: stops controls, preserves every table/record, restores old hooks; retains cohort-aware policy/finalization if any new cohort exists. This recovery source needs final offline verification and packaging.
- `supabase/security-proposals/one-hour-development-session.sql.txt`: exact future actor predicate; review only, not run/imported/included in migration bundle.
- `config/persistent-registration-function-baseline.json`: fresh read-only hashes/owners/ACLs; actor still original hash `587aff...d652`.
- `artifacts/persistent-registration-access-surface.json`: installed static call graph for all 42 protected RPCs and RLS/view surface observations, explicitly not fresh signed-JWT execution.
- `docs/persistent-registration-stage-b-security.md`: separate strict/bounded assessment, direct Auth credential-change limitations, tests and approval boundaries. No risk accepted.

## Historical intermediate evidence — superseded

- Prior baseline: 305 unit tests / 44 files, TypeScript, three read-only integration checks passed.
- After initial implementation: full **321 unit tests / 47 files** passed. Additional signup/recovery/deployment tests were added afterward and passed in a focused 17-case run; run the complete suite again before sign-off.
- Latest SQL-only run: **7 tests passed**, including recovery after finalized-intent pruning and the final available mail-slot race.
- Latest TypeScript check passed before the final SQL/test additions; rerun at completion.
- Production build passed before the latest source/UI edits; rerun at completion.
- New fixture browser suite: **8 cases passed**, covering 320/390/768/1024/1440, eight axe scans, enlarged text, uncertain submission, recovery action and delivery status. All provider traffic mocked/blocked; no real CAPTCHA/onboarding claims. Screenshots exist in `docs/previews/persistent-registration`. The initial screenshot masked EMPTY password fields magenta; the test now asserts empty inputs and takes unmasked synthetic screenshots. **Rerun to replace the initial previews**, then visually inspect desktop/mobile.
- No active tool process/session remains at this checkpoint; completed handles were consumed. Do not restart a process solely based on a stale file.

## Important implementation findings to preserve

- PostgreSQL regex repetition upper bound 256 is unsupported. Hook uses regex plus explicit 32–256 length check. Do not restore `{32,256}` in PostgreSQL.
- PL/pgSQL record variable `d` conflicts with SQL alias `d`; claim guard uses alias `permit`.
- PostgreSQL JSON timestamps include offsets; shared schemas accept offsets.
- Mail capacity must be reserved BEFORE provider signup claim. Claim checks its own live reservation and health, not the remaining global capacity (otherwise the final slot blocks itself).
- Passwords are never included in the canonical fingerprint, service payload or DB records. Stable ID retries cannot trigger another provider signup after the atomic claim.
- Provider v2.197.0 password-grant source authenticates password before returning `email_not_confirmed`; live compatibility remains a later gate, not a new Stage A hosted test.
- Current password settings off mean the prospective resource-age cap does not constrain direct provider credential changes. Keep that concern explicit; do not mark strict refresh reuse passing.
- All observed live registration/release/pilot gates remained closed; historical delivery claims stayed three. No managed-Auth custom trigger exists. Fresh preservation verification still needed for final report.

## Historical worklist — completed within Stage A or explicitly deferred in final report

1. Complete negative/edge regression coverage: renewal preserves original consent/creation authority; missing/null/stale heartbeat; quota concurrency; expiry; recovery-specific actual validator; private status/cookie behavior; failure/restart recovery. Add an actual mocked child-process restart test if feasible without live services.
2. Review unresolved defects/edge cases, including changing identity details after an uncertain submission, private status rate-budget use, stale reservations, timing around provider callbacks, and safe shutdown of an in-flight SMTP claim. Do not silently relax assertions.
3. Complete Stage C package: dependency/order/permissions manifest, exact config proposal (private service disabled, narrow redirect allowlist pending real compatibility, no global CAPTCHA/SMTP/JWT change), preservation checks, reviewed hashes and tested forward recovery. Create no live policy versions or private service secrets.
4. Finalize Stage B assessment and UX reference ledger using the already attempted Refero research (NO_SUBSCRIPTION), bundled craft, approved Mitsa screenshots and primary Linear/Notion references. Do not let unavailable paid research block implementation.
5. Finish docs/README/.env.example for inactive configuration, worker operation/shutdown, tests, limits, policy scopes and future production transition. Do not change `.env.local`, private identities or activation records.
6. Run full unit, TypeScript, fresh build, new browser suite and relevant existing fixture regressions; inspect new screenshots. Run ONLY the inspected three read-only hosted registration checks and read-only preservation audits. No broad hosted test command, email or live account creation.
7. Scan public bundles for private secrets/fixture leakage; verify no actual environment activation or database changes; audit changed files against the goal. Produce final Stage A report with exact files, tests, pending live-provider dependencies and the next separate approval boundary. Keep goal active until all explicit Stage A requirements are proven.
