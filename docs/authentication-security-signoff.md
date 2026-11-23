# Mitsa authentication security review — 15 October 2026

**16 October investigation update:** [Continuous-registration readiness investigation](general-registration-readiness-investigation.md) distinguishes the failed immediate terminal-reuse requirement from basic signup feasibility and identifies the bounded pilot/runtime and recovery-evidence gates. This historical report retains the original stricter criterion; no risk has been accepted and no gate activated. The new investigation is the current recommendation for retiring temporary registration windows.

**Functional onboarding and exact-browser local logout are complete. Security sign-off and ordinary-address registration activation remain blocked by the unresolved terminal refresh-family reuse requirement.** The proposed Auth trigger remains uninstalled and is not recommended in its current form. Do not recreate Yuno, repeat the successful onboarding, or begin business-module development.

**Subsequent review:** the user has not approved installation. [Refresh-trigger review](refresh-family-revocation-review.md) recommends keeping the unchanged draft unapplied because of demonstrated constraint-timing/preflight hazards and incomplete rollback of false expiries. Supported local logout was independently tested again; getUser alone did not identify family revocation. No security gate was waived.

**Selected next step:** the user selected private Supabase clarification. The [support submission guide](supabase-support-submission.md) links the copy-ready, privacy-checked request and official channels; nothing has been sent. A separate [bounded-session-risk assessment](bounded-session-risk-assessment.md) is prepared without implementation or risk acceptance. The latest read-only target/hash check confirms the trigger remains absent and registration/delivery closed. Provider guidance or a separately approved security decision is still needed before resolving the gate.

## Verified in this review

| Check | Evidence |
|---|---|
| Original developer preservation | Read-only encrypted-baseline comparison: account, verified MFA, D Extacy Fireworks, memberships, location and all 11 historical application rows unchanged. |
| Yuno preservation | Same private identity, verified email, finalized original intent, trusted MFA factor, sole Owner membership, L.F Fireworks and Bulacan Warehouse. No cross-membership with the original developer. |
| Authenticated tenant denial | Real signed synthetic requests cannot open either retained workspace or its members. Separate synthetic tenants cannot switch workspace/resource identifiers. Staff sees only its assigned location; Owner/Admin see their permitted locations. Unauthorized financial and role changes are rejected. |
| Native local logout | Exact synthetic SSR cookie session removed; former bearer gets SQLSTATE 42501; its refresh fails; independent session remains usable. The actual Yuno browser check now also passes, as detailed below. |
| Password recovery | Desktop and mobile: native signup and finalized consent, encrypted provider recovery capture, expired/invalid/replayed tokens rejected, password reset denied without existing MFA, trusted factor preserved, former bearer denied after completed reset, old password rejected and correct workspace reopened after password+MFA. Only new example.invalid fixtures; no SMTP. |
| Registration intent/provider hook | Hosted unsigned, forged, stale and replayed requests, altered Terms/roles and direct unauthorized signup rejected. Durable intent limits exercised. |
| CAPTCHA | Previously confirmed live server success/replay protection and rejection of the held unusable token remain valid. Expiration-specific attribution remains unconfirmed under the user's approved evidence criterion. Actual signup freshness/hostname/action/failure regressions remain strict. |

## Actual browser diagnostic

An authenticated request recorded Yuno's AAL2 session fingerprint and actual denial of the other workspace and member endpoint. It did not sign out. Its fingerprint differs from the original pre-return checkpoint, confirming that the checkpoint alone cannot identify the current browser session.

A later request failed the identity match. The sanitized failure category is `different-authenticated-identity`: the provider recognized a signed-in account which was not the fixed Yuno identity in the diagnostic control. That request did not proceed to tenant checks. Do not interpret this as an RLS failure or reset any account to make it pass.

The original generic message obscured this distinction. The local endpoint now explains identity mismatch, missing provider session and incomplete trusted MFA separately, using no email, raw session ID, token or factor secret. Failure records are restricted to diagnostic GETs so unrelated logout requests cannot overwrite that diagnosis. The successful session fingerprint remains separate from failure records. The diagnostic expires after one hour and is disabled outside development/127.0.0.1:3000.

The user subsequently completed the controlled logout in Yuno's Guest profile. The server recorded provider success and an actual former-bearer API denial. Read-only correlation confirms that exact session row and all its refresh records are gone; another checkpoint session remains, matching local scope. Revisiting Workspaces without signing in returned Sign In. This is session-specific proof, not a navigation-only inference. Yuno's refresh-token value was not retained or replayed; absence of its backing session/token records is verified, alongside separate synthetic deleted-session refresh-replay denial. No further human logout repetition is needed.

## Critical refresh-reuse finding

Two synthetic reproductions rejected stale rotated-refresh use but did not deny the issued bearer immediately. The deeper reproduction observed four distinct refresh tokens; the newest refresh also remained usable after rejection of the oldest, outside a 12-second delay. The session row and one non-revoked refresh record remained. See `artifacts/refresh-reuse-security.json` and the intentionally failing regression.

The user read the dashboard: refresh-token rotation is enabled and the reuse interval is 10 seconds; no setting was changed. Refined metadata proves the family has zero live refresh records immediately after stale-reuse rejection. Inside the new post-revocation interval, the newest token can produce a replacement; after 12 seconds it is rejected. Both cases leave an old bearer accepted by Mitsa because the legacy provider session row remains active. Bounded error categories confirm actual `refresh_token_already_used`/HTTP 400, not network or rate-limit errors. Current upstream legacy-token code is consistent with these observations; its newer-token branch differs.

No migration or provider configuration change was applied. A synthetic test of the existing session-expiry boundary returned `session_expired` for refresh and 42501 for the old bearer, while preserving another session. The proposed draft uses one private deferred trigger function and one Auth refresh-table trigger to expire a fully revoked family. Its intended deferred-transaction model preserves rotation, but review demonstrated false expiry when constraints are forced immediate. Live compatibility is unproven; rollback cannot restore an incorrectly expired session's original lifetime. The draft adds no table, changes no actor function or Auth-hook setting, and performs no backfill. It remains uninstalled and is not recommended in its current form.

Read-only Auth health inspection reports v2.197.0. Its matching upstream release source contains both the legacy family-revocation path and a newer-format session-deletion path. This is consistent with the observed legacy outcome; it does not prove identical deployed binaries or establish a supported hosted-project format switch. A [sanitized provider reproduction](supabase-refresh-reuse-reproduction.md) is prepared but unsent. The [application-owned alternative assessment](application-revocation-alternative-feasibility.md) identifies the missing trusted event source: browser/server error handlers cannot observe every direct Supabase refresh attempt. No undocumented setting or unproven denylist was substituted for the security gate.

The general-registration activation helper now requires explicit passing session-specific logout, refresh-reuse protection and authenticated tenant-isolation evidence, in addition to completed onboarding. Missing/false flags fail closed. Successful functional onboarding cannot override the failed security regression.

## Email and provider readiness

- Gmail delivery and the isolated lease are closed. No real emails were sent in this review. Existing encrypted capture remains functional. Ordinary-recipient recovery delivery under the general lease has not been exercised; the completed Gmail signup delivery milestone is preserved.
- Application SMTP budgets are 10/hour, 20/24 hours and one recipient/minute, with durable claims, conservative expiry checks, private credentials, no automatic uncertain-delivery retry and lease closure/heartbeat controls. General mode is limited to two hours.
- Google documents a consumer Gmail ceiling around 500 messages/day and potential 1–24 hour sending blocks. This is not guaranteed SMTP capacity. Keep Mitsa's lower development budgets, test legitimate recipients only and move to a dedicated transactional provider with a verified domain before larger launch. [Google sending limits](https://support.google.com/mail/answer/22839?hl=en-GB).
- Supabase's provider-wide CAPTCHA toggle remains unchanged. Application Turnstile plus private signed intents/provider hooks currently protect signup. Do not consume a single-use token twice or enable a global switch that locks sign-in/recovery out. [CAPTCHA integration](https://supabase.com/docs/guides/auth/auth-captcha).
- The security advisor still reports leaked-password protection disabled. Supabase documents this feature for Pro and above. No paid upgrade was performed. [Password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- The policy-free private mail ledger is intentionally forced-RLS/default-deny; no permissive policy was added to silence its informational advisor notice.
- The current Supabase TLS notice removes older CBC HTTP ciphers from November 10, 2026 at the earliest. Existing clients use modern Node/TLS; no cipher downgrade was introduced. [Provider notice](https://supabase.com/changelog/cbc-tls-ciphers-deprecated).

## Verification and next boundary

The last full application suite passed 285 unit tests across 43 files, TypeScript, production build and two desktop/mobile recovery cases. Subsequent targeted trigger review passed 13 assertions, including two adverse reproductions; those green assertions demonstrate draft defects, not approval. The supported-API alternatives probe passed. Scoped hosted run: 20 checks passed, one refresh-reuse assertion failed. Separate inside/after-interval reproductions both retain failed security assertions; the provider session-expiry boundary probe passed. These failures remain blockers until a reviewed correction or an explicit security-requirement decision resolves them. Initial fixture MFA enrollment failed because email verification alone was used; the fixture was corrected to perform the required password confirmation and both browser cases then passed. A sandbox temporary-file module-cache failure was resolved by rerunning the unchanged unit suite outside that virtualization. Configured private keys were absent from all 30 compiled public asset files; private configuration remains Git-ignored.

Already-authorized general isolated registration stays conditional on passing security gates. No redundant approval for that objective is required. Separate external-delivery activation and any additional migration/Auth-setting changes still require the user's scoped approval. No production/Vercel deployment, live policy publication, account reset, ownership change or unrelated feature work occurred.

Commands used:

```powershell
npm run test:unit
npm run typecheck
npm run build
npx vitest run --project integration tests/integration/authentication-signoff.test.ts tests/integration/auth-settings.test.ts tests/integration/registration-edge.test.ts tests/integration/development-recovery.test.ts tests/integration/security.test.ts
npx vitest run --project integration tests/integration/refresh-reuse.test.ts
npx playwright test --config playwright.security-signoff.config.ts
node scripts/verify-reset-preservation.mjs
node scripts/inspect-controlled-workspace.mjs
node scripts/verify-browser-session-audit.mjs
```

The browser correlation command now passes. New evidence includes `artifacts/security-session-correlation.json`, both `artifacts/refresh-reuse-*-post-revocation-interval.json` cases, `artifacts/refresh-expiry-boundary.json` and the encrypted candidate recovery/hash checks. No code, token, password, QR or secret belongs in the report or user reply.
