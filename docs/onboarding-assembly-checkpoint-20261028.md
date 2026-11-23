# Onboarding assembly checkpoint — 28 October 2026

**Concrete adapters assembled; full runner NOT READY.** The complete positive OFFLINE journey stopped at the unchanged 200-Auth-request ceiling during the second fixture's recovery. Raising the future proposal was rejected by automatic approval review; it has not been applied. No hosted onboarding test, account, OTP, email, worker, provider change, push or deployment occurred.

## Recovered and completed implementation

Recovered the existing uncommitted database, preservation, receipts, direct-authorization and runtime assembly files. No checkout/reset/stash/replacement Goal was used. The existing local branch remains `codex/foundation-proof`, HEAD `d9fd220`, seven commits and no remote. Original unrelated work is retained.

| Area | Concrete source and behavior |
| --- | --- |
| Database/control/preservation | `scripts/lib/onboarding-database.mjs`, `onboarding-preservation.mjs`: one counted PG producer, exact SELECT/mutator allowlists, bounded connect/drain/close, reviewed control SQL, forced-security checks, exact retained-row comparison and explicitly bounded new fixture additions. No managed Auth-table mutation. |
| Actual assembled runtime | `scripts/lib/onboarding-hosted-runtime.mjs`: real worker, encrypted observer receiver, ordinary Auth/RPC observers, supervised Next/Edge browser, actual forms, receipt bridge and direct API denials. SMTP failures retain their irreversible claim. Service-disabled status is verified after restoration. |
| Owned entry/authority | `scripts/onboarding-hosted.mjs`, `onboarding-authority.mjs`, `onboarding-controller-channel.mjs`: exact sources, compiled build, target, approved fixtures, proven Strict A, C-B transition, private credentials and one-shot launch; parent acknowledgement plus natural exit required. Readiness=false denies hosted execution. |
| Fixture/request protection | `onboarding-fixture-transport.mjs`, `onboarding-counted-fetch.mjs`, `onboarding-execution-scope.mjs`: fixture-bound credentials/objects, actual producer accounting, narrow own-profile read for the real workspace shell, direct probes outside the harness fence. Durable append mirror retains original per-operation records, verifies immutable history and fails on interrupted/mismatched writes. No budget reset or lock stealing. |
| Browser/recovery/receipts | `onboarding-browser-driver.mjs`, `onboarding-receipts.mjs`, `onboarding-recovery-capacity.mjs`: actual CAPTCHA hidden field, same-path recovery POST completion and protected DOM/session checks, read-only cooldown wait before requesting recovery, separate human receipt with job/review/interval binding, encrypted-only detailed failure evidence. |

The isolated integration uses real Mitsa built forms, real controller, real owned Next/browser processes, real credential fence/ACK/encryption, real worker and observers. Only provider, database transport and SMTP are controlled OFFLINE substitutes. In-memory users, random fake-provider OTPs and fake SMTP acceptance are **not** hosted evidence or real inbox delivery. An offline fixture simulates the separate receipt action; the HOSTED path requires the actual human adapter.

## Actual verification

- **200/200 OFFLINE component tests, 24 files, zero skipped:** `artifacts/onboarding-assembly-components-offline-v3.json`.
- **5/5 additional OFFLINE real root-process IPC tests:** `artifacts/onboarding-root-process-offline-v2.json`. Normal acknowledgement exits naturally; missing/wrong acknowledgement and disconnect fail; a zero exit without acknowledgement is rejected. Combined unique component count **205**, 25 files. Repeated subset checks are not added to this count.
- **Positive assembled journey FAILED:** `artifacts/onboarding-assembled-offline-v15.json`. Both fixtures completed signup, isolated provider-code capture/verification, TOTP, trusted MFA, workspace/Owner creation, logout and returning MFA login. Direct tenant, anonymous, AAL1 and role-escalation probes passed. First recovery passed. Second recovery reached the exact **200 Auth calls** and stopped; both recoveries/full final cleanup acceptance have not passed together. Four fake messages, two in-memory accounts/factors/workspaces were involved. Do not reclassify this positive failure as a passing negative test.
- TypeScript **PASSED** after correcting the optional-signal typing. Production build **PASSED** with Next 16.4.1. Final source checks, syntax, private-fixture byte scan and compiled-runtime/source checks **PASSED**. The new root-process tests were separately typechecked after the build; application/build sources were unchanged.
- Frozen C-B manifest, **128 sources and 64 historical files match**. Accepted A manifest `05206a18393390f9849ea5c2e3b3ae8a50f2b0e25f86bcdc0056ed02ab77318e` remains decryptable and integrity-valid. The historical unclassified Auth-row difference is retained. No new hosted preservation baseline was captured or accepted.

The earlier sandbox browser/cache failures, all intermediate positive failures and their local ledgers remain preserved. Normal Windows execution was used only for isolated owned processes/in-memory dependencies. No old hosted allowance was reused.

## Source-bound review

Active incomplete review: `config/registration-onboarding-review.json`.

SHA-256: `35d41e3321100afd6d8823f31a276f0224f3fe9411d73503dc82420ace7a7ee4`.

It pins 273 source files and 1,065 compiled build files, records the failed positive journey and explicitly sets `hostedRunnerReady=false`. The additive five-process-test review is `artifacts/onboarding-assembly-final-local-review.json`; it preserves the base review. Future changes need a new version, not edits to historical evidence.

| Source | SHA-256 |
| --- | --- |
| `scripts/onboarding-hosted.mjs` | `8dbf97f712f0af072692a5f0cefc98c8d37714c27c9b6996cef4a8a8634f39e6` |
| `scripts/lib/onboarding-hosted-runtime.mjs` | `8f8af833587592f105aeeedaddc7d40668615c5b9dbe5caa782443a9d8988587` |
| `scripts/lib/onboarding-database.mjs` | `671cb86e25a3980ed0bb4684163302bbc2d63fb476128fa272778169328a03c7` |
| `scripts/lib/onboarding-preservation.mjs` | `ec7766af21a76feffff70ccf1a829bb39049c0c115fa90ca0544f5d47b1d7160` |
| `scripts/lib/onboarding-receipts.mjs` | `fcf3bafeaf7c439db684d8ae2552a0da399e66c01b8bb7486901792243a65986` |
| `scripts/lib/onboarding-execution-scope.mjs` | `44fb079bfc9ad80e4afe0e396ef418db388f6835c625a67723493e1bc57ceb40` |
| `scripts/lib/onboarding-browser-driver.mjs` | `31a9e0606317a551674e6f694e17febf92277fe81cdfa23d871113c9592c2fc8` |
| `scripts/lib/onboarding-authority.mjs` | `3d9fe6559c4aa3dd30dc00cee5cc8d52504da10bb7b02f0b5be7cf021c90184f` |

The local one-shot entry `node scripts/onboarding-hosted.mjs --check` passed source/build checks and reported no D/E approval. It opens no provider connection. No executable hosted approval has been created. Privately generated replacement-password fixture material is local only; no live password was changed.

## Independent publication/deployment preparation

`artifacts/publication-review-1793142464535.json`: seven commits, 1,638 reachable history blobs inspected; 1,116 category/path findings, including two large blobs requiring manual review. These are screening findings, **not** 1,116 confirmed live secrets. Historical private/evidence paths and credential-shaped content make a blanket public-history push unsafe. Of 152 candidate source files, 148 enter the clean hash allowlist; four contain isolated-project references. Configuration dependency closure remains unresolved, so the allowlist is not an approved complete export.

Fresh connected metadata confirms the existing **public** LukeMendoza05/Mitsa repository reports size zero and default branch main. No local remote was added. Recommend private visibility and a separately reviewed sanitized export; retain all original local history. Recheck remote refs before any approved push. See `docs/onboarding-publication-preview-scope.md` for exact proposed commands and boundaries.

Git author/committer metadata also contains one distinct historical address that is not a GitHub noreply address. The address was not printed. Before a clean public export commit, approve a public commit identity, preferably the GitHub noreply address shown in the account's own settings. No global/local Git identity setting was changed, and existing commit metadata was not rewritten.

Name and repository filters found zero matching Vercel projects in the connected scope. No public application URL is verified. `config/vercel-preview-proposal.json` and the same scope document specify Next.js/root/Node 24, HTTPS, exact origins, separate clean preview/production Supabase targets, server-only secrets, access protection before first deployment, external supervised mail-worker hosting, monitoring and rollback. Team, project, domain and clean resource targets remain unapproved. Do not expose the retained isolated database through a preview.

Provider references: [Supabase session/reuse and session-id semantics](https://supabase.com/docs/guides/auth/sessions), [Vercel supported Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [Vercel deployment protection](https://vercel.com/docs/deployment-protection). These documents do not prove a security fix on the isolated project.

## Security and shortest remaining sequence

Strict Option A remains **BLOCKED — SU-519045**, managed Supabase selected, no residual risk accepted. Verified prior terminal ancestor rejection initially revoked all family records; immediate-current-token reuse then issued a replacement and restored a live record while the session row remained. The newer session-terminating path is a source-level/provider-rollout hypothesis, not hosted proof. Need Supabase's supported target rollout/version/configuration guidance and a separately approved synthetic regression. It must prove immediate unexpired protected RPC/RLS denial, no renewal, affected direct Auth/factor/recovery denial and legitimate independent-session/MFA/recovery compatibility. No shorter JWT/application-only cutoff is equivalent. No support follow-up was sent.

1. Approve the **local-only** request in `docs/onboarding-runner-budget-review.md` if desired. Automatic approval review rejected changing the future proposal from 200 to 256 twice. The existing 200 limit remains enforced. This is the next local authorization boundary, separate from provider security.
2. Complete the same integrated test after that decision; correct any new demonstrated failures, verify full cleanup and create a new immutable review. Do not assume a larger budget alone guarantees success.
3. Obtain supported Strict A guidance/proof and exact hosted approvals: C-B real provider OTP/inbox tests first, then fresh D/E fixtures/full onboarding/recovery/tenant testing. The prior Yuno milestone is preserved and is not proof of this new engine's hosted acceptance.
4. Separately approve operational/failure-restart testing, production legal notices, verified-domain transactional delivery, clean deployment resources, sanitized source publication and protected preview. API budgets count outgoing operations, including SSR; they do not pretend to enumerate every internal SQL statement executed by Auth/PostgREST.
5. Only after all real acceptance/security/legal/operational gates pass, obtain final public activation approval. General registration, external delivery and public deployment remain disabled/unperformed. Internal business modules were not changed.

The consolidated readiness ledger was archived before updating its local fields. Historical consumed counts, all completed A/B/C-A and C1/C2/C3A/C3B(a) evidence, existing accounts/businesses/MFA and Strict A's definition were not reset or reclassified.
