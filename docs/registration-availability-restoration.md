# Mitsa — registration availability diagnosis and correction

**16 October investigation update:** the optional rehearsal below is not approved. The [continuous-registration investigation](general-registration-readiness-investigation.md) supersedes its next-step recommendation, separates policy risk from signup feasibility, and proposes replacing fixed human windows with durable development controls and renewable service health. Historical test evidence is preserved; registration and delivery remain closed.

## Exact cause

Read-only checks of isolated project `mjtejwafxriwntweussc`, after verifying marker `fireworks-foundation-proof-01a12e38`, establish:

- Local mode is `development-open`, using the approved loopback origin.
- The test agreement exists. Its public and pilot registration flags are false.
- The pilot row has `enabled=false`, `smtp_enabled=false`, a closed/expired lease, and no fresh worker heartbeat. Its private runtime file is expired.
- The intent signing key and both Turnstile credentials are present. No credential value was printed.
- Supabase provider signup is enabled, email confirmation remains mandatory, and anonymous signup is disabled.
- The rejected Auth-table trigger remains absent. General registration security evidence remains false because terminal refresh-family reuse denial is unresolved.

The expired lease was deliberately closed after the successful controlled onboarding test. `registrationPolicyMode()` correctly refuses `development-open` when the database pilot flag is false; `registrationContext()` therefore returns `enabled=false`. That result disables the form. This is not evidence of a missing email key, failed registration-intent request or broken CAPTCHA. The page did not attempt account creation in this state.

The defect was presentation: every false readiness result displayed “The current account setup could not be verified,” which misrepresented an intentional closure as an unexplained technical failure. The ordinary-address mode exists but its activation remains conditional; changing its name or removing developer eligibility checks would not reopen the closed lease safely.

## Completed corrections

The same permission/readiness expression is retained. An additional bounded presentation state distinguishes `available`, deliberately `closed`, worker/delivery `paused`, and genuinely `unavailable`.

- Closed signup now says new registration is currently closed and existing accounts can still sign in.
- A healthy policy with unavailable development mail runtime is described as paused.
- Missing policy/signing/CAPTCHA/provider safeguards remain unavailable and fail closed.
- Delivery-only continuation is labeled closed for new accounts while retaining its existing independent email readiness.
- Stale valid submissions receive `registration_closed` or `delivery_paused` with the unchanged HTTP 503 rejection. CSRF still rejects with 403. No intent or provider signup is invoked through the closed branch.
- The disabled page suppresses a redundant stale query error; all fields, password controls, terms version, consent checks and existing visual styling remain.

No database, Auth hook, provider setting or availability flag was changed. The new error codes describe existing refusal conditions; they grant no permission. Supabase hook pointers are not exposed by the public settings endpoint, so this diagnosis does not claim to have reread their dashboard configuration. Hosted signed-intent/direct-signup denial tests provide scoped enforcement evidence.

## Verification

`artifacts/registration-availability-diagnosis.json` retains the pre-fix diagnosis. `artifacts/closed-registration-feedback.json` proves the actual loopback GET displays the closed message and an anonymous, CAPTCHA-less negative POST receives 503/`registration_closed`; invalid-origin POST receives 403. Account, intent, capture and SMTP claim counts were unchanged.

The first full suite after the feedback fix passed 292 unit tests across 43 files; the production build passed. The new closed/paused browser case passed at 320, 390, 768, 1024 and 1440px with no automated accessibility violations. The earlier comprehensive UI suite remains scoped UI evidence, not proof of new live registration.

Hosted run: eight Auth-setting/registration-edge checks passed. Two older pilot tests initially failed because they compared the latest lease with the old Gmail self-test window and expected its global ledger count of two. The separately approved onboarding continuation added one authorized claim. The corrected test strictly reconciles both approval windows, recipient bindings, timestamps and all three accepted claims; it rejects extras. The negative signup test checks unchanged before/after delivery counts. Both tests then passed. No history or delivery record was removed to make the tests green.

Original developer account/MFA and the 11 protected account/workspace/history rows passed the encrypted preservation comparison. No real account, MFA factor, workspace ownership or historical business record was modified. Further test totals and preparation status will be appended as the remaining review work completes.

## What remains blocked

**Ordinary new-user registration is not active. Gmail delivery remains closed.** This correction fixes misleading feedback, not the activation decision. Do not keep submitting signup or start a delivery process as a workaround.

General activation still requires resolution of the refresh-family security requirement, or an explicit separately reviewed security decision. The provider clarification request remains prepared for private submission. A 30-minute registration/email lease does not establish a 30-minute compromise bound: existing sessions may survive its closure and refresh replacement remains the unresolved issue. Neither the risky trigger nor a silent change to the passing criterion is acceptable.

## Smallest separate testing proposal — not approved or activated

If the user wants an additional rehearsal before Supabase responds, the narrow proposal is one new unallowlisted synthetic `+onboarding-…` alias of the dedicated sender, one new synthetic workspace, a maximum 30-minute loopback window and **two** user-initiated signup verification emails (initial plus at most one resend). It is a controlled exception for synthetic data, not ordinary-address/general registration or authentication security sign-off.

Keep real Turnstile, signed intents, replay/CSRF/rate protections, six-digit provider OTPs with 3,600-second expiry, encrypted capture, MFA, atomic workspace creation and tenant RLS. Use a separate private recipient file; retain Yuno's identity file, checkpoint and completed evidence. Never add the new alias to the developer allowlist. No account is created automatically. The user would complete the challenge, verify the private inbox code, enroll MFA and create a fictional workspace in a separate Guest browser profile; then sign out, return through password+MFA and reopen that same workspace.

The operator preparation adds an optional `--registration-rehearsal` flag to the existing controlled service. It cannot run in general/resume/check/stop mode; it requires a one-use private approval record explicitly accepting the unresolved reuse risk for this synthetic rehearsal only, matching the new recipient hash, forbidding existing-account/provider changes and fixing the two-email/30-minute budget. Missing approval fails closed. The ordinary activation guard and failed refresh-reuse evidence remain unchanged. No approval or new recipient file has been created.

The guarded preparation is now tested offline and described in `docs/registration-rehearsal-approval.md`. It preserves the prior runtime/lease history before a new run, supports strict reconciliation afterward, enforces the two-email budget in the durable claim function, and excludes recovery mail. Read-only checks confirmed the original controlled identity, trusted factor, sole ownership and location IDs. The existing operator preflight confirms protected credentials readable and capacity available without any SMTP connection. No approval or new recipient file exists. Activation still requires a fresh explicit scoped decision; no window has opened.

The recommended path remains provider clarification first; the previous controlled onboarding journey is already complete. The optional rehearsal cannot prove the missing terminal-revocation guarantee or justify general activation.

## Files changed for this correction/preparation

```text
src/lib/auth/registration-policy.ts
src/lib/auth/registration.ts
src/lib/auth/feedback.ts
src/app/signup/page.tsx
src/app/auth/register/route.ts
scripts/diagnose-registration-availability.mjs
scripts/verify-closed-registration-feedback.mjs
scripts/lib/closed-pilot-evidence.mjs
scripts/lib/registration-rehearsal.mjs
scripts/lib/pilot-mail-claim.ts
scripts/verify-controlled-account-preservation.mjs
scripts/verify-delivery-only-window.mjs
scripts/isolated-registration-service.mjs
tests/unit/registration-context.test.ts
tests/unit/closed-pilot-evidence.test.ts
tests/unit/registration-rehearsal.test.ts
tests/unit/workspace-sql.test.ts
tests/integration/pilot-disabled.test.ts
tests/visual/data.ts
tests/visual/registration-availability.spec.ts
playwright.registration.config.ts
```

## Final local and scoped hosted checks

The final full unit run passed **305 tests across 44 files**. TypeScript passed after correcting a test-fixture typing issue. The production build passed after the application feedback changes; subsequent operator-only preparation does not alter its application bundle. All ten scoped hosted cases passed (eight Auth/Edge checks plus the two corrected closed-pilot cases). The actual closed signup/CSRF/no-side-effect probe and the closed/paused responsive accessibility case passed. Protected Gmail credentials are readable, capacity is available, and no SMTP connection or external email was attempted. Original developer encrypted preservation and controlled-account identity/factor/owner/location checks passed within their stated scopes. The unresolved refresh-family regression has not been relabeled passing, and no new full onboarding journey has been claimed.
