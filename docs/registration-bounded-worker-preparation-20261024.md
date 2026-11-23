# Mitsa — inactive bounded worker preparation

24 October 2026. Safe local continuation after C3A. **No D delivery approval or worker launch is inferred.** C1/C2/C3A are not repeated. Strict Option A and SU-519045 are unchanged.

## Implemented

- `scripts/lib/registration-mail-test-scope.mjs`: review/fixture/explicit-section binding; immutable, flushed local claims; exact-recipient hashes; 60-second cooldown; never-replayed dispatch IDs; per-phase 6/6/2 and shared 14-message caps; 12 SMTP verification slots; five launches and 300 reserved worker-minutes. Counters are retained over restart and later separately approved sections, not reset by a new approval record for the same review.
- `scripts/persistent-registration-worker-review.mjs`: local-only source/fixture check and inactive bounded run entry. Run requires a new private approval, exact reviewed generation and private dispatch/recipient/section mapping. Missing or mismatched authorization stops before loading operator/SMTP credentials or connecting to the database.
- `scripts/persistent-registration-worker.mjs`: extracted its existing operator operation into an import-safe function. Normal `--check`/`--run` behavior is retained; the opt-in entry wraps the existing transport/send hooks. The worker's database ownership, fencing, lease, heartbeat, queue claims, uncertainty handling and normal authentication architecture are unchanged.
- The consolidated manifest now hashes **74 sources**. The pending D proposal is corrected from four launches to **five**, accommodating C3B, E, F initial and F's two crash restarts. C3B/E can reserve 90 minutes each and F 40/40/40; no extra message or Auth budget is added.

No live approval record, dispatch map or live budget ledger exists. Only disposable local test directories were used for guard tests. Four future recipient aliases remain private and are still addresses, not newly created Auth users.

## Verification

**21 tests across four files passed, zero failed** in `artifacts/registration-bounded-worker-offline.json`: nine scope/adapter cases, four subprocess entry cases, seven existing worker behavior cases and the real child-process restart case. Some existing worker cases overlap the preceding C3A focused suite; do not add the counts as distinct new tests.

Coverage includes missing approval, source/fixture binding, exact recipients/sections, cooldown, job replay after restart, counters shared across instances/approved sections, phase/global exhaustion, SMTP-verification/launch/runtime limits, process-local leases, incomplete-claim/lock failure, adapter refusal without a send, import safety and absent-approval subprocess denial before credentials/network access. The child subprocess fixtures have no operator configuration or SMTP credentials and make no live requests.

TypeScript, syntax, the 74-source manifest/private-fixture audit and the unchanged Stage A/C2 source/privacy audit passed. Existing public assets were scanned; no new production build or browser pass is claimed for these operator-only changes. A single approved SELECT-only normal-worker `--check` also passed against the isolated target: schema installed, admission/delivery false, zero SMTP connections and no ownership acquisition.

## Limits and remaining boundary

This is narrower **test-operation control**, not an authentication/security fix. It does not resolve terminal refresh-family invalidation, accept a one-hour policy, start a worker, grant fixture access or enable registration/mail. Database global/legacy quotas and worker fences still apply in addition to the local test budget.

Expiry blocks new network authorizations and stops the worker loop. Already-started SMTP can finish/fail within transport timeouts; this local lease alone is not proof of a hard process/SMTP cutoff. Future approved supervisor/cleanup tests must enforce the final runtime ceiling, reconcile uncertain sends and execute only the reviewed control-stop operation. Stale/incomplete local claims fail closed and require explicit reconciliation; no capacity is silently returned.

Actual Auth/provider protocol execution tooling still depends on the selected scope, provider correction and fixture state. Its source must be shown/hashed before hosted execution; this package never approves unknown future code. The [single consolidated package](registration-completion-approval-package.md) remains the only remaining-work decision document. No new approval question, provider message or hosted security experiment was issued by this continuation.

The next restricted action remains independently selectable C3B(a), the two immutable inactive test notices. Account-admitting tests require the strict security condition plus their separate C3B/D/E/F approvals. No production or general-registration completion is claimed.
