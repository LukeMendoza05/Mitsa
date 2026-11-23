# Mitsa — Stage C runner implemented; hosted testing not executed

**READY locally.** This supersedes the earlier statement that C had only a protocol/budget wrapper. The executable supervisor, actual operator adapters, interactive receipt/challenge console, signed signup/OTP protocol, durable budgets, expected-delta preservation and closure paths now exist. No live email, account, OTP, worker, Edge or Management operation ran.

## Frozen review

Manifest: config/registration-stage-c-review.json; SHA-256 **407651a10d92e13118a5b12ccb48c9a1d75b34b3aa8acb35716ac4038e6e9424**. **128 source files / 64 historical files** verified. Accepted A remains 05206a18393390f9849ea5c2e3b3ae8a50f2b0e25f86bcdc0056ed02ab77318e. Stage B v3 and every previously consumed attempt remain unchanged; no A/B host test was repeated. Source SHA values below are exact; complete transitive dependencies and SQL are in the manifest.

| New file | SHA-256 |
|---|---|
| scripts/registration-stage-c.mjs | fff29cc36ed2048aa23cc02d8d7c778cedf791f4e7239d190f13fe00cebf39a6 |
| scripts/configure-stage-c-management.mjs | be9fb48e81a603dcb92d0138ea388c3e7bec6e4b501c8abed4679702c429e31d |
| scripts/prepare-stage-c-review.mjs | b41ed58b036dda92e238bee9727fd625d8f21baef11be51122e1b40b7d2fda39 |
| scripts/lib/stage-c-scope.mjs | ce9bf895c4e19494cb3582ee33e0039d8997977a959ca14fa88a4d4d8154c19b |
| scripts/lib/stage-c-engine.mjs | 793df4b0db666dc0f1568f8127955d438fdad5b262d91cec0597bf0d49157017 |
| scripts/lib/stage-c-runtime.mjs | c6fbf84f3d83d6f03ff450fc2eb3e87affdc9c5ab92ba0299f3158c22627e65c |
| scripts/lib/stage-c-panel.mjs | 5a0475adec72487b1aa22331038cb6608730e4412a31c3561d3f4afe059bcbac |
| scripts/lib/stage-c-preservation.mjs | 5de0bf5951ec09b7baca2429968e33b26454741f36719704bd9a33d085987a79 |
| scripts/lib/stage-c-sql.mjs | c03b0f6f63cb486ea5828a1868381146152bf5139d7ecb7daf7bfb18bb5df016 |
| scripts/lib/stage-c-management.mjs | 4c0facaf860ea9a7eba4063f84e61a388f5b683c36d10750747ae18c749820de |
| tests/unit/stage-c-runner.test.ts | 7500a816755ffa2b6fc82cc3bbe7d0ffe458bf13f7fbc7470e485587a3a77898 |
| tests/unit/stage-c-runtime-adapter.test.ts | edcdeda151520eef9e7558766dd57df9589925c30cf1f4b2843d3f1f384caedb |
| docs/registration-stage-c-final-approval.md | 622ac2d29fc2eb3bc56abc3009b59dea1fd0ba5039daafb97ddbe4d1a7c9f506 |

## Execution distinction

**C-A-v1:** optional supervised diagnostic mail to the immutable c3b-a sender alias, with no account, OTP, Auth/Edge/Management call, control activation or DB write. It verifies transport-to-human-reported-inbox delivery only. It deliberately does not manufacture a six-digit code or fake a persistent dispatch. The installed Auth mail hook requires a real user/intent/cohort, so no-account diagnostics cannot honestly prove it.

**C-B-v1:** real operator-driven persistent signup/OTP for c3b-a/c3b-b. Fresh real Turnstile proofs and acceptance of the full hash-checked test notices precede private signed service commands. The real public Supabase signup/resend/verification APIs and existing Before User Created/Send Email hooks must produce the encrypted six-digit capture and durable dispatch. The real worker sends only bound fixture jobs. Wrong, superseded, replayed and held-after-expiry code tests use Supabase responses, not database verification flags. Positive verification produces AAL1, never trusted MFA or business access. No privileged Admin user creation or manual verification shortcut exists.

B is executable code but currently **BLOCKED for hosted execution** by the unresolved Strict Option A prerequisite. No generic approval, one-hour policy or development exception is accepted by this runner. A can be separately approved independently. Existing CLI sign-in is not extracted as an opaque Management token: B needs a separately protected, hash-bound credential with suitable project secret read/write permissions, plus fresh hash-bound provider-setting confirmation. Those live permissions are not established by offline mocks. No credential was requested in chat, created or configured.

## Concrete safeguards

Reservations persist before I/O; immutable fixture hashes, exact recipients, job no-replay locks, scope/source/target binding, failure consumption and one-shot attempt guards apply. The existing final-acceptance budget is also enforced for B's actual Auth/Edge/SQL/mail/worker paths. Unknown SQL is conservatively write-capable. HTTP redirects/retries are not delegated to CLI helpers. SMTP send claims remain consumed after uncertainty. Shared diagnostic claims also count against the hourly/daily/recipient guard.

The localhost-only console rejects cross-origin posts, bad form nonces, wrong Hosts and excess bodies/requests, uses CSP/no-cache and exposes labels/checks only. Human receipt is a separate explicit attestation, encrypted privately; SMTP acceptance alone never sets it. Codes/passwords/nonces stay in encrypted state, with state saved before provider mutation. No private headers/arguments enter public journals. Failures retain bounded phase/category/status/SQLSTATE evidence rather than raw exception payloads.

B alone may temporarily enable the existing private Edge flag and strict generation-bound delivery/admission after the proven security prerequisite. It then stops current-generation work, restores the original closed control row, disables/readbacks the flag, verifies encrypted retained rows/allowed fixture additions and requires natural process exit. Readiness probes are bounded and included in Edge limits. Parent/child deadlines include startup, soft-stop cleanup reserve and watchdog failure; a body result is not an overall pass. Unconfirmed cleanup is not reported successful, never grants a retry and never deletes test/retained records.

## OFFLINE verification

**65 tests passed, ten files, clean final test-process exit:** artifacts/stage-c-acceptance-offline-tests.json. Tests cover missing/invalid authorization, invalid signing/foreign audience/replay, wrong recipient, exhausted/restarted budgets, actual diagnostic adapter through mocked transports, SMTP failure/uncertainty, real synthetic process crash without duplicate job delivery, account-permission denial, received-vs-accepted distinctions, OTP state/rejections, retained-row protection, actual in-memory PostgreSQL shutdown/restore, poisoned restore rejection and a loopback-only real form Origin/nonce check. Positive codes in tests are explicitly offline provider fixtures, not hosted issuance.

The diagnostic budget integration models the real **54-statement preflight + 54-statement postflight**, proving a normal 111-query/zero-write path fits 120 and retains cleanup capacity. This caught and corrected an overlarge reserve that would otherwise have stopped A too early. No hosted trial was used to discover it.

TypeScript, syntax, actual Node imports under react-server conditions, local CLI checks for A/B, privacy and source integrity passed. Privacy scanned 14 files against 14 known private values without disclosing them. One intermediate existing crash case timed out at its unchanged 30-second test limit, then passed unchanged in isolation and in the final non-concurrent suite; no frozen worker/test timeout was raised. Restricted sandbox temporary-cache failures and earlier typing corrections are retained in intermediate artifacts. No failed output was relabelled passing. This does not establish hosted provider compatibility, actual inbox receipt, actual OTP success, worker-failure recovery in Gmail, MFA or onboarding.

No production build/browser application test was repeated because no Next.js/app UI source changed. The operational console's loopback test is not a real Cloudflare challenge or a Mitsa user journey. Real Gmail/worker outage/restart fault injection remains hosted Stage F work; offline claim/no-replay coverage is not represented as that acceptance.

## One independently selectable approval package

Review **docs/registration-stage-c-final-approval.md** under manifest **407651a10d92e13118a5b12ccb48c9a1d75b34b3aa8acb35716ac4038e6e9424**.

| Limit | Selection A | Selection B |
|---|---:|---:|
| DB connections / direct SQL / write-capable | 1 / 120 / 0 | 1 / 9,000 / 8,000 |
| Transaction controls, included above | 6 | 12 |
| Auth / Edge / Management HTTP | 0 / 0 / 0 | 30 / 48 / 4 |
| Server Cloudflare / operator requests | 0 / 30 | 6 / 180 |
| Emails / SMTP verify operations | 1 / 1 | 6 / 3 |
| Process launches / total runtime | 1 / 10 minutes | 1 / 90 minutes |
| New Auth users / MFA / businesses | 0 / 0 / 0 | 2 / 0 / 0 |

Management requests use Supabase's supported project secrets GET/POST endpoints, changing only the one service flag and restoring it. Auth-provider settings, hook selectors, keys, RLS, managed Auth tables, production and public release remain excluded. Supabase-internal SQL behind Auth/Edge calls is not claimed to be observable as direct operator SQL. Test accounts and related durable fixture records are expected effects of B only; all retained rows must remain unchanged. No legal notice is published and no actual Sign Up page is opened for arbitrary users.

**Recommended immediate selection:** A is optional and eligible for review now; approve exactly one C-A-v1 if inbox-level diagnostic evidence is useful while waiting. B requires genuine approved Strict A resolution and its declared readiness/credential prerequisites before execution; this package requests no risk waiver. The real-email runner is prepared, but no hosted Stage C requirement has passed yet. Registration and delivery remain disabled, as last verified in B and unmodified here.

Strict Option A remains **BLOCKED under SU-519045**. Existing developer/Yuno accounts, MFA, businesses, permissions and history were not accessed through Auth or modified. No support follow-up, configuration deployment, account reset or unrelated business feature was started.
