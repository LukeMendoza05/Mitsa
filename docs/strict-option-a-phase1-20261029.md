# Strict Option A — Phase 1 findings, 29 October 2026

**BLOCKED: no supported managed-project correction has been established or tested.** No new hosted Auth, database, Edge, SMTP or Management request occurred. No support message was sent. Managed Supabase remains selected; SU-519045 and disabled support access remain unchanged. This review does not reopen C-B, D/E, registration or delivery.

## Exact candidate mechanism and its limits

The supported application-side mechanism is the documented correlation between a verified JWT's `session_id` and the active session row. Mitsa already performs that check in `private.current_actor()` at its authenticated database boundary. It cannot detect the historical terminal-reuse event while the session row remains present. `getUser()` and client-side logout wrappers do not add an authoritative signal for a replay submitted directly to Auth.

Current official [session documentation](https://supabase.com/docs/guides/auth/sessions) still distinguishes the ten-second grace interval and immediate-parent retry from prohibited reuse. It describes the whole session as terminated outside the exceptions. [Signout guidance](https://supabase.com/docs/guides/auth/signout) separately explains that cryptographic JWT validity lasts until expiry. These are different guarantees; neither a shorter JWT lifetime nor a one-hour cutoff is substituted here.

The public latest stable Auth release remains **v2.197.0**, published 9 September 2026 according to GitHub release metadata. Public master at **fcc491d6d7665718b62f50598d723fde1e9b6c4a** still contains both paths:

| Boundary | Source finding | Evidence strength |
| --- | --- | --- |
| Legacy terminal reuse | `internal/tokens/service.go` calls `RevokeTokenFamily`; `internal/models/refresh_token.go` revokes live rows and updates their timestamps without deleting the session. | Consistent with the old hosted result; not deployed-binary proof. |
| Newer-format terminal reuse | The token service calls `LogoutSession` and returns a commit-with-error. `internal/models/sessions.go` deletes the exact session. | Credible native correction candidate; not a confirmed managed rollout. |
| Direct Auth and factors | `internal/api/api.go` routes `/user` and `/factors` through `requireAuthentication`; `internal/api/auth.go` loads the claimed session and returns `session_not_found` when absent. | Source-level coverage for user operations and factor management if that session deletion actually commits on the target. |
| Protected RPC/RLS | Existing `private.current_actor()` requires verified PostgREST context, eligible user, matching session and validity. | Existing application mechanism; needs actual affected-session denial after the supported provider correction. |
| Managed availability | Public `UpdateAuthConfigBody` exposes rotation/reuse/JWT/time-box controls, but no algorithm-version or upgrade-percentage field. | No documented self-service switch found; not proof Supabase cannot perform a supported rollout. |

The [maintainer's rollout PR](https://github.com/supabase/auth/pull/2356) describes newer issuance and legacy-session upgrades and warns about concurrent refresh interruption during upgrade. Those source configuration names are **not instructions to set internal flags on managed Supabase**. Version numbers, signing-key rotation and SDK upgrades do not prove that the target uses the session-terminating branch.

Official changelog, release, API schema and commit-pinned source captures are retained under `artifacts/strict-option-a-review-20261029/`. The platform index contained no matching managed correction announcement in the material inspected. Its upcoming TLS-cipher retirement is unrelated. No assumption is made about the project's current version or session format without a separately approved fresh check.

## Historical evidence retained

Both old runs showed zero unrevoked family records immediately after prohibited R0 rejection and a retained session row. The immediate-R3 run then issued a replacement and restored one live record; the delayed-R3 run did not. Otherwise-unexpired bearer access remained accepted in both. Explicit supported local logout removed the exact session and denied former access/refresh while preserving an independent session. These old results are not rerun, reclassified as passing or described as a confirmed vendor vulnerability.

## Local implementation completed

`scripts/lib/strict-revocation-regression.mjs` now executes the regression core through explicit reviewed ports: positive AAL2/RPC/RLS baseline, three distinct rotations, non-parent replay outside grace, initial state, immediate formerly-current renewal, subsequent state, every retained refresh credential, eleven bearer/resource surfaces, legitimate compatibility and mandatory cleanup. It requires exact-session witnesses, otherwise-unexpired access and exclusion of alternative cutoffs. A generic 400/404, invalid challenge, deleted test resource, wrong session or watchdog/cleanup failure cannot count as revocation. It emits no automatic Strict A approval.

Its raw HTTP adapter fixes the project/endpoint/method, rejects unknown bearer/refresh/factor/challenge/password targets, disallows admin/arbitrary destinations and redirects, and reserves requests before dispatch without retry. Responses remain private to the test process. Actual RLS evidence must use the authenticated Data API with a previously accessible fixture-owned record that still exists; an empty unrelated table or operator-injected JWT claims is not a witness.

The core is OFFLINE-verified, **not a complete authorized hosted fixture/bootstrap controller**. Final managed rollout details, fixture provisioning/preservation wiring, applicability of recovery-code features and exact hosted source binding remain necessary before sensitive execution. Existing onboarding adapters and guards are preserved; this does not route around their Strict A gate.

`scripts/strict-provider-readonly.mjs` and `scripts/lib/strict-provider-audit.mjs` provide a complete, separately approvable diagnostic. It has private one-shot authorization, exact source/target/actor binding, reservation-before-dispatch, finite deadlines, fixed read-only SQL, encrypted integrity-checked output, no retry and verified transaction/connection close. It neither accepts a baseline nor creates a security-pass artifact. `--check` is local-only; an actual `--run` without approval is tested to stop before private credential reads or attempt creation.

Current source-bound test results and hashes are in `artifacts/strict-phase1-package.json`. New tests use isolated fakes; passing them does not establish provider behavior. Existing A/B/C-A milestones and the 221-test onboarding checkpoint are not repeated.

## Scope required for the sensitive regression

Once Supabase identifies a supported correction and the source-bound hosted controller is finalized, obtain a separate approval. The proposed ceiling is two new disposable `example.invalid` identities, four fixture TOTP factors, two fixture businesses/locations and two positive RLS witness records; 128 Auth requests including eight cleanup slots; 96 Data API/RPC requests including at most 16 write RPCs; two private Admin recovery links; at most four fixture password-update attempts; two database connections (second only conditional read-only reconciliation), 256 SELECTs and eight transaction controls; sixteen app HTTP requests; fifteen minutes; zero emails, SMTP/worker launches, deployments, provider configuration changes or direct managed-Auth writes. This is a **proposal, not an executable approval or an enlargement of any old allowance**. Provider-specific change installation, if needed, is a different approval.

Require ordinary and direct refresh, RPC/RLS and app denial, `/user` read/update, factor listing/enrollment/challenge/verification/removal, and stale recovery-session use. Fresh legitimate recovery creates a different session: it must still require MFA and must not revive the terminated family; it is not supposed to be forbidden forever merely because an older session was revoked. Test parent retry outside grace, concurrent refresh, independent sessions, returning password/TOTP and recovery replay. Native MFA recovery-code endpoints appear in current upstream source; their target availability/configuration must be established and included if applicable. A disabled/missing endpoint is not a successful revocation probe. No new recovery feature is enabled by this proposal.

Retain all old attempts and evidence. Encrypt fresh fixture credentials and observations; do not log raw IDs, JWTs, refresh values, OTPs, factors, codes or account rows. Stop admission/testing on a counterexample. Cleanup can sign out only the new fixture sessions through supported APIs. Do not fix provider behavior by calling logout before the negative assertions, changing tables or installing a trigger. Do not delete accounts, businesses or evidence as improvised rollback.

## Concrete decision

| Option | Guarantee and remaining limitation | Implementation, migration and cost |
| --- | --- | --- |
| **Recommended: supported managed correction** | Native terminal-session deletion could cover renewal, direct Auth/factors and Mitsa's session-aware boundaries. Supported target availability, atomicity and full hosted evidence are still missing. | Smallest application impact. Ask SU-519045 for exact supported rollout, legacy-session handling, compatibility and rollback. No new service cost incurred; any required paid change needs approval. |
| Separate clean self-hosted Supabase/Auth evaluation | Officially documented self-hosting provides deployment/configuration control; native newer-format behavior must still be proven across all boundaries. It is community-supported, not the managed support guarantee. | Pin/review images and native configuration, run the complete regression in a separate stack, harden HTTPS/network/secrets, operate backups/monitoring/upgrades. Preserve the current managed project. Identity UUIDs, signing trust, hooks, consent and MFA migration require an additional approved plan; no silent MFA reset/export. Infrastructure, mail and operations costs are unquoted and unapproved. |
| Development-only exception | Accepts precisely described residual renewal, Auth/factor and bearer risk. It **does not meet Strict A** and cannot authorize public registration. | No architecture migration, but separate informed risk approval and an explicitly scoped synthetic-only runner would be required. No such approval exists and the current strict gate remains closed. |

A gateway around Next.js alone is not the alternative: direct managed Auth remains reachable with stolen credentials. Third-party JWT integration alone also leaves stateless JWT acceptance and existing Auth/UUID/MFA integration unresolved; Supabase's [third-party guide](https://supabase.com/docs/guides/auth/third-party/overview) says built-in Auth cannot currently be disabled. A replacement with opaque, atomically revoked sessions and backend-only data access is a major separate architecture migration, not a local correction. No replacement is claimed proven.

Self-hosting responsibilities and support limitations are documented in the [official guide](https://supabase.com/docs/guides/self-hosting). No service has been provisioned or priced as an approved purchase.

## Next action

Approve only the source-bound `G-provider-readonly-v1` diagnostic in `docs/strict-option-a-readonly-approval.md` if a fresh target observation is desired. It can run independently of the unresolved policy and does not retest prohibited reuse. Supabase's substantive rollout/guarantee response remains necessary before a supported change or sensitive regression is finalized. No duplicate ticket or follow-up is sent.

GitHub sanitized export and protected Vercel preparation remain independent. No application/publication candidate changed during this phase; the clean export, private-repository recommendation, clean preview target and separate push/deployment approvals still apply. Security review does not block those tasks or authorize publishing existing private history/data.
