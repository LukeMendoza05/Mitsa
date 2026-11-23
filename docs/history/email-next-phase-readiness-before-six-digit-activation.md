# Superseded preparation evidence

This document records the earlier eight-digit/candidate phase. Current state is in ../email-next-phase-readiness.md.

# Mitsa — email verification and controlled delivery readiness

Updated 2026-10-14. The disabled pilot installation milestone is complete. No migration was repeated, no provider setting was changed, no external email was sent and no personal reset was performed in this preparation phase.

## Six-digit readiness

The application now has a strict shared email-format setting. `MITSA_EMAIL_OTP_LENGTH=6` selects six-digit code entry/help, server validation and SMTP validation; unsupported values fail closed. Default and normal local configuration remain eight, matching the current provider. Expiration is fixed at 3600 seconds. TOTP MFA is independent and unchanged.

Prepared the exact provider proposal: **change only `mailer_otp_length` from 8 to 6; leave `mailer_otp_exp` at 3600**. [Approval and coordinated switch](six-digit-email-approval.md). Existing template variables are length-independent. New six-digit HTML/text examples and empty-input UI previews are separate from the current eight-digit previews. No real verification code appears in either set.

Actual six-digit provider issuance remains unproven until approval, dashboard configuration and captured-code regression succeed. The Supabase API tools expose neither Auth configuration read nor update, but a later read-only inspection found the existing signed-in dashboard for this exact target and directly verified **8 digits / 3600 seconds** without editing. It can be used for the scoped switch after approval; no manual user change or credential sharing is required.

## Verification completed

| Check | Result |
|---|---|
| Typecheck and production build | Passed |
| Default eight-digit unit suite | 180 passed in 24 files |
| Staged six-digit unit suite | 180 passed in 24 files |
| Final approval-window hardening | 49 focused checks passed for each length, including pg Date millisecond precision |
| Hosted captured-code, invitation and account-security compatibility | 11 passed in 3 files |
| Existing invitation-context and password-recovery browser journeys | 4 passed across desktop/mobile |
| Candidate page checks | 12 passed, including 5 widths with JavaScript on/off and two alternate-length rejection checks |
| Candidate accessibility | Zero Axe violations at 320/390/768/1024/1440px with JavaScript enabled |
| Native candidate behavior | Labels, skip-link keyboard focus, exact-length input validity and native POST rejection passed |
| Safe previews | Six separate candidate previews rendered; mobile UI/email visually inspected |

The initial candidate verifier attempted Axe with page JavaScript disabled. A diagnostic confirmed Chromium disables the page timers Axe needs, so that scan could not finish. The harness was corrected to scan the enhanced page and independently test native keyboard/validation behavior; the final run passed. No application fix or reduced security boundary was needed.

A subsequent local delivery-boundary audit tightened the durable claim: it now rechecks the manifest's exact start/end timestamps under the database locks, so a window changed after it was first read cannot extend an earlier approval. Offline PostgreSQL checks cover changed start/end times. The hosted schema and disabled flags were not modified.

Unit and offline PostgreSQL checks cover both provider lengths, exact rejection of the alternate length, unchanged cooldown/replay/finalization behavior, capture compatibility, recovery/invitation purpose separation, closed sending gates, TLS settings, expired-message refusal, generic SMTP errors, recipient binding and durable delivery caps. Mocked SMTP is not evidence of real delivery.

## Gmail readiness and proposed scope

Read-only verification confirmed the Windows DPAPI file decrypts, matches the dedicated sender baseline and contains the expected App Password format. The initial test recipient is the dedicated sender itself, differs from the real developer identity and currently has no Mitsa Auth account. SMTP authentication is untested; no setup repetition or credential disclosure is needed.

The separate proposal uses `smtp.gmail.com:465`, implicit TLS with certificate verification, Mitsa display name, dedicated username/From and approved HTML/plain text. It retains the strict encrypted capture hook; no Supabase SMTP setting is changed. A matching private approval manifest and open database window are both required. The local relay filters the initial recipient and additionally enforces at most three durable attempts in a 30-minute window. Existing hourly/daily/minute limits remain. No approval manifest or sending worker exists now.

See [exact Gmail test, recipient restrictions and rollback](controlled-gmail-test-approval.md). The first message requires real inbox confirmation before further resend checks. SMTP acceptance alone is insufficient. Close both flags and return local mode to isolated-test immediately on uncertainty or completion, retain evidence and never automatically retry a claimed capture.

## Security and preservation

The exact isolated target/marker, reviewed hash, original function grants/RLS and encrypted baseline remain the preservation boundary. Final checks compare the original 4,755 application/history rows and the real developer's account, verified factor, membership, workspace, location, Terms and audit history. Only separate synthetic accounts were used for compatibility tests.

Public registration and all global release gates remain false; pilot/SMTP flags remain false and the delivery ledger is empty. Normal local configuration is still isolated-test/eight digits. The SQL capture and signup functions remain installed, and email verification stays mandatory. No production deployment, legal publication, paid upgrade, session revocation or account/workspace archive occurred.

The unresolved leaked-password protection warning is recorded for the [upcoming read-only Supabase optimization audit](supabase-optimization-audit-brief.md), together with the intentionally default-denied ledger notice. No related setting was silently changed.

## Remaining steps and eventual personal onboarding

1. Obtain separate OTP approval, confirm dashboard values, coordinate only the provider/local length switch and prove actual captured six-digit verification/resend plus recovery/invitation compatibility.
2. Obtain separate controlled Gmail approval and prove real inbox receipt, code verification, resend, expiry and failure behavior under the documented bounded test scope. Public signup remains closed.
3. Only after real email works, refresh the existing [developer reset/archive impact assessment](developer-account-reset-approval.md) and obtain final account and workspace approvals. Never delete a working account merely to demonstrate email delivery.
4. Under a separately approved recipient/window scope, the user registers personally with the private address, accepts Terms, enters the newest six-digit inbox code, enrolls a fresh authenticator and creates a new D Extacy Fireworks workspace/location. The closed archive stays inaccessible, and the new UUID inherits no old membership, factor or onboarding state.
5. Sign out and return with password/MFA to the newly created workspace. Public release, production and Vercel deployment remain separate decisions.

Evidence: `artifacts/email-next-phase-readiness.json`, `email-delivery-readiness.json`, `six-digit-ui-readiness.json`, `six-digit-preview-verification.json`, `pilot-relay-postflight.json` and `developer-reset-preservation.json`.
