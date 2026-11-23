# Mitsa — A current-state preservation capture PASSED

27 October 2026, Asia/Manila. **Capture and integrity verification PASSED. The candidate is NOT accepted. No Stage B operation occurred.**

## Exact authority and execution

Executed the user's explicitly resumed unused `A-current-preservation-v2` scope in isolated project `mjtejwafxriwntweussc`, marker `fireworks-foundation-proof-01a12e38`.

Reviewed manifest SHA-256: `7d354cffb5f50993167485b803de76d9f6be6cb1178dfa9407b08bfe39a13d55`. All **109 sources and 27 historical files** still match. No reviewed collector/query/permission source was changed to run this capture.

The corrected original private authorization was still within its exact 30-minute interval. A private explicit-resume record was saved; **no new window was required** and no allowance was reset. The original invalid/corrected authorization and earlier zero-query stop remain preserved. The earlier failed result was archived as `artifacts/current-preservation-preflight-stopped-execution.json` before the successful execution result was written.

Local target/evidence/hash/comparison/process/gate/unused-scope checks passed. The first approved SELECT verified the live marker, closed controls, registry and least-privilege prerequisites before fingerprints were read. No extra ping or hosted preflight call occurred. The transaction was `REPEATABLE READ READ ONLY`; it completed COMMIT, and the process/connection exited normally with code zero. The private capture attempt is now consumed and cannot be rerun as an unused scope.

| Resource | Actual / approved maximum |
|---|---:|
| Database connections | **1 / 1** |
| SQL statements | **54 / 54** |
| SELECT-only statements | **52 / 52** |
| Read-only transaction controls | **2 / 2**, BEGIN/COMMIT |
| Runtime including collection/encryption/offline bridge | **21.248 / 180 seconds** |
| Hosted database writes | **0** |
| Auth / Edge / SMTP requests | **0 / 0 / 0** |
| Workers / accounts / emails | **0 / 0 / 0** |

No query was retried, no second connection opened, and no additional hosted request was made during post-capture verification. SQL used by the historical bridge ran in local in-memory PostgreSQL only; it is not hosted consumption.

## Encrypted candidate and integrity

**Candidate-manifest SHA-256:**

`05206a18393390f9849ea5c2e3b3ae8a50f2b0e25f86bcdc0056ed02ab77318e`

The private candidate manifest is referenced by `artifacts/current-preservation-capture-result.json`; its ciphertext and decrypted payload digests validate. An independent offline continuation decrypted it again, checked its reviewed-source binding and repeated the historical comparisons. No raw credential representation, token, OTP, MFA secret, user row, account identifier or address was returned in the capture or printed in public evidence. Comparison keys remain inside encrypted evidence. No acceptance authority/file was created.

## Comparison findings

| Category | Result |
|---|---|
| All 41 application/foundation tables | **Match both historical captures** after offline keyed/canonical comparison; no differing table. |
| Memberships, ownership, locations, historical business records | **Preserved** by complete table comparison. |
| C3A ledger | Both exact authorized proof rows are present in the historical ledger; the entire current table matches. There are earlier ledger rows too; this is not a claim the table contains only two rows. |
| C3B(a) legal notices | Both exact installed test Terms/Privacy rows preserved, unpublished and unselected. Whole legal table matches; original test status and null approval/effective dates verified. |
| Auth accounts versus original baseline | **0 added, 0 removed, 1 changed whole-row fingerprint** — the already recorded historical incident. |
| Auth accounts versus diagnostic snapshot | **0 added, 0 removed, 0 changed**. No additional whole-row Auth change since that capture. |
| MFA fingerprints versus both captures | **0 added, 0 removed, 0 changed**. |
| Captured historical RLS/relations/column ACL metadata | **Match both captures**, no difference. |
| Installed C1 invariants | **23 function definitions/owners/ACLs/settings verified**, managed Auth privileges match, custom registration role not elevated, three private registration tables retain forced RLS, expected 24-migration corrective checkpoint matches. |
| Expanded v2 coverage | All Auth identities now fingerprinted; registry/types/PKs, roles/memberships, schema/default grants and wider function metadata captured for future comparison. Fields not retained historically are **not retrospectively proven unchanged**. |

The new candidate retains whole-row Auth hashes and separate keyed protected/activity fingerprints. These support future comparisons; historical snapshots did not retain the split fingerprints. Consequently the historical one-row change cannot now be assigned to a specific column or classified as harmless. No security compromise is established either. Its attribution remains **UNRESOLVED**.

The secondary offline verifier initially assumed the full replay ledger contained only two rows. It was corrected to identify the two actual C3A proof rows and verify full-table equality; no hosted query was repeated, candidate changed or extra record accepted. Final independent verification passed.

## Controls, preservation and budgets

Admission, delivery, transport and session-policy readiness remain false, strict policy selected, Terms/Privacy selections null, and release/publication/pilot/SMTP gates closed. No provider configuration, hook selector/body, role/grant/RLS policy, account/factor, workspace, location, membership or ownership was modified by this READ ONLY execution. No service, Gmail connection, worker or onboarding test ran.

All original snapshot/manifest bytes, the unexplained incident, prior failed/diagnostic outcomes and spent budgets remain intact. The original D-family still records **126 SQL / 120 SELECT / six controls / zero writes / three connections**. This new A family independently consumed **54 SQL / 52 SELECT / two controls / zero writes / one connection**. No prior budget was reused or refunded.

Strict Option A remains **BLOCKED under SU-519045**, with no one-hour policy or other session-risk exception accepted. A new current-state reference is not evidence that terminal refresh reuse now denies renewal or protected resources.

## Separate A acceptance decision

**The candidate meets the reviewed acceptance conditions:** historical application/MFA/security comparisons match, original Auth difference is exactly one known row, and there is no additional Auth difference since the diagnostic. Acceptance is still a human decision acknowledging the historical attribution gap; it is not automatic or a finding of harmlessness.

Exact proposed wording:

> I approve A-current-preservation-v2-acceptance for candidate manifest SHA-256 05206a18393390f9849ea5c2e3b3ae8a50f2b0e25f86bcdc0056ed02ab77318e. Accept it solely as the current operational preservation reference. Retain all original snapshots and the unresolved historical Auth difference, including the limits of historical identity coverage. This does not declare the old change harmless, satisfy Strict Option A, accept a session-security exception, or approve Stage B, SMTP, workers, accounts, email delivery or registration activation.

After that explicit approval, the unchanged local acceptance procedure may create the exact-hash reference with **zero hosted requests**. Until then the candidate remains unaccepted and the original baseline remains historical evidence.

**Stage B:** locally prepared and eligible for its own approval after A acceptance. Acceptance alone does not authorize its connection/worker/TLS test. A separate B approval must retain its exact new budgets and chosen preservation rule. No B approval or attempt exists.

Evidence: `artifacts/current-preservation-capture-result.json`, `artifacts/current-preservation-candidate-verification.json`, retained private A authorization/attempt/budget/ciphertext manifests and original historical evidence. Stop at the acceptance decision; no further hosted action is authorized here.
