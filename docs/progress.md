# Foundation Tasks 1–3 execution ledger

Plan: docs/superpowers/plans/2026-10-12-foundation-proof.md

- 2026-10-12: User authorized Tasks 1–3 and approved five decisions; all other implementation remains gated.
- Repository inspected: empty, no commits or project files. Branch codex/foundation-proof created.
- Superpowers writing-plans/executing-plans/TDD/verification guidance, Addy security/quality guidance and Archify authoring guidance read from official repositories.
- Ruling: execute natively under the user's existing implementation approval; no redundant plan/execution-method approval. Final independent review remains required.
- Pre-flight: spec -> traceability preserves all three stages; bootstrap -> security tests share guarded target/config; SSR -> DB uses user identity and publishable key only. No contradictory interfaces found.
- Hosted provisioning: organization explicitly approved, Singapore selected. MCP get_cost unavailable; dashboard sign-in requested. No existing project accessed.
- Task 1: design/traceability recorded; diagrams pending.
- Task 2: exact dependency manifest and script-blocking policy recorded; install/build/tests pending.
- Task 3: not started. Hosted verification must not be inferred from documentation.

## Execution evidence

- Target guard RED: 8/8 failed against unimplemented guard; GREEN: 8/8 passed.
- Runtime configuration RED: 3 new failures; GREEN: all 11 unit tests passed.
- Foundation page RED: desktop/mobile failed on missing heading; GREEN: 2/2 passed after page implementation.
- Authentication boundary RED: desktop/mobile expected 401 but received 404; GREEN: unsigned authentication/layout suite 4/4 passed.
- Initial hosted assertion failed: app_command role missing. Initial identity assertion failed: API identity function missing.
- Migrations applied only to approved Fire_Inv. Ruling: MCP stamps remote migration versions; local CLI-generated files renamed to the returned remote versions to keep history consistent, without editing applied SQL.
- Hosted catalog assertions passed: custom roles NOLOGIN/NOBYPASSRLS/non-superuser; eight tables owned by postgres with ENABLE/FORCE RLS; private commands owned by app_command; invoker API wrappers; anonymous execute and authenticated direct UPDATE denied; no custom role membership for authenticated.
- Actual Auth settings RED: disable_signup=false. GREEN after dashboard configuration: disable_signup=true, anonymous_users_enabled=false. Site URL and exact redirect use loopback only.
- Current build/typecheck passed. Native runtime audit found zero vulnerabilities.
- Archify architecture, sale/reservation/delivery/transfer lifecycles and checkout recovery sequence passed validation, delivery, strict check and real-browser checks. Visual quality was not separately reviewed. Sequence required measured readability/height repairs.
- Hosted Vitest suite currently fails setup because operator credential placeholders remain. No real JWT/concurrency or signed-in SSR test is claimed passed.
- Ruling: test/operator environment is parsed into a separate object, never process.env, because Playwright collection could otherwise pass privileged credentials to the Next.js child process.

## Independent review and subsequent evidence

- Previous credential-help turn yielded dashboard evidence and a concrete handoff; credentials still absent on revalidation. This turn made substantive repairs rather than repeating the wait.
- Final review: target/TLS query override reproduced; regression RED then GREEN, all 13 unit tests pass. Malformed URL errors also RED then GREEN and no longer retain credential input.
- Final review: membership FOR SHARE default-deny reproduced on real PostgreSQL with temporary table (zero rows). Additive scoped UPDATE USING / WITH CHECK(false) repair allows lock but denies data changes; real temporary reproduction passed, rolled back.
- Final review: hosted auth.sessions ENABLE RLS/no policies confirmed. Narrow current-actor/session helper SELECT policy added by migration after a failing catalog assertion. Ownership and non-bypass roles preserved.
- Final review: corrected SET ROLE negative test to inspect authenticated SET privilege; operator session_user remains postgres and cannot simulate that failure accurately.
- Added real membership revocation race, shop assignment revocation and concurrent signed-in context tests; unexecuted pending credentials. Invalid callback/no-store checks pass on desktop/mobile.
- Supabase advisors: revoked platform event-helper PUBLIC execute; only intentional default-deny private.businesses INFO remains. Updated catalog assertions pass.
- Fresh evidence: aggregate fails at missing hosted credentials; full E2E fails hosted setup; targeted unsigned desktop/mobile E2E 6/6 pass; unit 13/13 pass; build/typecheck pass; npm audit zero vulnerabilities. See docs/foundation-checkpoint.md for limits.
- Ruling: preserve a versioned incomplete checkpoint rather than claim acceptance from catalog-only evidence — real JWT/concurrency/SSR tests remain mandatory — cost if wrong: delayed implementation until proof is available.
- Final: Ruling: production readiness and later domain features excluded by reviewer — user explicitly limited Tasks 1–3; backup restore remains a pre-live gate — cost if wrong: cannot treat this checkpoint as deployable.
- Final: Ruling: reviewer omitted credential-dependent verification — retain as open acceptance gates, not inferred pass — cost if wrong: no domain implementation can proceed.
- Task 1: six Archify visual-check captures inspected at 1440×900 light theme; readable labels/connectors and no node overlap. Other theme/viewport captures have automated checks only.
- Ruling: preserve generated Archify files byte-for-byte with Git attributes — CRLF conversion would invalidate artifact receipts — cost if wrong: diagram provenance would fail after checkout.
- Latest complete command runs: npm run test unit13pass then integration1failed/16skipped due missing credentials; npm run test:e2e sixpass/twofailed/sixnotrun due hosted setup; build/typecheckpass; reconciliation fails before connection with sanitized config error.
- Version control: 11cd1b1 records documentation, bootstrap, tests and five synchronized migrations. Worktree verified clean; ignored credentials/tool downloads are absent from the index. Checkpoint is explicitly incomplete, not a passing release.
- Credential blocker has persisted through the initial setup turn, credential-help turn and this continuation. Independent review, diagram inspection, local verification and version control are now complete; remaining required acceptance evidence needs user-supplied credentials.

## Credential-supplied continuation

- User supplied operator file. Verified target URL/username and modern secret-key format without outputting values. Read-only Auth admin list request to approved Fire_Inv succeeded; key is valid for that project.
- Initial database TLS failed SELF_SIGNED_CERT_IN_CHAIN. Downloaded public CA from the exact link in Fire_Inv's Database Settings; scoped it to test/operator pg clients only. Certificate/hostname verification stays enabled; no global trust change.
- TLS configuration regression RED (missing implementation), then GREEN 15/15 unit tests. One sandbox runner temporary-module error was resolved by running the same test command escalated. Build caught an incorrect pg type assertion; corrected assertion, then build/typecheck passed.
- PostgreSQL now rejects the supplied password with 28P01. Read-only marker verification and fixture setup stop before writes. Asked user to correct only the database URL/password; no credential values displayed or changed.
- Executed integration: real Auth settings test passes, two database setup failures, 16 cases not run. Executed aggregate: 15 unit tests pass, same integration result, no aggregate browser phase. Separate full E2E: six pass, two setup failures, six not run. Reconciliation fails authentication; audit zero vulnerabilities.
- Ruling: trust Supabase's published CA only in isolated database tool configuration — required to retain verified TLS rather than bypass certificates — cost if wrong: connection fails closed; reviewed public CA fingerprint is documented.

## Corrected credentials and hosted design stop

- User corrected the database URI; remaining template brackets around the password were tested without persistence first. Verified TLS and the pinned marker succeeded after removing those brackets; only that correction was saved to the ignored operator file. No credential values displayed.
- Actual hosted integration ran. Two catalog failures were PostgreSQL name[] driver representation mismatches; explicit roles::text[] fixed those assertions (four existing security tests then passed).
- Root cause of authorized command failures: app_authz/app_command lack auth schema USAGE despite initial migration GRANT text. postgres has no auth USAGE grant option and cannot SET ROLE to either managed administrator. Column SELECT and function EXECUTE grants are present. No evidence supports claiming those original schema grants ever took effect.
- Added failing schema-USAGE regression and catalog assertion. Removed the empty unapplied migration draft; no sixth migration or privilege workaround applied.
- Latest aggregate: 15 unit passed; integration 7 passed/11 failed; aggregate browser phase not reached. Separate E2E 8 passed/6 failed across desktop/mobile. Security 4 passed/1 failed. Build/typecheck/reconciliation/audit exit 0. Reconciliation contains zero command events/results, so it is not a positive transaction proof.
- Ruling: obey the user's explicit stop if hosted privileges cannot work as designed; keep the red tests and report the blocker rather than change role inheritance/ownership or use runtime administrative credentials. Cost if wrong: Tasks 1–3 remain incomplete and Task 4 stays gated. Design, plan, setup and checkpoint now record this limitation; all three release stages preserved.
