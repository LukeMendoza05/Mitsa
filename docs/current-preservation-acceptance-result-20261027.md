# Mitsa — Stage A capture and acceptance PASSED

27 October 2026, Asia/Manila. **The exact approved candidate is accepted as the current operational preservation reference. Stage B is READY for separate approval and has not run.**

## Accepted reference

Candidate-manifest SHA-256: `05206a18393390f9849ea5c2e3b3ae8a50f2b0e25f86bcdc0056ed02ab77318e`.

Reviewed source manifest SHA-256: `7d354cffb5f50993167485b803de76d9f6be6cb1178dfa9407b08bfe39a13d55`.

Before acceptance, the exact hashes, all 109 pinned sources/27 historical files, ciphertext/decrypted payload digests and historical comparisons were verified again locally. The reviewed prerequisites held: 41 application tables match, MFA fingerprints and captured security metadata match, the original one-row Auth difference remains, and there are no further Auth changes since the diagnostic. The unchanged reviewed acceptance procedure then created the private exact-hash accepted-reference record. An independent local postflight verified the record, user authority, immutable candidate and unchanged original evidence/budgets.

The capture artifact and encrypted candidate retain their **capture-time unaccepted flags** to preserve their exact approved bytes. The later private `accepted.json` is the authority for acceptance; the candidate was not rewritten or re-encrypted to change a flag. The consolidated readiness ledger now records both capture and acceptance PASSED.

The historical Auth change remains **UNRESOLVED and unclassified**. Acceptance is not a finding of harmlessness, approval of an underlying credential/identity change, proof of historical identity coverage or a session-security exception. Strict Option A remains **BLOCKED under SU-519045**. No original snapshot, fingerprint, authorization or spent budget was erased or rebased.

## Consumption and boundaries

Acceptance and postflight made **zero hosted requests, database writes, Auth/Edge/SMTP requests, worker launches, accounts or emails**. No provider setting or registration/delivery control changed. Stage A capture's existing one connection/54 READ ONLY statements remain recorded; this local acceptance added no allowance and reset none. No Stage B approval, attempt, budget or child process was created.

Evidence: `artifacts/current-preservation-acceptance-result.json`, prior capture/verification artifacts and the private acceptance authority/reference under `.secrets/registration-final-v1/A/`.

## Stage B readiness — verified locally

- Exact accepted reference and source hashes validate; candidate decryption works and the comparison key is available inside encrypted evidence.
- Operator target/marker configuration matches the isolated project; local engine remains legacy and private service false.
- Prior worker process is authoritatively absent. No new B approval/attempt exists and historical counters are unchanged.
- At the accepted capture: controls closed, dispatch queue empty, 23 C1 functions/owners/permissions match, private tables retain forced RLS and managed Auth privileges remain unchanged.
- The protected Gmail credential file exists in the **normal Windows operator context**. The restricted process did not see that file; this was execution-context visibility, not evidence it was deleted. No SMTP credential was decrypted, account contacted or authentication claimed successful.

Fresh live target/control/permission/preservation checks and actual TLS/login are still execution prerequisites **within B's future approved scope**. They were not silently performed during this local readiness check. Strict Option A does not block this no-account, rollback-only transport test; it remains a separate required registration-activation dependency.

## Exact separate Stage B approval request

**Scope:** `B-transport-retry-v2`, only `mjtejwafxriwntweussc`, marker `fireworks-foundation-proof-01a12e38`, source manifest and accepted reference hashes above. Sources and full rollback protocol remain in `docs/registration-final-approval-package.md` and `config/registration-final-review.json`.

Limits:

| Resource | Maximum |
|---|---:|
| Direct database connection attempts | **2** — normal test plus optional read-only reconciliation only |
| SQL statements | **180**: at most 164 SELECTs, four write-capable calls and twelve transaction/lock statements |
| Supervised child/worker launches | **1** |
| Reserved runtime | **5 minutes / 300 seconds overall**, including any reconciliation |
| Gmail TLS/authentication verifications | **1** |
| Auth/Edge/management requests, emails, accounts | **0** |

Require **exact preservation**; this request includes no activity-only mismatch allowance. Live preflight must pass before credentials/SMTP. Inside a locked rollback-only transaction, temporarily enable only delivery/worker-health state, keep admission and security readiness false, verify worker acquisition/heartbeat/shutdown and Gmail TLS/login, then roll back all four write-capable calls and compare encrypted pre/post state. Never tick/claim/send. Provider authentication logs and spent budgets are not reversible. Stop on any failure; no automatic transaction, worker or SMTP retry. One optional read-only reconciliation may run only after authoritative child termination, with remaining time and budget. No reconnection to repeat the transport test.

Proposed exact human wording:

> Approve B-transport-retry-v2 for isolated project mjtejwafxriwntweussc, marker fireworks-foundation-proof-01a12e38, under source manifest 7d354cffb5f50993167485b803de76d9f6be6cb1178dfa9407b08bfe39a13d55 and accepted candidate 05206a18393390f9849ea5c2e3b3ae8a50f2b0e25f86bcdc0056ed02ab77318e. Authorize the two-connection/180-statement limits, at most four rollback-only write-capable calls, one supervised five-minute worker launch and one Gmail TLS/login verification, with exact preservation required. The second connection is read-only reconciliation only. Send no emails, create no accounts, make no Auth/Edge requests, leave admission/security readiness disabled, and preserve Strict Option A. Stop after rollback, preservation verification and reporting; do not proceed to later stages.

This wording is a request only. User acceptance of A is not B authorization. No transport launch, SMTP operation, rollout, risk decision or general registration follows automatically.
