# Mitsa — controlled onboarding report, 15 October 2026

**Latest security review:** [authentication-security-signoff.md](authentication-security-signoff.md). Functional onboarding, authenticated tenant/recovery checks and exact-browser local logout passed. Refresh-family reuse protection remains a reproduced blocker; a narrow migration is prepared for separate approval. Earlier evidence below is retained as checkpoint history and must not override the newer correlation or failed regression.

**The functional new-user journey has completed. General-registration security sign-off remains pending.** This report does not claim all security checks passed or authorize unrelated business-module work. General signup and email delivery remain closed. No existing account, factor, ownership, permission or historical record was changed by these read-only validation checks.

## Completed functional journey

| Stage | Evidence and result |
|---|---|
| Registration | The previously unregistered, unallowlisted private test alias created exactly one new Supabase Auth identity with the original signed registration intent. Terms acceptance finalized after verification. |
| Turnstile | Real server verification and replay protection passed; the successful signup was subject to the existing strict validator and signed-intent/provider hook. Held unusable-proof rejection and freshness regressions meet the user's explicitly approved evidence criterion. Expiration-specific provider attribution remains unconfirmed. |
| Gmail verification | One fresh user-triggered resend was accepted by Gmail and received, as confirmed by the user. Supabase's six-digit OTP verified the account. The 3600-second expiry was preserved; no manual verification or fabricated code was used. |
| MFA | One verified TOTP factor has a current, unrevoked trusted binding. Initial and returning provider session records reached AAL2 with password and TOTP authentication. No authenticator was reset or replaced. |
| Workspace | The new identity, matching Yuno, created L.F Fireworks and is its sole active Business Owner and primary owner. The workspace creation audit names this identity as actor. |
| Location | Bulacan Warehouse remains the same initial active location. |
| Sign out and returning sign-in | User confirmed redirect to Sign In, password login, mandatory existing-authenticator challenge and reopening the same workspace. Provider audit for this exact test identity records token_revoked, login, challenge_created and verification_attempted. Read-only comparison confirms a genuinely new trusted AAL2 session, unchanged factor and unchanged workspace/location IDs. |
| Tenant scope | The account has only its own workspace membership; D Extacy Fireworks was absent in its actual workspace selector. Original developer and test-account memberships are separate. Six relevant tables retain forced RLS; anonymous/authenticated direct probes expose no tenant rows. Existing API membership/MFA predicates remain intact. A direct cross-tenant request using the Guest browser's actual bearer has not been tested. |
| Preservation | Original developer account, verified MFA, D Extacy Fireworks, memberships, location and all 11 historical baseline application rows compare unchanged. |

The corrected email worker uses the database clock for provider timestamp/expiry validation. This resolved the reproduced local clock-skew rejection without changing OTP timestamps, lifetime or rate controls. The email window was explicitly closed after its one received message; no further email is required for returning sign-in.

## Logout evidence limitation — unresolved

The pre-return database checkpoint's AAL2 session row and a non-revoked refresh-token record remain present after the user-reported logout. The audit log separately confirms a token_revoked action for this test account, and the returning login created a new password/TOTP AAL2 session. These facts establish the functional journey, but do **not** conclusively establish which actual browser session the logout revoked.

The checkpoint observed database sessions; it deliberately did not inspect the Guest browser's bearer token or cookies. Do not assume every pre-existing session must be removed by local logout, and do not explain this observation away as normal retention: Supabase documents local logout as terminating the current session, and its session guide describes checking the logged-out token's session ID for sensitive actions. The script's strict prior-session-revocation flag remains **false**, rather than being rewritten to make a check pass.

Before general registration security sign-off, correlate the actual current logout session safely and verify the former bearer cannot perform protected API operations. Do this in a scoped controlled test, never by revoking every session, resetting MFA, changing ownership, minting an impersonation token or treating UI navigation alone as revocation proof. No session was revoked by the agent during this audit.

Sources: [Supabase sign-out scopes](https://supabase.com/docs/guides/auth/signout), [session validation after sign-out](https://supabase.com/docs/guides/auth/sessions#how-to-ensure-an-access-token-jwt-cannot-be-used-after-a-user-signs-out).

## Remaining general-registration gates

1. Resolve the session-specific logout evidence gap above and test former-session denial, while preserving other legitimate sessions and all existing data.
2. Complete a direct cross-tenant API/location/member denial check with actual authenticated contexts. Membership, selector and RLS checks already passed; do not relabel those as this unperformed black-box check.
3. Complete eligible new-user password-recovery evidence, including MFA preservation and delivery restrictions. Current real test identity has not completed that flow; prior synthetic captured recovery regressions passed. Do not send new recovery mail or reopen delivery under the expired/completed window without the required scope approval.
4. Recheck ordinary-address eligibility, strict CAPTCHA and direct-Supabase-hook bypass resistance, limits, delivery failure handling, capacity and stop/rollback controls before broadening. General development eligibility is already implemented without manual email allowlisting; activation must not bypass the remaining evidence gate.
5. Use the already-authorized isolated general mode only after the gates pass. Preserve 10/hour and 20/day application email limits and the bounded local worker lease. Broader inbox delivery must remain legitimate and user initiated. Gmail is a low-volume development transport; confirm current provider capacity and use a dedicated transactional provider before larger launch.
6. Keep the leaked-password protection warning documented. No paid upgrade, public Vercel deployment, production change, legal publication or provider-wide CAPTCHA switch is included. Supabase's global CAPTCHA toggle remains unchanged; strict application-side Turnstile plus private signed intents and provider hooks protect signup without consuming the same proof twice or locking existing users out.

Fresh security advisors confirm leaked-password protection remains disabled. The other informational finding is the intentionally policy-free private mail-claim ledger: forced RLS plus no ordinary grants deliberately deny clients direct access. No permissive policy was added to silence that finding. See [password protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) and [default-deny RLS advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

The new-user registration → email verification → MFA → workspace → returning sign-in **functional milestone** is recorded as completed. The broader authentication/security sign-off and general-registration activation are **not** marked complete while the above evidence remains unresolved. Do not begin inventory, POS or unrelated dashboard implementation before that sign-off.

## Verification record

Latest implementation checks: 268 unit tests / 41 files, TypeScript, production build and three desktop/mobile/JavaScript-disabled verification-page checks passed. Earlier hosted RBAC/RLS/security regressions passed; they were not rerun with new-account creation during this read-only audit. Current read-only identity/session/workspace/preservation checks passed except the explicitly retained prior-session-revocation evidence flag.

Evidence: `artifacts/controlled-onboarding-results.json`, `artifacts/controlled-returning-signin.json`, `artifacts/controlled-returning-provider-audit.json`, `artifacts/controlled-workspace-authorization.json`, `artifacts/developer-reset-preservation.json`. No email address, verification code, password, token value, authenticator secret or QR is included.
