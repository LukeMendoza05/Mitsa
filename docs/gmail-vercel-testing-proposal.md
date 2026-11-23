# Mitsa — controlled Gmail delivery and Vercel proposal

Status: prepared but inactive, 2026-10-14. No deployment, SMTP setting, live template, new hosted hook, release gate or external sending was changed. The existing account/MFA/workspace onboarding milestone is complete; the user now requests a separately approved personal reset with a closed archive. This supersedes the earlier no-reset/allowlist-only testing proposal. Mitsa remains multi-tenant; D Extacy Fireworks is the first pilot, not a default tenant.

## Hosting and cost boundary

A custom domain is unnecessary for a Vercel deployment URL. Prefer `mitsa.vercel.app`, subject to actual assignment; it is **not confirmed available or reserved**. A read-only search found no Mitsa project in the connector's default account scope, and alias lookup returned 404. Neither result establishes global claimability. Vercel allocates `.vercel.app` addresses first come, first served and does not reserve them. [Vercel domains](https://vercel.com/docs/domains/working-with-domains)

Vercel Hobby is free but restricted to personal, non-commercial use. Do not assume Mitsa's commercial SaaS development/business pilot qualifies. Keep development local for free until appropriate hosting use is confirmed or an approved plan is selected. Pro currently starts at US$20/month, with usage and seat costs as applicable; no paid upgrade or trial is authorized. A free deployment subdomain is distinct from a free hosting plan suitable for business use. [Hobby restrictions](https://vercel.com/docs/plans/hobby), [current pricing](https://vercel.com/pricing)

Before any deployment, present the exact linked Vercel owner/project, permitted plan, assigned origin and source revision for approval. Do not claim a name, create/link a project, buy a domain or start a trial as an availability check. Exclude `.secrets`, `.env*`, operator scripts/test fixtures, recovery snapshots and private mail from uploads. Only publishable Supabase configuration and separate server-side application keys belong in the ordinary Next runtime; no service-role/admin/database or SMTP credentials belong in browser code or its public environment.

## Dedicated Gmail sender

The user has created the dedicated Gmail sender, enabled Google 2-Step Verification and confirmed App Password support. The protected configuration is now saved: local verification confirmed decryption, matching sender and valid App Password format. SMTP authentication and inbox delivery remain untested. `scripts/configure-gmail-smtp.ps1` is the private interactive helper for future credential updates; it performs no network/database operation and writes DPAPI-encrypted data to `%LOCALAPPDATA%\Mitsa\Private\gmail-smtp.dpapi` with a current-user directory ACL. It never writes a repository or `.env` credential file. The local relay reads it only in an approved sending window; no secret is passed as a process argument or printed. Google may withhold app passwords for Advanced Protection or organization/security-key policies; changing the Google password revokes app passwords. [Google app-password requirements](https://support.google.com/accounts/answer/185833)

The SMTP profile to review is:

| Setting | Proposed value |
|---|---|
| Host | `smtp.gmail.com` |
| Port / encryption | `465` with implicit TLS (or reviewed `587` STARTTLS) |
| Username | Full dedicated Gmail address, supplied privately |
| Password | Dedicated Google App Password, protected outside the repository using Windows DPAPI |
| Sender display name | `Mitsa` |
| Sender address | Same dedicated Gmail mailbox; do not impersonate a custom domain |
| Tracking | None; no tracking pixels or click redirects |
| Recipients | Valid email entered through the private loopback pilot and bound signed intent; no per-email DB allowlist in pilot mode. Synthetic `.invalid` messages remain capture-only. No public internet registration. |
| Test volume | One message per explicit relay invocation; durable caps 10/hour, 20/day and one/recipient/minute; bounded approved window up to two hours |

Google operates SPF/DKIM/DMARC for `gmail.com`; the developer cannot set its DNS policies or use `mitsa.vercel.app` as an owned email domain. Consumer Gmail can block sending after more than 500 emails/day and may impose earlier anti-abuse checks; that is a ceiling, not a delivery guarantee. Delivery can be delayed, filtered or suspended. A dedicated consumer Gmail account has no custom-domain subscription cost; no Google Workspace subscription or paid provider is authorized. This is a temporary testing arrangement, not the production transactional-mail recommendation. [Google SMTP guidance](https://support.google.com/a/answer/176600), [consumer sending limits](https://support.google.com/mail/answer/22839)

## Critical routing constraint — do not disable capture to bypass it

The active SQL Send Email hook **replaces** Supabase SMTP delivery. It enforces exact recipient/registration-intent/origin rules and encrypts signup/recovery messages. Adding Gmail (or Resend) SMTP credentials while that hook remains active will not route those emails to Gmail. Disabling the hook would remove its outgoing-recipient guard and capture routing. Strict signup eligibility alone does not guard every recovery/email-change request sent directly to Auth APIs. [Supabase Send Email hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook), [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)

Do not enable direct Supabase→Gmail SMTP or disable the existing hook. The prepared low-volume alternative retains the encrypted capture hook and adds an **operator-only local relay**. The reviewed candidate SQL permits valid unallowlisted signup addresses only through an explicitly approved, short-lived loopback pilot and existing signed intents. The relay decrypts only the latest eligible signup capture in memory, validates its user/intent/origin/code/expiry, claims it transactionally, and sends the approved Mitsa HTML/plain text through Gmail. Recovery/email change/invitations do not gain external permission. SMTP uncertainty consumes the claim; SMTP has no provider idempotency key, so there is no blind automatic retry. Synthetic mail remains capture-only. No SMTP secret, database admin credential or mail-decryption key is placed in the ordinary Next/Vercel runtime. [Nodemailer SMTP controls](https://nodemailer.com/smtp)

The existing developer remains verified and untouched. The user has selected a closed archive and expressly requires final approval before any actual account deletion, MFA/session invalidation or workspace change. Verify delivery and the new registration route first with separately authorized test identities; these rehearsals do not replace the user's personal fresh journey. Current hosted hooks still allow only existing isolated recipients; the candidate pilot SQL is prepared outside automatic migrations and has **not** been applied. The active runtime remains isolated-test/capture-only.

## Exact later changes requiring separate approval

1. Save the dedicated sender's App Password using the protected helper; only report readiness, never credentials. This is local storage, not permission to connect or send. Review sender fingerprint, exact isolated project/marker and proposed transport before activation.
2. The owner confirmed actual Email OTP lifetime **3,600 seconds** and length **8** in the isolated dashboard. Preserve this lifetime. Managed SMTP credentials/live template bodies/other rate overrides remain uninspected. A requested switch to **6** digits needs separate explicit approval and coordinated provider/input/server/relay updates; it is not applied. No invented defaults or ten-minute expiry.
3. Approve the prepared disabled SQL separately before applying it. Preserve email confirmation, anonymous denial, signed-intent/provider hooks, Terms, MFA/RBAC/RLS and public/legal/disposal gates. A later, separate real-delivery approval enables only the bounded local pilot/SMTP flags, approved sender hash and verified expiry; no per-email allowlist is needed in that private pilot. No personal reset is implied.
4. Prepared templates use subject **Verify your Mitsa email address** and the verified 60-minute expiry. The local relay renders both HTML and plain text without changing the managed live template. Any actual live-template or OTP-length change needs explicit approval. Delivered MIME/inbox rendering remain unverified until authorized sending.
5. Update actual assigned HTTPS origin in Next `APP_ORIGIN`, Supabase Site URL/exact redirect allowlist, Edge registration-origin validation and mail-hook redirect policy as one reviewed change. Preserve loopback synthetic testing. Current hook/Edge configuration pins loopback; changing only `APP_ORIGIN` would break registration/capture. Do not whitelist all `*.vercel.app` or route email tokens through a guessed alias.
6. Only after scoped approval, enable the two-hour-or-shorter local pilot window and explicit operator relay sending. Test actual approved-inbox delivery, direct-provider denial, nonce/code replay, invalid/expired codes, resend, caps and interrupted onboarding. Turning off both pilot flags and returning runtime mode to isolated-test restores capture-only behavior; do not delete evidence or claims. The global public/external release gates stay closed; separately approved pilot SMTP permission is explicit and must not be described as external mail disabled once used.
7. Request final personal account/archive approval only after a usable fresh route is verified. Deploy only after separate Vercel approval, verified project/plan/origin and private artifact exclusion. No production system, uncontrolled public signup, unrelated module or automatic personal workspace is included.

Keep verification, signup resend, recovery, email change, invitations and security notifications logically distinct. The new Resend code action uses only Supabase `resend({type:'signup'})`; it never calls password recovery or passwordless login. Existing recovery links still require explicit POST and trusted MFA where configured. Email-change/notification transport activation requires matching reviewed handlers and policies; prepared shared styling does not imply those flows are enabled.

## Resend later

Resend SMTP remains a future option after an owned sender domain is available: verify DNS records issued by Resend, use the actual verified sender, disable open/click tracking, and store credentials privately. A `.vercel.app` deployment URL does not grant DNS ownership suitable for Resend domain verification. No Resend domain, sender, credential or delivery has been fabricated. [Resend SMTP prerequisites](https://resend.com/docs/send-with-supabase-smtp), [domain verification](https://resend.com/docs/dashboard/domains/introduction), [DMARC](https://resend.com/docs/dashboard/domains/dmarc)
