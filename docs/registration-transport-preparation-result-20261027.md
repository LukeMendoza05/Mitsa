# Mitsa — Stage D local transport preparation complete

27 October 2026, Asia/Manila. **LOCAL PREPARATION PASSED. HOSTED TEST NOT APPROVED OR EXECUTED.** Resumed the saved usage-limit checkpoint. C1, C2, C3A and C3B(a) were not replayed. Strict Option A remains blocked under SU-519045; no session-risk exception is accepted.

## Completed work and preserved sources

Finished `scripts/registration-transport-probe.mjs`, its safety/protocol library `scripts/lib/registration-transport-probe.mjs`, the local package builder/auditor, `tests/unit/registration-transport-probe.test.ts`, the source manifest and [exact D approval document](registration-transport-only-approval.md). Updated the consolidated approval/progress ledgers to identify this as a prepared, independently selectable test, not an activated service.

The actual worker, existing worker test guard, registration application, C1/C2 service and migration packages, hook implementations, RLS and authentication architecture remain unchanged. **All original 74 frozen source hashes match.** Unrelated dirty working-tree files were retained; nothing was reset, staged, committed or deployed. Existing account/MFA/business data was not contacted or mutated by this local continuation. No fresh hosted-data preservation readback is claimed; the future test must perform its own approved preflight.

The interrupted approval-denial task is complete: the actual entry's Check succeeds locally; Run, direct unsupervised child and Reconcile all reject missing approval before creating an attempt/budget or loading operator/SMTP credentials. No private live authorization was generated. The new child also requires its recorded parent/own PID, source hash and deadline. Exclusive attempt creation rejects repeated runs without overwriting history.

Further local review corrected unsafe overlap/cleanup cases: reconciliation requires an authoritative missing child process, not a stale terminal file; parent disconnect terminates the child even before DB initialization; budget reservations validate safe integers/sums and are flushed before operations; a backwards wall clock cannot extend the monotonic five-minute supervisor; cleanup still attempts rollback if shutdown throws; a lost rollback response is not retried or labelled a pass. Credential/management errors are sanitized before reporting. The exact existing shutdown heartbeat SQL form is explicitly allowed and counted.

## Verified evidence

| Check | Result |
|---|---|
| Actual missing-approval entry test | Passed: no attempt/budget/live approval created; no network path reached |
| Transport safety and actual offline SQL/rollback suite | **34 passed, 0 failed** |
| Existing scope, subprocess, worker and crash/restart regressions | **21 passed, 0 failed** |
| TypeScript | `npm run typecheck` passed |
| Operator syntax and local Check | Passed |
| Source/fixture checks | **21 D sources and all original 74 sources match** |
| Privacy/secret audit | Reviewed source/package/artifact files contain no configured private values or retained/test recipient identities; private files ignored and untracked |
| Existing public assets | Prior private values/identities absent from 42 public/static files; broader frozen-review audit scanned 44 paths |
| Working-tree whitespace | `git diff --check` passed; only existing CRLF normalization warnings |

The selected earlier one-case denial run overlaps the 34-case suite and is not counted again. **55 focused cases total**, not 56. Actual PostgreSQL functions ran only in local PGlite with simulated SMTP results; no real Gmail connection, live worker timeout or hosted provider correction is claimed. No application/UI change required a new production build or browser session, so none was repeated.

Commands:

```powershell
node scripts/prepare-registration-transport-probe.mjs
npx vitest run --project unit tests/unit/registration-transport-probe.test.ts --reporter=json --outputFile=artifacts/registration-transport-probe-offline.json
npx vitest run --project unit tests/unit/registration-mail-test-scope.test.ts tests/unit/registration-reviewed-worker-entry.test.ts tests/unit/persistent-mail-worker.test.ts tests/unit/persistent-worker-process.test.ts --reporter=json --outputFile=artifacts/registration-transport-worker-regressions.json
npm run typecheck
node --conditions=react-server scripts/registration-transport-probe.mjs --check
node scripts/persistent-registration-worker-review.mjs --check
node scripts/verify-registration-transport-package.mjs
node scripts/verify-persistent-stage-a-safety.mjs
node scripts/verify-registration-completion-review.mjs
git diff --check
```

The package builder is a preparation command only. **Do not regenerate the reviewed manifest after approval**; source drift must stop for review. `--run` is intentionally absent from these preparation commands.

## Exact reviewed hashes

The full 21-file list is in `config/registration-transport-probe-review.json`. Its SHA-256 is:

`00290c2e2713d8d94ab1fac20cfc4791b57eb4e55595440094e0ce41eae3a841`

| Source | SHA-256 |
|---|---|
| `scripts/registration-transport-probe.mjs` | `01817cb11766c08576e91868dadbc1314cfd906cb39c163d22bedece72b5af37` |
| `scripts/lib/registration-transport-probe.mjs` | `020fa7bd9bf9c5f19437bf98b6444f5c42924a85b9474e277ad17d02471353ce` |
| Existing delivery-control SQL | `1b010b2c4bcd33edae3765f4ef81b9de95f0468bc3bf53ebb5f16acdd76343c3` |

`artifacts/registration-transport-package-readiness.json` records the manifest hash and local checks. The older completion-review artifact's `allSectionsRemainUnapproved` field describes frozen proposal selections; it does not revoke or contradict completed C1/C2/C3A/C3B(a) approvals. Runtime execution status comes from the milestone ledger and reports, not historical proposal labels.

## Proposed hosted scope — not yet executed

- Target only `mjtejwafxriwntweussc`, marker `fireworks-foundation-proof-01a12e38`.
- **One supervised launch, maximum five minutes, one SMTP TLS/authentication verification** to `smtp.gmail.com:465`.
- **192 SQL requests maximum:** 180 SELECT-only reads, four write-capable calls, eight transaction/lock statements. Maximum three DB connection attempts and two CLI secret-metadata invocations. These are separate explicit ceilings, counted before attempts; no automatic retry/refund.
- **Zero emails, Auth/Edge calls, accounts, Supabase Auth sessions, MFA factors, workspaces, ownership changes, message claims/deliveries or committed DB writes.** No deployment, provider setting, selector, RLS or schema change.
- One generation-bound rollback-only transaction temporarily changes control/ownership/heartbeat fields only in its own uncommitted view. Admission and security readiness remain false; other sessions continue to observe closed delivery/registration controls. It uses only the real worker's pulse and stop methods, never queue-claim/tick/send. Its single launch/five reserved minutes/one verification are consumed from the existing D shared ledger, not additional allowances.

Preflight must match the installed source/permission baselines and retained-data checkpoint, then create/decrypt/digest-verify a fresh encrypted snapshot. Postflight reconnects and compares committed retained data and security against that fresh baseline. Any unexpected drift stops without rebasing, overwriting data or replaying the test.

Rollback restores logical application rows, but cannot erase the SMTP login exchange/provider logs, consumed budgets, or DB lock/WAL/statistics/connection-log effects. The two private control/dispatch table locks may briefly block competing writes. An already-started remote SMTP authentication exchange can finish before socket closure. These are disclosed limits; a timer alone is not proof of remote cleanup.

Cleanup attempts shutdown and one rollback, then closes the connection. If uncertain, one source/approval-bound `--reconcile` may use the remaining original read/connection budget only after the child is authoritatively absent. It creates no worker and cannot convert unconfirmed transport into a pass. Expired approval, missing preservation evidence or exhausted capacity requires a separately bounded read-only recovery decision; no automatic reopening, secret rotation, account reset or destructive cleanup is allowed.

## Next action

Request explicit approval for **this exact D connection-only rollback probe**, with the hash and ceilings above. The future operator records that new human decision privately; preparation does not manufacture authorization. Stop after that test and report, without proceeding to mail/account onboarding or activation.

Persistent general registration is still incomplete. C3B(b) provider/correlation/recovery tests, real delivery, new-user onboarding, operational stability and final activation remain separately gated; account-admitting work still requires a supported Strict Option A correction and approved regression evidence. Await Supabase's substantive response to SU-519045; do not repeat its failed experiment or install a managed-Auth trigger while waiting.
