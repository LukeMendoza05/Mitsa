# Mitsa — strict security decision and supported paths

27 October 2026. Review only. No provider call, settings change, managed Auth-table change, support message or security-risk acceptance occurred.

## Verified checkpoint

Strict Option A remains selected and **BLOCKED** under acknowledged ticket **SU-519045**. Support access remains disabled; no new project access is authorized. The prepared follow-up stays unsent. Current-password hardening was previously tested/retained on; it is a completed protection, not a refresh-family correction. Existing MFA, RLS, memberships and logout/session checks stay intact.

Historical observations, not rerun:

1. R0 reuse outside permitted exceptions was rejected. Both runs initially observed zero unrevoked family records.
2. In the immediate-R3 run the previously current token subsequently obtained a replacement, restoring one live family record. In the later-R3 run that renewal was rejected.
3. The Auth session row remained, and former bearer credentials continued passing Mitsa's matching active-session check. A provider-valid identity response was not a terminal-session guarantee.
4. Explicit supported logout worked in its controlled tests, including protected resource denial and independent-session preservation. That does not make logout automatically occur for a prohibited reuse event submitted directly to Auth.

Evidence remains in `artifacts/refresh-reuse-inside-post-revocation-interval.json`, `artifacts/refresh-reuse-after-post-revocation-interval.json`, `artifacts/refresh-revocation-alternatives.json`, the existing source review and support report. No failed outcome is relabelled passed.

## Fresh public-source review

[Session documentation](https://supabase.com/docs/guides/auth/sessions) still describes two permitted reuse cases and termination/revocation outside those cases. It separately describes matching session-row checks for sign-out. Its timed-session controls are evaluated during refresh, so they do not supply the requested immediate event guarantee. The public [latest release](https://github.com/supabase/auth/releases/latest) resolved to **v2.197.0**, the already-reviewed source version. The [platform changelog](https://supabase.com/changelog) did not identify a relevant correction in the reviewed latest entries. This is not a comprehensive proof that no private managed rollout or supported remedy exists.

The newer upstream path's `LogoutSession` call is a **source-level hypothesis** for the different behavior. It does not establish the hosted algorithm/path, legacy-format coverage, rollout configuration or a fix. A client-library update, JWT shortening, session deadline, refresh reuse-interval change or existing session-row lookup cannot be represented as resolving the reproduced gap.

## Independently approvable security paths

| Path | Guarantee and missing evidence | Cost/impact | Decision |
|---|---|---|---|
| G1 — supported hosted Supabase correction | Requires exact supported release/rollout/configuration, legacy/new format behavior, atomic terminal invalidation and direct-resource denial proven on disposable fixtures. | Smallest architecture change if Supabase supplies the correction; timing/cost unknown. | **Recommended.** Keep strict policy; await technical guidance, not another identical experiment. |
| G2 — supported alternative architecture evaluation | Evaluate a provider with documented synchronous terminal reuse/session invalidation, or privately operated corrected Auth with server-owned revocation enforced at every resource boundary. Provider-direct Auth, renewal, password/recovery and MFA operations must also be included. | Substantial migration/operations/compatibility work; potential hosting/provider costs. Existing accounts/MFA cannot be assumed portable. | Approve feasibility research only if desired. No replacement, migration, paid service or credential export is proposed for installation. |
| G3 — synthetic-development-only exception | Existing prospective one-hour resource guard can bound covered resource access, but permits access inside the hour and does not stop every direct Auth/factor/persistence operation. It does not satisfy Strict A. | Requires separate informed risk decision, exact actor/RPC/RLS SQL approval and hosted enforcement evidence. Synthetic data only; no retained-user backfill. | **Not selected.** Previously rejected policy remains unaccepted. Master objective is not risk acceptance. |

A Next-only denylist/BFF wrapper is insufficient while direct public Supabase Auth and Data/RPC paths bypass its event observation. Polling logs or internal refresh counts has a detection delay and the demonstrated replacement race. An opaque server-session design could enforce its own revocations only if all relevant traffic and authority are actually constrained; putting a proxy in front of an otherwise reachable provider does not prove that constraint. No complete supported application-only substitute was established by this review. Managed Auth-table triggers remain excluded.

## Exact provider guidance required

- Confirm the hosted release/refresh path, legacy and newer token coverage, and whether terminal ancestor reuse should remove/expire the session synchronously.
- Explain the observed immediately-current-token replacement and retained active session, identifying an officially supported correction or managed rollout plus rollback/compatibility conditions.
- Identify a trustworthy terminal-state signal available to direct resource checks, with transaction/race semantics. Explain limits for direct Auth renewal, factor management, password changes and recovery.

The acknowledged ticket already requests clarification. Do not resend or request support access. User will supply the non-sensitive technical response when available.

## Regression specification after guidance — not authorized live

Prepare exact bounded budgets only against the actual proposed correction. Use two new disposable identities and their authorized tenants; never retained accounts. Required assertions:

1. Establish and privately retain R0 through R3, confirm R0 is a non-parent ancestor and outside permitted reuse grace, then submit terminal reuse directly to Auth. Record the verified terminal rejection privately.
2. From the moment the terminal transaction is acknowledged, test retained newest/ancestor tokens and unexpired former bearer credentials immediately and after the old grace boundary. Correlate to the same session privately. Prove no replacement or resource access on app routes and each relevant direct API/RPC/RLS class, rather than relying on one status code or a UI redirect.
3. Include direct Auth refresh, user/profile/password/recovery and MFA factor-management operations with explicit harmless fixture outcomes and one-use requests. Distinguish provider identity/token validation from resource authorization. Existing current-password protection remains on.
4. Prove legitimate parent retries, concurrency within permitted grace, normal renewal, unrelated sessions/tenants, TOTP assurance, recovery and returning sign-in still work. Do not infer branch coverage from one successful login.
5. Verify zero retained-account/factor/tenant changes using the separately accepted preservation reference and scoped allowed fixture deltas. Stop activation on any failed assertion. Recovery uses only supported logout and the approved provider rollback; no Auth-table edits or global resets.

No defensible hosted request/row budget can be fixed for an unknown provider correction. Stage G therefore has **zero executable hosted allowance now**. The exact correction/test package is a required follow-on source review, not blanket approval hidden in this document.

## Password and release gates

The last observed provider minimum length was six versus the application's eight. Propose provider minimum **8** only after a separate current-setting preflight and approval; do not change it now. The current-password requirement stays on. [Leaked-password protection](https://supabase.com/docs/guides/auth/password-security) is documented for Pro and above. Check actual plan/availability read-only under an approved scope before proposing its enablement; a paid upgrade requires its own cost approval. A client-only strength meter cannot establish direct Auth parity. These concerns remain on the activation checklist until resolved or explicitly decided for the applicable environment.

## Recommended action

Complete inactive capture/transport preparation independently. Execute A/B only with their exact approvals. Account-admitting C–F protocols require G1 proven or a separately approved/enforced G3 exception. Do not set security readiness true just to test signup. Public/ordinary-business activation always requires the final approved applicable security policy, legal basis and operational acceptance; development-only evidence is never labelled general registration released.
