# Mitsa — developer registration and authentication refresh

The approved developer activation is complete in isolated project `mjtejwafxriwntweussc` only. Sign In and Sign Up now use a balanced two-column desktop composition and a focused single-column tablet/mobile form. The approved landing, motion and 3D assets are preserved. Public registration, external mail, production, disposal and legal publication remain closed.

## Why registration failed

The previous signup handler rejected personal addresses before requesting a signed registration intent. The private synthetic-recipient constraint and strict provider/mail hooks independently required explicitly allowlisted `foundation-…@example.invalid` addresses. The supplied personal email was valid but absent from that allowlist, with no Auth account at the initial check. A generic error hid the deliberate restriction. Captured mail and mandatory provider confirmation were already configured; missing SMTP and password strength were not the demonstrated cause.

The reviewed fix adds a separate private singleton allowlist for only the email supplied in ignored `.secrets/developer-registration.json`. Existing synthetic eligibility is preserved. The preliminary local email-hash check is not the authorization boundary: signed server requests, database recipient approval, provider nonce binding, explicit current Terms, expiry, replay protection, rate limits and the encrypted Send Email hook remain mandatory. No product role is self-selected or assigned by signup.

## What is active

- Applied migration `20261014055453_mitsa_developer_registration` after rechecking exact project, marker, closed gates, storage/data guard and private recovery snapshot. All 3,544 original application/probe records were preserved; forced RLS, internal role restrictions and sole-Owner constraints passed postflight.
- Enabled only the privately supplied developer email; zero accounts, passwords, factors or memberships were created by operator activation. The singleton refuses substitution with a different developer identity.
- Deployed `mitsa-registration-intent` version 3. Existing private HMAC authorization, timestamp/body binding, atomic replay, no CORS, unchanged successful response and `verify_jwt:false` remain in force. Publishable key and Origin are not treated as sufficient authorization. Only bounded failure codes were added. The obsolete import-map path caused one pre-publication deployment failure; explicitly specifying the bundled import map resolved it.
- Provider signup remains controlled by the existing strict hooks. Confirmation stays mandatory; anonymous signup and unrestricted public registration remain closed. No external email, paid upgrade or production action occurred.
- Read-only checks subsequently observed an account for the approved email awaiting confirmation, with captured verification messages. The agent did not create that account or access its password. Use the status command for its current state; this observation is not a claim that personal verification/MFA/onboarding has already been completed.

The activation review, fingerprints and containment procedure are recorded in [developer-registration-approval.md](developer-registration-approval.md).

## Complete your account privately

Use the running app at <http://127.0.0.1:3000>. Commands run from this repository in your local terminal; no per-attempt database edits are required.

1. Run `npm run auth:developer -- status`. It reports boolean approval/account/verification status without printing your address. Authorization is already active. If no account exists, visit <http://127.0.0.1:3000/signup>, enter the exact approved address, choose your own password and explicitly accept the current isolated test agreement. If an account already exists, continue verification or sign in rather than repeatedly registering.
2. Run `npm run auth:developer -- inbox`. It decrypts only your captured messages into ignored `.secrets/developer-mail/`. Open `.secrets/developer-mail/latest.json` privately in your editor, copy its `url` into the browser and select **Verify email**. The link opens a confirmation screen; only that explicit action consumes it. Keep the URL/message private. No real email is sent. Refresh the private inbox after another attempt so that you use the newest message.
3. After confirmation, follow **Review account security**. Confirm your password with **Confirm identity**, start authenticator setup, scan the QR code in your authenticator app and enter its current code with **Confirm new authenticator**. Keep the setup key private. Owner access requires the trusted, verified authenticator; registration alone does not satisfy MFA.
4. Return to <http://127.0.0.1:3000/onboarding>. Use fictitious details and a business name beginning **Synthetic**, such as **Synthetic Developer Workspace**, plus a fictitious first shop/warehouse. **Create workspace** atomically makes you its sole Business Owner and opens its authenticated overview. Inventory, checkout, customer orders and reporting remain planned modules.
5. **Sign out**, return to <http://127.0.0.1:3000/login>, enter your email/password, choose **Verify authenticator** when prompted and enter the current code. Select your authorized workspace. Other workspaces remain inaccessible.

If a verification link expires or was consumed, use a fresh captured message. The form reports the known failure safely. Email registration intents remain limited to three per hour; do not keep resubmitting the form if it reports a limit. If already verified but you forgot the password, use **Forgot password?**, then the same private inbox command for the captured recovery message; existing MFA remains required. Never paste a password, message URL, setup key or private file into chat.

The local guide <http://127.0.0.1:3000/testing/registration> contains the same workflow. It cannot authorize an address and returns 404 in production mode. Private files and credentials are Git-ignored.

## Interface changes and visual evidence

Desktop uses the existing Mitsa serif/sans system, white canvas, fog editorial panel, original HTML workspace preview and a 420–464px form. Below 1024px the story panel is removed and the form takes priority. Persistent labels, show/hide controls, a password-row recovery link, compact development disclosure, pending states and safe focused errors work with native POST fallback. Password and agreement values remain in the live form after enhanced errors; nothing is saved to browser storage. CSS focus/press/entrance transitions respect reduced motion.

Browser review found and fixed blur validation moving the agreement checkbox during a click, and error focus running before the updated mobile form committed. The redirect audit confirmed that the existing shared server helper already returns validated JSON destinations for enhanced forms and preserves native 303 responses; the new signup form supports that contract plus a safe followed-redirect fallback. Complete synthetic flows then passed with and without JavaScript. Native endpoints, successful redirect destinations and cookie/session behavior remain unchanged.

All 12 final screenshots were visually inspected at exactly 320×568, 390×844, 768×1024, 1024×768, 1440×900 and 1920×1080. No horizontal overflow was found. Screenshots contain no entered credentials. The small development-tool box in development captures is not application content.

| Page and viewport | Before | After |
|---|---|---|
| Sign In, 1440×900 | [Before](previews/auth-refresh/before/login-1440x900.png) | [After](previews/auth-refresh/after/login-1440x900.png) |
| Sign Up, 1440×900 | [Before](previews/auth-refresh/before/signup-1440x900.png) | [After](previews/auth-refresh/after/signup-1440x900.png) |
| Sign In, 390×844 | [Before](previews/auth-refresh/before/login-390x844.png) | [After](previews/auth-refresh/after/login-390x844.png) |
| Sign Up, 390×844 | [Before](previews/auth-refresh/before/signup-390x844.png) | [After](previews/auth-refresh/after/signup-390x844.png) |
| Sign In, tablet | [Before](previews/auth-refresh/before/login-768x1024.png) | [After](previews/auth-refresh/after/login-768x1024.png) |
| Sign Up, tablet | [Before](previews/auth-refresh/before/signup-768x1024.png) | [After](previews/auth-refresh/after/signup-768x1024.png) |

The [before manifest](previews/auth-refresh/before/manifest.json) and [after manifest](previews/auth-refresh/after/manifest.json) list all requested sizes and titles. Enlarged actual text captures are under `previews/auth-refresh/accessibility/`.

## Verification

| Check | Result |
|---|---|
| `npm run typecheck`, `npm run build` | Passed |
| `npm run test:unit` | 129 passed |
| Isolated registration/authorization integration regressions | 20 passed |
| Exact private developer authorization test | Passed: signed intent, unchecked Terms, replay, anonymous RPC, transactional revocation; no agent-created account |
| `npx playwright test --config playwright.auth-refresh.config.ts` | 14 passed on desktop/mobile; real enhanced/native signup, explicit verification, MFA, sole Owner, protected routes, login/logout, duplicate feedback, invalid input/credentials, Terms, CSRF, pending/network errors |
| Captured password-recovery browser regressions | 2 passed on desktop/mobile; trusted MFA required and old sessions revoked |
| Production browser regressions | 34 passed on desktop/mobile: native MFA lifecycle, refresh, HttpOnly cookies, session isolation/revocation, callbacks, CSRF, membership denial, public accessibility, branding, clean browser requests and retired-route 404 |
| Responsive/accessibility | All six sizes; automated WCAG A/AA, keyboard/visible focus, focused errors, actual doubled text sizes, reduced motion, no browser storage |
| Public-file/private-value audit | 262 files checked at the recorded audit checkpoint; no private email or configured signing/encryption/admin/database secret found in public bundles/source/docs/artifacts or signed-out auth pages |
| Landing preservation | All 14 tracked landing/motion/asset hashes unchanged |
| Database preservation | 3,544 original application/probe records preserved; forced RLS, zero unsafe/legacy roles, valid sole Owners, all gates closed |
| Advisor | Existing leaked-password-protection warning only; no new RLS advisory |

Evidence: [developer authorization](../artifacts/developer-registration-verification.json), [deployed endpoint smoke](../artifacts/registration-edge-smoke.json), [public-file/landing audit](../artifacts/auth-refresh-audit.json). Initial browser failures were corrected and rerun; no configuration was skipped to claim success. Expected malformed/revoked-cookie tests produce server-side SDK warnings and generic denials.

## Files changed for this follow-up

- Presentation: `src/components/auth/AuthLayout.tsx`, `SignupForm.tsx`, `auth.module.css`; `src/components/site/AuthForm.tsx`, `PasswordField.tsx`, additive `site.module.css`; `src/app/login/page.tsx`, `signup/page.tsx`, `verify-email/page.tsx`, `testing/registration/page.tsx`.
- Registration: `src/lib/auth/feedback.ts`, `developer-access.ts`, `registration.ts`; `src/app/auth/register/route.ts`, `auth/login/route.ts`, `auth/password/request/route.ts`; `supabase/functions/mitsa-registration-intent/index.ts`, `_shared/registration-intent.ts`; the single applied developer migration.
- Operator/local workflow: `scripts/developer-registration.mjs`, `workspace-preflight.mjs`, `capture-auth-ux.mjs`, `verify-auth-refresh.mjs`, the `auth:developer` package script and `.env.example` documentation. No administrative credential was added to Next.js.
- Verification: `tests/unit/auth-feedback.test.ts`, `registration-entrypoint.test.ts`, `workspace-sql.test.ts`; `tests/integration/developer-registration.test.ts`; `tests/e2e/auth-refresh.spec.ts`; `playwright.auth-refresh.config.ts`; screenshot manifests/artifacts.
- Documentation: this handoff, activation review, auth reference lock, README, local setup and superseded checkpoint notes. Earlier unrelated working-tree changes are preserved.

The material authorization change is limited to replacing the old synthetic-format preliminary check with the exact local approved-email hint, and routing the three hosted recipient checks through `private.mitsa_test_recipient_allowed`. That helper admits the existing exact synthetic allowlist or the singleton approved developer only while every release gate stays closed. It grants no workspace role.

## Remaining release prerequisites

No further approval is needed to use the already activated local developer workflow. A different developer identity, hook/provider setting change, external delivery or production change requires separate review and approval. Public launch still needs approved eligibility/age/responsibilities, legal operator/contact and policies, final retention/backup decisions, isolated restore/erasure verification, production configuration and separately authorized sender/domain/delivery testing. The existing [leaked-password protection advisory](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains; no paid upgrade was authorized. Broader lost-all-factors support execution and disposal remain outside this auth-refresh scope.

The next action is the account owner's private email confirmation and authenticator setup, followed by synthetic workspace onboarding.
