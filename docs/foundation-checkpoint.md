# Tasks 1–3 evidence: incomplete checkpoint

2026-10-12. Progress record only; Task 4 remains gated. Product management, inventory, checkout and staff invitation features are not implemented. No live deployment.

## Files and work

- Architecture, all three stages and decisions: `superpowers/specs/2026-10-12-foundation-design.md`, `requirements-traceability.md`, `diagrams.md`; six Archify artifacts under `.archify/`.
- Next.js/TypeScript foundation, pinned npm dependencies, Vitest/Playwright; minimal foundation/login/proof pages and server-only Auth compatibility routes under `src/`.
- Isolated target guard and synthetic reconciliation under `scripts/`; setup in `local-setup.md`.
- Versioned migrations/catalog assertions under `supabase/`; unit, hosted integration and desktop/mobile tests under `tests/`.

## Hosted configuration

Only user-approved Fire_Inv (`mjtejwafxriwntweussc`, Sydney) was changed. The user supplied this project rather than the agent creating one. Public signup and anonymous sign-in are disabled. Site origin is `http://127.0.0.1:3000`; its exact `/auth/confirm` callback is allowlisted. The versioned authenticator setting exposes only `api`.

Next.js receives the publishable API key only. Test/operator credentials belong in gitignored `.secrets/operator.env`, parsed separately without modifying process.env. Credentials were supplied and examined without displaying them. The secret API key format is compatible, and a read-only Auth admin request to Fire_Inv succeeded. The database URL matches the approved host/project guard, but PostgreSQL rejects its password (`28P01`); database marker verification cannot complete. There is no service-role runtime fallback.

## Actual verification

- `npm run test`: 15 unit tests passed, then integration passed the real public Auth settings test; two database suite setup hooks failed (`28P01`), preventing 16 cases from running. Aggregate did not reach browser tests.
- `npm run test:unit`: passed 15/15, including actual pg configuration/CA assertions and target override rejection.
- `npm run test:integration`: one passed, two suite setup failures, 16 cases skipped because the database password is rejected.
- `npm run test:e2e`: six unsigned tests passed, two hosted setup hooks failed (`28P01`) and six subsequent cases did not run. No signed-in case passed.
- `npm run test:e2e -- tests/e2e/authentication.spec.ts tests/e2e/foundation.spec.ts`: passed 6/6 on desktop/mobile, including invalid callback cache behavior.
- `npm run build` and `npm run typecheck`: passed. `npm audit`: zero reported vulnerabilities.
- `npm run db:reconcile`: failed database authentication (`28P01`). Successful hosted reconciliation is not claimed.
- Hosted SQL catalog assertions passed through the connector. Temporary PostgreSQL reproduction showed zero lock-visible rows before the membership fix, then one visible row and UPDATE denied after it; both transactions rolled back.
- Six Archify artifacts passed automated validation/delivery/browser gates. All six light-theme 1440×900 captures were visually inspected; additional automated theme/viewport captures were not separately inspected.

## Security review and repairs

Independent Superpowers review found: pg URL query options could override target/TLS; membership FOR SHARE lacked UPDATE visibility; auth.sessions RLS hid rows from the non-bypass helper; SET ROLE on an operator connection was an invalid negative authorization test. Target guard regressions were observed fail then pass. Additive migrations permit scoped membership locks with WITH CHECK(false) and add current-actor/current-session SELECT for app_authz. The role test now checks authenticated's actual SET permissions and records session_user separately. No ownership, BYPASSRLS or runtime admin credential was added.

Credential preflight initially failed TLS with SELF_SIGNED_CERT_IN_CHAIN. The tools now use Supabase's published public CA and explicit pg fields rather than a connection-string parser; hostname and certificate verification remain enabled. TLS succeeds and PostgreSQL then reports the password rejection. Tests for this repair were observed fail then pass. A test type assertion initially failed the build and was corrected; the subsequent build and typecheck both passed.

Supabase security advisors now report only INFO for `private.businesses` having no RLS policy. This is intentional default-deny: the operator manages it, with no application grant/policy. Anonymous/authenticated EXECUTE on the platform's `public.rls_auto_enable()` helper was revoked by migration; its automatic RLS event trigger remains installed. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Open acceptance gates

Real signed-JWT commands, concurrent connections, membership revocation race, assignment revocation, distinct signed-in SSR contexts, refresh/logout/recovery and reconciliation remain unproven pending credentials. New tests are authored, not passed. Time-expired recovery behavior still needs explicit evidence; invalid/replay cases do not prove expiry. Backup restoration remains a pre-live gate.

Next: correct Fire_Inv's database password in the isolated credential file, reverify the database marker, execute all remaining gates, fix failures and issue the completed Tasks 1–3 checkpoint. Task 4 requires the user's next approval.
