# Tasks 1–3 evidence: incomplete checkpoint

2026-10-12. Progress record only; Task 4 remains gated. Product management, inventory, checkout and staff invitation features are not implemented. No live deployment.

## Files and work

- Architecture, all three stages and decisions: `superpowers/specs/2026-10-12-foundation-design.md`, `requirements-traceability.md`, `diagrams.md`; six Archify artifacts under `.archify/`.
- Next.js/TypeScript foundation, pinned npm dependencies, Vitest/Playwright; minimal foundation/login/proof pages and server-only Auth compatibility routes under `src/`.
- Isolated target guard and synthetic reconciliation under `scripts/`; setup in `local-setup.md`.
- Versioned migrations/catalog assertions under `supabase/`; unit, hosted integration and desktop/mobile tests under `tests/`.

## Hosted configuration

Only user-approved Fire_Inv (`mjtejwafxriwntweussc`, Sydney) was changed. The user supplied this project rather than the agent creating one. Public signup and anonymous sign-in are disabled. Site origin is `http://127.0.0.1:3000`; its exact `/auth/confirm` callback is allowlisted. The versioned authenticator setting exposes only `api`.

Next.js receives the publishable API key only. Test/operator credentials belong in gitignored `.secrets/operator.env`, parsed separately without modifying process.env. Placeholders remain. There is no service-role runtime fallback.

## Actual verification

- `npm run test`: 13 unit tests passed; hosted integration setup failed for missing TEST_DATABASE_URL (one test failed, 16 skipped by failed setup). Aggregate did not reach browser tests.
- `npm run test:unit`: latest run passed 13/13 after guard regressions.
- `npm run test:e2e`: latest full run passed six unsigned tests, failed two hosted setup hooks and did not run six subsequent cases. No signed-in case passed.
- `npm run test:e2e -- tests/e2e/authentication.spec.ts tests/e2e/foundation.spec.ts`: passed 6/6 on desktop/mobile, including invalid callback cache behavior.
- `npm run build` and `npm run typecheck`: passed. `npm audit`: zero reported vulnerabilities.
- `npm run db:reconcile`: refused to connect because credentials remain placeholders. Successful hosted reconciliation is not claimed.
- Hosted SQL catalog assertions passed through the connector. Temporary PostgreSQL reproduction showed zero lock-visible rows before the membership fix, then one visible row and UPDATE denied after it; both transactions rolled back.
- Six Archify artifacts passed automated validation/delivery/browser gates. All six light-theme 1440×900 captures were visually inspected; additional automated theme/viewport captures were not separately inspected.

## Security review and repairs

Independent Superpowers review found: pg URL query options could override target/TLS; membership FOR SHARE lacked UPDATE visibility; auth.sessions RLS hid rows from the non-bypass helper; SET ROLE on an operator connection was an invalid negative authorization test. Target guard regressions were observed fail then pass. Additive migrations permit scoped membership locks with WITH CHECK(false) and add current-actor/current-session SELECT for app_authz. The role test now checks authenticated's actual SET permissions and records session_user separately. No ownership, BYPASSRLS or runtime admin credential was added.

Supabase security advisors now report only INFO for `private.businesses` having no RLS policy. This is intentional default-deny: the operator manages it, with no application grant/policy. Anonymous/authenticated EXECUTE on the platform's `public.rls_auto_enable()` helper was revoked by migration; its automatic RLS event trigger remains installed. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Open acceptance gates

Real signed-JWT commands, concurrent connections, membership revocation race, assignment revocation, distinct signed-in SSR contexts, refresh/logout/recovery and reconciliation remain unproven pending credentials. New tests are authored, not passed. Time-expired recovery behavior still needs explicit evidence; invalid/replay cases do not prove expiry. Backup restoration remains a pre-live gate.

Next: supply isolated credentials, execute all required gates, fix failures and issue the completed Tasks 1–3 checkpoint. Task 4 requires the user's next approval.
