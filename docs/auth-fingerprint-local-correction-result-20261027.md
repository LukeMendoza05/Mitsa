# Mitsa — local Auth-fingerprint follow-up checkpoint

27 October 2026. **Local work PASSED; Auth-change attribution remains INCONCLUSIVE. New hosted inspection requires approval.**

## Completed

- Corrected `scripts/lib/registration-preservation-diff.mjs`: `array_agg(a.attname::text order by k.position)`. The SQL now produces text[] (OID 1009), matching the installed pg parser's array shape. No change to Auth hashing or comparison rules.
- Archived the two pre-correction source files byte-for-byte under `docs/history/stage-d-drift-1119c4a8-source/`; hashes match the already-consumed diagnostic manifest. `artifacts/registration-parser-source-archive.json` records both. The old diagnostic manifest remains unchanged and consumed; its current-source check intentionally no longer passes for the two authorized revisions. It must not be regenerated or reused as a fresh execution approval.
- Removed one test's dependence on the real private approval-file absence. Missing-approval denial now runs in a hermetic temporary fixture workspace, leaving consumed approvals and counters alone.
- Added SELECT-only query definitions, one-account evidence selection and sanitized reporting in `scripts/lib/registration-auth-metadata-review.mjs`; no network client or live execution entry point exists in that module.
- Prepared the exact rendered SQL/source/evidence-hash manifest `config/registration-auth-metadata-review.json` and [single approval package](stage-d-auth-metadata-inspection-approval.md).
- Prepared a [future preservation classification design](auth-preservation-classification-design.md). It is not adopted or applied to the current/historical baseline.

## Verified offline evidence

`node .tools/prepare-auth-metadata-review.mjs` decrypted both original captures, validated ciphertext and decrypted-payload digests, identified exactly one affected UUID in memory without printing/storing it in a new plaintext file, and checked the snapshots and consumed evidence/counter files remained byte-for-byte unchanged. All 41 application/foundation table arrays, captured security metadata and MFA fingerprints still match between those historical captures. The one Auth fingerprint mismatch is retained. The original 21 transport sources and 74 shared sources still match their frozen manifests. `artifacts/registration-auth-review-local-result.json` records the sanitized result.

There has been **no current hosted reinspection**. The old snapshots contain only Auth IDs and whole-row digests; they cannot establish the changed field, initiator, precise time or legitimacy. The account is internally identified but not named in this checkpoint. Legitimate provider activity is a hypothesis, not an accepted explanation. Current credential changes cannot be ruled out from this evidence, and no forbidden credential/token fields will be retrieved by the proposed inspection.

## Tests

1. `npx vitest run --project unit tests/unit/registration-auth-metadata-review.test.ts tests/unit/registration-preservation-diff.test.ts tests/unit/registration-drift-offline-recovery.test.ts`: **15 passed**, three files. Exact SQL tested in offline PGlite, actual pg array decoder tested, other-user exclusion, private-output suppression, missing audit storage, audit truncation, ambiguous identity rejection and missing-approval denial covered.
2. `npm run typecheck`: **passed** after the changes.
3. The initial focused run failed to open a transient Vitest cache file before one suite loaded. Rerunning with TEMP/TMP set to the existing workspace-local `artifacts/local-test-temp` resolved the local filesystem issue; all focused tests then passed. No production/runtime setting was changed.

No full browser/build suite was needed for this isolated diagnostic-library change; no application interface or authentication flow was altered. No hosted regression, Auth/API request, SQL query, worker, SMTP connection, email, account mutation, migration, baseline replacement or provider-setting change ran in this task. Existing D-family counters remain 120 SQL / 116 SELECT / 4 transaction controls / 0 writes; two connections, one earlier metadata request.

## Decision boundary

Approve only the proposed one-connection, six-statement, two-minute READ ONLY inspection if desired. It may still leave attribution inconclusive because optional audit storage, retention and historical column evidence are limited. A new preservation reference requires a separate reviewed decision; the original remains valid historical evidence but is not an unchanged current whole-state baseline. Any Stage D transport retry requires its own approval/source/budget/preflight. Strict Option A remains BLOCKED under SU-519045; registration/delivery remain disabled and no session-risk exception is accepted.
