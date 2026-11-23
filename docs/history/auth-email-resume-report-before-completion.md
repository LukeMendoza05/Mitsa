# Historical evidence — superseded

# Mitsa — resumed authentication and email checkpoint

Updated 2026-10-15 at 2026-10-15T04:10:49.359Z. The exact synthetic retry sent **one** Gmail SMTP-accepted message, and the user confirmed actual inbox receipt, Mitsa branding, six digits, 60-minute expiry and correct formatting. The code exposed in a screenshot is treated as compromised and has not been used to verify this account. Do not use it.

The runner stopped at subsequent resend: its URL wait was already satisfied by the current ?resent=1 page, so it read the previous capture before the request completed. It closed at **03:59:05 UTC**. Read-only evidence confirms no second capture or delivery claim, both flags closed, active manifest absent, local isolated mode restored and public/global external gates closed.

The same-URL race is reproduced and corrected. Seven local browser checks, 218 unit tests/34 files and typecheck pass. Existing developer account/MFA/workspace/location/history and all original 4,755 rows, grants and RLS remain preserved. **Fresh-code verification and compromised-code rejection remain incomplete in this Gmail run.** The synthetic account is unverified with zero memberships/factors.

A [one-message completion window](controlled-gmail-finish-approval.md) is prepared but requires fresh approval because this window closed on failure. It preserves the old claim and permits at most one new resend email, two total across both windows. No account is recreated or reset.

## Historical checkpoint — superseded by the current result above

Verified 2026-10-15 against isolated project `mjtejwafxriwntweussc`, marker `fireworks-foundation-proof-01a12e38`. This is a continuation checkpoint, not a claim that external delivery or public registration is complete.

**Latest update:** the approved replacement Gmail run created one synthetic pending account and captured a real six-digit code. It closed before any SMTP attempt because a timestamp-rounding bug blocked its claim. The bug is fixed with native database comparison and a regression test. The latest full suite passes **214 tests in 33 files**, plus TypeScript and build. The test identity and encrypted credential remain intact; [fresh exact-identity retry approval](controlled-gmail-resume-approval.md) is pending. Existing developer account/MFA/workspace and all 4,755 original rows remain preserved. The earlier checkpoint below is retained as historical evidence; its statement that the dedicated inbox has no account and its 203-test count are superseded.

## Current verified status

Six-digit Supabase signup codes and 3600-second expiry remain aligned with Mitsa. The latest hosted capture checks prove actual provider issuance and confirmation, replacement after resend, expiry and replay rejection. Existing developer account, verified MFA, D Extacy Fireworks workspace, sole-Owner membership, location, Terms and historical records remain unchanged. Public business registration, pilot SMTP and global release gates are closed; the active mail approval manifest is absent and the ledger has zero attempts.

## Carried forward and newly completed

Carried forward: installed disabled pilot schema, approved six-digit switch, encrypted capture, verification/resend UI, mandatory MFA and workspace authorization. No migration was repeated. The first Gmail window closed before registration or SMTP because the runner selected missing bundled Chromium.

New: the runner now launches installed Edge before opening a window, retains a separate synthetic test credential as private PGP ciphertext, requires first-inbox receipt before a second send, exercises normal Resend Code and newest-code/replay checks, and closes on stop, input closure, timeout, completion or failure. Its approval boundary remains one exact loopback window, one dedicated recipient and at most three attempts; it has not been reactivated.

Added a development-only Turnstile diagnostic to the existing local guide. It tests the real widget/server validator after private key setup, but cannot issue a registration intent, create an account or assign a role. Both its page and endpoint return 404 in production. Reused existing Mitsa typography, shell, controls and challenge component; landing-page files remain unchanged.

## Test evidence

| Command or check | Result |
|---|---|
| `npm run test:unit -- --bail 1` | 203 passed, 31 files |
| Isolated capture, pilot, account-security, invitation and workspace integration files | 21 passed, 5 files |
| `npx playwright test --config playwright.email.config.ts --max-failures=1` | 8 passed, desktop/mobile |
| Journey tests matching `captured password recovery` or `invitation context` | 4 passed, desktop/mobile |
| `npm run typecheck` and `npm run build` | Passed |
| `node scripts/check-turnstile-diagnostic.mjs` | Missing-key and CSRF denial; production page/endpoint 404; no overflow/Axe violations at 320/390/768/1024/1440px |
| `node scripts/verify-email-phase.mjs` | No private-value matches; all 14 landing files preserved; correct production context/CSRF rejection and deployment exclusions |
| Private preservation/postflight scripts | Existing account/MFA/workspace unchanged; 4,755 original rows, grants and RLS preserved |

The browser cases cover native/enhanced registration, captured verification, cooldowns, replaced/expired/replayed codes, MFA enrollment, new synthetic workspace/location creation, returning sign-in and recovery session revocation. Hosted checks cover Owner/Admin/Staff permissions, location/tenant isolation, sole ownership and invitation lifecycle. These are synthetic captured-mail checks, not evidence of external inbox delivery or unrestricted public registration.

## Corrected failures

- Readiness fixture used base64url where the unchanged signing guard requires 64 lowercase hexadecimal characters. Only the fixture encoding changed; the guard correctly kept registration closed.
- Gmail runner used unavailable bundled Chromium. Corrected to installed Edge and moved browser preflight before activation. No SMTP attempt occurred.
- Postflight and disabled-pilot tests assumed null never-used timestamps. They now accept only the exact recorded closed approval window and bound ledger evidence, retaining all original preservation checks. No live guard was relaxed.
- The initial port-3001 preview inherited origin 3000. It now uses process-local origin 3001; CSRF rejection and missing-context behavior pass. Local `.env.local` origin remains 3000.
- Windows sandbox/cache failures were resolved through authorized execution with the required file access. The usage-limit approval-review failure prevented its command from running; the command later ran after the stated reset time.

## Turnstile readiness

The user has created the Managed **Mitsa - Development** widget. Intended setup is Free service, pre-clearance disabled, development hostnames and a separate future Vercel widget. Private inspection confirms **site key and secret key are not yet saved locally**. Server-side Siteverify, exact hostname/action/freshness checks and fail-closed behavior are prepared and mocked tests pass. Actual key pairing, widget completion, live rejection/replay/expiry and widget accessibility remain pending. The five-width scan covers the guide without a configured widget.

Run the [private PowerShell helper](turnstile-development-setup.md), then open `http://127.0.0.1:3000/testing/registration` and choose **Check server verification** after completing its challenge. Report only the visible outcome. This does not open public signup. No Supabase CAPTCHA configuration was changed; enabling a second provider verifier for the same single-use token is not part of the prepared design.

## Gmail readiness and exact replacement scope

Protected dedicated-sender credentials decrypt privately, match the recorded sender identity and differ from the developer identity. The dedicated inbox has no existing Mitsa account. SMTP authentication, real receipt and Gmail restrictions remain **untested**. Attempts: **0**. External messages: **0**. The first window closed successfully; no approval manifest or sending worker remains.

Replacement activation requires fresh explicit approval for:

- Only the approved isolated project and `http://127.0.0.1:3000`.
- One 30-minute window, dedicated sender's own inbox only, maximum three signup-verification SMTP attempts using `smtp.gmail.com:465` with verified TLS.
- One separate synthetic test account, six-digit Supabase codes and 3600-second expiry; keep encrypted capture, signed intents, Terms and all rate limits.
- First message, non-secret inbox-receipt confirmation, normal resend after cooldown, second explicit send and private provider verification/replay check; no blind retry.
- Automatic closure after completion, stop, timeout or failure. Retain encrypted evidence and durable claims.

No Supabase SMTP configuration, unrestricted registration, recovery/invitation sending, developer reset, MFA/workspace changes, production or deployment is included. [Exact scope and rollback](controlled-gmail-test-approval.md).

## Public registration readiness and security concerns

Public-mode registration is prepared without a developer-address allowlist, but requires published policy/gates, mandatory provider confirmation, private signed registration intents and successful server CAPTCHA. Direct provider calls remain subject to strict signup hooks and cannot grant workspace/platform roles. The hosted public gates remain closed. General-recipient delivery and recovery-purpose transport/hook changes still need review, isolated tests and approval; the local self-test relay is not the finished public SaaS transport.

Read-only Supabase advisors still report **Leaked Password Protection Disabled**. Review applicable provider plan/configuration before public release; no paid upgrade or setting change is authorized. [Remediation guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). The ledger's no-policy INFO is intentional default denial: ordinary roles have no grants and RLS/FORCE RLS remain enabled. Do not make it accessible to suppress that notice.

Gmail remains a temporary low-volume transport with sending/throttling/inbox reliability limits. A successful self-test will not establish general delivery readiness. Broader recipients, recovery, durable abuse controls, actual CAPTCHA, end-to-end inbox journeys, eligibility/Terms/privacy decisions and final unrestricted-signup approval remain prerequisites. No hostname is claimed and no public deployment is authorized.

## Next steps and rollback

1. Save Turnstile keys privately and verify the development-only widget/server diagnostic; never share keys, OTPs or request bodies.
2. Approve the exact replacement Gmail scope above; recheck target, fresh preservation evidence, credentials and closed state immediately before execution.
3. Report SMTP acceptance separately from user-confirmed inbox receipt. Close and investigate any uncertain delivery; do not retry a claimed message.
4. Complete reviewed broader-delivery and public abuse/end-to-end tests, then present final readiness and request final public-registration approval.

Pilot rollback closes both existing window flags, restores local isolated-test mode, removes the active approval manifest and preserves claims/ciphertext/audit history. The database deadline independently fails closed; normal completion/failure also explicitly closes flags. CAPTCHA diagnostic rollback is to keep keys absent/disabled while leaving signup gates closed. Do not disable signed intents, provider hooks, MFA or RLS. No personal reset, migration, production change or legal publication is part of this checkpoint.
