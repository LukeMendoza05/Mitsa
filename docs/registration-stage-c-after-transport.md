# Mitsa — Stage C requirements after verified transport

Stage B v3 is **PASSED** with actual Gmail TLS/login, worker health, rollback, exact preservation and natural exit in 40.783 seconds. Preserve that result; no new baseline or transport investigation is required merely to prepare C. This document authorizes no execution.

## What Stage C must establish

An actual provider-issued signup code is encrypted/captured, correlated with the correct durable dispatch and authorized recipient, sent once to the approved inbox, received and confirmed, then verified through Supabase. Test invalid/replayed/expired codes, resend/cooldown and safe uncertain-delivery handling without using retained developer/Yuno accounts. SMTP login alone already passed and must not be presented as delivery evidence.

## Exact pending local integration

The existing specification is `scripts/lib/registration-acceptance-protocol.mjs#acceptanceProtocol.C`; its append-only budget adapter is `scripts/lib/registration-final-budget.mjs`. The installed worker is `scripts/lib/persistent-mail-worker.ts`, with the existing private Gmail/crypto, correlation, signing and bounded-message safeguards retained. These components are implemented; **the final C-specific executable Auth/browser/provider/control runner is not complete/source-frozen yet**. Do not solicit execution approval as if a protocol table alone were that runner.

Before the one consolidated C execution request:

1. Wire the budget adapter to every direct SQL, signed service command, Auth request, worker heartbeat/claim/complete, SMTP verification/send and browser-generated request. Failed/uncertain attempts consume capacity. Freeze complete transitive sources and an exact fresh-scope manifest; missing/unreviewed calls must fail closed.
2. Bind only the existing two private fresh fixtures `c3b-a`/`c3b-b` to the dedicated authorized inbox. Recheck nonexistence before creation; collision stops. Never invent replacement aliases, print addresses, use retained accounts or manually verify users. Keep credentials, codes and recovery material encrypted/private; human inbox receipt is an explicit evidence checkpoint.
3. Complete the exact correlation/hook/provider tests offline, then freeze the activation/control SQL, idempotent requests, consent versions, worker lifecycle and shutdown/recovery paths. Keep actual notices unpublished; use only the two approved test documents and synthetic participation. Define secure continuation for pending verification when new admission stops.
4. Keep the security prerequisite enforced: current `assertAcceptancePrerequisites` requires either **Strict Option A proven** or a separately approved precisely scoped development exception. Strict A is still unresolved and the user has not accepted an exception. No approval to enable `session_policy_ready`, select the one-hour proposal or weaken direct Auth/resource checks is implied. No new risk-decision request is being substituted for the user's existing strict choice.

## Existing proposed ceilings — not yet execution approval

These are inherited from the consolidated protocol, not newly granted allowances. The final executable review may reduce them; any changed scope must be explicitly approved:

| Category | Proposed C ceiling |
|---|---:|
| New synthetic accounts | 2, only c3b-a/c3b-b |
| Supabase Auth requests | 30 |
| Signed registration-service commands | 48 |
| Protected resource requests | 0 |
| Direct SQL / write-capable calls | 9,000 / 8,000, including worker polling |
| Authentication email attempts | 6, only the two private fixture recipients |
| Worker launches / total runtime | 1 / 90 minutes |
| SMTP verification calls | 3 |
| New MFA factors / workspaces / locations | 0 / 0 / 0; those belong to later D/E scopes |

Retain shared 10/hour, 20/day and 60-second recipient controls across sending paths. Count uncertain SMTP outcomes as spent and never replay a claimed message. Explicitly document any temporary admission/delivery changes, their exact live prerequisites and independent shutdown controls. A future real-mail run has expected durable account/consent/intent/dispatch/capture records; unlike B it is not a rollback-only/no-committed-change test. Those side effects require separate exact approval.

## Preservation, recovery and next approval

Use accepted A as the historical operational reference and B's verified exact postflight as the latest transport evidence. Initial checks must reject unapproved changes. Before creating fixtures, define the exact expected new-record delta; preserve all retained rows/security invariants, compare those independently after testing and encrypt evidence. Do not reuse exact-whole-state equality as if authorized fixture creation should leave no records. Do not replace A or classify unexpected drift automatically.

On failure: stop admission/delivery according to the reviewed failure class, terminate only the bound worker, retain pending/uncertain claims and budgets, preserve test records and encrypted evidence, and request a specific correction if needed. Do not resend automatically, delete users, reset factors, roll back historical records or open another window without scope authority.

The **next execution approval** must explicitly bind the final C manifest/hash, exact target/marker, allowed private fixtures and recipients, account/email/request/SQL/worker budgets, notices and temporary control settings, expected durable deltas, shutdown/recovery protocol, and the satisfied/explicitly selected security path. None is granted by B v3. Until that source-bound package and prerequisite exist, C is **preparation pending / hosted execution blocked**, not READY for real email sends.

General registration, production/legal publication, Vercel, unrelated provider changes and retained-account modification remain excluded. D/E/F/G/H are separate milestones. Safe local runner preparation can continue independently of the pending Supabase response, but cannot masquerade as hosted acceptance.
