# Mitsa — public registration and controlled reset phase

Current update: [six-digit email standardization is active and verified](six-digit-email-results.md), retaining 3600-second expiry. The latest objective requests staged real Gmail delivery and eventual general public registration. Earlier closed-state statements describe the current gates or historical restrictions, not a permanent prohibition. External delivery and final unrestricted activation still require their respective approvals. Preserve the existing personal account unless separately reset.

Current request: resume authentication verification, public Business Owner registration preparation, Turnstile and controlled Gmail delivery while preserving the working personal account. A personal reset is a separate future decision. The first approved Gmail window closed before SMTP because of an unavailable test browser; a replacement window requires explicit approval. See [execution results](controlled-gmail-test-results.md).

## Implemented locally

- Centralized the existing registration-mode decision. Public mode accepts valid Gmail and other email addresses without consulting a development allowlist **only when the database reports an approved published registration policy**. Missing/mismatched mode or policy stays closed. Provider signup must remain enabled and mandatory confirmation enabled; private signing configuration remains required.
- Added route tests for unallowlisted public addresses, strict Terms, injected role rejection, closed policy, signed-intent denial/rate limits and unexpected auto-confirmation. Local PostgreSQL tests exercise all publication/eligibility/registration gates and provider nonce/user binding. They do not change hosted gates or send mail.
- Kept isolated mode's synthetic/developer restrictions and actual provider hooks intact. Removing the real isolated restrictions is a separate reviewed change, not a client-only edit. Public launch cannot be inferred from a public-mode environment variable.
- Code entry, server validation, templates, tests and relay now use exactly **six digits**. Actual provider issuance and verification passed after the approved saved-and-reloaded provider switch; expiry remains **3,600 seconds**. Supabase owns code generation and validation, while authenticator MFA remains independent. See [activation results](six-digit-email-results.md).
- The first real-mail relay requires matching private approval and a 30-minute window, with at most three attempts to the dedicated sender's own inbox. The first window closed on a browser-launch failure before signup or SMTP. Its corrected Edge preflight passes; renewed activation is pending. See [controlled Gmail scope](controlled-gmail-test-approval.md).
- Prepared Managed Turnstile client/server integration. Public signup requires successful server-side validation before a signed intent can be issued; missing configuration keeps public signup closed. The user's widget exists, but application keys and live validation remain pending. See [private key setup and readiness-test correction](turnstile-development-setup.md).
- Added a replaceable, inactive Gmail SMTP adapter using Nodemailer and a local operator relay. They render Mitsa HTML/plain text from validated Supabase-issued signup values, require a trusted approved window/sender and durable DB claim, pin TLS Gmail SMTP, preserve synthetic capture, disable debug/transaction logging and remote/file content, and never automatically retry uncertain SMTP outcomes. No endpoint, worker, hook deployment or SMTP connection is active. Real credentials must be Windows-encrypted outside the repository; `scripts/configure-gmail-smtp.ps1` prepares them privately without network access. SMTP tests are mocked.
- Prepared exact personal reset impact and encrypted snapshot; rehearsed using disposable identities. See [reset approval scope](developer-account-reset-approval.md). Personal execution is pending separate approvals and recovery readiness.

## Remaining implementation and approval boundaries

The current strict SQL Send Email hook replaces SMTP and allows only approved isolated recipients. Merely adding SMTP credentials, removing a Next.js format check or setting public mode would not safely provide the requested real journey.

Installed the approved **disabled time-bounded local pilot registration schema**, independent of per-email allowlisting, using the existing private signed-intent boundary and exact loopback origin. Hosted migration `20261014124737_mitsa_controlled_pilot_relay_disabled` used the exact reviewed `supabase/prepared/20261014_mitsa_controlled_pilot_relay.sql`. The source remains outside auto-applied migrations to prevent duplicate installation. Offline SQL tests cover valid unallowlisted addresses, required private intent/provider binding, closed public gates, expiry, denied recovery sending and restricted configuration/ledger access. Both pilot and SMTP flags remain false; activation requires separate approval. See [installation results](pilot-schema-installation-results.md).

The prepared operator-only relay reads the latest eligible Supabase signup message from the existing encrypted capture; `.invalid` identities stay capture-only. It requires a current pilot intent, unverified exact user, approved sender fingerprint and window, unique durable claim and DB-locked caps of 10/hour, 20/day and one/recipient/minute. It reads no SMTP secret until sending has separately been enabled and explicitly requested. Recovery/email-change/invitation sending stays disabled; the capture hook is never disabled. Protected credentials are saved and decrypt locally; SMTP authentication and external activation remain untested and pending approval. This local bridge is a low-volume pilot tool, not the public SaaS transport or a Vercel worker with admin credentials.

Do not delete the currently working personal account before the new route is verified with disposable accounts and the real transport is approved. Disposable rehearsals supplement, and never replace, the user's eventual personal inbox journey.

## Hosting and release

Existing `.vercelignore` excludes private configuration, snapshots and operator/test artifacts. No project has been created or linked and no subdomain is claimed. `mitsa.vercel.app` is a preference, not confirmed availability. Vercel Hobby's personal/non-commercial restriction needs resolution for a business pilot. See [transport and hosting proposal](gmail-vercel-testing-proposal.md) for settings, limitations, costs and exact later approvals.

Public launch remains blocked on approved legal/eligibility/retention policies, production-appropriate transport/hosting, backups/recovery, monitoring, and authentication/isolation verification. No new legal policy is published and no production/paid-service action is authorized.

## Personal steps — after reset and delivery activation, not yet

1. Open the reviewed local pilot signup route; enter the same private Gmail and a new password, and accept the displayed applicable agreement. No per-email operator insertion should be needed in this mode.
2. Read the real Mitsa inbox message and enter its six-digit code. Use Resend code after the cooldown if necessary; use the latest message. Never paste a code/link into chat.
3. Complete normal password sign-in when requested and enroll a fresh Google Authenticator entry through Account security. Scan the private QR yourself and confirm the current authenticator code.
4. Create a new business workspace and initial location through normal onboarding. The old closed archive does not grant automatic access or a default tenant.
5. Sign out, then sign in with password and the fresh authenticator. Confirm the new workspace persists.

Until approval and activation, the existing developer account/MFA/workspace remain usable and unchanged; external email and public registration remain closed.
