# Mitsa MFA enrollment repair — current evidence

Scope: existing Account Security and first-time MFA only. Preserve the established Mitsa design system, landing assets, database policy, verification, recent-authentication windows and all existing factors. No provider configuration or schema change is needed for the prospective application fix.

The interrupted read-only Supabase query did not execute when automatic review hit the usage limit. After the user reported the reset, status-only queries completed on the exact approved isolated target/marker.

Confirmed developer state: verified email; one provider-verified TOTP factor; zero unverified factors; zero Mitsa bindings; uninitialized account security; one expired, unconsumed enrollment permit; zero active workspace memberships. No address, identifier, secret, QR, code, token or password is included here.

Timing checks show provider verification occurred before the enrollment permit expired but after the authorizing session's password evidence expired. The old UI/cookie granted a fresh five-minute QR window independently of the original password confirmation. Provider verification could therefore succeed while Mitsa's unchanged five-minute binding check correctly refused it. Subsequent correct-password confirmation saw the provider-verified factor and required an existing authenticator, while the UI listed only trusted Mitsa bindings. This produced an empty dropdown and generic error. This is not evidence that the password was incorrect.

Reference lock: existing Account Security typography, white/neutral surfaces, persistent labels, ink actions and native POST flow. Use the previously researched Refero form/focus craft guidance for ordered first-time setup, distinct existing-factor verification, safe state explanations and focused errors. No new visual language or assets.

Application changes: compute one deadline bounded by password confirmation and permit request time; shorten the encrypted enrollment cookie to that deadline; reject near-expired/expired setup before provider verification; preserve any already verified factor on binding failure. Classify pending, trusted and provider-verified incomplete states explicitly. Show password confirmation before setup; suppress empty existing-factor controls; provide explicit pending cancellation and actionable safe errors. Keep verified-incomplete factors on the review path.

The actual developer factor's QR/setup secret was reported exposed. After separate explicit user approval, the narrowly scoped recovery removed only that audited, provider-verified but Mitsa-unbound factor and revoked seven existing developer sessions. Target, marker, private-file identity, exact factor, zero bindings and zero workspace memberships were rechecked before acting. No verification flag was written and no personal workspace was created. A fresh normal enrollment is required; the exposed old entry must not be reused.

## Verification and findings

- Type checking and production build passed. All 132 unit tests passed, including the shared deadline, future/missing/expired evidence, encrypted cookie isolation and explicit factor states.
- Fourteen hosted integration checks passed across the new timing reproduction/recovery case and existing account-security/workspace authorization suites. A unique synthetic identity was used to reproduce provider verification after its password evidence expired; the unchanged database rejected binding. Correct password sign-in then succeeded while reviewed initialization remained required.
- The synthetic administrative recovery check first demonstrated that factor deletion alone left AAL1 sessions present on this hosted configuration. It was corrected to explicitly revoke only that synthetic identity's sessions before supported provider factor deletion; old JWT session provenance was then rejected. This result informs the separately approved actual-account recovery procedure.
- Six production browser regressions passed on desktop/mobile, including native Terms, primary/backup MFA, replacement, disable/reenrollment, cookies, logout, offline feedback and CSRF denial.
- All eight new MFA browser cases passed on desktop/mobile: native/enhanced first-time setup, bad-password rejection, bad-code rejection, verified persistence, workspace/Owner creation and returning sign-in; pending expiry/cancellation/new secrets; and preservation/review of provider-verified incomplete factors. The final corrected full run passed without retries.
- The expired-pending browser case exposed an overlapping-navigation race in the test: the next password submission could start before cancellation's document committed. The test now waits for the actual navigation. Account Security also groups enhanced security actions so a second form cannot start while a security action is pending; it retains the pending state through navigation.
- Setup screenshots mask every QR code, manual key, password input and code input. Secret-bearing browser contexts close in `finally`, preventing automatic failure snapshots from capturing secrets. Only synthetic identities are used. Redacted setup captures are under `docs/previews/mfa-repair/`.
- Two additional desktop/mobile browser quality checks passed: keyboard access, accessible feedback, doubled text, 320/390/768/1024/1440px widths, reduced motion, grouped pending actions and offline error focus. This brings the recorded browser checks to 16.
- The final expanded public-bundle/private-value audit passed with 292 examined files, including operator scripts and the recovery report, and no exposed configured private values. All 14 tracked landing/motion/asset fingerprints remain unchanged. The earlier production check confirmed the development testing guide remains 404.
- Approved recovery completed on 2026-10-14 in isolated project `mjtejwafxriwntweussc` only. Read-only postflight compared private before/after digests and verified unchanged account/password/email verification/Terms/profile and all other accounts' factor metadata. Audit history was preserved and recovery events added. Both database and provider checks confirmed zero remaining developer factors, zero sessions, zero bindings and zero memberships. The account remains active; public registration and external email gates remain closed. See `artifacts/developer-mfa-recovery-postflight.json`.

## Changed files

`src/app/auth/security/route.ts`: recognized error states, explicit trusted-factor classification, common deadline, pre-verification expiry guard, bounded secret-free diagnostics and pending cancellation results.

`src/app/settings/account/security/page.tsx`: ordered first-time setup, existing-factor verification, incomplete-factor recovery state, pending/expired cleanup and verified-factor management. No empty factor selector is rendered. Password confirmation comes first; a newly generated code is entered only in **New authenticator code**.

`src/lib/security/mfa-state.ts`: pure typed state/deadline helpers and safe messages. `src/components/site/PostForm.tsx`: reliable pending/focus handling and optional grouped security submissions; native POST behavior remains available.

`tests/unit/mfa-state.test.ts`, `tests/support/mfa-fixtures.ts`, `tests/integration/mfa-enrollment-regression.test.ts`, `tests/e2e/mfa-repair.spec.ts`, `tests/e2e/mfa-quality.spec.ts`, `playwright.mfa.config.ts`: actual signed-provider reproduction, isolated security checks and redacted browser verification.

`scripts/repair-incomplete-developer-mfa.mjs`, `scripts/verify-developer-mfa-recovery.mjs` and [developer-mfa-recovery-approval.md](developer-mfa-recovery-approval.md): private manifest, separately approved narrowly gated recovery and read-only preservation/provider postflight.

## Personal retry after approved recovery

1. Sign in again with your own password; the scoped recovery signs out old sessions.
2. Open `/settings/account/security`. Confirm your current password with **Confirm identity**; wait for its success message.
3. Select **Start authenticator setup**. Scan only the new QR code in Google Authenticator. Never reuse the exposed old entry or share a screenshot of setup.
4. Enter the new entry's current six-digit code in **New authenticator code**, then select **Confirm new authenticator** before confirmation expires. If setup expires, cancel the unfinished setup, reconfirm and create another fresh QR code.
5. Refresh and confirm that the verified authenticator and verified-session message appear. Continue to `/onboarding`, create **Synthetic Developer Workspace** with a fictitious first shop/warehouse, and receive the sole Business Owner role through the normal atomic operation.
6. Sign out and sign in again, verify the existing authenticator code and select the same workspace.

No password, personal code or setup key is needed in chat. The agent must verify current boolean MFA/membership status after the user completes these private actions before claiming personal onboarding is complete.

Current verified state — 2026-10-14: the user reported successful fresh MFA enrollment, workspace creation and authenticated workspace access. Read-only checks on the exact isolated project/marker confirmed verified email, one provider-verified authenticator, zero pending factors, one active trusted verified binding, initialized security with no recovery lock, one active Business Owner membership and one initial location. The reported workspace matched. This supersedes the earlier pending-enrollment state. The user created the workspace through the application; recovery created no workspace or role. No account, MFA or workspace changes were made during verification. See `artifacts/developer-onboarding-status.json`.

Milestone completed — 2026-10-14: the user subsequently confirmed successful sign-out, returning password/MFA sign-in and access to the existing workspace, and explicitly closed this milestone. This supersedes the earlier unconfirmed-return state. Do not restart MFA troubleshooting, reset the authenticator, recreate the account or create another workspace. The next phase is email code verification and controlled delivery, using separate synthetic registrations. Public registration, external delivery and the other release gates remain closed pending separate approval.
