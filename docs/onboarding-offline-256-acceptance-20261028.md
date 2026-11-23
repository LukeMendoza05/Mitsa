# Assembled onboarding acceptance — 28 October 2026

**PASSED OFFLINE. The complete executable runner is READY FOR HOSTED APPROVAL, not authorized for hosted execution.** Both fixture journeys, both password recoveries, negative authorization, natural process exit, control restoration and preservation passed together. There were zero hosted requests, real messages, hosted accounts or provider-setting changes. General registration and delivery remain disabled.

## Completed journey and budgets

The full suite passed **221 unique tests across 27 files, zero failed or skipped**. Every named assertion from the previous 213 passing checks was matched to a passing assertion in the new report. Seven new budget/lifecycle cases and the now-passing positive journey make eight additional cases. After the production build, the positive journey and actual Next.js interception test passed again (2 repeated cases, not added to 221).

The full-suite positive run consumed **222/256 Auth requests**: 220 body requests and 2 cleanup signouts. The post-build positive run consumed **223/256**: 221 body requests and 2 cleanup signouts. Four slots remain exclusively reserved for cleanup; only two were used. The one-request variation was an additional identity read, not another signup or recovery request. Every reservation preceded dispatch. A newly reconstructed scope matched the complete durable journal exactly; failures and earlier attempts were not refunded or reset.

The complete journeys used actual built Mitsa forms, the real controller/adapters, owned Next.js and disposable Edge browser processes, the credential fence, encrypted acknowledgements, actual mail worker and independent observers. Only the isolated database transport, Auth/provider and SMTP dependencies were controlled fakes. Fake provider-issued random codes and simulated inbox acknowledgements are OFFLINE evidence only. Two in-memory identities, two TOTP factors, two workspaces/locations and four fake SMTP messages are not hosted accounts or real inbox delivery.

| Phase | Post-build Auth calls |
| --- | ---: |
| First signup / email verification / MFA | 4 / 3 / 25 |
| First workspace / logout / returning MFA login | 7 / 7 / 17 |
| Second driver initialization | 1 |
| Second signup / email verification / MFA | 4 / 3 / 25 |
| Second workspace / logout / returning MFA login | 7 / 7 / 17 |
| First recovery | 47 |
| Second recovery and final cleanup interval | 49 |

Phase labels describe the active controller interval, not a claim that every request was directly initiated by that phase's button. Final cleanup's two requests are separately identified by immutable `cleanup=true` journal records. Exact sanitized endpoint totals and all operation counters are in `artifacts/onboarding-offline-256-postbuild-request-summary.json`.

## Why 200 was exhausted and what changed

The preserved original failure reached exactly 200 reservations and 200 mock-provider Auth requests during the second recovery. It contained 154 `GET /auth/v1/user` calls, two signup calls and two recovery requests. Proxy/page checks and the installed SSR client's HS256 identity-verification fallback account for most reads. The trace did not show an admission/recovery loop. Original endpoint aggregates and phase attribution limitations are retained in `artifacts/onboarding-prior-200-request-analysis.json`.

One genuine duplicate navigation was found: email verification already rendered Account Security, but the MFA driver reloaded that page. It now navigates only when necessary, saving three Auth reads per fixture in the positive model. All independent trusted-session checks remain intact.

The approved increase is implemented as a **separate OFFLINE profile**, selected only by an explicitly OFFLINE review/authority under an isolated `mitsa-*` temporary directory. The hosted profile remains **200**. OFFLINE body requests stop at 252; only the constrained fixture-local-signout operation can consume the final four. Old authority cannot switch modes, increase its limits, reset its execution clock or reuse consumed slots.

Real integration also exposed three defects now corrected:

1. Normal Next shutdown aborted counted provider/ACK chains before streamed HTTP responses finished. The adapter now closes admission, drains owned request/provider work through HTTP completion, closes idle connections and the application, then cancels transports. Failure remains bounded and cannot become a success via watchdog termination.
2. Windows disk contention could exceed the journal's two-second lock wait. Only the isolated OFFLINE wait is now five seconds; HOSTED remains two. Authority is checked again after acquisition. No producer's lock is stolen or deleted by another producer.
3. A successful controller result included `failurePhase: undefined`, which JSON encryption omits. It now omits that absent field before persistence. The encrypted round-trip equality assertion remains unchanged and strict.

All intermediate failed reports and local ledgers remain available. The final post-build child exited naturally with code zero, acknowledged shutdown, closed pipes, authoritative process absence and no watchdog/private-channel failure. Worker/browser/database cleanup, exact retained-state comparison and disabled controls passed.

## Verification and source binding

Commands run:

```powershell
npx vitest run --project unit onboarding- --no-file-parallelism --reporter=json --outputFile=artifacts/onboarding-offline-256-full-v1.json
npx tsc --noEmit
npm run build
npx vitest run --project unit tests/unit/onboarding-assembled-journey.test.ts tests/unit/onboarding-next-framework.test.ts --no-file-parallelism --reporter=json --outputFile=artifacts/onboarding-offline-256-postbuild-v1.json
node scripts/review-onboarding-offline-256.mjs
node --conditions=react-server scripts/onboarding-hosted.mjs --check
```

TypeScript, Next.js 16.4.1 production build, syntax, private-fixture exposure, ignored/private-path and compiled/source checks passed. The local entry check reports `SOURCE_CHECK_ONLY_NOT_AUTHORIZED`, 281 sources, no approval and zero hosted requests. The review pins 1,065 compiled files. All **128 frozen C-B sources and 64 historical evidence hashes match**. Accepted A evidence remains encrypted, decryptable and digest-valid at `05206a18393390f9849ea5c2e3b3ae8a50f2b0e25f86bcdc0056ed02ab77318e`. Historical Auth attribution uncertainty remains unresolved and preserved; no hosted baseline was captured or accepted.

Active version-5 review: `config/registration-onboarding-review.json`.

SHA-256: **801795d439085f2f740047d21819097594b6005bf5041ad1c2c11076c4a30141**.

Immutable copy: `artifacts/onboarding-assembly-review-v5.json`. Version 4 is retained unchanged at `artifacts/onboarding-assembly-review-v4.json`. Exact final hashes for every file, and all 15 changed/new source entries against version 4, are recorded in `artifacts/onboarding-offline-256-final-review.json`. The seven pre-budget source archives also remain hash-valid.

| Main source | Final SHA-256 |
| --- | --- |
| `scripts/lib/onboarding-execution-scope.mjs` | `b739283d37361c69cc0dabe00d01ac29e1e7f8ae12cfcd710fbdafea53682181` |
| `scripts/lib/onboarding-browser-driver.mjs` | `2695dae14a056aa441e883d45a3c8e7beaa809ace0c7a05f8d54cdc348a76620` |
| `scripts/lib/onboarding-next-runtime.mjs` | `14224d496eb42317ab8329b8ae688d826007cb07438c71fa1a5d32149ec5391d` |
| `scripts/onboarding-next-child.mjs` | `9e478b02cf01b91eae94ea135bb2d6e528cabbbb5c5e28aa7d900dd5b13782ff` |
| `scripts/lib/onboarding-controller.mjs` | `f2ed3ae0e0daf0ae4481638edc6b4ef0165d119b820608355f6cf0c273db43fe` |

## Hosted boundary and shortest remaining sequence

**Strict Option A remains BLOCKED under SU-519045.** The recorded legacy-family terminal-reuse result did not immediately terminate the session: the formerly current token could renew and existing bearer access continued through a retained session row. Newer upstream source behavior is not proof of the managed target's rollout or of all direct Auth/factor paths. No new live experiment or risk acceptance occurred.

1. Obtain Supabase's supported managed rollout/correction guidance, including target availability and coverage of renewal, otherwise-unexpired resource access, direct Auth/factor/account operations and legitimate MFA/recovery. Review the response and approve only a source-bound disposable strict regression. A passing local fake trace is never accepted as provider evidence.
2. After verified Strict A evidence, separately approve the existing unchanged C-B real provider-issued OTP package and its exact preservation transition. C-A receipt does not replace C-B. Do not rerun A/B/C-A.
3. Review and separately approve D/E's exact hosted request profile, private fixtures, reference transition, unused attempt and execution interval. The current hosted cap is still 200 and has not been shown sufficient; 256 is approved ONLY OFFLINE. The 223-call result informs a future hosted proposal and does not expand C-B/D/E authority. No hosted scope is silently opened by `hostedRunnerReady=true`.
4. Execute real onboarding/recovery/tenant acceptance only under those approvals; then stability, production legal/retention/contact, verified-domain transactional mail, clean hosting targets and final public activation approval.

The runner has no unfinished concrete adapter or placeholder success port. READY describes implementation/offline acceptance for review; it does not mean hosted execution prerequisites or public-release gates passed.

## GitHub and protected Vercel preparation

The existing local HEAD/history and all 148 previously screened clean publication candidates are unchanged. Four candidate source files and configuration dependency closure still require explicit sanitized-export review. The old private implementation/evidence history must not be pushed to the existing public repository. Recommend making that repository private and approving a separate clean export; no remote, staging, commit or push occurred. Evidence: `artifacts/onboarding-publication-delta-256.json`.

The protected-preview proposal remains in `config/vercel-preview-proposal.json` and `docs/onboarding-publication-preview-scope.md`; its Next.js build has passed again. A clean separate preview Supabase target, exact protected HTTPS origin, project/team, secrets, worker hosting and cost/deployment approval are still required. No matching project/public deployment is newly verified and none was created. Retained isolated accounts/business data must not be exposed through preview. Public general registration remains disabled.
