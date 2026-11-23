# Mitsa — targeted Auth metadata inspection result

27 October 2026, Asia/Manila. **Inspection PASSED; historical attribution remains INCONCLUSIVE.** No baseline acceptance/replacement or Stage D transport retry occurred.

## 1. Approved execution

Executed `D-auth-metadata-audit-readonly-v1` exactly once against isolated project `mjtejwafxriwntweussc`, marker `fireworks-foundation-proof-01a12e38`. Reviewed manifest SHA-256 remains `180d2c49f722a1543e68d5c83216338f43bf3a383bb623a3dfe8c8adc8f4ea63`.

Local preflight verified every pinned source/query/evidence hash, both snapshots' ciphertext/plaintext digests, exactly one changed account derived in memory, equality of the 41 historical application tables/MFA fingerprints/captured security metadata, closed local gates, private-file Git exclusion, unused inspection scope and authoritative absence of the earlier worker process. Both old snapshots, historical records and spent authorizations remain intact. The database marker and current closed controls were then verified by the first approved SELECT before any account metadata query. No separate ping/catalog request occurred.

The reviewed package contained query sources only. A local one-shot execution wrapper enforced the exact statements, private bound parameters, durable request reservations, one connection, no retry, timeouts and encrypted evidence handling. Its hash is recorded in the private human authorization/attempt record. Seven new offline execution tests and TypeScript passed before connecting; the pinned package and its 15 earlier parser/query tests were not changed or needlessly rerun.

## 2. Sanitized findings

| Question | Verified result | Limit |
|---|---|---|
| Was relevant activity observed? | Current sign-in and account-update timestamps both fall within the approved enclosing evidence window. | They are not equal. Neither timestamp identifies the historical field that changed. The enclosing window is wider than the exact capture interval. |
| Is legitimate activity plausible? | Yes: the activity metadata is compatible with legitimate account use/provider metadata maintenance. | This is a plausible explanation, not an attributed cause or proof of harmless drift. |
| Are selected current security/status flags concerning? | Email verified; not deleted, currently banned, anonymous, SSO or marked privileged; audience and Auth role match expected ordinary-user values. | Only approved current flags were inspected. Historical credentials, identity values, unrestricted metadata and changes to them were not inspected or ruled out. |
| Is MFA consistent? | One verified TOTP factor; no other factor aggregate returned. This is consistent with expected enrollment. | The current aggregate does not prove the exact same factor identity/secret or a complete unchanged factor history. No factor IDs/secrets were selected. Historical captures' MFA fingerprints still match each other. |
| Are audit events available? | Audit columns were present/readable; the approved affected-account/time-window query returned **zero matching events**. | No sample truncation, but completeness is **not established**. Database audit storage configuration, retention, event coverage or timing may explain the gap; none was determined or changed. Empty results do not prove no activity. |
| Can the original fingerprint change be classified confidently? | **No.** Sign-in/update activity supports a possible explanation but not a specific historical column. | Old snapshots retained whole-row hashes only, and no matching audit event was available to attribute the write. No security compromise or harmlessness is established. |

No account identifier, address, raw timestamp, row value, credential, query parameter or raw audit payload is included here. The inspection did not retrieve password representations, OTPs, recovery/refresh tokens, MFA secrets or authentication keys. The apparent lack of concerning selected flags must not be generalized to a complete historical credential-integrity verdict.

## 3. Exact consumption

| Resource | This inspection | Cumulative D-family |
|---|---:|---:|
| Connection attempts | **1 / 1** | **3** |
| SQL statements | **6 / 6** | **126** |
| SELECT-only statements | **4 / 4** | **120** |
| Read-only transaction controls | **2 / 2**, BEGIN/COMMIT | **6** |
| Runtime, including connection and teardown | **3.562 seconds / 120** | No timeout |
| Database writes | **0** | **0** |
| Auth/Edge/SMTP requests, worker launches, emails | **0** | No additional consumption |

The audit SELECT used the exact approved SELECT-only CTE. No SQL failed or was repeated. All four SELECT responses were encrypted immediately into private evidence stages, read back, decrypted and digest-verified. The final encrypted evidence was independently decrypted/digest-verified offline after execution. No plaintext response file was created. The process exited successfully; the read-only transaction committed and the connection closed. No subsequent hosted request was made.

The previous one-launch/five-minute transport reservation, earlier metadata request and earlier failed/diagnostic SQL budgets remain consumed without refunds. This inspection uses the third D-family connection; a future transport retry cannot infer another connection from the old allowance.

## 4. Preservation and controls

The current live guard confirmed persistent admission, delivery, transport and session-policy readiness false, strict policy selected, notice selections null, release/publication/disposal gates closed and pilot/SMTP flags false. Nothing was temporarily enabled. The reviewed source manifest and original encrypted evidence/counters/failure records remained intact except for the explicitly consumed cumulative SQL/connection counters. Both historical C3A rows, C3B(a) notices, existing accounts/MFA/business data remain preserved in the unchanged historical evidence; this narrow inspection is not a new whole-database snapshot.

READ ONLY execution made no account, session, factor, workspace, ownership, membership, history, setting, policy, migration or service change. No account/email was created by this diagnostic. No worker/transport retry or authentication experiment ran. Strict Option A remains **BLOCKED under SU-519045**, with no residual session-risk exception accepted.

Evidence:

- `artifacts/registration-auth-metadata-inspection-result.json`: actual one-shot execution outcome, counters and encrypted evidence-manifest reference.
- `artifacts/registration-auth-metadata-inspection-assessment.json`: independently verified offline assessment and explicit limitations.
- Private `.secrets/registration-auth-review/`: human approval, single-attempt claim, budgets, terminal record and encrypted response stages. Public summaries contain no private identifiers or timestamps.
- The original reviewed manifest and old baseline/drift ciphertexts are unchanged. The two original diagnostic source versions remain archived; their authorized parser correction does not erase the original mismatch.

## 5. Baseline and next safe step

The original preservation baseline remains cryptographically valid historical evidence. It still cannot satisfy an unchanged-current-whole-state preflight because the known Auth difference is unclassified. This inspection does not authorize accepting it, replacing it, ignoring Auth fields or modifying an account to recover the old hash.

**A new preservation baseline is appropriate for separate review, not automatic creation or approval.** That review must explicitly address the missing historical per-column/audit evidence and decide whether the remaining uncertainty is acceptable for a new operational reference. This is distinct from, and cannot relax, Strict Option A. If stronger historical attribution is required, obtain provider-held activity evidence through a separately approved, minimized request rather than repeating the same empty SQL query.

The exact next safe step is the human baseline decision informed by this report. Any new-baseline proposal must retain both old captures and this mismatch, specify preserved sensitive invariants, obtain fresh approval, and validate fresh encrypted capture/digests under separately bounded read-only scope. No such scope is executed or assumed here. Only afterward may a separately reviewed/approved Stage D transport retry use fresh budgets and preflight checks. Registration activation remains independently blocked by Strict Option A and the outstanding staged-test approvals.

Stop after this report. No baseline, transport, email, account creation or activation action follows automatically.
