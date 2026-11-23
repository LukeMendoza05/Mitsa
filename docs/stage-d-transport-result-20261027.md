# Mitsa — Stage D transport-only result: FAILED IN PREFLIGHT

27 October 2026, Asia/Manila. **FAILED — before the writable probe and before Gmail.** One approved supervised child ran and exited in **28.937 seconds**. It was not retried. This is not a Gmail failure, a successful transport test or a change to Strict Option A.

## Exact approved package and execution

Target: `mjtejwafxriwntweussc`, database marker `fireworks-foundation-proof-01a12e38`. Review-manifest SHA-256: `00290c2e2713d8d94ab1fac20cfc4791b57eb4e55595440094e0ce41eae3a841`.

All 21 referenced D source hashes and the original 74 frozen hashes matched before execution. No reviewed source, SQL, configuration or manifest was regenerated. The user's exact attachment approval was recorded in the ignored private execution file with its evidence hash, scope, project, limits and thirty-minute authorization lifetime. Existing counter capacity was absent at this first approved execution; it was created once, not reset/refunded.

The child passed target/local closed-gate checks and the one CLI secret-metadata comparison against the completed C3A baseline. Its marker-checked read-only transaction completed the C1 catalog validation and full preservation collection. The **23 reviewed functions/owners/privileges, migration history, managed-Auth restrictions, forced RLS and closed registration/release/pilot controls passed**. C1 also confirmed zero persistent dispatch/cohort/submission rows and null notice selections.

The runner then stopped with `AssertionError / ERR_ASSERTION`, stage `database-preflight`, before saving a new encrypted baseline. Source mapping plus the successful collection, zero dispatch count and local old-snapshot validation identifies the full retained-state comparison against the approved C3B(a) snapshot as the failing prerequisite. The public failure record does not retain the differing fields or current in-memory payload. **Do not guess which account, business row, permission, metadata or representation differs.**

Local-only diagnosis subsequently confirmed the approved old snapshot manifest hash, ciphertext hash, successful decryption and plaintext digest. No new preservation file exists. This excludes a corrupt old snapshot/digest as the recorded comparison failure. It does not authorize replacing that snapshot, correcting records or rerunning the probe.

## Results by required operation

| Operation | Actual result |
|---|---|
| Gmail TLS/SMTP verification | **NOT ATTEMPTED; zero SMTP connections** |
| One-shot worker construction/acquisition | **NOT REACHED** |
| Worker heartbeat/shutdown | **NOT REACHED; no worker ownership acquired** |
| Writable rollback-only transaction | **NOT ENTERED; zero write-capable calls and no private-table locks** |
| Rollback | Not applicable to test writes; none began. The read-only preflight transaction ended normally. `rollbackConfirmed=false` in the raw record means the probe stage was never reached, not that a write transaction was left open. |
| Fresh encrypted preflight baseline | **NOT CREATED — mandatory prerequisite failed** |
| Full prior-snapshot preservation comparison | **FAILED; differences unclassified** |
| Child/connection cleanup | Parent observed exit code 1; OS process check confirmed child absent. DB connection closed on exit. No active SMTP connection existed. |
| Current controls | Closed admission/delivery/transport/session readiness and release/pilot controls were confirmed during C1 preflight; this run issued no write-capable call. |
| Accounts, MFA, workspaces, ownership, history | This run performed no mutation or Auth operation. Full equivalence to the previous snapshot is **not claimed**, because that is the failed check. |
| Email/account/dispatch creation | **Zero by this run**; no sending or creation path reached. |
| Secrets/local environment | Preflight secret metadata matched; no secret/configuration write occurred. Postflight recheck was not reached, and no extra metadata call was submitted after the stop. |

## Durable consumption

| Resource | Used / approved ceiling |
|---|---:|
| SQL requests, all read-only/control | **69 / 192** |
| SELECT-only queries | **67 / 180** |
| Write-capable calls | **0 / 4** |
| Transaction/control statements | **2 / 8**, read-only BEGIN/COMMIT |
| Database connection attempts | **1 / 3** |
| CLI secret-metadata invocations | **1 / 2** |
| Supervised child launches | **1 / 1** |
| Shared D launch reservation | **1 consumed; five minutes reserved**, not refunded after early exit |
| SMTP verification reservations/connections | **0 / 1 for this attempt** |
| Mail/phase-mail claims, emails, Auth/Edge requests | **0** |

The unused SMTP slot is **not** permission to launch a replacement test. Shared D's remaining original aggregate capacity is four launches, 295 reserved minutes and twelve verification slots; those are still subject to future exact approvals and do not reopen this failed attempt. No previously consumed C2/C3A/C3B(a) budget was reused.

Evidence: original `artifacts/registration-transport-probe-result.json`, new execution summary, `.secrets/registration-completion/transport-probe/{attempt,child-started,child-terminal,budget,connections-budget,management-budget}.json`, and retained shared D ledger claims. `artifacts/stage-d-local-snapshot-diagnostic.json` records only the local decryption/hash check. No private payload, email, credential or token was printed.

## Why the reviewed reconciliation was not run

`--reconcile` requires the new `preflight.json` and encrypted baseline. Neither exists because the mandatory comparison failed first. The cleanup has no write transaction to undo. Calling reconciliation or restarting the probe would not supply the missing baseline and is not justified by the approved protocol. No additional hosted request was made after the preflight stop.

## One next approval — inspection only

Prepared [a separate read-only preservation-drift inspection](stage-d-preservation-drift-approval.md), manifest `config/registration-preservation-drift-review.json` SHA-256:

`1119c4a840b3363ef381c438f39b4d978272d1787e67b0f498f63d71b5d8d5d3`.

Proposed: **one connection, 51 SQL requests (49 SELECTs + read-only BEGIN/COMMIT), at most two minutes, zero writes/workers/SMTP/Auth/Edge/management requests**. It uses the existing counters without reset, encrypts diagnostic evidence and emits only changed table/column names and aggregate row/digest counts. It does not accept a new baseline or approve another D test. The failed attempt's counters remain binding; maximum cumulative accounting after that fully consumed inspection would be 120 SQL requests and two DB connections.

Eight new offline cases pass, including value/identity non-disclosure, ordering-vs-data classification, composite-key SQL and refusal of diagnostic execution without its own new approval. TypeScript passes. Original D sources remain unchanged. The diagnostic has **not** run against Supabase; its separate private authorization/attempt files are absent.

After inspection, review the actual differences before deciding whether to accept legitimate drift or investigate an integrity problem. No retained record may be overwritten to make a comparator pass. A new baseline or D retry requires its own reviewed approval.

Strict Option A remains BLOCKED under SU-519045. General registration, real email delivery and account-admitting tests remain disabled/unapproved. C1/C2/C3A/C3B(a) completed evidence is preserved; no Supabase Auth experiment, provider change, migration, account reset, support message or deployment occurred.
