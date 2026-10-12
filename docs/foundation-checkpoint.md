# Stage 1 Tasks 1–3 checkpoint

2026-10-12, Asia/Manila. Tasks 1–3 are complete: the reviewed repair committed atomically, final independent review findings were addressed, and all three final aggregate runs passed. Task 4, product management, inventory operations, checkout, staff invitations and live deployment remain gated. All three original release stages remain in scope.

## Work and files

- Task 1: approved architecture, schema/migration roadmap, trust boundaries, state machines, permission matrix and decisions in `superpowers/specs/2026-10-12-foundation-design.md`, `requirements-traceability.md`, `diagrams.md` and the implementation plan. Six original Archify architecture/sequence/lifecycle artifacts plus the reviewed Auth-adapter design artifact are retained under `.archify/`.
- Task 2: pinned Next.js App Router/TypeScript, Supabase SSR, Vitest and Playwright; minimal foundation/login/proof routes under `src/`; guarded isolated target configuration and public CA under `config/`; setup/environment instructions. No business workflow was added.
- Task 3: six versioned migrations, SQL catalog assertions, unit/integration/browser tests, non-empty read-only reconciliation, and a one-time atomic operator runner.
- This repair adds `tests/integration/auth-adapter.test.ts`, `tests/unit/auth-adapter-sql.test.ts`, `docs/auth-adapter-repair.md`, the reviewed migration and `scripts/apply-reviewed-adapter.mjs`. Existing security/command/browser tests now exercise the supported adapter with real JWTs. `npm run db` aliases reconciliation. The pinned PostgreSQL/WASM dependency is development-only, executes in memory in unit tests, and is absent from application runtime.

## Database and authentication configuration

Only user-approved Fire_Inv (`mjtejwafxriwntweussc`, Sydney) was accessed. Marker: `fireworks-foundation-proof-01a12e38`. Target checks pin approved purpose/ref, API origin, database host/pool username, port and database. Query-option overrides are prohibited; marker verification precedes fixture writes. There is no reset or truncate command.

Public signup and anonymous sign-in are disabled. Site origin is `http://127.0.0.1:3000`; its exact `/auth/confirm` callback is allowlisted. Only `api` is exposed. Synthetic users are created by the operator-only Auth admin API. Owner provisioning and staff invitation product workflows remain gated.

Next.js receives only URL, publishable key and application origin. The supported modern secret key and database URI stay in ignored `.secrets/operator.env`; tools parse them into a separate object, never process.env. No service-role runtime fallback. TLS certificate/hostname verification remains enabled using the public Supabase CA; no machine-wide trust changes.

## Migrations and atomic application

Hosted history contains these six versioned migrations:

| Version | Name |
| --- | --- |
| 20261012053948 | foundation_security_proof |
| 20261012054416 | foundation_identity |
| 20261012060403 | foundation_membership_lock_policy |
| 20261012060628 | foundation_current_session_policy |
| 20261012060908 | foundation_platform_function_grants |
| 20261012070606 | foundation_verified_actor_adapter |

The user separately reviewed and explicitly approved the last migration, rollback proof and atomic application. SHA-256: `E4408BCED96D469EDD7012188650C14C60F383294FA6CE9BFC198041A870CDC3`.

The file has no transaction wrapper. The narrow runner supplies explicit BEGIN/COMMIT on one pg.Client, pins hash/project/marker, executes the unchanged SQL and its history insertion in that transaction, verifies the same transaction ID and security catalog assertions, and never automatically retries an uncertain commit.

| Command | Observed result |
| --- | --- |
| `node scripts/apply-reviewed-adapter.mjs --rollback-proof` | exit 0; complete SQL/history shared one transaction; rollback removed adapter/history and restored old policy/grant |
| `node scripts/apply-reviewed-adapter.mjs --apply` | exit 0; COMMIT acknowledged; stored history name and complete SQL matched the reviewed file |

Both operations verified unchanged business/probe row counts/content digests, Auth user/session identity counts/digests, table owners/RLS flags, custom-role restrictions and role-assumption boundaries. No DELETE/TRUNCATE or executed business UPDATE occurs. Migration preservation checks are distinct from later tests that deliberately sign out or temporarily alter only their own synthetic Auth records.

## Security and RLS evidence

The original missing Auth schema USAGE blocked real requests despite GRANT text in history. The separately reviewed solution is one fixed, postgres-owned read-only authentication adapter returning UUID/null. It accepts no identity arguments, requires PostgREST authenticator/authenticated request provenance, validates claims/expiry and joins the same live Auth user/session. No business reads or mutations occur inside it. Business authorization and commands retain their original non-bypass owners; no new managed-schema grant or role inheritance is introduced. See `auth-adapter-repair.md`.

Fresh read-only inspection confirmed the pinned marker, eight FORCE RLS tables, both restricted custom roles, no obsolete Auth policy, no remaining injected test-fault function/trigger, and unchanged Supabase-managed Auth session ownership.

Catalog assertions and hosted integration tests passed:

- Both custom roles remain NOLOGIN/NOBYPASSRLS/NOSUPERUSER/NOINHERIT, own no business table and have no managed Auth schema USAGE.
- All eight foundation tables retain ENABLE/FORCE RLS and separate ownership. Auth sessions retain their managed owner and enabled RLS.
- Authenticated cannot assume custom roles or directly update balances. API wrappers/view remain invokers; the private command keeps app_command ownership, empty search path and row security enabled.
- Adapter ACL is owner plus authenticated/app_authz/app_command; no anonymous/PUBLIC execution. Private/Auth schemas and arbitrary context-setting RPCs are not exposed. Operator-copied claims are rejected.
- Real signed requests prove shop/business isolation, active membership/assignment checks, owner-only ordinary-price authority, owner/manager discount authority, metadata spoof rejection and rejection of caller-supplied identity headers/arguments.
- Concurrent HTTP commands reach independently observed real PostgreSQL row/advisory locks. Duplicate requests produce one event; last-unit contention produces one success/one constraint rejection and zero balance. Membership revocation waits for an in-flight locked command, then denies subsequent commands.
- Injected audit failure rolls back balance/result/event. Replay returns the original result, changed payload conflicts, and finalized events reject UPDATE.
- Still-signed JWTs lose access after real sign-out, session expiry, membership/assignment revocation and synthetic banned/deleted/anonymous status changes. Temporary synthetic changes are restored in finally blocks.

Twenty-six local in-memory SQL cases execute the exact adapter definition: malformed/missing claims, audience/role/types, expiry/not-before, UUID parsing, mismatched/missing sessions, user status and operator injection. Removing audience validation made its regression fail; validation was restored before application. These local cases do not substitute for hosted JWT signature or concurrency tests. Historical red failures are retained in `progress.md`.

## Exact automated results

| Command | Result |
| --- | --- |
| `npm run test:unit` | exit 0; 41/41 across four files |
| `npm run test:integration` | exit 0; 26/26 across four files, 153.26s |
| `npm run test` — final run 1 | exit 0; 41 unit + 26 hosted integration + 18 desktop/mobile E2E passed (85 total) |
| `npm run test` — final run 2 | exit 0; 41 unit + 26 hosted integration + 18 desktop/mobile E2E passed (85 total) |
| `npm run test` — final run 3 | exit 0; 41 unit + 26 hosted integration + 18 desktop/mobile E2E passed (85 total) |
| `npm run test:security` | exit 0; 7/7 passed, 10.12s |
| `npm run test:integration -- -t "ignores user-editable role metadata"` | RED: old token lacks forged metadata; GREEN: 1 passed, 25 explicitly filtered, 20.96s |
| `npm run test:e2e -- --grep "rejected refresh"` | RED: valid refresh returned 200 against rejection expectation; GREEN after actual synthetic-session revocation: desktop/mobile 2/2 passed, 38.1s |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0; production compilation, TypeScript and route generation succeeded |
| `npm run db` | final exit 0; 70 committed events/70 command results; zero projection mismatches, commands without events or event/result mismatches |
| `npm audit` | exit 0; zero vulnerabilities |
| `node --check scripts/apply-reviewed-adapter.mjs` | exit 0 |
| `git diff --check` | exit 0 |

Final integration durations were 157.00s, 155.38s and 153.26s. Each final E2E phase passed 18/18 in approximately 1.2 minutes. No hosted tests were skipped in the full final runs. Pre-commit credential scans found zero matches across current tracked/built-browser files and 154 historical Git blobs; `.secrets/operator.env` and `.env.local` remain ignored. Final catalog inspection again found eight FORCE RLS tables and zero residual injected fault functions/triggers.

Three pre-review aggregates each exited 0 (41 unit + 26 hosted integration + 16 E2E). They exposed no failures, but did not cover the two review gaps; they do not replace the final acceptance runs above.

Each final aggregate runs `npm run test:e2e`: six unsigned/layout/origin cases and twelve real hosted cases on desktop and Pixel 7. Evidence covers parallel identity isolation, password login, HttpOnly/Secure/SameSite cookies, absent browser storage, reload, successful refresh/Set-Cookie/no-store, logout, forged-cookie rejection, rejected refresh with expired-cookie cleanup and generic denial, fixed recovery destination/replay/time expiry, membership and actual Auth-session revocation. Credential-bearing traces/screenshots are disabled; tokens/passwords are not printed.

Expected SDK warnings from deliberately malformed forged cookies, revoked refresh-token errors, and NO_COLOR/FORCE_COLOR toolchain warnings appeared. Passing results are not described as warning-free. Earlier credential/schema failures are superseded only by the specific fresh passes above.

Reconciliation rejects an empty ledger and checks initial values plus immutable deltas against balances, event/command pairing and matching scope/results in one consistent read-only snapshot. It is synthetic foundation reconciliation, not future sales/inventory/financial reconciliation.

## Review, diagrams and remaining risks

The focused adapter review found no concrete bypass/Auth data leak; its parser-coverage finding led to exact-SQL cases. Final fresh-context whole-branch review found no critical or minor findings and two important test gaps: stale JWT metadata and untested rejected refresh. Both were reproduced and corrected in one test fix pass. Fresh tokens demonstrably carry forged metadata while still losing owner/discount and unassigned-shop access; actual revoked refresh with expired cookies returns generic 401, no protected body/redirect, no-store and cookie cleanup. No application or migration changes were required for those two findings. All three final aggregates passed after the fix pass. No unresolved foundation blockers or deferred minors remain. Exhaustive decisions and reviewer scope rulings are retained in `progress.md`.

The six original Archify artifacts passed automated checks and their light-theme 1440×900 captures were inspected. The new Auth-boundary design passed showcase validation, delivery/provenance, strict and real-browser checks with zero diagnostics; no separate capture/perceptual review was claimed. No update notice was required.

Fresh Supabase security advisors reported intentional default-deny `private.businesses` INFO and leaked-password protection disabled WARN. The latter requires Pro-plan-or-above; no billing upgrade is authorized. Decide and verify production password protection before live use. [RLS advisor](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

PostgREST, JWT signing authority and the operator remain trusted. Revocation denies subsequent statements/requests rather than cancelling already in-flight transactions. Revalidate compatibility after provider upgrades. Historical synthetic fixtures remain in the isolated project; no project reset is performed.

Before live use: complete the remaining approved release scope, finalize/test foreign-currency rounding, configure production invitations/operational controls, and verify backup restoration in another isolated environment. Backup restoration and live readiness are not claimed here. Stop before Task 4 pending the user's next approval.
