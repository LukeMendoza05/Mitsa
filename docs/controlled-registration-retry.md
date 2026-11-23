# Mitsa — controlled signup rejection and replacement run

Latest result: the approved replacement is now closed. The Guest-profile submission created one pending account and an encrypted six-digit capture; clock skew stopped the worker before any SMTP claim or connection. See [current diagnosis and existing-account continuation](controlled-verification-resume-approval.md). The earlier zero-account findings below are historical and must not trigger another signup.

## Verified findings, 15 October 2026

The approved isolated target is `mjtejwafxriwntweussc`, marker `fireworks-foundation-proof-01a12e38`.

At 08:56:38 UTC, the private onboarding address matched the controlled runtime recipient hash. The database policy and the `app_workspace` role used by signed intents both saw the open pilot. A deliberately CAPTCHA-less request using that exact address passed application eligibility and was refused at the CAPTCHA boundary. It created no intent, account or email. This demonstrates eligibility, not successful CAPTCHA validation or complete registration.

The approved alias had zero accounts and zero registration intents. There was no verification capture or SMTP claim. No duplicate account was created. The original rejected request's submitted address and CAPTCHA proof were deliberately never retained. Existing Next development logs reduced diagnostic object arguments to `{}`, so the historical rejection cannot conclusively be attributed to a recipient mismatch, an earlier isolated-test runtime state, or the signed endpoint from those logs alone. Do not claim that the original cause has been fully proven or that signup now works end to end.

The previous shared `testing_access` message conflated development allowlisting, the temporary controlled-recipient restriction and signed-intent denials. The local route now distinguishes controlled-recipient failure, explains private recopy instructions, and records a bounded rejection stage as serialized JSON so it survives Next's development logging. It never records submitted names, addresses, recipient hashes, passwords, proofs, signatures or nonces. No identity was added to an allowlist and no signup hook or database function was changed.

The prior window was explicitly closed after the reported failure, before its original 08:58:56 UTC deadline. The worker exited without sending email. Read-only postflight confirms the window is closed, the alias remains unregistered, and the developer account, verified MFA, business, membership, location and historical baseline remain unchanged.

## Replacement scope — explicitly approved by the user, 15 October 2026

The user approved this exact replacement controlled window. Fresh target, preservation, capacity and recipient checks still precede activation. No repeat approval is needed for this run within the scope below.

Activated at **2026-10-15 09:08:24.913 UTC**, with a fixed deadline of **09:38:24.913 UTC / 5:38:24 PM Manila**. Fresh marker, preservation, capacity and recipient checks passed. All nine active-window security probes passed. The exact private alias passed application eligibility and the intent role saw the active lease. At activation postflight there were zero accounts, intents or email attempts for this alias. The user has been asked to submit once in a new private regular-browser session and report only the Verify Email/inbox outcome. Complete signup remains pending. The worker closes automatically on failure, completion or timeout; this record does not extend its deadline. See `artifacts/controlled-registration-retry-activation.json`.

- One new window, at most 30 minutes, same isolated project and loopback origin `http://127.0.0.1:3000`.
- Reuse the same private fresh onboarding alias, only after checking again that no account exists. Do not regenerate it, add developer allowlisting or create an account automatically.
- At most four legitimate authentication email attempts to that alias's dedicated-sender inbox. The prior failed window used zero attempts. Keep existing hourly, daily and recipient limits, encrypted capture and durable claims.
- Before asking the user to submit, verify the actual anonymous policy, app eligibility for the exact private alias, current role/window checks, and active-window negative security probes. A missing-CAPTCHA probe must stop before any intent.
- The user completes a fresh real Turnstile challenge in private regular Chrome/Edge. No CAPTCHA automation, token reuse or bypass. On failure, retain only the bounded error/stage, stop, and diagnose before expanding access.
- Continue email verification/resend, MFA, workspace/location, Owner access, logout, returning sign-in and recovery/security checks only after successful registration and confirmed inbox receipt.
- Close on completion, failure or deadline. No extension, production/Vercel deployment, real account modification, provider CAPTCHA toggle, new migration or hook change is included.

General isolated signup remains conditional on the previously authorized complete onboarding and security milestone. This replacement request concerns the expired controlled run only, not reapproval of that broader objective.

## Verification

- 255 unit tests across 38 files passed, including new real-route controlled-recipient, valid-alias, native POST and secret-free diagnostic regressions.
- TypeScript and the final production build passed, including the bounded-log serialization change.
- A private-value scan of 458 source, documentation, evidence and public build files found zero matches; private local configuration remains Git-ignored.
- Read-only preservation checks passed against all 11 baseline application rows and the existing verified authenticator.
- Live CAPTCHA expiration-specific attribution remains unconfirmed; the user's separately approved unusable-proof/freshness evidence decision is preserved.

Evidence: `artifacts/controlled-eligibility-diagnostic.json`, `artifacts/controlled-onboarding-progress.json` and the preservation audit. These contain no private address or authentication credential.
