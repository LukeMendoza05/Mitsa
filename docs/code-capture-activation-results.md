# Mitsa — isolated encrypted-code capture activation

Approved target: `mjtejwafxriwntweussc`. Activation date: 2026-10-14. The user explicitly approved only [the reviewed code-capture package](email-code-capture-approval.md).

Historical activation report. The later [registration/reset phase](public-registration-reset-phase.md) supersedes the ten-minute expiry proposal below: the owner confirmed 3,600 seconds and eight digits, with a requested six-digit switch pending approval. Linked previews now show the verified 60-minute expiry; the original activation results and migration hash remain unchanged.

## Applied scope and preservation

Before applying, the exact project/marker and SHA-256 `c4be17d5156c8b6e2d73f6b1fe774a00da1638dc5b424a1cae1b516537801ee8` matched. The original private developer/configuration preservation baseline passed. A private rollback snapshot retained the original function definitions/owners/grants/policies and fingerprints of 4,469 historical rows; no Auth secrets or plaintext codes were exported.

Supabase applied only `mitsa_capture_verification_codes`, recorded as hosted version `20261014102045`. The reviewed local file/hash is retained as approval evidence; do not reapply it as a second migration. It retains the provider-generated signup code inside the existing OpenPGP encrypted payload. It does not generate codes, change their format/lifetime, grant roles, update historical records, modify another hook or enable external sending. The local help-text flag was enabled only after actual hosted capture verification passed.

The exact-definition postflight initially failed because its JavaScript replacement string interpreted the SQL regex's `$'` sequence specially. The audit was corrected to use a literal callback replacement. The database required no further change. Postflight then proved exactly the approved hook-body addition, unchanged owners/grants and all other functions, unchanged RLS/policies, unchanged historical rows and the original developer preservation digest.

Your existing account, password/email verification, verified authenticator, Terms, D Extacy Fireworks Business Owner membership, workspace, initial location and business records remain unchanged. No personal registration or workspace creation was performed. Only separate allowlisted synthetic identities were used for tests.

## Security and test evidence

Three new hosted integration checks passed against the actual isolated backend:

- Real provider-issued codes survive OpenPGP capture/decryption with exact synthetic email/user/purpose/origin binding. Raw ciphertext does not expose the numeric code. Anonymous, authenticated, service-role and workspace roles cannot read captured mail.
- Unauthorized direct signup is rejected without creating a user. Provider resend cooldown returns rate denial. Existing strict intent, Terms, recipient/origin, rate and replay safeguards remain in place.
- An aged synthetic confirmation is rejected after 3,601 seconds; resend captures a different code and invalidates the earlier one. Correct confirmation finalizes Terms once, grants no workspace and rejects reuse. No provider code-generation/admin fallback is used.

The project currently emits **eight-digit email codes**. Mitsa accepts the actual provider code length; no OTP configuration was changed. The synthetic age test proves rejection after the tested bound, not an inspection of the exact configured expiry. The six-digit/ten-minute branded template configuration remains proposed and unpublished.

Codes are single-use and subject to provider expiry/replacement. Historical capture ciphertext remains retained and encrypted; this activation adds no automatic purge or storage TTL. No cleanup job or deletion was introduced because historical preservation and the reviewed migration scope were explicit requirements. Numeric codes are decrypted only in operator/test memory. Existing private link-export tools now omit the numeric code before writing JSON, preserving the prior link workflow without creating plaintext code files. No codes, QR keys, private addresses or session credentials are printed.

All eight captured-code browser cases passed across the initial run and corrected targeted reruns: native/enhanced desktop/mobile code entry, invalid and expired codes, actual resend-button behavior, cookie-replay/concurrent suppression, provider cooldown, old-code invalidation, one-use replay, mandatory MFA, atomic synthetic Owner workspace creation and returning sign-in. Initial enhanced cases raced a second navigation after first-frame confirmation; the test now waits for the final loaded destination and uses the visible workspace link. All four onboarding cases then passed together without retries. Application source/authentication behavior did not require weakening or reset.

Final verification: 145 unit tests, three new hosted capture checks, eight captured-code browser cases, typecheck and production build passed. The final postflight reverified all 4,469 historical rows, the private developer preservation baseline, all other function definitions/owners/grants and RLS/policies. Public-output audit examined 331 files with zero configured private-value matches; all 14 landing fingerprints are unchanged. Production missing-context and CSRF checks passed. The six updated previews were rendered and inspected; no actual email-client inbox rendering or real external delivery is claimed. Sanitized records: `artifacts/code-capture-activation-results.json`, `artifacts/code-capture-hosted-tests.json`, `artifacts/code-capture-activation-postflight.json`, `artifacts/code-capture-migration-record.json` and `artifacts/email-public-audit.json`.

## Review and remaining boundary

Updated previews: [desktop verification](previews/email-verification/desktop.png), [mobile verification](previews/email-verification/mobile.png), [desktop email](previews/email-verification/email-desktop-light.png), [mobile email](previews/email-verification/email-mobile-light.png), [dark mobile email](previews/email-verification/email-mobile-dark.png). Email previews use only an illustrative eight-digit code; the ten-minute copy describes the proposed future provider setting, not a published template or current inbox delivery.

Gmail SMTP, external delivery, public registration, live templates, code-length/expiry settings, Vercel deployment, production and paid services remain unchanged/disabled. Real inbox delivery and actual Gmail/Outlook/Apple Mail rendering are not claimed. Separate approval is still required for the recipient-safe Gmail transport and sender/recipient configuration in [the testing proposal](gmail-vercel-testing-proposal.md).
