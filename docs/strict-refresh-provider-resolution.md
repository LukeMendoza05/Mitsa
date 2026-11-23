# Mitsa — strict refresh-family resolution

**22 October status:** the user submitted the private ticket and left support access OFF. Awaiting technical guidance; no correction has been verified. Strict Option A remains required. The 16 October investigation and unsent-status references below are historical; [the current support record](supabase-support-status.md) supersedes their submission status only.

16 October 2026. **Option A approved: retain strict terminal revocation.** No one-hour exception is accepted or installed. Current-password enforcement remains on; existing MFA, accounts and business records are preserved. Signup, delivery and Stage C remain inactive. This investigation authorizes no provider change or external submission.

## Root cause and evidence strength

The hosted health endpoint still reports **v2.197.0**. A fresh read-only marker-checked audit found legacy refresh metadata on all current sessions and no newer-format session metadata. It found zero custom refresh-table triggers and closed release/pilot gates. It did not read or replay any bearer/refresh credential. Evidence: `artifacts/supabase-strict-readonly-target-1792150870010.json`.

The pinned matching release source has two distinct paths:

1. Legacy: `internal/tokens/service.go:375–409` checks a revoked token against `UpdatedAt + reuse interval`. Terminal ancestor reuse invokes `models.RevokeTokenFamily`. `internal/models/refresh_token.go:87–110` marks live family rows revoked **and updates their timestamps**, retaining the session. A previously current token can therefore fall inside a newly started grace interval, reach `GrantRefreshTokenSwap` and produce another pair. The existing session-row check cannot detect a terminal event that did not remove or expire that row.
2. Newer format: `internal/tokens/service.go:562–578` uses `models.LogoutSession` after disallowed reuse. That provider helper deletes the exact session. If this path is supported and enabled for the project, Mitsa's existing active-session actor should deny covered database access without a custom Auth trigger. This is a candidate, not a hosted verification result.

The recorded hosted reproductions match the legacy source: R0 is a non-parent ancestor outside grace, so this is distinct from the documented immediate-parent or concurrent-refresh exceptions. Current R3 refreshed immediately after terminal reuse, but failed after another twelve seconds. Former bearer access and `getUser()` still passed. Explicit local logout removed the exact session and denied bearer/refresh, preserving an independent session. The JWT remains cryptographically valid until expiry; the failed Mitsa requirement concerns immediate resource denial and terminal refresh renewal. Do not label ordinary unexpired JWT validity a vendor vulnerability.

This is a strong source-level explanation consistent with hosted evidence, not proof of the hosted binary's provenance or a confirmed vendor CVE.

## Supported-correction assessment

| Candidate | Finding | Decision |
|---|---|---|
| Provider-managed newer-format issuance/rollout | Upstream implementation deletes the session on terminal reuse. Maintainer PR #2356 explains algorithm version two and gradual legacy-session upgrade; it warns upgrade can terminate concurrent sessions early. | Ask Supabase whether this is supported for this hosted project and how to preserve existing sessions/accounts/MFA. Do not set internal environment flags or change stored token data. |
| Provider-supported legacy correction | A provider fix could make terminal detection and session termination atomic, eliminating post-revocation renewal. | Request an exact supported release/rollout and its compatibility guidance; do not patch hosted Auth or install triggers. |
| Newer release alone | Public release metadata still lists v2.197.0 as the latest stable entry inspected; newer v2.198.0 entries are prereleases. Commit `ce9a8eee0cc042be8c7a42981a7ddae631e41d91` still contains the same legacy timestamp/grace path. | No verified upgrade fix identified. A version bump or prerelease must not be represented as remediation. |
| Public project configuration | Official Management API `UpdateAuthConfigBody` and response schemas expose rotation/reuse/session/JWT controls, but neither refresh algorithm version nor upgrade percentage. | No documented self-service hosted switch established. Field absence is not proof Supabase cannot perform a supported managed rollout. |
| Explicit local logout and session-row validation | Historical hosted controls pass. | Preserve them. They do not detect a terminal event submitted directly to Auth. |
| `getUser()`, shorter JWT, time-box, zero reuse interval, polling/audit worker, Next-only logout wrapper | None supplies the required immediate terminal event plus direct API enforcement. Shorter/grace settings can also harm normal refresh; polling is delayed and races replacement issuance. | Do not substitute them for Option A or change settings. |

PR #2624's “ensure legacy refresh token revoked” fix concerns legacy lookup during MFA upgrade, already present in the matching release. It is not the observed family timestamp/session-retention correction. JWT signing-key rotation and upgrading the JavaScript SDK do not select the refresh-token algorithm.

Public metadata/source evidence: `artifacts/supabase-strict-supported-surface-1792150763637.json` and `artifacts/supabase-strict-upstream-review-1792150802264.json`. Exact public sources are SHA-256 pinned. No fetched source was executed. The platform changelog was inspected; no matching terminal-reuse correction was identified. Upcoming TLS cipher retirement is unrelated to this failure.

## Verification results and remaining tests

Existing hosted strict evidence was inspected, not rerun or relabeled:

- `artifacts/refresh-reuse-inside-post-revocation-interval.json`: ancestor denial passes; newest refresh denial and immediate Mitsa bearer denial **fail**.
- `artifacts/refresh-reuse-after-post-revocation-interval.json`: ancestor and newest refresh denial pass after the wait; immediate bearer denial **fails**.
- `artifacts/refresh-revocation-alternatives.json`: exact supported logout, subsequent bearer/refresh denial and independent-session preservation pass; `getUser()` still accepts after family-only revocation.
- Approved hardening: all ten password checks pass, including private recovery replay rejection, retained MFA and returning sign-in. This is password compatibility evidence, not a refresh fix.

No fresh live sign-in, refresh replay, new account, factor or recovery request was performed by this investigation. The previous hardening grant was purpose-limited and must not be reused for different refresh experiments. Go and Docker are not available locally; upstream Go/database tests were inspected but not run. No proposed provider correction is yet verified on this project.

After Supabase identifies a supported correction, prepare a separately approved synthetic test protocol. It must prove:

1. Serial rotation to a non-parent ancestor; terminal detection outside grace; immediate and delayed denial of every retained refresh token, even on direct Auth requests; matching session terminal state.
2. Former signed JWT denial at Mitsa's direct RPC/RLS boundaries while that JWT is otherwise unexpired; app-route denial; no cross-tenant access. Do not claim every Supabase service revokes JWTs immediately.
3. Valid parent-response retry and concurrent refresh inside normal grace remain usable; independent sessions and tenants survive. No provider-wide logout or existing-user backfill is permitted.
4. Password-plus-TOTP returning access, recovery requiring retained MFA, consent/binding invariants and existing-account preservation pass. If a legacy-to-newer rollout is proposed, test its concurrency and MFA transitions explicitly before broadening it.
5. Source/version/configuration provenance, sanitized bounded outcomes and approval budgets are recorded. Any unexpected result stops activation; rollback follows provider-supported guidance and never edits managed Auth rows.

Historical source/evidence verification (before the later support-draft refinement): **19 assertions passed** for snapshot integrity, source-path classification, documented API capabilities, preservation of the failed/pass historical outcomes and outgoing-text privacy. Artifact: `artifacts/supabase-strict-evidence-verification-1792151115714.json`. These are source/evidence assertions, not executed upstream Go tests or a passing hosted correction. Recheck the current outgoing text with `node scripts/verify-supabase-support-request.mjs`; the earlier artifact hashes do not certify later edits. No application code changed, so the completed unit/build suites were not repeated.

## Next action and boundary

Submit the reviewed text in `docs/support/supabase-refresh-reuse-request.txt` through the official private [Supabase support form](https://supabase.com/dashboard/support/new), following `docs/supabase-support-submission.md`. Nothing has been submitted by Codex. The request asks for guidance only and forbids automatic resets, factor changes, paid upgrades or configuration changes.

A provider response confirming an exact supported correction is the missing dependency. It is not another request to accept residual risk. After that response, review the exact change, rollback and synthetic protocol for approval. Stage C disabled installation can be reviewed separately but cannot satisfy this gate or authorize activation.

References: [documented session/reuse rules](https://supabase.com/docs/guides/auth/sessions), [newer-format rollout maintainer guidance](https://github.com/supabase/auth/pull/2356), [MFA lookup fix #2624](https://github.com/supabase/auth/pull/2624), [official public Management API schema](https://api.supabase.com/api/v1-json), [Auth releases](https://github.com/supabase/auth/releases). No third-party commentary is used as implementation authority.
