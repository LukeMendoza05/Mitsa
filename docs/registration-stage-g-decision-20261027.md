# Stage G — supported resolution decision, 27 October 2026

**Strict Option A remains BLOCKED under SU-519045. No security exception, provider change, new Auth experiment or additional support message is authorized by this review.** C-A diagnostic email delivery is independent; it cannot establish OTP, signup or session-security acceptance.

## Evidence and current public guidance

The existing hosted evidence remains unchanged: both prohibited-R0 runs had zero unrevoked family records immediately after rejection and retained the session row. The immediate-R3 run subsequently issued a replacement and restored one live record; the delayed run denied R3. Former access credentials still passed the existing active-session check. These are recorded observations, not newly executed tests.

Supabase's [session documentation](https://supabase.com/docs/guides/auth/sessions) distinguishes the normal reuse interval and immediate-parent exceptions, and describes termination outside those exceptions. Its post-signout guidance checks whether the JWT's session identifier still exists. That check cannot identify this reproduced terminal event while the affected session row remains present. [Signout documentation](https://supabase.com/docs/guides/auth/signout) separately warns that signed access tokens remain valid until expiry. Ordinary cryptographic JWT validity is not itself the demonstrated defect.

The public [latest-release link](https://github.com/supabase/auth/releases/latest) resolved to [v2.197.0](https://github.com/supabase/auth/releases/tag/v2.197.0) during this review. The [matching token-service source](https://github.com/supabase/auth/blob/v2.197.0/internal/tokens/service.go) and [maintainer rollout discussion](https://github.com/supabase/auth/pull/2356) remain evidence for the existing legacy/newer-path hypothesis. Public source is not proof of this project's hosted execution path, supported rollout configuration, or successful correction. No new supported self-service correction was established.

## Decision required

| Path | Exact remaining dependency | Boundaries |
|---|---|---|
| Recommended: supported Supabase correction | A substantive SU-519045 response identifying an exact supported legacy correction or newer-token rollout, affected existing sessions, concurrency/MFA compatibility, and rollback | Preserve current architecture; apply nothing until reviewed and separately approved. Then prove the complete guarantee with disposable fixtures. |
| Separately commissioned architecture evaluation | A supported replacement/session authority with atomic terminal-reuse invalidation and enforcement at every relevant access boundary | No implementation or migration is approved. Preserve existing identities, MFA and ownership; migration feasibility and costs are unverified. |
| Weaker development exception | Explicit informed acceptance of precisely enumerated renewal, direct-Auth and stolen-session risks | Not approved; not equivalent to Strict A; unavailable as an execution gate in the current C-B runner. |

A backend-only cookie wrapper, application denylist, polling worker, shorter JWT lifetime or one-hour resource cutoff does not by itself prevent an attacker from using retained credentials directly against Supabase Auth. A third-party authentication integration alone also does not prove immediate revocation of previously issued resource JWTs. Neither is an established resolution.

## Required proof after provider guidance

Prepare one separately approved, bounded synthetic protocol before any hosted change. It must demonstrate terminal rejection of a non-parent ancestor outside the documented exceptions; immediate and delayed denial of every retained refresh credential, including direct Auth renewal; and immediate denial of an otherwise unexpired bearer credential at protected RPC/RLS and application boundaries. Correlate the exact session lifecycle privately rather than accepting an expected HTTP status alone.

Include direct Auth user-update and MFA/factor-management operations with the affected credential. Where a provider endpoint remains usable, record its capability and security consequence explicitly; do not extrapolate resource denial to Auth-wide revocation. Test independent sessions, legitimate concurrent/parent refresh, password-plus-TOTP returning access and recovery with retained MFA. Preserve unrelated accounts, factors, consent and businesses. Stop on any counterexample.

**Next dependency:** Supabase's non-sensitive technical response to SU-519045. No duplicate ticket, speculative setting change, managed-Auth trigger or automatic security-test retry is needed.
