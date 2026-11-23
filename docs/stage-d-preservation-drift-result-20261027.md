# Mitsa — Stage D preservation-drift findings

27 October 2026, Asia/Manila. **Overall: INCONCLUSIVE as to the cause/legitimacy of the Auth change.** The mismatch itself is conclusively isolated to **one existing `auth.users` whole-row fingerprint**. Collection/encryption completed, and offline comparison recovered the findings after a local runner error. No further hosted connection or query was made.

## 1. Approved execution and processing outcome

Executed `D-preservation-drift-readonly-v1` once against `mjtejwafxriwntweussc`, marker `fireworks-foundation-proof-01a12e38`. Reviewed manifest SHA-256: `1119c4a840b3363ef381c438f39b4d978272d1787e67b0f498f63d71b5d8d5d3`.

Final local preflight matched all ten diagnostic sources, the original D manifest and 21 sources, the original 74 frozen sources, exact prior counters and prior failure evidence. The previous child was authoritatively absent. The old encrypted snapshot decrypted with matching cipher/plaintext digests. New approval was recorded privately with the exact limits and a thirty-minute authorization lifetime. No existing counter/approval/history was reset or overwritten.

The reviewed process completed its **49 SELECT queries and read-only BEGIN/COMMIT**, saved the current diagnostic payload encrypted, read it back, decrypted it and verified its digest. It then exited with **TypeError** at local comparison, after the database transaction had closed. No write transaction or external service was involved.

The local failure is reproduced: `array_agg(pg_attribute.attname)` returns PostgreSQL `name[]` (OID 1003), which the installed `pg` parser returns as a **string**. The comparison expects an array and calls `.some`. PGlite's test result had been an array, so that adapter difference was absent from the earlier test. The runtime did not retain a raw error stack or key registry, but the reviewed source and installed parser reproduce this failure. This is separate from the original D preservation mismatch.

Both encrypted snapshots were then decrypted/verified **offline**. Direct comparison showed every application table already exactly equal, making primary-key inference unnecessary. The unchanged reviewed comparison helper was rerun offline with conservative multiset matching for those identical tables and ID-keyed Auth digest comparison. No record values or account identifiers were printed. The reviewed source files were not altered, the diagnostic was not rerun, and no database requests were added.

## 2. Exact differences

| Category | Added | Removed | Changed | Finding |
|---|---:|---:|---:|---|
| 41 private/foundation tables | 0 | 0 | 0 | Full table arrays exactly match, including memberships, ownership, locations, history, private account security and factor bindings. |
| `auth.users` whole-row fingerprints | 0 | 0 | **1** | One existing account's computed fingerprint differs; no account was added or removed. |
| `auth.mfa_factors` whole-row fingerprints | 0 | 0 | 0 | IDs, order and full-row digests match. |
| Captured permission/RLS metadata | — | — | 0 | Policy, relation owner/ACL/RLS and column-ACL snapshots exactly match. |
| Captured table presence/shape | 0 | 0 | 0 | Same 41 application tables and row objects; no captured schema/security difference. This is not a claim about uncollected schema objects. |
| Prior C3A ledger rows | 0 | 0 | 0 | Both authorized rows match and remain present; the complete ledger table is unchanged. |
| C3B(a) notices | 0 | 0 | 0 | Both exact test records remain unpublished, unselected and unchanged. |

The target metadata also matches. This is **not merely a different ordering of Auth rows**: comparison keyed by account ID still finds one changed fingerprint. No actual identifiers or hash values are included in this report.

## 3. What the evidence cannot identify

The preservation collector stores `auth.users` IDs and SHA-256 of `to_jsonb(row)::text`, **not historical per-column values or per-column digests**. Consequently these two snapshots cannot recover which Auth column changed, its previous value, the update time, or its initiating event. A whole-row SHA-256 cannot be reversed into that missing evidence.

No account password/email/security change is proven. No harmless provider timestamp update is proven either. Source serialization within the hashed Auth row cannot be independently reconstructed from the stored digest. The changed fingerprint is therefore **unclassified and potentially security-sensitive**, not accepted as legitimate and not labelled corruption or compromise.

The diagnostic was READ ONLY, so it did not cause this Auth update. The fingerprint difference was already the cause of the earlier preflight mismatch. The inspected account, MFA, workspace and business data were not modified by either run; this does **not** mean the one pre-existing Auth difference is automatically approved.

## 4. Controls and preservation

Private admission, delivery, transport and session-policy readiness remain false, with strict policy selected and null notice selections. Release and pilot controls match the original closed state. The two inactive notices retain exact content hashes, `status='test'`, null approval/effective dates and no active selection. There were no new captures, dispatches, accepted consent versions, membership/ownership changes or history changes compared with the approved snapshot.

No Auth request, account creation, factor update, workspace operation, SMTP connection, worker launch, setting change, migration, Edge deployment, support message or external mail occurred. Strict Option A remains **BLOCKED under SU-519045**; no one-hour policy or other residual risk is accepted.

## 5. Exact consumed budgets

| Resource | This diagnostic | Cumulative D-family consumption |
|---|---:|---:|
| SQL requests | **51 / 51** | **120 / 192** |
| SELECT-only queries | **49 / 49** | **116 / 180** |
| Read-only transaction-control statements | **2 / 2** | **4 / 8** |
| Write-capable calls | **0** | **0 / 4** |
| DB connection attempts | **1 / 1** | **2 / 3** |
| Secret-metadata checks | **0** | **1 / 2**, historical earlier D check only |
| Worker launches/reservations | **0** | One earlier launch/five reserved minutes remain consumed |
| SMTP/Auth/Edge requests, emails, new accounts | **0** | **0** |

No capacity was reset, refunded or reused. The SQL transaction ended before encrypted local analysis. The process exited with its local comparison error; no live connection/process handle remains. The original D worker was not restarted. Remaining numerical capacity is not authorization for another operation.

Evidence: `artifacts/registration-preservation-drift-result.json`, `artifacts/registration-drift-offline-inspection.json`, the original terminal error/counts and the private `drift-diagnostic-{approval,attempt,budget}.json` plus counter files. Encrypted diagnostic evidence is under the artifact-referenced private `drift-evidence-*` manifest, marked `diagnosticOnly=true` and `replacementBaselineApproved=false`.

## 6. Baseline validity and safest next steps

The original approved snapshot remains **cryptographically valid historical evidence**. Its application/business/MFA/security portions still match. It does **not** match the current complete Auth state and cannot be reused as an unchanged whole-state preflight baseline. It has not been replaced, rebased or approved away.

Do not change an account, credential, timestamp or business record to recover the old hash. The safest next step is a separately reviewed, minimized investigation of the changed Auth row's metadata/audit history and relevant authorized activity. Current metadata/audit may help attribute the event, but cannot by itself reconstruct historical per-column data that was never retained. Any residual uncertainty must be presented explicitly before a baseline decision.

Only after the Auth difference is understood or explicitly reviewed may a separate decision approve a new independently retained preservation reference and an exact D retry. **The present evidence is insufficient to recommend resuming D now.** The diagnostic alone grants neither baseline acceptance nor a transport retry. Account-admitting registration remains subject to the separate unresolved strict session requirement.

## 7. Local diagnostic correction proposal — not installed or rerun

For a future reviewed diagnostic version, the narrow parser correction is:

```diff
-array_agg(a.attname order by k.position)
+array_agg(a.attname::text order by k.position)
```

The installed `pg` text-array parser (OID 1009) returns the array expected by the helper. Three additional offline tests and TypeScript pass: reproducing the name-array TypeError, validating the proposed text-array shape, and recovering the one Auth-fingerprint finding without a key registry when all application tables are identical. This proposal fixes local reporting only; it does not explain the Auth change. No reviewed source/SQL was edited and no hosted query was repeated.

Stop at this report. No new baseline, Auth inspection, corrective SQL, D retry, registration activation or delivery permission is inferred.
