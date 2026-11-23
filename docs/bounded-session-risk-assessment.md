> **16 October 2026 decision: not selected or authorized.** The user chose strict Option A and prohibited the one-hour exception. This document is retained as historical assessment; see `strict-refresh-provider-resolution.md` for the active path.

# Mitsa — bounded-session risk assessment

**16 October update:** this document assessed the earlier bounded synthetic exercise. The [continuous-development investigation](general-registration-readiness-investigation.md) now also evaluates a prospective application API access-age cap, without claiming that it revokes provider credentials or supplies immediate reuse detection. Provider clarification is needed for the original provider-wide guarantee, not to prove that basic signup is technically possible. No risk criterion has changed.

Prepared 15 October 2026 (Asia/Manila). **Assessment only: not implemented, not approved risk acceptance, and not authentication security sign-off.** No registration activation, provider setting, migration, role, MFA factor or existing session is changed.

## Decision under consideration

Whether a time-limited isolated development exercise could accept delayed denial after detected refresh-family reuse, while preserving the existing stronger behavior for explicit local logout. This is a different security requirement from immediate terminal-session denial; accepting it would need an explicit decision and a separately reviewed configuration/test scope. It is not a way to mark the failing immediate-revocation regression passed.

## Known evidence and unresolved bound

Current evidence establishes successful local logout, verified MFA and tenant isolation. It also establishes that a rejected old ancestor can leave its legacy session row active; a previously current refresh can obtain a replacement immediately after family revocation. `getUser()` did not identify that terminal family state. The observed immediate replacement is enough to prevent assuming a fixed, whole-session compromise bound from one access token's expiry.

Let **T** be the verified lifetime of an individual access JWT, and **t_last** its last successful issuance. That bearer expires around **t_last + T**, subject to the actual validator's clock tolerance. If replacement issuance remains possible, **t_last can move**. Therefore T alone does not prove that access stops T after the original reuse detection. The finite overall bound is **not established** by the current tests. Repeated renewability has not been proved either; provider clarification is required rather than guessing in either direction.

The project's current access-JWT lifetime and any validator tolerance have not been reverified for this assessment. The 3,600-second email OTP lifetime is unrelated. No numerical bound is being represented as configured.

## Threat and impact

An adversary holding usable bearer/refresh credentials for an already authenticated session may retain that session's permitted access after reuse detection. A previously satisfied MFA claim does not force a new authenticator challenge on every API call. MFA remains necessary, but it does not make a stolen authenticated session harmless.

Tenant RLS and current role/location restrictions limit the affected authority to what that identity may access; they do not protect that identity's own workspace from misuse of its session. Potential effects include reading permitted personal/business data and invoking currently implemented commands. No inventory/POS capability is assumed to exist. The analysis must not treat retained real workspaces as disposable or imply that a loopback frontend makes the hosted Auth/Data APIs unreachable.

No evidence here demonstrates cross-tenant access, privilege escalation or a confirmed provider vulnerability. Confidentiality and integrity exposure within the compromised authority remain material even when tenant isolation works.

## Options and limitations

| Option | Benefit | Residual limitation / approval |
|---|---|---|
| Keep current controls and wait for provider clarification | Avoids a new managed-Auth write dependency; preserves verified logout/MFA/RLS | General registration stays closed; immediate reuse denial remains unresolved |
| Reduce individual JWT lifetime through a supported setting | Reduces each issued bearer lifetime | Does not establish a total bound if renewal survives; increases refresh frequency and requires configuration approval plus clock/concurrency regression |
| Supported provider session-lifetime controls | May establish an additional provider-enforced lifetime | Availability, plan requirements, enforcement timing and coverage of legacy reuse need verification; no paid upgrade or setting change authorized |
| Application-owned absolute session deadline | Could enforce a finite application-access deadline independently of a reuse event if implemented across every protected API/RLS path | Separate design/migration review; no implementation or coverage proof; cannot promise to revoke a provider refresh token or protect unrelated services |
| Supported local logout when Mitsa observes a terminal error | Exact-session removal is already proven for explicit logout | Direct Auth attempts bypass Mitsa's error handler; not complete automatic detection |
| Reviewed Auth refresh-table trigger | Would attempt synchronous terminal-family detection | Current draft has reproduced timing/preflight defects and incomplete rollback; do not install |

Supabase documents JWT expiry, legitimate reuse exceptions, refresh-enforced session controls and checking session existence after logout in its [sessions guidance](https://supabase.com/docs/guides/auth/sessions). It discourages very short JWT lifetimes because of refresh load and clock/reliability concerns. Some session controls require Pro or above. Its [sign-out guidance](https://supabase.com/docs/guides/auth/signout) distinguishes local/global scope and retained JWT cryptographic validity. These documented semantics do not prove a finite bound for the observed replacement-after-revocation outcome.

## Conditions before any proposed isolated exception

1. Obtain provider clarification or independently verified supported behavior that explains whether renewal can continue and how it terminates. Until then, no meaningful total compromise bound is claimed.
2. Read the actual JWT lifetime, session policies and relevant clock tolerance without changing them. Document the proposed bound, its start event and which APIs enforce it. Distinguish a bearer bound from an absolute session bound.
3. Review all protected application and direct Data API/RLS paths for the chosen guarantee, including trusted AAL2, role/location restrictions and session deletion/expiry. Keep the existing session-row checks.
4. Define an explicit isolated-only duration, eligible testing scope, conservative email budget, incident/closure criteria and a sunset. Do not infer a broader launch or permission to modify real account/session data.
5. Obtain approval for the changed security requirement and any exact configuration/migration. Keep the immediate-revocation failure recorded; use separately labeled evidence for a different accepted criterion.
6. Run separate synthetic tests for the actual bound, direct Auth/API requests, concurrent refresh, independent sessions, MFA, recovery, logout and tenant denial. Preserve original accounts/factors/workspaces and require regression success before considering activation.

Monitoring and an operator response can reduce exposure but are not a substitute for a proven time bound. Closing new registration or the email lease does not revoke existing bearer/refresh credentials. Global sign-out is not a silent fallback: it affects legitimate independent sessions and needs appropriate authorization.

## Recommendation

Seek the supported provider correction or authoritative behavior explanation first. Do not accept a hypothetical finite bound while refresh renewal remains uncertain. This assessment is available for a later explicit risk decision; it grants no approval and changes no activation gate. Leaked-password protection remains a separate documented launch concern. Completed onboarding, Gmail verification, MFA and exact-browser logout remain valid evidence within their original scope.
