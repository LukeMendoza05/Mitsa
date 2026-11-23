# Mitsa — registration security paths, separate from infrastructure

23 October 2026. Decision review only. **Path A / Strict Option A remains selected. Path B is not approved, installed or equivalent.** Inactive Stage C1 infrastructure may be approved independently; it leaves `session_policy_ready=false` and does not accept either path's activation risks.

## Evidence to retain

The historical prohibited non-parent ancestor R0 was rejected outside the reuse interval. Immediately after that rejection both independent runs retained the session with zero unrevoked family records. Subsequently, immediate R3 reuse obtained a replacement and restored one live record; delayed R3 reuse was rejected. Former bearer access still passed the protected actor. No experiment was repeated for this comparison. Ticket status is recorded in `supabase-support-status.md`; an acknowledgement is not a supported correction.

The separately approved current-password hardening passed ten hosted compatibility checks and was retained on. It denies ordinary password changes without a correct current password and preserves necessary recovery/MFA behavior. This reduces one persistence path for an attacker with only a session token; it does not terminate refresh families, protect every direct Auth action or establish complete account-takeover containment. Current setting observations should be refreshed before any later approved policy test.

## Comparison

| Dimension | Path A — strict terminal invalidation | Path B — explicitly bounded isolated testing |
|---|---|---|
| Required guarantee | Prohibited terminal reuse stops renewal and immediately denies that session protected Mitsa resources, including direct RPC/RLS access. Legitimate parent/concurrent retries remain supported. | Covered Mitsa resource access ends at the provider session's original creation time plus one hour for explicitly assigned new testing cohorts. It permits access during that hour and does not supply terminal-reuse invalidation. |
| Present status | Required but failed/unresolved; awaiting supported Supabase guidance. | Historical review-only actor proposal outside the migration bundle. No risk acceptance, hosted enforcement or activation. |
| Provider dependency | Exact supported correction/rollout and terminal-state signal. A newer-format path alone does not establish hosted support or coverage of retained legacy sessions. | Does not fix the provider dependency. Any test authorization must explicitly accept the known failure for its exact limited scope. Strict sign-off remains failed. |
| Enforcement | Existing protected paths can deny after the provider terminates the matching session, subject to verified hosted semantics. No managed Auth trigger. | A separately approved database actor predicate, not a page timer. Applies to every reviewed direct RPC/RLS boundary. Refresh, MFA and server restart cannot reset the original session creation timestamp. |
| Existing accounts | Preserve accounts, factors, ownership, history and independent sessions. Provider migration/rollout must be reviewed for all affected session formats. | No automatic existing-account/cohort backfill. A fresh trusted sign-in may create a new session; this is not a one-hour account lifetime or takeover deadline. |
| Deployment | Required supported behavior plus full compatibility/security acceptance before activation under the selected policy. | Isolated low-volume development only, with explicit test/consent scope and approved data exposure. No production, general public launch or public hosting follows from testing approval. |

## Path A — implementation and verification

1. Obtain the Auth team's explanation and exact supported release/configuration/managed rollout; identify how terminal revocation becomes observable to direct resource checks and how legacy/current sessions are handled. Do not assume a client update, `getUser()`, JWT shortening or the existing retained-row lookup fixes it.
2. Review the precise provider change and rollback; request separate authorization for synthetic identities and hosted request budgets. Preserve current password hardening, MFA, reuse interval and authorization policies unless that exact supported proposal is approved.
3. Prove immediate and delayed denial of all retained refresh tokens and former unexpired bearers on protected app and direct RPC/RLS paths. Also prove legitimate concurrent/parent retry, independent-session/tenant preservation, MFA/recovery and retained-data invariants. Existing token-format and legacy coverage must be explicit; no silently weaker grandfathered strict guarantee.

Residual risks remain for data already returned, credential theft outside this event and services not covered by Mitsa's authorization boundary. Do not claim every Supabase service instantly invalidates a signed JWT. Rollback closes affected admission/testing, follows provider-supported recovery and never edits managed Auth tables or resets retained accounts without approval.

## Path B — limited testing proposal, not a recommendation to accept silently

This can be considered for separately approved synthetic accounts or informed isolated-development testers, with explicit permissible data/actions and a reviewed consent statement. It is not appropriate to describe the result as strict security or to enroll ordinary real businesses under an undisclosed exception. Persistent development controls can replace repeated manual signup windows; a security test still has finite account/request/email budgets. Do not reintroduce developer email allowlisting as the general product architecture.

The review-only source is `supabase/security-proposals/one-hour-development-session.sql.txt`. It uses the existing actor's provider session `created_at`, applies the prospective cohort policy and fails closed at one hour or on missing required time. It is not installed by C1. The cohort emergency flag also becomes a resource boundary only when a separately reviewed actor actually enforces it; merely installing a flag/table does not revoke resource access or Auth sessions.

### Attack scenarios and limitations that require explicit acceptance

- A stolen fresh AAL2 session may use the victim's permissions during the permitted resource hour. Tenant isolation restricts whose data it reaches; it does not protect the victim from their own stolen authorization or recall downloaded data.
- Direct Supabase Auth calls do not pass through Mitsa's database actor. The resource-age predicate does not stop provider refresh issuance, every profile/credential operation, factor-management calls or denial of service by factor removal.
- Completed baseline tests showed sufficiently recent trusted AAL2 could enroll/remove a factor and satisfy relevant Mitsa binding conditions. UI password prompts alone do not constrain direct APIs. A stolen recent AAL2 context can therefore create factor/persistence risks; current-password hardening does not protect those actions.
- With additional stolen password/recovery access or an attacker-controlled trusted factor, an attacker may establish a new session and regain resource access. The one-hour resource cutoff is **not a total account-compromise bound**. Do not infer refresh cannot extend access elsewhere.
- Existing providers/Storage/Realtime/new endpoints need their own coverage review. Historical catalog coverage of 42 RPC paths and shop/resource RLS is not all-branch hosted JWT testing or a guarantee for future modules.

### Required approvals and tests before Path B testing

Approve the exact cohort/data/consent scope and residual risks separately from SQL, provider/service changes and email activation. Review the exact actor SQL/ownership/ACLs and all affected RPC/RLS/direct-API paths before installation; do not set readiness true based only on approval of the wording.

Use disposable approved fixtures to prove: AAL1/trusted-MFA restrictions; at minute 55 refresh and retain the same provider session; denial at original minute 60 despite an otherwise valid JWT; missing-time and emergency-block denial; no extension through refresh/MFA/restart; fresh legitimate password-plus-trusted-TOTP sign-in; every protected RPC/view/shop path; other cohorts/sessions/tenants preserved. Test direct password, factor and recovery operations and report the actual remaining successful attacker actions rather than labelling them fixed. Recheck completed hardening only within a newly approved test budget.

A single end-to-end journey is insufficient. Complete callback correlation, provider OTP/resend/expiry/replay, recovery-session binding, worker fencing/outage/restart, quotas, failure handling and tenant denial. External mail needs its own recipient/attempt scope. No retained identity or business record may be a disposable fixture.

Rollback must keep the accepted resource guard or deny the affected cohort. Closing signup/email is not session revocation; removing the guard would remove the accepted bound. Use separately authorized supported session revocation for an actual incident. Stop controlled testing if enforcement or preservation fails.

## Recommended decisions, in order

**Now:** approve or defer inactive C1 without changing the security decision. Complete separately approved disabled-service preparation and non-activation compatibility work next. These steps do not require declaring the provider issue fixed.

**Before real signup/email tests:** either retain Path A and wait for a supported verified correction, or explicitly approve a precisely scoped Path B testing exception with its residual direct-Auth/factor risks, exact actor SQL and hosted test protocol. The default remains Path A; this document requests no immediate risk acceptance.

**Before public release:** production needs its own target, supported session guarantees, reviewed password/leaked-password protection, every API/service boundary, published legal/retention policy, transactional email capacity/monitoring and explicit release approval. Development acceptance never carries over automatically. No public/Vercel deployment or paid upgrade is proposed here.

Primary references, read 23 October: [sessions and reuse rules](https://supabase.com/docs/guides/auth/sessions), [current-password enforcement](https://supabase.com/docs/guides/auth/password-security), [Send Email hook routing](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook). Historical hosted evidence and exact guarantees remain in `persistent-registration-stage-b-security.md` and `strict-refresh-provider-resolution.md`.
