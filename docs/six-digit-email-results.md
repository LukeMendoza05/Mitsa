# Mitsa — six-digit email verification results

Activated and verified on 2026-10-14 only in isolated project `mjtejwafxriwntweussc`, marker `fireworks-foundation-proof-01a12e38`, under the user's explicit OTP approval.

## Saved configuration

Supabase's refreshed Email provider panel now shows **length 6 / expiry 3600 seconds**, with Save disabled. The earlier reported save had not persisted: refreshing still showed eight. The agent changed only the length field to six under the existing approval, saved, reloaded and reopened the provider panel to independently confirm persistence. The reason the earlier save did not persist was not established; no other provider setting was changed to resolve it.

The local email setting is six, and six is now the normal application/test default. An explicit eight-digit setting remains for a coordinated rollback only. Temporary local signup hold was removed after alignment; registration is again restricted to the existing isolated-test workflow. The test runners load only the non-secret format setting from local configuration. Templates and server/input/relay validation follow the same setting. Supabase remains the code generation and verification authority.

## Actual provider and browser evidence

- **3 hosted capture checks passed** with an actual six-digit Supabase code read from encrypted, recipient-bound capture. There was no admin code-generation fallback.
- Successful confirmation finalized Terms without assigning any workspace role. Invalid/expired codes, the replaced old code and one-time replay were rejected. Provider resend cooldown was enforced. Synthetic confirmation age 3601 seconds verified expiry handling while the configured lifetime remained 3600.
- **8 desktop/mobile browser cases passed** with captured six-digit codes, native/enhanced submissions, actual Resend Code, countdown/provider limits, old-code invalidation, cookie replay/concurrent denial, missing context/CSRF, offline feedback, MFA enrollment, workspace creation and returning password/MFA sign-in.
- **2 desktop/mobile password-recovery journeys passed**, preserving required trusted MFA, changing only synthetic passwords, revoking synthetic prior sessions and returning to each synthetic workspace. Recovery links remain separate from signup codes.
- The final **183 unit checks passed**, including private-input error suppression; typecheck and the production build passed. Browser private-field helpers prevent failed fill actions from exposing provider codes/passwords/authenticator values in error output. Traces and authentication screenshots remain disabled or masked.

The previous invitation compatibility checks remain recorded in the preparation report; no invitation purpose, route or authorization was changed by OTP standardization. Any later public/CAPTCHA or delivery change needs its own compatibility verification.

## Preservation and next stages

The original developer identity, verified authenticator, D Extacy Fireworks workspace, Owner membership, location, Terms and audit history still match the private encrypted baseline. The installed SQL functions/RLS/grants and all original 4,755 rows remain under the existing postflight audit. No migration was repeated and no personal reset, factor removal, session revocation, legal publication, production operation or deployment occurred.

Protected Gmail credentials remain readable privately; SMTP/pilot flags remain false and the delivery ledger is empty. **No SMTP connection or external email was attempted.** Public registration remains closed during preparation. The new objective requests eventual real delivery and general registration; these are staged activation requirements, not permanent prohibitions.

Next: obtain the separately scoped [first controlled Gmail test approval](controlled-gmail-test-approval.md), prove real inbox delivery, then expand recovery/general-recipient delivery through reviewed controls as needed. The initial self-test does not establish unrestricted public-email readiness. CAPTCHA, provider capacity, final policy/eligibility gates and a final public-registration approval remain required before public activation. The existing account remains preserved unless separately reset.

## Recovery

On an OTP mismatch, close local registration, restore both provider length and local setting to eight, retain expiry 3600, verify a fresh synthetic encrypted capture, then reopen only isolated registration. Keep sessions/factors/data intact. On any unexpected change or test failure, stop and report before proceeding, as instructed by the user.

Evidence: `artifacts/provider-otp-dashboard-review.json`, `code-capture-hosted-tests.json`, `six-digit-activation-results.json`, `pilot-relay-postflight.json`, `developer-reset-preservation.json` and `email-delivery-readiness.json`.
