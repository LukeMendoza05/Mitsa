# Mitsa — C3B(a) stopped before installation

**Historical attempt.** A separately authorized fresh retry later diagnosed the runner's incorrect zero-trigger assertion and completed installation successfully. See [24 October retry result](stage-c3ba-retry-result-20261024.md). The counts and uncertainty below describe the evidence available at the original stop; the historical 120-request allocation remains unchanged.

24 October 2026, Asia/Manila. **NOT INSTALLED.** The user's conditional approval required stopping if preflight failed. No write transaction was attempted; no retry is authorized by this report.

## Approved source and target

Candidate: `supabase/security-proposals/persistent-registration-test-notices.sql.txt`.

SHA-256: `ced89e0a97f9b96cb25902ce6ed4ae97a2b8c15df520ab81beab9e22c6f16538`.

The source hash and 74-source review manifest matched. Supabase management returned the expected healthy isolated project `mjtejwafxriwntweussc`; direct database checks verified marker `fireworks-foundation-proof-01a12e38`. No SQL bytes, hook selector/body, deployment, source bundle or provider setting were changed.

## Actual execution

- Initial preflight used **70 counted read-only database requests**. The corrected C1 catalog validation completed: 23 function definitions/owners/permissions, managed Auth restrictions, forced RLS, migration history and closed controls matched. Full preservation collection completed, but the runner stopped before saving its fresh encrypted baseline/preflight checkpoint. Its original catch recorded only the broad `preflight-snapshot` stage; it did not retain the exception class or sufficient substage detail. **The original cause is unconfirmed.** Do not label it a provider regression, data loss, permissions failure or confirmed filesystem error.
- A single subsequent **50-request SELECT-only diagnostic** used the approved read-only budget to reconcile the stop, not to retry installation. It saved and decrypted an encrypted diagnostic snapshot. The exact local C3A comparator then passed: the two authorized ledger additions match; every other private/foundation row, Auth account/factor digest and captured permission/RLS metadata match the original preservation evidence. No new notice ID/version collision exists.
- Total: **120/200 read-only database requests, 0/1 installation requests, zero new notice rows**. No Auth request, account/session/factor creation, recovery link, email, SMTP connection, worker, migration or configuration write occurred. Registration/delivery/transport/security-readiness and publication controls remain closed. Existing policy selections remain unchanged.

The diagnostic proves the currently collected preservation state matches; it does not explain the earlier discarded error or convert that failed preflight into an installation approval. Retained developer/Yuno accounts, authenticators, businesses, ownership, memberships, locations and history were not modified. C1/C2/C3A results and both prior C3A ledger rows remain preserved.

## Local safeguards and tests

Added `scripts/lib/test-notice-preservation.mjs`: pins the exact approved SQL hash/text; accepts only the two specified `status='test'` rows with null publication fields and bounded database creation times; rejects any other retained-data/security/ledger change. **Eight local tests passed**, including source drift, notice publication/content/hash drift, extra rows and preserved account/ledger/RLS changes. TypeScript and operator syntax checks passed.

The stopped operator's failure reporting now distinguishes marker comparison, C3A preservation comparison, notice collisions, encrypted-baseline creation and checkpoint saving, with bounded error class/code only. It still cannot print private payloads, silently retry the installation or reset its consumed budget. This improves future evidence collection; it is **not a demonstrated fix for the unknown original cause**. No second preflight or write was run after this change.

Evidence: `artifacts/stage-c3ba-notices-result.json`, `artifacts/c3ba-preservation-offline.json`, private `.secrets/stage-c3ba-notices/budget.json` and the artifact-referenced encrypted diagnostic. No install-attempt file or successful preflight checkpoint exists. No rollback/recovery write was needed because nothing was installed.

## Next boundary

Fresh explicit permission is needed to resume after this preflight stop, as the user required. Proposed continuation retains the same exact SQL hash, one unused atomic two-row installation slot, closed controls and all preservation conditions; uses a fresh read-only preflight/postflight allocation of at most 200 requests; preserves the original 120-request audit rather than resetting/deleting it; and stops again on any failed condition. No C3B(b), D, E, F, accounts, mail, worker or provider setting is included.

Do not use the expired/failed checkpoint or rebase away an unexplained data difference. The diagnostic snapshot is retained as evidence, not silently adopted as an approved replacement baseline. Strict Option A remains unresolved under SU-519045 and is unrelated to this preflight-runner stop.
