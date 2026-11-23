# Mitsa — Stage A completion and handoff

**22 October checkpoint:** Stage A remains an inactive implementation and has been reverified locally. Later approvals resolved the redacted hook/quota observations and enabled current-password hardening. The user has now submitted the Supabase ticket with support access OFF. The 16 October statements below are historical; use [the current follow-up report](registration-readiness-20261022.md) and [support status](supabase-support-status.md) for current evidence and remaining boundaries.

16 October 2026, Asia/Manila. **Stage A is complete as inactive local implementation. General registration is not operational or activated.** No live migration, hook/provider setting change, Edge deployment, SMTP connection, account creation, session-policy installation or risk acceptance occurred.

## Implemented and tested locally

Mitsa retains Next.js, Supabase Auth, signed registration intents, encrypted provider mail, trusted MFA and the existing workspace authorization foundation. The new engine is selected only by `MITSA_REGISTRATION_ENGINE=persistent-v1`; the actual private local configuration remains on the legacy engine. Missing configuration or schema fails closed. Deployment profile is independent of Next's build mode, and only the existing isolated project/origin is approved. No production target is invented.

- **Persistent controls:** independent admission, delivery, worker health, capacity, policy applicability and security-readiness controls. Their prepared database defaults are all closed. The new path does not use a thirty-minute registration lease. Legacy controlled tests remain available for compatibility.
- **Durable submissions:** stable UUID and canonical fingerprint excluding passwords/proofs; transactionally reserved mail capacity before a single provider-signup claim; retries reuse the intent and cannot create another account after an uncertain claim. A sealed own-request status can resume verification without sending mail. Only proven expired, unbound requests offer an explicit new identifier.
- **Pending verification:** provider OTP verification remains independent of new-admission and delivery availability. Password-proven continuation can recover a pending account after browser-state loss. Expired continuation requires a fresh challenge and the same applicable versioned policies; it does not renew account-creation authority or rewrite previous consent.
- **Email infrastructure:** opaque one-use request correlation, encrypted captured provider payloads, durable dispatch states, capacity reservations, conservative recipient/global limits, separate worker credentials, ownership fencing, heartbeat, restart recovery and emergency shutdown. A claimed uncertain delivery is retained and never automatically replayed. Supabase still issues and verifies OTPs.
- **Account recovery:** recovery-purpose Turnstile, private request permits, duplicate suppression, generic eligibility responses, cooldown and safe uncertainty handling. Verified cohort eligibility survives pruning of finalized intents. Existing MFA and factor-recovery boundaries remain.
- **UI:** preserved editorial typography and existing layouts; clear availability and challenge states; policy disclosure; bounded loading; focused errors; explicit interrupted-request status; delivery feedback distinguishing SMTP acceptance from inbox receipt; consistent Account → Email → Authenticator → Workspace progression. Passwords and email addresses are not stored in sessionStorage.

The source runner and supervisor are prepared but were **not started**. They cannot activate a database control. The new service source was **not deployed**. The one-hour session predicate is review-only SQL text outside the migration bundle, not runtime enforcement.

## Exact Stage A workset

The repository already contained substantial uncommitted authentication/design work. These paths were created or extended for Stage A; this is not a claim that every untracked file or all content in these files originated in this stage. No reset, commit or unrelated cleanup was performed.

| Area | Files created or extended |
|---|---|
| Contracts and private adapter | `src/lib/auth/persistent-registration.ts`, `src/lib/auth/persistent-signup.ts`, `src/lib/auth/registration-service.ts`, `src/lib/auth/deployment-profile.ts` |
| Existing auth integration | `src/lib/auth/registration.ts`, `src/lib/auth/forms.ts`, `src/lib/auth/feedback.ts`, `src/lib/auth/email-verification.ts`, `src/lib/auth/signup-challenge.ts`, `src/lib/security/auth-flow.ts`, `src/lib/supabase/server.ts`, `src/proxy.ts` |
| Routes | `src/app/auth/register/route.ts`, `src/app/auth/registration/status/route.ts`, `src/app/auth/login/route.ts`, `src/app/auth/password/request/route.ts`, `src/app/auth/email/route.ts`, `src/app/auth/email/code/route.ts`, `src/app/auth/email/status/route.ts`, `src/app/auth/email/renew/route.ts` |
| Pages | `src/app/signup/page.tsx`, `src/app/forgot-password/page.tsx`, `src/app/verify-email/page.tsx`, `src/app/verify-email/renew/page.tsx` |
| Components | `src/components/auth/SignupForm.tsx`, `src/components/auth/SignupChallenge.tsx`, `src/components/auth/RecoveryForm.tsx`, `src/components/auth/VerificationRenewalForm.tsx`, `src/components/auth/EmailDeliveryStatus.tsx`, `src/components/auth/auth.module.css`, `src/components/site/AuthForm.tsx`, `src/components/site/PostForm.tsx` |
| Undeployed private service | `supabase/functions/mitsa-registration-service/index.ts`, `supabase/functions/mitsa-registration-service/deno.json`, `supabase/functions/_shared/registration-service.ts`, `supabase/functions/_shared/registration-service-auth.ts` |
| Worker and audits | `scripts/lib/persistent-mail-worker.ts`, `scripts/persistent-registration-worker.mjs`, `scripts/supervise-registration-worker.ps1`, `scripts/build-registration-stage-c-package.mjs`, `scripts/verify-persistent-stage-a-safety.mjs` |
| Inactive database proposals | `supabase/prepared/20261016004927_mitsa_persistent_registration_inactive.sql`, `supabase/prepared/20261016005221_mitsa_persistent_registration_hooks_inactive.sql`, `supabase/prepared/persistent-registration-forward-recovery.sql`, `supabase/security-proposals/one-hour-development-session.sql.txt` |
| Configuration | `config/registration-deployments.json`, `config/persistent-registration-function-baseline.json`, `config/persistent-registration-stage-c-proposal.json`, `.env.example`, `package.json` |
| New unit regressions | `tests/unit/persistent-registration-service.test.ts`, `tests/unit/persistent-registration-sql.test.ts`, `tests/unit/persistent-signup.test.ts`, `tests/unit/persistent-status.test.ts`, `tests/unit/persistent-recovery.test.ts`, `tests/unit/persistent-mail-worker.test.ts`, `tests/unit/persistent-worker-process.test.ts`, `tests/unit/registration-deployment.test.ts`, `tests/unit/recovery-challenge.test.ts` |
| Offline/browser fixtures | `tests/support/persistent-database.ts`, `tests/support/persistent-worker-process.mjs`, `tests/visual/persistent-registration.spec.ts`, `tests/visual/data.ts`, `tests/visual/flow.ts`, `tests/visual/render.tsx`, `tests/visual/vite.config.mjs`, `playwright.persistent-registration.config.ts` |
| Documentation | `README.md`, `docs/local-setup.md`, this report, `docs/persistent-registration-stage-a-progress.md`, `docs/persistent-registration-stage-b-security.md`, `docs/persistent-registration-stage-c-approval.md`, `docs/persistent-registration-operations.md`, `docs/persistent-registration-ux-reference-ledger.md` |

Generated build/test outputs and previews are evidence, not application source. `next-env.d.ts` is generated by Next and was not used as a manual integration point. Existing dependencies, package identifier, environment values, business modules and landing design were preserved.

## Final verification

All commands below completed successfully on 16 October after the final application edits. An earlier approval-review usage-limit error prevented some attempts from executing; those attempts were not counted. After review became available, the checks were rerun successfully.

| Check | Result and practical scope |
|---|---|
| `npm run test:unit -- --reporter=json --outputFile=artifacts/persistent-registration-unit-results.json` | **351 tests, 53 files passed.** Includes prior auth/MFA/authorization regressions and new service, submission, recovery, SQL, worker and lifecycle cases. |
| `npm run typecheck` | Passed. |
| `npm run build` | Passed; optimized production build, not deployment. |
| `npx playwright test --config playwright.persistent-registration.config.ts` | **9 passed**; real page/components with synthetic adapters; 320/390/768/1024/1440px, eight axe scans, enlarged text, interrupted requests, safe new-request recovery, delivery status and recovery challenge action. No live CAPTCHA or account mutation. |
| `npx playwright test --config playwright.ui-refinement.config.ts` | **34 existing UI cases passed**, including login, verification, MFA states, onboarding, workspaces, management and keyboard/error behavior. |
| `npx vitest run --project integration tests/integration/registration-readiness-readonly.test.ts` | **3 passed**; provider confirmation settings, closed live gates, private permissions and existing shop RLS. No broad hosted mutation suite was run. |
| `npm run registration:package` | Exact candidates and forward recovery passed in offline PGlite; manifest covers ten source/config files (including the pinned Edge import map) and seventeen function definitions, owners/ACLs, forced RLS, disabled defaults and original actor preservation. |
| `node scripts/verify-persistent-stage-a-safety.mjs` | Passed; legacy engine remains selected, private configuration ignored/untracked, configured private values and retained identities absent from 42 public build/assets files, reviewed manifest matches source. This is an exact-value leakage check, not a universal proof against every encoding or future secret. |
| Original-account preservation audit | Passed; exact isolated marker/identity, verified MFA and eleven baseline application/history rows unchanged. |
| Yuno preservation audit | Passed; verified identity/trusted factor, sole workspace ownership, memberships/location IDs and creation audit retained. Its scope is checkpoint invariants, not a full-row historical snapshot or session replay. |

Offline SQL cases cover disabled defaults/permissions, consent snapshot, direct-role denial, signature replay ledger, fingerprint mismatch, provider single claim, wrong recipient/callback, expired permits, recovery after intent pruning, last-slot capacity, concurrent quota, stale/null heartbeat, renewal, worker fencing and forward recovery with retained cohorts. A real child-process crash/restart test retained the claimed dispatch as unconfirmed and sent it only once. Mock transport outage recovers health without replaying uncertain mail. Explicit database-heartbeat and lost-completion regressions prove ownership identity renewal and no resend after an uncertain persistence result. Runner JavaScript and supervisor PowerShell syntax checks also passed without starting either process.

PGlite uses an encryption policy stub: these tests do **not** establish hosted OpenPGP or hook behavior. The native/no-JavaScript browser check covers serialized fixture markup; it does not claim a live CAPTCHA can run with JavaScript disabled. Desktop/mobile signup and verification screenshots were visually inspected: labels, spacing, progress, controls and footer remain readable without overlap. Previews have empty password/code fields and contain no real identity, OTP or QR.

Evidence: `artifacts/persistent-registration-unit-results.json`, `artifacts/persistent-registration-browser-scope.json`, `artifacts/persistent-registration-stage-c-manifest.json`, `artifacts/persistent-registration-local-safety.json`, `artifacts/persistent-registration-live-readonly.json`, `artifacts/developer-reset-preservation.json`, `artifacts/controlled-account-preservation.json`; screenshots under `docs/previews/persistent-registration`.

## Live configuration and preservation boundary

Read-only final checks confirmed the approved marker, all five release gates closed, pilot/signup/delivery closed, three retained historical SMTP claims, no installed persistent tables, no new service deployment, and zero custom refresh-table triggers. All five original actor/hook/Terms/finalization definition hashes, owners and ACLs still match the Stage A baseline.

Earlier read-only dashboard observations during Stage A established JWT 3,600 seconds, rotation on/reuse ten seconds, global CAPTCHA disabled, signup enabled, confirmation required, OTP six digits/3,600 seconds and both hooks enabled. The exact email-hook pointer and email quota were redacted by the connected browser and remain **unconfirmed**. No setting was saved. Current-password and secure-password-change protections were observed off; leaked-password protection remains off and documented as a launch concern.

Static installed-definition analysis covers 42 protected RPC paths to the actor, shop RLS and the security-invoker foundation view. Storage had no buckets/custom policies and Realtime no published tables. This is not a new signed-JWT tenant or one-hour boundary test. New registration does not assign Owner or platform privileges; existing verified-email, trusted-MFA and atomic workspace-creation checks remain in the path.

## Remaining gates and next approval

1. **Stage B remains unresolved.** The strict terminal refresh-family reuse regression is failed. The proposed one-hour resource-age bound does not revoke provider credentials, constrain every direct Auth operation or establish account-takeover containment. No exception was accepted. See the separate [security assessment](persistent-registration-stage-b-security.md).
2. **Stage C source is exact but uninstalled.** Review [the SQL/configuration package](persistent-registration-stage-c-approval.md) and source hashes before any disabled installation. It adds three private tables, nullable intent extensions, narrowly privileged functions and hook-body branches, with no existing-account backfill or business RLS change. The session policy is excluded from that bundle.
3. **Hosted compatibility is pending approval.** Confirm the exact email-hook pointer/quota, narrow callback allowlist and `email_data.redirect_to` round trip; hosted password-proven pending continuation; real encryption; provider OTP/recovery expiry/replay and supported credential-hardening behavior. The shared private handler is covered locally, but a standalone Deno executable was unavailable: the Edge entrypoint/import map still needs its approved provider bundling/runtime check. Do not broaden callbacks, double-consume CAPTCHA proofs or relax validation to pass.
4. **No new live onboarding evidence is claimed.** Genuine ordinary-address registration, inbox receipt, MFA, workspace creation, returning sign-in, direct-API isolation and recovery must be exercised with separately authorized fresh synthetic identities after the required changes. Historical Yuno success remains valid but does not prove the new engine.
5. **Activation remains separate.** Policy versions/applicability, private service configuration, worker supervision, delivery budget and persistent availability require their explicit approvals. Existing Gmail transport is only for conservative low-volume development; sustained public use needs a reviewed transactional provider/domain, monitoring, legal and retention work.

Recommended next request: **approve only the reviewed disabled Stage C database/hook-body installation after rechecking target, marker, hashes and encrypted preservation baseline.** Keep all admission/delivery/security-readiness flags false; exclude the one-hour policy, provider setting changes, service deployment and live tests. Stage B's decision and provider compatibility authorizations remain separate before activation. If source/baseline differs, stop and obtain review of the changed candidate.

## Recovery and incident response

Each candidate is transactional and checks its expected baseline. Stop new admission independently of pending verification/recovery. Full delivery stop fences workers, cancels unclaimed work and retains claimed work as unconfirmed; it cannot recall accepted SMTP mail or revoke Auth sessions. Prepared forward recovery retains all evidence and cohort-aware policy/finalization when cohorts exist. Do not roll back to an app incapable of resuming those accounts, silently remove an approved future session bound, or rerun old candidate SQL as a forward fix. No destructive rollback or retained-account reset is authorized.

Stage A changed inactive implementation so continuous ordinary-address registration can replace expiring testing infrastructure. The principal remaining risks are provider correlation compatibility and the unresolved session-security decision. The next step is review of the separate security assessment and exact disabled installation package—not registration activation.
