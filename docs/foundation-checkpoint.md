# Tasks 1–3 evidence: blocked checkpoint

2026-10-12, Asia/Manila. Tasks 1–2 are recorded and bootstrapped; Task 3 acceptance is incomplete. Task 4, product management, inventory operations, checkout and staff invitation features remain gated. No live deployment or unrelated project access.

## Work and files

- Approved design and all three first-release stages: `superpowers/specs/2026-10-12-foundation-design.md`, `requirements-traceability.md`, `diagrams.md`; six Archify artifacts under `.archify/`.
- Next.js/TypeScript, pinned dependencies, Vitest/Playwright; minimal foundation/login/proof pages and server-only Auth compatibility routes under `src/`.
- Guarded test/operator configuration with verified TLS: `scripts/test-target.mjs`, `scripts/postgres-config.mjs`, public CA `config/supabase-ca.crt`; instructions in `local-setup.md`.
- Five versioned, hosted migrations under `supabase/migrations/`; hosted SQL assertions under `supabase/tests/`; unit, integration and desktop/mobile browser suites under `tests/`.
- This continuation corrected PostgreSQL `name[]` result handling in two catalog tests using `roles::text[]`, added an intentionally failing custom-role Auth schema access regression and corresponding SQL assertion, and updated the design, plan, setup, checkpoint and progress record. No new migration was applied. An empty, unapplied migration draft was removed.

## Credentials and hosted configuration

Only user-approved Fire_Inv (`mjtejwafxriwntweussc`, Sydney) was accessed. Public signup and anonymous sign-in are disabled. The site origin is `http://127.0.0.1:3000`; its exact `/auth/confirm` callback is allowlisted. The versioned authenticator setting exposes only `api`.

The supplied admin key uses the supported modern secret-key format and was verified against Fire_Inv's Auth admin API. Real synthetic user creation and password sign-in succeeded during fixture setup. The database URI passed the approved target guard. Removing template square brackets around its password in memory allowed verified TLS and the pinned marker check to succeed; only that URI correction was then saved in gitignored `.secrets/operator.env`. No credential values were printed or committed.

Next.js receives only the URL, publishable key and application origin. Operator credentials are parsed into a separate object, never process.env or browser configuration. Certificate and hostname verification stay enabled with Supabase's published public CA. There is no service-role runtime fallback.

## Confirmed hosted privilege blocker

Real signed-JWT requests fail with PostgreSQL `42501`, `permission denied for schema auth`. Read-only catalog evidence:

| Check | Actual result |
| --- | --- |
| `app_authz` / `app_command` USAGE on `auth` | false / false |
| Both roles EXECUTE on `auth.uid()` and `auth.jwt()` | true |
| `app_authz` SELECT on `auth.sessions.id,user_id` | true |
| Operator `current_user` / `session_user` | postgres / postgres |
| Operator USAGE on `auth` WITH GRANT OPTION | false |
| Operator may SET ROLE to `supabase_admin` / `supabase_auth_admin` | false / false |

The first migration history contains `grant usage on schema auth to app_authz, app_command`, but the actual ACL grants neither role access. Recording a GRANT in migration history did not prove it took effect. The ordinary hosted operator cannot issue that grant as designed. Function execution and column grants alone cannot overcome missing schema access.

The full updated `supabase/tests/security_catalog.sql` was executed through the connector and failed at the new assertion with `P0004: private roles cannot access managed Auth schema`. The earlier catalog-only pass is superseded. A scan of tracked files and built browser files found zero matches for the supplied administrative key, database URI or decoded database password. The operator file remains ignored by Git.

Per the user's explicit stop condition, no new schema repair, role inheritance, helper ownership change, bypass privilege, or service-role runtime was introduced. A supported managed-schema access arrangement or revised authorization-helper design needs separate review and proof before proceeding. No alternative has been declared secure.

## Exact automated results

Latest runs on this continuation:

| Command | Result |
| --- | --- |
| `npm run test` | exit 1: unit 15/15 passed; integration 7 passed, 11 failed (18 total); aggregate browser phase not reached |
| `npm run test:e2e` | exit 1: 8 passed, 6 failed (14 total), desktop and Pixel 7 mobile layouts |
| `npm run test:security` | exit 1: 4 passed, 1 failed; new Auth schema access regression detects both missing grants |
| `npm run build` | exit 0; production compilation, TypeScript and route generation succeeded |
| `npm run typecheck` | exit 0 |
| `npm run db:reconcile` | exit 0: zero synthetic projection mismatches and zero commands without events |
| `npm audit` | exit 0: zero reported vulnerabilities |

The earlier standalone `npm run test:integration` run in this continuation passed 5 and failed 12 of 17. Two failures were `name[]` decoding mismatches, corrected by the explicit cast; the four existing security tests subsequently passed. The latest aggregate includes the added schema privilege regression and is the authoritative 18-case integration result above. No failures were skipped or converted to passes.

Integration failures cover scoped signed-JWT reads/commands, owner/manager capability distinction, metadata spoof resistance, idempotency, injected audit rollback, duplicate and last-unit concurrency, membership/assignment revocation and its concurrency race, plus missing Auth schema access. Real connections were used, but failed commands never reached the expected row/advisory locks. These behaviors remain unverified.

Passing integration evidence: four catalog/security cases, direct authenticated DML/custom-role assumption denial, public Auth settings, and synthetic projection reconciliation. Catalog evidence confirms non-login/non-bypass/non-superuser roles, eight private/probe tables with FORCE RLS and separate ownership, scoped lock/session policies, and restricted anonymous command execution. This does not establish usable authorized commands.

Browser passes cover six unsigned/cache/origin/layout checks and two real recovery callback checks (fixed destination, server-issued HttpOnly cookie and single-use replay rejection). Six signed-in cases fail because the database identity check returns 403 or the proof page cannot render. Cookie refresh/logout/isolation/revocation assertions after those failures were not reached; they are not claimed passed. Time-expired recovery behavior remains unproven.

Reconciliation is limited: read-only counts after the suites show 22 synthetic resources, **zero command results and zero events**. Commands failed before posting. Therefore the zero-mismatch result proves consistency of initial synthetic state only, not successful business or command reconciliation. The injected fault trigger was removed (remaining count zero).

## Earlier evidence and remaining gates

Independent Superpowers review found and led to fixes for target/TLS query overrides, membership lock visibility, missing auth.sessions RLS visibility and an invalid operator SET ROLE negative test. TLS configuration and target regressions were observed fail then pass. The new schema usage regression remains red. Existing migrations were not rewritten.

Six Archify artifacts passed automated validation/delivery/browser checks; all six light-theme 1440×900 captures were visually inspected. Additional automated theme/viewport captures were not separately inspected. Earlier Supabase security advisors reported only intentional default-deny `private.businesses` INFO; no fresh advisor success is inferred from that earlier result.

Tasks 1–3 cannot be declared complete. Resolve the managed-schema design blocker first, then rerun all real authorization, concurrency and SSR acceptance tests, add explicit recovery-expiry evidence, and verify successful event reconciliation. Backup restoration remains mandatory before live-shop use. All original release stages remain in scope. Task 4 requires the user's next approval and has not started.
