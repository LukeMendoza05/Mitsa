# P3-D — FAILED — ACTION REQUIRED

The single approved deployment request used the exact reviewed source and payload. Vercel immediately returned **`target=production`**, violating the required Preview environment. The in-progress build was canceled under the approved recovery scope. No retry or second deployment occurred.

## Actual hosted evidence

- Deployment: `dpl_EB7MnUUWk1VspXj8dkEjYsRKXiYJ`.
- Returned URL: `https://mitsa-fireworksinventory-56cc3b6sv-lukemendoza.vercel.app` — **canceled deployment, not an accepted working Preview**.
- Source: `LukeMendoza05/Mitsa`, exact SHA `ec4a96bef0ea77e3553513b37931076f288cc204`.
- Correct Vercel project/team: `prj_kd0rBsWC3pzvbY6LGeTUGUEwxiDD` / `lukemendoza`.
- Backend configured only for Preview: `geuttbanjqdapcubjrnn`.
- Create response: `INITIALIZING`, `target=production`. Cancellation and independent deployment read: **CANCELED**.

The reviewed request omitted `target`, included `gitSource.ref=main` with the exact SHA, and set `withLatestCommit=false`. The documented assumption in the original assembler—that omission always selects Preview—was insufficient. The current [Vercel API documentation](https://vercel.com/docs/rest-api/deployments/create-a-new-deployment) describes branch-inferred environments in one field while its target-field description says omission selects Preview. Actual provider evidence controls acceptance. Branch inference is a plausible explanation; the precise provider implementation cause is not independently proven. Do not claim a provider outage, confirmed platform bug or successful correction.

## Environment batch and cleanup

Exactly one batch created the 13 reviewed entries, all scoped to Preview. Both independent fresh 32-byte private keys use sensitive storage. The keys were generated in memory, passed via child stdin and never printed or written to private-key files. Non-secret receipts retain only hashes and entry metadata. The CLI response parser did not recognize the initial batch response shape; an approved read-only reconciliation confirmed all 13 entries, correct storage/targets and zero hidden Production entries. The batch was not repeated.

The first local module import failed before any key generation or network dispatch; its relative path was corrected. The actual hosted batch then ran once. No failed attempt or consumed allowance was refunded.

Exactly two approved settings updates were used: permit the explicit build, then restore `previewDeploymentsDisabled=true`. A full independent CLI project read confirms:

- All Deployments Authentication remains `all`.
- Automatic Preview deployments disabled, automatic custom-domain assignment disabled.
- No Git link, no live production target, empty project alias list; Next.js/Node 24.x and reviewed commands unchanged.
- The only latest deployment is the canceled wrong-target attempt.

Alias reconciliation found `mitsa-fireworksinventory-git-main-lukemendoza.vercel.app` automatically bound to the canceled deployment. The requested final hostname `mitsa-fireworksinventory.vercel.app` and the generic team alias returned 404 in the authorized team. No explicit alias/domain write was dispatched. The unexpected branch alias is retained; deletion was not authorized and was not attempted.

## Backend and preservation

The preflight and postflight SELECT aggregates match: zero users, sessions, identities, MFA factors, businesses, memberships, locations, legal notices, registration intents and mail dispatches. Admission, delivery, transport, security-readiness and release gates remain disabled, with strict policy. No database, Auth, account, MFA or provider-configuration mutation targeted either Supabase project. The retained development project was never used. P3-A/P3-B/P3-C source and evidence remain preserved.

## Acceptance not established

Landing/Login/closed-Signup rendering, runtime backend binding, security headers, workspace denial, private-file exposure checks and anonymous `/_src`/`/_logs` denial were **NOT RUN**. The required environment failed before application acceptance. All Deployments protection is configuration-verified, not a claim that the canceled URL passed runtime tests. No real registration, account, OTP, email, MFA, recovery or tenant acceptance occurred.

## Consumed budgets

| Category | Charged / allowed |
| --- | ---: |
| Deployment request | 1 / 1 |
| Environment batch / entries | 1 / 1; 13 / 13 |
| Fresh private keys / publishable-key reads | 2 / 2; 1 / 1 |
| Settings updates / build cancellations | 2 / 2; 1 / 1 |
| Provider metadata reads | 17 / 20 |
| Backend SELECTs | 2 / 4 |
| HTTP/browser checks / page policy RPCs | 0 / 20; 0 / 10 |
| Auth submissions, accounts, emails, workers, paid changes | 0 |

The provider-read charge includes three reserved CLI identity slots for the environment operation, of which two were actually dispatched. Thus 16 provider metadata reads are evidenced and 17 slots are charged conservatively. No unused capacity is refunded or automatically reused. The failed scope is sealed. A canceled production-classified record and automatic branch alias are unexpected hosted side effects; do not claim there were no unintended provider objects.

## Independent local work and next action

Added a response gate in `scripts/lib/phase3-preview-receipt.mjs` and 14 passing OFFLINE regression cases. It rejects production, staging, unknown/missing target evidence, wrong source/project, canceled records and unexpected hosts; it never substitutes HTTP success for Preview acceptance or full onboarding. Original approved sources and historical request remain unchanged.

A separately reviewable branch-based candidate keeps the exact source SHA and changes only its Git source ref to a new non-production branch. It follows the standard [Preview branch workflow](https://vercel.com/docs/deployments/environments), but its hosted selection is **not proven**. It needs explicit approval for one new GitHub ref and one fresh bounded deployment trial. No candidate was deployed. See `docs/phase3-p3d-branch-candidate-approval-20261031.md`.

Phases 4–9 remain prepared/local or awaiting scoped hosted tests and release decisions; none gained hosted acceptance from this failed build. Production backend selection, real transactional mail/legal readiness and final activation remain separate decisions. Strict Option A is **EXTERNAL RELEASE DEPENDENCY — SU-519045**, not resolved or weakened here.
