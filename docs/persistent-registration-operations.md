# Mitsa — inactive persistent registration operations

Current checkpoint, 24 October: C1 and disabled C2 passed; the separately approved C3A eight-slot signed-command/replay/anonymous-denial protocol also passed, with only two retained ledger additions and service restored false. See [C3A result](stage-c3a-hosted-integration-result-20261024.md) and [consolidated remaining approvals](registration-completion-approval-package.md). No account-admitting service/worker/delivery activation is authorized. The current DB has no matching test Privacy version; the two-record synthetic notice candidate is prepared offline only. Strict Option A remains unresolved. Older checkpoint statements below are dated history, not instructions to repeat C1/C2 or their probes.

The opt-in bounded test entry `node scripts/persistent-registration-worker-review.mjs --check` performs only local source/fixture checks. Its run mode remains unauthorized and requires a new private, source-bound grant, exact dispatch/recipient map and durable budget ledger. It wraps the existing worker rather than bypassing ownership/fencing. Ordinary `--run`/supervisor execution is not a substitute for the proposed test's narrower recipient/attempt/runtime limits. See consolidated D before any later approved mail test.

Current checkpoint, 23 October: corrective C1 is installed and verified with all controls disabled. Stage A source is intact; [C2 deployment preparation](stage-c2-disabled-service-approval.md) and [post-C1 evidence ledger](registration-post-c1-readiness-20261023.md) distinguish completed offline work from pending hosted operations. Do not select the persistent engine, start delivery, configure the new private service or apply further SQL without the corresponding separate approval. Historical architecture details below do not authorize activation.

## Architecture

The existing Next.js/Supabase Auth foundation remains. The legacy engine retains controlled tests and historical evidence. The new engine reads a target-bound database control rather than expiring local approval files. Deployment profile is separate from Next's development/production build mode. Only the existing isolated project/origin is approved in `config/registration-deployments.json`; pilot and production targets are null.

Admission requires an approved generation, policy/security readiness, healthy worker and mail capacity. Delivery has an independent switch. Closing new admission does not invalidate a previously delivered OTP or prevent password-proven continuation of an eligible pending account. Verification still uses Supabase's code/token validation. Signup grants no workspace role; verified email, trusted MFA and atomic workspace creation remain responsible for Business Owner assignment.

Stable submission UUIDs and canonical non-password fingerprints bind retries. A mail slot is reserved before a single atomic provider-signup claim. Uncertain submissions retain a sealed status context; retries cannot call signup again after that claim. Only an expired, locked record with no provider identity allows an explicit fresh request. Names/emails stay fixed while an interrupted request is being resolved. No password, CAPTCHA proof or provider credential enters the private command record or browser storage.

Pending accounts can sign in with their original password to reopen verification independently of admission. Expired pending intents use a fresh human challenge and review of the same applicable policy versions; renewal extends continuation only, preserving original consent and expired creation authority. A changed policy bundle fails closed and requires an explicitly reviewed applicability/consent update rather than silently rewriting an accepted version.

## Email lifecycle

Provider signup/resend/recovery receives an opaque correlation callback. The strict hook consumes its one-use permit, encrypts the provider payload and queues that exact capture. No historical uncorrelated capture is picked up automatically.

Dispatch states: reserved → queued → claimed → SMTP accepted. Cancelled, superseded, expired, failed and unconfirmed outcomes remain durable. A unique request key prevents duplicate resend/recovery requests. Signup uses its atomic claim as the single provider-call authority. Only the latest valid queued message may be claimed. Messages with less than one minute remaining are withheld; the operator rereads database time after decryption. Supabase remains the final authority for OTP expiration and verification.

The existing Gmail transport remains dedicated, TLS-verified and single-recipient. Initial conservative limits are ten reservations/attempts per hour, twenty per rolling 24 hours, and one per recipient/minute, counting the retained legacy claim ledger. Reserved capacity is checked transactionally; uncertain claims continue to consume budget. Provider sending limits are ceilings, not delivery entitlements. SMTP acceptance is explicitly distinct from inbox receipt.

No automatic retry follows an SMTP claim or uncertain provider request. The worker may recover transport health and process other newly authorized work; the affected user must explicitly request a fresh provider message after cooldown. Preclaim failures pause readiness rather than create an account without capacity. Application Maps are supplemental; database/provider controls remain authoritative across restarts. Status checks also consume the bounded signed-command budget and are manual, not continuous polling.

## Worker restart and shutdown

The prepared runner is separate from Next and owns the DB/DPAPI/OpenPGP credentials. Next receives only its publishable provider key and private server signer. The worker renews a sixty-second lease every five seconds; admission pauses when its heartbeat is older than fifteen seconds. A new worker waits out the stale ownership lease and reuses the approved generation. Normal restart requires no new human registration window. A crashed claimed job becomes unconfirmed and cannot be sent again.

The PowerShell supervisor retries unexpected failures with bounded 5–30-second backoff. It does not install a Windows task or store a Windows password. Closed/revoked controls exit normally and stay stopped; supervisor restart cannot undo an emergency stop. A separately reviewed current-user hidden startup task can be installed during activation.

Safe commands available now:

```powershell
npm run registration:package -- --check
npm run typecheck
npm run test:unit
npx playwright test --config playwright.persistent-registration.config.ts
```

`npm run registration:worker:check` is a target/marker-checked **read-only** hosted preflight. It does not acquire ownership, decrypt SMTP credentials, connect to SMTP, activate controls or send mail. Do not run broad hosted suites under Stage A. The prepared supervisor `-Run` and runner `--run` are for separately approved activation only; neither enables a database control.

Admission-only shutdown leaves authorized continuation delivery available. Full delivery shutdown revokes the generation, cancels unclaimed jobs and marks in-flight jobs unconfirmed. It cannot recall accepted email or revoke Auth sessions. Preserve account, cohort, consent, queue and audit evidence. Use supported, account-specific Auth revocation only with the required incident authorization. Never install a trigger on managed Auth tables.

## Production transition

The engine supports ordinary addresses and real business onboarding. Isolated development is its validation stage. Before a public deployment: approve the real target/origins and hosting; review published versioned Terms/Privacy and retention; replace low-volume Gmail with a reviewed transactional transport and delivery-event/suppression handling; deploy a least-privilege supervised worker; establish capacity, monitoring, incident response and session-security sign-off; then separately approve activation. An owned verified sender domain is required for the preferred Resend path. No domain purchase, provider switch, paid upgrade or production URL is assumed here.

The strict refresh-family finding and disabled leaked-password protection remain launch concerns. The prospective one-hour Mitsa resource bound does not revoke provider credentials or constrain every direct Auth operation. See the separate Stage B assessment; development tests do not establish production readiness.
