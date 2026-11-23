# Mitsa — approved A capture stopped before connection

Historical note: the user subsequently resumed A and the capture passed. The original stopped execution is retained at `artifacts/current-preservation-preflight-stopped-execution.json`; the main result path now records the later success. See [successful capture and acceptance decision](current-preservation-capture-result-20261027.md). No historical failure or authorization was erased.

27 October 2026, Asia/Manila. **Execution result: FAILED at local authorization preflight; no database capture occurred. Local cause corrected and verified; capture was not retried.**

## What passed

The exact approved manifest remains `7d354cffb5f50993167485b803de76d9f6be6cb1178dfa9407b08bfe39a13d55`. All 109 sources and 27 pinned historical files match. Existing original/drift ciphertexts decrypt with matching digests, their historical application/security/MFA comparisons remain intact, previous worker absence was verified, local target/gates were correct and the capture scope was unused. Additional referenced C1/C3A/last-Auth-inspection encrypted evidence was verified locally; the recorded C2 preservation result was checked without a new provider request.

## Exact failure and correction

The new local approval-record helper sampled the clock separately for `notBefore` and `notAfter`. The resulting record interval was **1,800,008 ms**, exceeding the reviewed maximum **1,800,000 ms** by **8 ms**. The collector correctly rejected it at its existing interval assertion before claiming `attempt.json`, creating a comparison key or starting a connection. No Supabase permission, schema, data or network failure was encountered.

The first commentary attributed a one-millisecond overrun before measurement; that was corrected to the measured eight milliseconds. The reviewed collector and its validation were **not modified or relaxed**. The helper now derives both endpoints from one clock sample. The original invalid record was preserved privately, and only its end was shortened by eight milliseconds, retaining the original start, human approval, scope, target, hash and limits. No window restart, allowance increase or budget reset occurred.

Three focused offline approval-window tests and TypeScript passed. A local-only prerequisite diagnostic then passed every check, including the corrected interval. No subsequent capture command or hosted operation was executed: the user's explicit instruction to stop on a prerequisite failure was retained.

## Consumption and preservation

| Item | Actual |
|---|---:|
| Database connection attempts | **0** |
| SQL statements / SELECT / transaction controls | **0 / 0 / 0** |
| Database writes | **0** |
| Auth / Edge / SMTP requests | **0** |
| Worker launches / accounts / emails | **0** |
| Capture timer / hosted runtime | Not started |
| One-shot capture attempt claimed | **No** |
| Encrypted candidate / accepted baseline | **None / none** |

All old snapshots, fingerprints, incident evidence, approvals and spent budgets remain unchanged. The historical Auth difference remains unresolved. Existing accounts, factors, businesses, memberships, ownership, locations and history were not modified by this local preflight. This is not a fresh verification of current database contents: no SQL ran. Registration/delivery were not activated, and Strict Option A remains **BLOCKED under SU-519045**.

Evidence: `artifacts/current-preservation-capture-result.json` preserves the exact stopped outcome; `artifacts/current-preservation-preflight-failure-diagnosis.json` records the sanitized measured cause/correction; `artifacts/current-preservation-approval-window-tests.json` records the three passing offline tests. The original and corrected authorization records are retained privately under the A scope. No values from protected account rows or credentials were printed.

## Acceptance and B decision

There is **no candidate encrypted-manifest hash** and no new Auth/MFA/ownership/security comparison result, so no candidate meets acceptance conditions yet. No A acceptance wording should be approved without an actual candidate hash and successful capture/comparison report. The existing acceptance procedure is unchanged and still requires its separate exact-hash decision.

The approved A connection/query allowance remains unused. Resuming A would use the existing human authorization and unchanged collector, with fresh local preflight and a valid bounded private execution record; it does not require a broader scope. If the original private interval expires, do not silently extend it: retain its history and bind any resumed interval to an explicit user continuation. Do not rerun on an automatic Goal continuation after this required stop.

Stage B remains unapproved and cannot proceed now. Later it requires both a successfully captured and explicitly accepted A reference **and** the separate B transport approval. No Gmail authentication, worker, email, account test, activation or security exception follows automatically.
