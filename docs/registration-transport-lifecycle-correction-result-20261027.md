# Mitsa — Stage B lifecycle correction READY; hosted retest not executed

27 October 2026. Local correction, offline verification and the exact new retest package are complete. No new hosted request, connection, worker, SMTP verification, email, account, provider change or private approval was made. Previous B-v2/D attempts remain consumed. This is not a hosted Stage B PASS.

## Root cause and applied correction

The executed B-v2 source installed a child `disconnect` listener and left the IPC channel connected after body completion. Node keeps that channel referenced while the listener remains; a real process-only fixture reproduces the completed child staying alive. B-v2 also started a fresh 300-second timer after `fork()` returned, excluding startup from that timer. The historical run had body success at 36.268 seconds and watchdog termination at 305.610 seconds. No historical active-handle dump was captured, so the report does not claim to have excluded every other possible historical handle.

The reviewed correction is now applied to `scripts/registration-transport-retry.mjs` and its lifecycle helper. Existing worker business logic, SQL, Auth, session policy and SMTP behavior remain unchanged:

1. A parent-start handshake binds the child to the newly written attempt/PID before resource acquisition. Parent loss closes owned resources and produces failure.
2. After the real worker's logical stop and rollback/postflight, cleanup closes SMTP, awaits database `end()`, clears owned timers, removes only its emergency disconnect handler and disconnects IPC. The bounded eight-second cleanup path destroys a stuck database connection and fails. There is no forced success exit or arbitrary handle unref.
3. Parent observes real child exit, both output pipes ending/closing, zero exit/no signal/no watchdog, cleanup evidence and authoritative PID absence. A body result is explicitly pending; aggregate PASS is written only after these conditions hold.
4. Startup counts against the original deadline using wall and monotonic time. New work stops at 210 seconds, the watchdog acts at 240, and the total cap remains 300. Reconciliation stops by 290 and needs 55 seconds remaining before it begins. OS scheduling is not a real-time guarantee: any measured excess/failure remains a failure rather than being hidden.

Offline parent-disconnect testing discovered a second Windows lifecycle issue: after parent-initiated IPC disconnection, `exit` and the two stream closures occurred without aggregate `ChildProcess.close`. The supervisor now observes those individual prerequisites directly, instead of waiting indefinitely for that aggregate event. No security/provider configuration was used to resolve this local defect.

Installed dependency source was checked: `pg.Client.end()` resolves after connection termination (or immediately if never connected); Nodemailer's unpooled `verify()` initiates QUIT before resolving, while transporter `close()` disposes transporter resources. Therefore close invocation alone is not claimed to prove immediate TLS socket termination: natural process exit is also mandatory in the hosted retest.

## Exact reviewed package

New scope: **`B-transport-lifecycle-v3`**.

Manifest: `config/registration-transport-lifecycle-review.json`.

**Manifest SHA-256: `b0a9e321cf84e136d731084fe5841cd8981f40ce1e3a49e24ac3660223b75930`.**

115 source hashes and 51 historical file hashes verified. The immutable old manifest remains `7d354cffb5f50993167485b803de76d9f6be6cb1178dfa9407b08bfe39a13d55`. Its executed runner and changed entrypoint test are verified through explicitly mapped archived bytes; the old manifest itself was not regenerated. Old preparation tools that require unchanged current paths are historical, not authority to rerun a consumed scope. Use the new package for current source verification.

| Changed file or newly pinned dependency | SHA-256 |
|---|---|
| `scripts/registration-transport-retry.mjs` | `27022a44e515c44963699a4ebfb54cae4fa15db31bec4deacad449ece61c59da` |
| `scripts/lib/registration-transport-lifecycle.mjs` | `c6fbf692a471a2e5de83ae7b1e58bca4a388a88481c0eb0657e88dceb4919ef7` |
| `scripts/prepare-transport-lifecycle-review.mjs` | `c881708a8d347390c41e632fcee15d25642f8ddcbf4f40df4853027de33730a1` |
| `tests/unit/registration-transport-lifecycle.test.ts` | `c7f94189404a6cbbec6e89dd27680bd3aa70bb0f55d5abc578be806a26a95aba` |
| `tests/unit/registration-final-entrypoints.test.ts` | `d888ec9aa32d3e70c894c85cdce0c2734c20183d1f050b37015e20b506867d59` |
| `tests/support/transport-cleanup-fixture.mjs` | `b80eb216b7d0576a2cbc2a4482530ac4478e4578463b715539c4104364caebf2` |
| `tests/support/transport-ipc-fixture.mjs` — unchanged earlier fixture, now pinned | `d1d0c35ad723c952fd798186b82a598be11cb1798a3fbcf3327db037dc2f6105` |
| `docs/registration-transport-lifecycle-retest-approval.md` | `3fb6f36416edb64a77f6792d56f51c80b39e717b55ed25fdf428530d965e9595` |

Prior reviewed sources, inactive proposal text, encrypted snapshots and all historical attempt records remain intact. Additional archives are in `docs/history/b-lifecycle-local-v2/`; the original executed runner is also preserved in `docs/history/b-transport-retry-v2/`. Unrelated working-tree changes were preserved.

## Verification — OFFLINE only

Final command:

```powershell
npx vitest run --project unit --fileParallelism=false tests/unit/registration-transport-lifecycle.test.ts tests/unit/registration-final-controls.test.ts tests/unit/registration-final-entrypoints.test.ts tests/unit/registration-transport-probe.test.ts tests/unit/current-preservation.test.ts tests/unit/current-preservation-security.test.ts --reporter=json --outputFile=artifacts/registration-transport-lifecycle-v3-verified-tests.json
```

**67 tests passed, six files, zero failures, clean exit.** This includes the original ten lifecycle/control regressions; actual process-only launch/exit; normal/failure/timeout/disconnect; no pending owned timer handles; installed pg/Nodemailer client disposal without connecting; actual worker SQL against offline PostgreSQL/PGlite; rollback/uncertain-response failures; approval/budget/direct-entrypoint denial; exact preservation and C1 security checks.

Earlier failed outputs remain retained: the Windows aggregate-close wait exposed and corrected the real supervisor issue; initial TypeScript optional-parameter inference was corrected with an explicit parameter type; the four-process entrypoint test needed an appropriate test deadline; a later sandbox temporary-cache ENOENT caused a suite-level failure despite completed assertions. Final offline execution in the normal Windows context passed all 67 with no missing suite. No failed result was overwritten or relabelled passing.

Separate process measurement, `artifacts/registration-transport-lifecycle-v3-process-evidence.json`:

| OFFLINE fixture | Elapsed | Actual outcome |
|---|---:|---|
| Successful cleanup | **272.305 ms** | Natural exit 0, no signal, both streams closed, zero owned timeout handles, PID absent |
| Hung database cleanup | 273.397 ms | Natural failure exit 3 after bounded cleanup/destroy; zero owned timeout handles, PID absent |
| Unexpected parent disconnection | 203.348 ms | Natural failure exit 1; PID absent |
| Deliberately leaked handle | 1,217.848 ms | Watchdog SIGKILL, marked expired/failure, PID absent |

These fixture processes use referenced timers to model owned resources. They are not hosted mail workers, real Gmail connections or real PostgreSQL sessions. Real TLS/database termination remains part of the separately approved hosted retest.

TypeScript passed. Syntax checks passed. Working-tree whitespace check passed (existing CRLF normalization warnings only). Privacy/hash verification scanned ten files against ten locally configured private values and credential patterns without printing values; all 115 source and 51 historical hashes match. Actual `--check` passes with no private approval/attempt, no credential decryption and no hosted request. No UI/app source changed, so no new build/browser journey is claimed.

## Preservation and recovery

Accepted reference remains candidate `05206a18393390f9849ea5c2e3b3ae8a50f2b0e25f86bcdc0056ed02ab77318e`. Its immutable bytes, encryption/decryption integrity and original-review binding passed local verification. Both B-v2 encrypted pre/post observations still compare exactly against it; 23 C1 function/security invariants pass. This is verification of retained evidence, not a new hosted inspection. The older one-account historical Auth change remains unclassified.

New root `.secrets/registration-final-v1/B-lifecycle-v3/` has no authority or attempt record. Old roots, ledgers and counters are untouched. Fresh hosted preflight must check current target, full exact preservation, closed controls, empty queue and prior child absence before SMTP. A new activity-only or protected drift stops; it cannot be silently accepted.

All four future test writes must remain inside the one locked rollback-only transaction. After shutdown, ROLLBACK and exact encrypted postflight are mandatory. No writable COMMIT, job claim or mail send. Any failure stops without transport retry. The second connection is only for one reviewed READ ONLY reconciliation after confirmed child absence, with budget/time remaining; late watchdog failure does not leave sufficient time. Uncertain cleanup requires reporting and a separately approved response, not destructive rollback, account changes or baseline replacement.

## One next approval

Review `docs/registration-transport-lifecycle-retest-approval.md` and approve **one** `B-transport-lifecycle-v3` under manifest **`b0a9e321cf84e136d731084fe5841cd8981f40ce1e3a49e24ac3660223b75930`**:

- Isolated project/marker only; accepted A unchanged; exact preservation.
- At most **two DB connections**, **180 SQL = 164 SELECT + four write-capable + twelve transaction/lock**; second connection conditional READ ONLY reconciliation only.
- **One supervised launch**, **300 seconds overall**, work stop **210**, watchdog **240**, reconciliation stop **290**; **one Gmail TLS/login**.
- Only the documented temporary uncommitted delivery/worker state; admission and security readiness stay false; ROLLBACK, natural exit and process absence required.
- **Zero emails, accounts, MFA/workspaces, Auth/Edge requests, provider changes or committed application changes**. Preserve all previous consumed budgets; stop after result reporting.

This local task does not grant that approval. No new hosted execution follows automatically. The retest is independent of Strict Option A because it admits no users/sessions and commits no activation. Strict Option A remains **BLOCKED under SU-519045**; no exception is accepted. General registration and delivery remain disabled. Stage C real mail, subsequent onboarding/security tests and final activation still need their own exact protocols, gates and approval.
