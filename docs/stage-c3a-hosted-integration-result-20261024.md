# Mitsa — C3A no-account hosted integration PASSED

24 October 2026, Asia/Manila. Executed the exact approved protocol in `stage-c3-hosted-integration-preparation.md`; that reviewed protocol was not edited. C1 was not reinstalled and C2's exhausted smoke budget was not reused.

## Actual hosted results

| Slot | Result | Evidence |
|---|---|---|
| 1 | 401 | Missing private signature denied; no ledger addition. |
| 2 | 401 | Foreign-project signature denied; no ledger addition. |
| 3 | 401 | Stale signature denied; no ledger addition. |
| 4 | 400 | Unsupported signed action denied; no ledger addition. |
| 5 | 200/null | Unknown synthetic submission; exactly one signed request-ledger addition. |
| 6 | Generic 503 | Exact slot-5 replay denied; no second row for that request. |
| 7 | 200/null | Independent unknown submission; second and final ledger addition. |
| 8 | HTTP 401 with PostgREST `42501` | Exact `permission denied for function mitsa_registration_command` from the direct anonymous Data API call. This is database denial, not a gateway-only 401. No ledger addition. |

Exactly **8/8** slots used, no retry, no hidden ninth disabled-endpoint probe. Only the hosted service enable secret was temporarily true and restored false in the runner's finally path. CLI secret metadata afterward matched the entire preflight set again. Local configuration stayed false/legacy. No signed prepare/claim/mail authorization, Auth user request, factor request, SMTP connection, worker start or account/business creation occurred.

## Preflight and preservation

- Healthy exact isolated project/marker, seven approved source hashes, six retrieved service sources and five legacy sources matched. Corrected C1's 23 definitions, owners, ACLs and required service schema/function privileges passed; direct anonymous/authenticated command EXECUTE remained denied. Custom registration role still has no managed Auth schema USAGE. Private registration tables retain forced RLS.
- Fresh encrypted preservation snapshot was round-trip decrypted and compared with the prior C2 preservation evidence. Complete postflight comparison permitted only the two exact privately recorded request hashes/signed times and execution-bounded received times. Every prior ledger row, all other rows across **41 private/foundation tables**, Auth account/factor digests and relation/policy/column ACLs matched. The baseline contains no raw Auth password/factor/session secrets.
- Per-slot comparisons verified zero changes for slots 1–4, one ledger addition for slots 5–6 and two for slots 7–8. All admission/delivery/transport/security-readiness, release and legacy pilot controls stayed closed; cohorts/dispatches remained empty. No DDL, managed Auth grants, provider Auth settings or hook selectors were written.
- Independent SELECT-only retained-developer and Yuno identity/MFA/ownership/location/history invariants passed. Existing hooks' reviewed bodies/permissions match. The latest dashboard selector observations remain C2's dated enabled-state check and the user's exact-name confirmations; no fresh dashboard selector read is claimed here.

The C3-specific encrypted preflight baseline and execution journal are referenced privately by the artifacts. The older generic C1 preservation pointer predates the two authorized C3A ledger rows; a naive comparison against that old pointer would now report those expected additions. Do not delete them or silently allow arbitrary deltas. Use the exact C3 expected-delta comparison, then adopt a fresh verified encrypted baseline before later approved work; retain both historical snapshots.

## Deployment observations

After the two service-flag updates, version counters changed: service **1→3**, legacy **4→6**. Both IDs, all retrieved source bytes, bundles, gateway settings and entrypoint/import-map paths matched. No function deployment was submitted during C3A. Counter changes correlate with the secret-write sequence; provider-internal causation remains unverified. The prior C2 legacy 3→4 observation remains historical and is not erased.

Service bundle: `dca295c28aaa37aea61b6a8db0849094f09f3eca40c42884f3f2d0494798819e`.
Legacy bundle: `70003dc2425a7c00b75ffeda59881a752e1dbb8cb1b95f3afcaddc66bd241af5`.
Hosted retrieval still omits deno.lock. Its approved submitted hash/frozen local dependency graph remain provenance; remote lockfile bytes are not claimed verified.

## Local work and evidence

Added the bounded no-account protocol and exact preservation-delta comparator in `scripts/lib/stage-c3-protocol.mjs`, with seven offline cases covering eight-slot limits, exact replay, failure-without-retry, gateway-only-401 rejection and unauthorized preservation deltas. Operator execution/preflight/postflight scripts remain in ignored `.tools`; their execution hashes are bound in the C3 preflight artifact.

The independent focused suite passed **64 tests across 13 files**, including the seven new protocol cases, corrected handler/SQL integration, worker fencing/crash/recovery, pending signup/status, recovery, CAPTCHA and login independence. Four additional offline PostgreSQL tests passed for the new **uninstalled** notice/delivery/admission/shutdown proposals, including preservation of uncertain claims at shutdown. Total fresh focused evidence: **68 tests, zero failed**. TypeScript and local privacy/source/package audits passed.

No Next application, form or landing source was changed in this continuation. Previously completed build, responsive/accessibility/UI, actual Gmail legacy verification, MFA and returning-sign-in evidence is retained and explicitly historical. No fresh retained-account login, hosted OTP/recovery round trip, inbox delivery, full persistent-engine onboarding, production build or browser pass is claimed by these C3 checks. The in-memory SQL model is not hosted encryption/provider proof.

Remaining local preparation includes a single source-hashed consolidated decision package, four exact private future fixture addresses (no accounts), and immutable synthetic test notices because current data has no matching test Privacy record. SQL candidates were executed only in PGlite. See [remaining approvals](registration-completion-approval-package.md) and `config/registration-completion-review.json` for dependencies, budgets and limits; nothing there is implicitly approved.

Artifacts: `artifacts/stage-c3a-preflight.json`, `stage-c3a-execution.json`, `stage-c3a-postflight.json`, `stage-c3a-independent-offline-results.json`, `registration-completion-controls-offline.json`, `registration-completion-review-audit.json`, retained C1 postflight/developer/Yuno preservation artifacts.

## Current status and next boundary

**Completed:** A, corrective inactive C1, disabled C2, no-account C3A. No recovery action needed. **Pending approval:** two inactive test notices, source-bound bounded execution tooling and the separately selectable C3B/D/E/F scopes. **External dependency:** Strict Option A under SU-519045 remains failed/unresolved; no new provider guidance or risk acceptance. **Not operational:** persistent general signup, live worker/delivery and real-user activation.

The next concrete decision is review of the single consolidated package. Its C3B(a) two-notice inactive addition can be selected independently. Actual account-admitting sections still require the approved strict security guarantee and their explicit operational approvals. Do not repeat C3A, the completed landing work or the historical refresh-reuse experiment while waiting.
