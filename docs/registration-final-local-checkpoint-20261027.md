# Mitsa — master registration continuation checkpoint

27 October 2026, Asia/Manila. **Inactive local implementation advanced; persistent general registration is not enabled or accepted.** No hosted project request, worker, SMTP connection, account, message, migration, provider setting, baseline capture or risk acceptance occurred in this continuation.

## Implemented now

1. `scripts/lib/current-preservation.mjs`: v2 database-side keyed row fingerprints for all 41 application/foundation tables plus Auth users/MFA/identities; retained whole-row Auth hashes; separately protected versus two declared activity fields; registry, unknown-field, duplicate-row and 10,000-row-per-table stop checks; captured policies/ACLs/schema grants/default privileges/roles/function hashes/migration state. No raw credential/token/MFA-secret column is returned.
2. `scripts/lib/current-preservation-security.mjs`: checks the installed C1 function/owner/ACL/search-path baselines, managed Auth privileges, unprivileged registration role, forced RLS and corrective migration checkpoint from the approved SELECT results, without additional queries or grants.
3. `scripts/lib/legacy-preservation-bridge.mjs` and `preservation-private-evidence.mjs`: offline PostgreSQL canonicalization bridge, encrypted candidate save/readback/digest validation and retained original history. Numeric/serializer limitations remain explicit; mismatches never become silent acceptance.
4. `scripts/capture-current-preservation.mjs` and `accept-current-preservation.mjs`: separate approval-gated read-only capture and later explicit local acceptance. Missing authority stops before connections/key creation; capture never writes an accepted reference. Historical unknown Auth attribution is not relabelled benign.
5. `scripts/registration-transport-retry.mjs`: independent new attempt/budget, supervised no-send worker, one TLS/login verify, rollback-only control changes, encrypted pre/post preservation, bounded read-only reconciliation and no automatic retry. It cannot run without the separately accepted reference.
6. `registration-final-controls.mjs`, `registration-acceptance-protocol.mjs`, `registration-final-budget.mjs`: finite stage/request limits and durable append-only operation reservations. Failed/uncertain requests remain consumed; restart cannot refund capacity; unapproved identities and unknown security/runner prerequisites are rejected. Actual C–F browser/Auth/control sequencing and worker integration still require final review against the approved security path.

The new [A–H consolidated approval package](registration-final-approval-package.md) contains affected services, exact source references/hashes, limits, recipients, dependencies, failure/recovery and selectable wording. [Security decision](registration-final-security-decision-20261027.md) and [acceptance/internal handoff](registration-final-acceptance-and-handoff.md) keep independent work separate from release gates.

Final review manifest SHA-256: **7d354cffb5f50993167485b803de76d9f6be6cb1178dfa9407b08bfe39a13d55**. It binds **109 sources and 27 historical evidence files**. No private approval or new accepted reference exists.

## Verification

- **80 OFFLINE tests passed:** 75 across capture/security/bridge/controls/entrypoints/protocols and reused worker/mail/transport behavior, plus five durable request-ledger cases. JSON results: `artifacts/registration-final-offline-verified.json` and `artifacts/registration-final-budget-tests.json`.
- **TypeScript passed** after correcting the new ledger's inferred empty-object result type with an explicit dictionary type. No runtime security logic was relaxed.
- Actual new A/B `--check` entrypoints passed with zero connections/requests; B correctly reports no accepted A reference. No ordinary worker `--check` command was used, because that existing command connects to the hosted database.
- Source/evidence/privacy audit passed: `artifacts/registration-final-local-readiness.json`. Private values absent from reviewed content; private paths ignored/untracked; old ciphertexts/digests/counters intact; all 74 shared application sources and 20 transport runtime/other sources unchanged.
- An initial broad run had **74 pass / one fail** because the historical transport-denial test assumed the actual now-consumed approval did not exist. The real old approval was not deleted. Its reviewed test bytes were archived and hash-verified; the test now exercises the actual operator in a hermetic temporary workspace. The successful 75-case run verifies the correction. The failed-run JSON is retained, and the consumed original manifest is not regenerated or executable again.

No app screen/runtime/dependency was changed; production build and old browser journeys were not rerun without a relevant code change. Prior build/browser evidence is historical, not evidence of current persistent-engine hosted acceptance.

## Precise milestone status

| Item | Status | Meaning |
|---|---|---|
| Existing Stage A/C1/C2/C3A/C3B(a) | PASSED | Their recorded scopes remain intact; no reinstall/replay. |
| New current-state preservation | READY | Capture tooling/tests complete; A capture and later acceptance are unapproved. |
| New Stage D connection-only retry | READY | Inactive implementation tested; needs accepted A and B approval. The original hosted attempt remains FAILED at preservation preflight. |
| Real persistent email delivery | NOT STARTED | No new transport or message run; legacy Gmail receipt is not new-engine evidence. |
| New-engine MFA/returning login/recovery | NOT STARTED | Existing legacy journeys/hardening passed historically; no retained identities were used again. |
| New-engine workspace/tenant acceptance | NOT STARTED | New disposable tenants and direct-API/RLS assertions remain to execute; existing records unchanged by local-only work. |
| Hosted restart/stability | NOT STARTED | Guards and tests are local; actual F evidence still required. |
| Strict Option A | BLOCKED | SU-519045 response/supported correction and approved passing regression still required. |
| General registration activation | NOT STARTED | Disabled; H has no executable allowance. Legal/operational/security decisions remain. |
| Independent internal local development | READY for a separately specified scope | Existing authorized login/workspace architecture can support local work; no business modules implemented or publicly exposed here. |

## Immediate approval and later boundaries

Recommended next selection: **A capture only** — one connection, at most 54 SQL statements (52 SELECTs + two read-only controls), 180 seconds, zero writes/Auth/SMTP/accounts/workers. This creates only an encrypted candidate, not an accepted baseline. The manifest and explicit source/limits are in the consolidated package.

B may be selected conditionally in the same response, but its single five-minute no-email probe will not execute until A is explicitly accepted. New B allows at most two connections/180 statements/four rollback-only write-capable calls/one SMTP verify; the second connection is reconciliation only within the remaining window. All historical consumption stays recorded.

C–F need their final integrated request/browser/worker protocol reviewed and an approved/enforced security path before account admission; their finite proposed caps are consolidated rather than invented at each retry. G currently has no authorized live correction or test. H requires actual acceptance, legal applicability, password/provider decisions, monitoring/delivery suitability and explicit activation approval. Current test notices and development Gmail cannot silently authorize ordinary real businesses.

The latest public Supabase release remains the previously reviewed source version; no new documented self-service correction was identified. Retained-session/source-path hypotheses are not hosted remediation evidence. No support follow-up was sent, no one-hour risk was accepted and no managed Auth table was changed.

Stop at A's genuine hosted approval boundary. Do not restart completed diagnostics or use a repeated Goal continuation as permission. Continue future safe local implementation under the master scope when useful, but never mark full registration complete without the actual acceptance evidence.
