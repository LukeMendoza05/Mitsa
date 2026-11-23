# Mitsa — Post-C1 registration readiness and next approval

23 October 2026. Corrective C1 is installed and accepted. This continuation performed local/offline work and SELECT-only/catalog reads only. No migration, deployment, secret configuration, Auth request, account/factor mutation, worker launch, SMTP connection, signup activation or session-risk acceptance occurred.

## Milestone ledger

| Stage | Completed evidence | Remaining boundary |
|---|---|---|
| C1 | Installed migration `20261023134011`, exact approved hash, 23 reviewed functions and encrypted preservation comparison passed. No recovery needed. | Complete as inactive infrastructure. Not reinstalled or re-experimented in this continuation. |
| C2 | Seven unchanged deploy-source hashes; complete five-module/two-package static graph; frozen cached Deno check; ten actual-entrypoint fail-closed cases. Exact inactive deployment/three-probe proposal prepared. Fresh read-only target, command/schema/hook privileges and unchanged legacy bundle observed. | New endpoint absent; local signer absent. Deployment/secrets not authorized. Hosted secret-management access unproven. Hosted bundler/runtime and post-deployment 503 proof remain pending. |
| C3 | Three new offline tests bridge the real Edge handler to the corrected in-memory PostgreSQL command, demonstrating durable replay rejection, forged/stale/cross-project denial before commands, and direct browser-role denial. Existing route/hook/correlation/continuation tests remain available. | No live signed command, provider hook/correlation/OTP/recovery round trip performed. See restricted next-stage protocol below. |
| D | Existing persistent admission/delivery separation, durable claims, consent snapshots, fencing, supervision and budgets are implemented. Recovery/continuation routes and worker outage/uncertainty tests pass offline. | No supervised live worker, generation, policy applicability assignment, Gmail transport or persistent admission enabled. Sender/quotas/health and live consent applicability need their own review/approval. |
| E | Earlier controlled **legacy-engine** onboarding, MFA, workspace and returning sign-in remain completed historical evidence. No retained identity reused here. | Full new persistent-engine journey has not been live-tested. Requires supported strict-session resolution and separate synthetic identity/email/workspace test authorization. |
| F | Local transport/database outage recovery, uncertainty retention and real child-process crash/restart tests pass. | Actual hosted service/worker restarts, real delivery failure, quotas and emergency stop still require an activated, approved test scope. Do not label the whole stability stage passed. |
| Strict Option A | Existing failure/regression and support request SU-519045 preserved. No new provider experiment. | **BLOCKED** pending supported terminal refresh-family invalidation and separately approved regressions. No bounded-session exception accepted. Blocks activation, not inactive C2 preparation/deployment review. |

## C2 implementation and checks

New local files:

- `config/stage-c2-disabled-service-proposal.json`: exact project/marker, seven source hashes, entrypoint/import map, disabled flag, legacy engine, unchanged legacy version/bundle fingerprint and exactly GET/POST/GET smoke methods.
- `scripts/lib/stage-c2-review.mjs`: pure review guards. Reject target/source/activation/budget drift before file access; verify the full static import closure; reject unreviewed dependencies and unexpected Edge services sharing the secret boundary. Validate both function EXECUTE **and schema USAGE**, avoiding the prerequisite mistake from original C1.
- `scripts/verify-c2-disabled-service.mjs`: local-only command. Checks protected/untracked configuration, absence of a public signer variable and unchanged reviewed source; can validate explicitly dated saved catalog evidence without pretending it is a new network check. It cannot deploy, set secrets, call Auth, or connect to SMTP.
- `tests/unit/stage-c2-review.test.ts`: 28 review/permission/package cases. `tests/unit/persistent-service-database-boundary.test.ts`: three actual handler-to-corrected-SQL bridge cases.
- `tests/edge/persistent-registration-runtime.test.mjs`: expanded from two to ten cases. Complete-but-disabled, noncanonical enable flag, wrong project/origin, missing provider/public/private configuration and malformed signer all return generic 503/no-store for GET/POST. Actual imports run in Deno; its listener is replaced and network/subprocess access denied.

The deployed seven-file graph itself is unchanged. A valid HMAC proves the private server envelope, not a human user or Terms agreement; challenge, CSRF, durable intent, one-use correlation, consent, account verification and workspace checks retain their respective responsibilities. Edge signature verification alone is stateless; the corrected SQL command's durable request ledger rejects replay. The bridge test proves that link offline, not the hosted gateway or provider.

Fresh SELECT-only evidence confirms API/private schema USAGE and command EXECUTE for `service_role`, private schema USAGE and both hook EXECUTE privileges for `supabase_auth_admin`, anon/authenticated command denial, absent custom-role Auth schema USAGE, strict/closed controls and zero cohorts/dispatches. Only legacy intent version 3 is deployed with its recorded unchanged bundle. No provider setting was changed. Fresh hook enabled/selector evidence is the completed C1 report; it must be checked again at deployment time, rather than claimed as a new dashboard observation here.

No hosted secret names/values were obtained by the read-only CLI attempt. Management access is unproven, not proven absent or denied by a particular role. The connected deployment tool cannot itself set secrets. After C2 approval, establish authorized private CLI/dashboard access, confirm Owner/Administrator secret-management permission and inspect shared-name collisions before any write. Do not ask for keys in chat. The existing legacy endpoint uses the same `MITSA_APP_ORIGIN` and `MITSA_PUBLISHABLE_KEY`; only reuse matching values. An unexpected value/function stops installation. The new signer is separate from the legacy signer; no platform-managed Supabase credential is replaced.

## Verification performed

Final focused command: `npx vitest run --project unit tests/unit/stage-c2-review.test.ts tests/unit/persistent-service-database-boundary.test.ts tests/unit/persistent-registration-service.test.ts tests/unit/persistent-mail-worker.test.ts tests/unit/persistent-worker-process.test.ts tests/unit/persistent-recovery.test.ts tests/unit/persistent-signup.test.ts tests/unit/persistent-status.test.ts tests/unit/login-registration-independence.test.ts tests/unit/recovery-challenge.test.ts --maxWorkers=1`.

**68 cases across 10 files passed.** Report: `artifacts/stage-c2-c3-operations-offline-results.json`. These include 31 new cases (28 review and three bridge cases); prior route/worker cases were rerun to verify the remaining integration/stability scope. No real mail was sent by any fixture.

`npm run typecheck`, JavaScript syntax checks, C2 source/local-boundary review and frozen/cached Deno checking passed. **Ten Deno runtime cases passed**, separately from Vitest. Deno uses `.tools/deno-v2.9.7/deno.exe`, `DENO_DIR=.tools/deno-cache`, the service deno.json/deno.lock, `--frozen --cached-only --node-modules-dir=none --deny-net --deny-run`, restricted public-source/cache reads and only the six named service environment variables. No dependency or executable was downloaded.

The existing local privacy/public-asset audit passed: protected files ignored/untracked; no configured private values/identities in 42 existing public files; prior review manifest still matches. This does not claim a fresh production build or deployed-artifact scan. No application/UI source changed; production build, responsive browser tests and already completed MFA/browser journeys were not repeated. Full earlier 458-unit results remain historical.

PGlite uses policy encryption stubs and an undemotable bootstrap superuser. Hosted owner/role/schema permissions were separately inspected read-only; offline tests do not prove hosted cryptography, provider operations, external delivery, global session revocation or current live account sign-in. No remaining exception is counted as passed.

Evidence: `artifacts/stage-c2-local-preflight.json`, `artifacts/stage-c2-readonly-catalog.json`, selected unit JSON, earlier individual review/bridge JSON and `artifacts/persistent-registration-local-safety.json`. The saved catalog and local preflight deliberately record different observation times. A fresh deployment-time catalog/secret check remains mandatory.

## Next approved work sequence

1. **C2:** obtain the exact [disabled service/private signer approval](stage-c2-disabled-service-approval.md). Preserve all seven source hashes; establish private management access; set only reviewed variables with enabled=false; deploy only the new endpoint; consume at most three credential-free smoke probes; verify preserved data/legacy service/closed controls. Stop on failure without enabling the service or improvising SQL.
2. **C3A:** after C2 acceptance, request the separate eight-request no-account protocol in [C3 hosted integration preparation](stage-c3-hosted-integration-preparation.md). It tests signed command/replay/denial with database admission/delivery false. It is not a signup window and does not assign security readiness.
3. **C3B / D:** after strict provider correction and its regression approval, prepare explicit synthetic identities, consent applicability and provider-hook/OTP/recovery correlation budgets. Then separately approve the worker/sender/generation and persistent controls. Never set `session_policy_ready=true` just to exercise signup while Strict Option A fails.
4. **E / F:** approve exact controlled recipients/actions, complete the persistent-engine journey and real failure/restart/shutdown evidence, then decide continuous isolated availability. Preserve every retained identity/workspace and all historical evidence. No production/Vercel authorization is implied.

The actual next decision is C2, not another C1 approval or repeat session-policy choice. General registration, Gmail delivery and all provider/security changes remain unauthorized in this continuation.
