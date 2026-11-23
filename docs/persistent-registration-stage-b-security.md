# Mitsa — Stage B session-security assessment

**22 October update:** the user submitted the private Supabase support ticket; support access is OFF. Awaiting Auth-team guidance. Strict Option A remains selected, with no residual risk accepted. Historical references below to an unsent request or choosing Option B are superseded by [the current decision/status](supabase-support-status.md); no repeated policy choice is requested.

Status: **Option A approved on 16 October: retain strict terminal revocation pending a supported Supabase resolution.** No one-hour exception is accepted or activated. The separately approved current-password provider hardening is now on and compatibility-tested; no other provider change occurred. Stage A prepares a prospective registration cohort but leaves `private.current_actor()` unchanged. Existing accounts receive no cohort backfill.

## Evidence and boundaries

Read-only dashboard observations on 16 October 2026 confirmed JWT expiry **3,600 seconds**, rotation enabled, reuse interval **10 seconds**, global CAPTCHA disabled, mandatory email confirmation, six-digit/3,600-second email OTPs, and enabled Before User Created and Send Email hooks. The signup hook name matched `private.mitsa_before_user_created`. The user independently confirmed the redacted fields: Send Email is `private.mitsa_isolated_send_email`, and Auth email quota is **100/hour**. These initial observations saved no setting. The later approved current-password change is recorded below. Secure email change is enabled; Free-plan session time-box/inactivity controls are unavailable.

The Email provider initially showed Secure password change off, current-password requirement off and leaked-password protection off (Pro+). The user separately approved current-password hardening. Following an interrupted six-step run and approved rollback, the guarded remaining four checks completed; **Require current password when updating is saved on and retained**. Ordinary/AAL2 missing or wrong current passwords are denied; valid current-password updates and private recovery without the old password succeed. MFA recovery still requires trusted AAL2 and preserves the primary factor. No other provider setting changed. The screenshot shows provider minimum **6**; complexity remains unconfirmed. Mitsa forms require eight characters, which is not a provider-wide boundary.

Installed-definition analysis found 42 protected authenticated API functions with a call path to `private.current_actor()`. `private.shops` SELECT uses `has_shop_access`; the security-invoker `api.foundation_resources` view reaches the same helper through resource RLS. Storage had zero buckets/objects and no custom policies; Realtime had no published tables. This is source/catalog coverage, not a new signed-JWT runtime test or a promise about future endpoints. The actor validates a live matching session, user status, JWT expiry and `not_after`.

Historical synthetic tests demonstrated:

- Explicit session-specific logout removes the intended session/family; former Mitsa bearer access and refresh fail, while another session survives.
- Reuse of an old non-parent refresh token outside the ten-second grace interval is rejected and revokes the family. In the reproduced legacy path, the session row remains; the latest token could obtain a replacement inside the new grace interval, and the old bearer still reached Mitsa. Outside that interval the refresh failed.
- `getUser()` accepted identity after terminal-family revocation. A retained session-row lookup therefore does not establish this terminal event.
- No demonstrated cross-tenant escalation, forged account creation or bypass of the signed registration hook was found. Stolen credentials can still exercise the victim's existing permissions; tenant isolation does not neutralize that compromise.

The strict refresh-family regression remains **failed**, not relabeled passing. Qualified Turnstile evidence remains server rejection of an unusable held proof; expiration-specific attribution remains unconfirmed.

## Option A — retain strict immediate terminal denial

Require immediate denial of protected Mitsa resources after the provider detects terminal refresh reuse, including direct Data API calls. Keep registration's security-ready control false until Supabase provides a supported fix/event or a supported release passes the original reproduction. Continue the prepared private support request; nothing has been submitted externally.

Supported local logout, `getUser()`, JWT validation and the existing active-session check each remain useful but do not supply a complete terminal-reuse event. A Next-only denylist can be bypassed by direct Auth/Data API requests. Polling refresh rows cannot prove immediate revocation without races. Shorter JWT expiry bounds one bearer only; replacement issuance can extend compromise. No managed Auth-table trigger is acceptable.

Tests: original ancestor-reuse sequence inside/outside grace, old/latest bearer and refresh rejection, direct RPC/RLS access, normal concurrent refresh and parent retry, MFA, recovery, independent-session preservation and provider upgrade compatibility. Provider clarification is necessary to claim the original guarantee. Rollback restores the supported provider configuration and closes admission; it never resets retained accounts or factors.

## Historical alternative B — not selected or authorized

The review-only SQL is `supabase/security-proposals/one-hour-development-session.sql.txt`. It is **not in the installation bundle, not installed live, and not imported by application code**. Six isolated offline SQL tests exercise the proposal; they do not establish hosted enforcement.

For newly assigned development/pilot cohorts only, the proposal adds a predicate to the existing database actor: reject resource access at or after the provider session's original `created_at + 1 hour`. Reject a missing creation time and emergency-blocked cohorts. Refresh, MFA verification, process restart and renewed admission cannot reset that original time. Existing unassigned accounts retain their current behavior. A fresh password-plus-trusted-MFA sign-in creates a new session and may regain authorized access.

This protects only covered Mitsa database resources after the boundary. It does **not** invalidate a JWT, revoke a provider credential, prevent use during the first hour, recall returned data, or provide a total account-compromise deadline. Direct Supabase Auth operations remain outside the Mitsa actor. Storage/Realtime must not be introduced without extending the coverage assessment.

### Credential-change concern

The provider now denies ordinary password changes without a valid current password, including direct Auth requests at AAL2. Private recovery retains its necessary old-password exemption; MFA-bearing users must still verify trusted TOTP before changing the password. All ten approved password checks passed. This closes the demonstrated ordinary password-update persistence path for a session-only attacker who lacks the password. It does not establish complete account-takeover containment.

Direct native Auth factor operations remain outside the resource-age predicate. The baseline demonstrated recent trusted AAL2 can enroll/remove a factor and obtain a Mitsa binding permit; a sufficiently recent stolen AAL2 session may satisfy the same AMR condition. Current-password hardening does not protect those operations. Removing factors can deny service; a further stolen password or recovery proof changes the attack assumptions. Do not describe the one-hour proposal as a total compromise bound.

Secure password change stays off: its 24-hour fresh-session exemption does not protect a recently stolen session, and reauthentication-mail support needs separate compatibility work. JWT lifetime and reuse interval are unchanged.

Required negative tests use new synthetic users only: direct password update with an old bearer; factor enroll/challenge/removal outside Mitsa; trusted binding without an authorized permit; a refreshed token on the same expired session; attempted fresh sign-in without the required password and trusted MFA; recovery preserving factors; every protected RPC and RLS view at the one-hour boundary. Refresh at minute 55 and test after minute 60 while the JWT remains otherwise valid. A new trusted sign-in must work, and other sessions/tenants must remain unaffected.

Rollback must keep the cohort guard or deny the affected cohort. Removing it after assigning bounded cohorts would silently remove the approved bound. Closing signup or delivery is not session revocation. Use supported, separately authorized Auth revocation for an actual account incident.

## Recommendation and approval boundary

Stage A is complete. Keep the strict failed requirement visible. Current-password compatibility is demonstrated. Before choosing Option B, review the remaining direct-Auth/factor risks and the exact resource-only guarantee; hosted one-hour enforcement and all covered paths still need approved installation and tests. A one-hour limit by itself is insufficient justification to claim account-takeover containment. Option A remains the default until a separate Stage B decision explicitly accepts a precisely stated development-only exception.

## Continued investigation — 16 October 2026

The isolated Auth health endpoint still reports **v2.197.0**. The official source snapshot is pinned to commit `4eee58f296d9698a1c2c0ae14d7a0b379c7622d3`; source hashes/line references are in `artifacts/persistent-registration-provider-source.json`. This verifies the reported-version source, not the deployed binary's full configuration or build provenance. Upstream Go tests were inspected, not executed.

| Supported option | What current evidence establishes | What it does not establish |
|---|---|---|
| Explicit supported local logout + active-session actor | Historical hosted tests removed the exact session/family and denied old Mitsa bearer/refresh, preserving another session. Existing actor definition/owner/ACL remain unchanged. | Automatic terminal-reuse detection. `getUser()` and a retained session row accepted the historical terminal-family state. |
| Provider reuse detection | Source revokes legacy family rows and updates their timestamps; the reuse interval is measured against those timestamps. This explains the recorded latest-token retry during the newly started interval. | A supported immediate permanent denial guarantee. Standard parent/concurrency retries are intentional; that does not make the stricter recorded failure pass. |
| Require current password | Now saved on. Ten hosted fixture checks passed, including direct ordinary/AAL2 denial, valid-current update, private recovery/replay, retained MFA and returning TOTP. | No direct-factor protection, complete takeover bound, real inbox recovery or browser sealed-reset-cookie proof. |
| Secure password change | Source/docs require a nonce only after the session is 24 hours old. | Protection of a recently stolen session. The current hook does not implement reauthentication mail, so enabling this indiscriminately could strand older-session changes. Keep off pending a separate workflow proposal. |
| Shorter JWT / paid session time-box | Supported provider controls can reduce a bearer lifetime or refuse later refresh. | Immediate JWT invalidation or a total compromise deadline. Renewal, cleanup timing and direct Auth access must be assessed independently. No JWT change or paid upgrade is proposed now. |
| One-hour Mitsa resource predicate | Six new offline tests execute the exact review-only SQL: fresh owner access, post-hour direct workspace/RLS denial, no reset from renewed claims/MFA, unassigned-user compatibility, fresh-session access, emergency denial and unchanged actor owner/ACL. | Signed-JWT verification, all 42 live RPC paths, Auth credential revocation, Storage/Realtime coverage or a live installation. The proposal remains uninstalled. |

The first session-test fixture omitted its Privacy acceptance; the normal consent gate correctly rejected workspace access. The fixture was corrected to model normal finalization rather than weakening that assertion.

### Exact conditional development-policy recommendation

**Current policy remains strict, with activation blocked.** If the user later selects a bounded alternative, require all of the following: prospective cohorts only; original provider-session creation time plus one hour at every covered database boundary; unchanged trusted MFA/RBAC/RLS; secure email change retained; verified provider current-password enforcement for ordinary updates; recovery retaining MFA and account/session binding; tested direct factor-management/persistence attempts; explicit emergency cohort denial; and a separate, documented risk acceptance. Keep JWT 3,600 seconds/reuse ten seconds until a separately tested configuration decision changes them. No grandfathered account is backfilled.

Do not enable Secure password change merely to satisfy the recent-session requirement: its 24-hour exemption is the wrong guarantee. The separately approved **Require current password when updating: false → true** candidate is now retained after successful hosted compatibility. Do not repeat its consumed test budget.

Residual risks include access during the permitted hour, already returned data, direct Auth operations beyond the resource predicate, recent stolen AAL2 credentials authorizing factor-management actions, and factor-removal denial of service. A recently authenticated stolen session may satisfy the database's five-minute AMR check; UI password prompts alone do not constrain direct RPCs. Provider current-password enforcement addresses password persistence, not all of those risks. Private hosted recovery compatibility is now demonstrated; inbox delivery and the browser recovery-session binding still require their separately approved integration evidence.

Production must not inherit this exception. Require its own reviewed session policy, supported provider revocation semantics or explicitly approved production guarantees, direct-API/factor/recovery tests, monitoring, transactional delivery, published policy/retention decisions and deployment approval. The disabled leaked-password protection warning remains open.

The user approved the narrowly bounded [two-fixture provider baseline](persistent-registration-stage-b-test-approval.md), then its bounded continuation. The continuation completed: normal MFA-bearing AAL1 password/factor denial, unbound-factor and missing-permit denial, recent trusted-AAL2 binding/removal, private recovery replay rejection, recovery retaining the primary factor and requiring AAL2 for a password update, and returning password-plus-TOTP access all passed. Both fixture sessions are closed; capture/SMTP counts and retained-account invariants are preserved. The first interrupted response's precise cause remains unknown; it was not silently relabeled passing. See [baseline results](persistent-registration-stage-b-baseline-results.md).

The user then approved [current-password configuration and compatibility testing](persistent-registration-stage-b-hardening-approval.md). All ten password checks completed under the original grant; two private recovery links and five sign-ins were used, with zero external emails/new accounts/factors. Both fixture sessions are closed. The flag is retained on. The original interruption remains recorded as inconclusive; guarded continuation and Windows checkpoint repair completed successfully. Both retained-account preservation audits passed again. See [hardening results](persistent-registration-stage-b-hardening-results.md).

## Selected decision and remaining provider dependency

Option A remains the current strict policy and safest guarantee: keep security-ready false pending a supported provider correction/reproduction pass. Ordinary signup is technically possible; this is a security-policy gate, not an intrinsic account-creation limitation.

The user explicitly selected Option A and instructed that the one-hour alternative must not be introduced. Do not ask for the same risk decision again. The separate proposal remains historical review material, excluded from installation. Continue toward a supported provider correction and passing strict tests. New public API/source and read-only hosted evidence, candidate newer-format rollout and exact regression criteria are recorded in [strict provider resolution](strict-refresh-provider-resolution.md). No confirmed self-service hosted correction has been found; provider clarification is required.

Reviewing or selecting a path grants no migration, factor/account mutation, external email, SMTP/worker launch, provider setting change or release approval. Current provider minimum six versus app eight and leaked-password protection remain documented readiness issues for separate policy/configuration review.

Production cannot inherit a development exception. It requires its own provider/session policy, published versioned policies, transactional email, monitoring, abuse controls, retention/legal review and explicit deployment/activation authorization. No paid upgrade is requested by Stage A.

References: [Supabase sessions](https://supabase.com/docs/guides/auth/sessions), [sign-out behavior](https://supabase.com/docs/guides/auth/signout), [password security](https://supabase.com/docs/guides/auth/password-security), [CAPTCHA integration](https://supabase.com/docs/guides/auth/auth-captcha). The inspected [v2.197.0 password-grant source](https://github.com/supabase/auth/blob/v2.197.0/internal/api/token.go) checks the password before returning `email_not_confirmed`; Mitsa's pending continuation relies on that behavior and needs a hosted compatibility check before activation.
