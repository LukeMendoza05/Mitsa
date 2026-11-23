# Mitsa — C3B(a) controlled retry PASSED

24 October 2026, Asia/Manila. **The two inactive test notices are installed and verified.** This result supersedes the earlier installation status, preserves that failed attempt's audit, and does not authorize a later stage.

## Exact installation

Target: isolated project `mjtejwafxriwntweussc`; verified database marker `fireworks-foundation-proof-01a12e38`. Supabase management reported `ACTIVE_HEALTHY` before the retry.

Executed the unchanged `supabase/security-proposals/persistent-registration-test-notices.sql.txt` once as its complete BEGIN/DO/INSERT/COMMIT transaction. No migration-history entry, schema change, grant change or hook change was made.

SQL SHA-256: `ced89e0a97f9b96cb25902ce6ed4ae97a2b8c15df520ab81beab9e22c6f16538`.

| Notice | ID | Content SHA-256 |
|---|---|---|
| Test Terms | `98b7abf1-bca4-474f-aee4-e851b4f28d84` | `ad129dc38b6ef3a9fd83e9c9b78657849f36cad12f614de24817ee9fab523ac5` |
| Test Privacy | `40714378-eb52-46cf-a7cf-760db4100456` | `dc54cf1cfbd9b30a65f2093840566b6b61261999a3d7b38fb7ab6e6a74d86d0b` |

Both rows have version `isolated-persistent-synthetic-v1`, status `test`, and null approval/effective timestamps. Neither is published or selected by registration/release controls. They permit no real-business use by themselves.

## Previous runner failure: diagnosed and corrected locally

A single counted read-only diagnostic reproduced the old safety assertion's failure. The operator required **zero** noninternal triggers on `private.legal_versions`. The database correctly has the historical `legal_version_immutable` BEFORE INSERT OR UPDATE trigger. Its invoker function checks the content hash and protects non-draft text against updates; it does not insert other records, issue mail or create Auth sessions. Its exact body matches `supabase/migrations/20261013185440_mitsa_account_security_terms.sql`.

The old operation completed its catalog/collection, encountered this false safety assertion, and rolled back the read-only transaction before writing a baseline. The original discarded exception cannot be recovered, but the failing assertion was reproduced using actual catalog evidence; the 70-request stop is consistent with that path. This is a local runner defect, not a failed database permission, encryption, filesystem, CLI sign-in or Supabase Auth operation. The database clock is a valid JavaScript Date; clock formatting was not the cause.

The new pure assertion requires exactly this enabled trigger, its exact historical body/definition, postgres owner, SECURITY INVOKER, empty search path, no PUBLIC/anon/authenticated execution and no additional trigger/rule. It rejects missing, changed, privileged or additional triggers. No safeguard or SQL was removed. The previous 120-request budget and failed-attempt evidence remain untouched; the retry has its own durable budget and checkpoint directory.

## Fresh preflight and postflight

- All 74 frozen review-source hashes and the approved candidate matched. Existing C1's 23 function definitions, owners, settings and grants matched; migration history, managed Auth restrictions and forced RLS matched. C2 signer/disabled-flag metadata and protected local configuration matched the completed C3A baseline. No function deployment or endpoint request occurred. Existing Auth-hook bodies/selectors were not changed; no new dashboard/provider-settings readback is claimed.
- Fresh full preservation state was encrypted to a new ignored private snapshot. Ciphertext and plaintext SHA-256 values were verified, the written file was decrypted, and the recovered payload exactly matched. This happened before the installation transaction.
- Preflight compared all 41 private/foundation tables, Auth account/factor row digests and captured security metadata against original C3A preservation evidence, allowing only its two already-approved ledger additions. Both notice IDs/version were absent. Immediate marker/control/account/factor guards passed before the write.
- Postflight accepted exactly the two specified notice rows with exact text, content hashes, version, status and bounded database creation times. After removing only those additions from the comparison, all other preserved data/security matched the fresh baseline, including developer/Yuno identities, MFA, businesses, ownership, memberships, locations, history, captures and both C3A ledger rows. A separately encrypted postflight snapshot was also decrypted and verified. The historical legal trigger definition/privileges matched preflight.
- Admission, delivery, transport, session-policy readiness, publication and legacy release/pilot controls remain closed; strict policy remains selected. Private-table RLS, managed Auth privileges, secrets and local environment remain unchanged. Zero Auth/Edge/SMTP requests, workers, accounts, factors, recovery links or emails were created by this operation. The sole invoked row trigger has no Auth-session creation path. No recovery/rollback was needed or performed.

## Request accounting and local verification

| Allocation | Read-only database requests | Installation transactions |
|---|---:|---:|
| Historical stopped attempt and reconciliation, retained | 120 | 0 |
| This separately authorized retry | **144 / 200** | **1 / 1** |

The 144 requests include one diagnostic, 70 full preflight reads, three immediate guards and 70 postflight reads. Counts include transaction-control requests and are persisted before execution. The remaining 56 reads and consumed installation slot are not authority to run another stage or repeat this installation.

**26 focused offline tests passed**, zero failed: exact two-row preservation/content checks, historical trigger safety and negative cases, and actual SQL notice/control transitions in offline PostgreSQL. TypeScript and operator syntax checks passed. No browser/build rerun is claimed for this database/operator-only change.

Evidence: `artifacts/stage-c3ba-notices-retry-01-result.json`, `artifacts/stage-c3ba-notices-retry-01-diagnostic.json`, `artifacts/c3ba-retry-offline.json`; private preflight/postflight manifests and encrypted files under `.secrets/stage-c3ba-notices-retry-01/`. No private payload, email, password, key or token was printed.

## Next boundary

C1, C2, C3A and C3B(a) are complete; do not reinstall or repeat their consumed protocols. Strict Option A remains **BLOCKED** under SU-519045, independently of this successful data installation. General registration is not operational.

The next independently reviewable approval is **D connection-only transport testing**: propose one supervised worker launch lasting at most five minutes, at most one TLS/SMTP authentication verification, **zero messages, accounts, Auth requests or Edge probes**, and only the generation-bound delivery-readiness/heartbeat/stop operations. Admission and session-policy readiness must remain false. Before requesting executable permission, bind its exact source, hosted request/write ceilings, stop/reconciliation procedure and preservation checks in a narrow addendum to the existing package. The broader 14-email D/C3B/E/F proposal is not approved by C3B(a). No worker or transport connection was started here.

Account-admitting C3B(b), E, F and general activation still require the supported Strict A correction, separate exact hosted-test approvals and all transport/recovery/security evidence. No one-hour policy or additional session risk is accepted. Stop at this checkpoint; do not use automatic continuation to rerun the provider investigation without new evidence.
