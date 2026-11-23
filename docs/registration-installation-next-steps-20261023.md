# Mitsa — actionable registration infrastructure checkpoint

**Current next approval:** [Stage C2 disabled service deployment and private signer configuration](stage-c2-disabled-service-approval.md). The explicitly approved [corrective C1 installation passed](stage-c1-identity-boundary-installation-result-20261023.md) as migration `20261023134011`, with exact reviewed source and 23 function baselines, preserved accounts/business data and disabled controls. No incident recovery was applied after success. Earlier approval wording and recovered/absent-object observations below are historical; do not rerun them.

**Superseded later on 23 October:** the user approved C1; both exact candidates committed but failed effective Auth schema USAGE postflight. Approved forward recovery passed, retaining inactive objects and restoring baseline functions/data. C1 is not accepted. The [installation/recovery result](stage-c1-installation-result-20261023.md) is current; the proposed approval wording and absent-table observations below are historical. Do not rerun original candidates or proceed to C2 without a separately reviewed forward correction.

23 October 2026, Asia/Manila. This report separates existing-account login, missing persistent signup infrastructure and the unresolved strict session guarantee. **Stage C1 is ready for inactive installation review; no installation or activation has been authorized or performed.** Strict Option A remains selected. Path B is assessment only.

## 1. Existing-account login

Normal password-plus-MFA returning sign-in was previously completed with Yuno and independently recorded. Today's read-only checks find the same verified account/factor, sole workspace ownership/membership/location and audit invariants; the developer's encrypted baseline also matches its account/factor and eleven application/history rows. Neither retained identity was signed in, challenged, refreshed, revoked or mutated in this pass.

Anonymous `GET http://127.0.0.1:3000/login` returns **HTTP 200** with email/password fields. The current engine remains legacy (`usesPersistentRegistration()` false). The normal verified-user branch in `src/app/auth/login/route.ts` invokes provider password sign-in and proceeds to `/proof`; closed registration and absent persistent tables are not prerequisites for that branch. Existing proof/workspace guards still enforce MFA/authorization. A premature switch to persistent mode would add a finalization dependency, so do not switch before installation/compatibility.

Six new tests in `tests/unit/login-registration-independence.test.ts` execute the actual route with synthetic provider responses: login independence while signup is closed; existing pre-cohort finalization; safe failure for premature persistent selection; generic 401/429 handling; and native invalid-form feedback. **Six passed; TypeScript passed.** These are not a new live password/MFA test. No actual current sign-in error was reproduced; current credential/MFA challenge success has not been retested without approval. Do not mislabel a read-only check as live authentication.

## 2. Exact signup gaps — fresh observed state

| Component/control | 23 October state | Required later action |
|---|---|---|
| Isolated project/marker | ACTIVE_HEALTHY; approved marker matches. | Recheck before installation. |
| Three persistent private tables and command role | Absent. | Approved C1 schema installation. |
| Migration history | Twenty entries; persistent candidates absent. Required existing registration/capture/pilot/recovery dependencies present. | Apply only the two reviewed candidates in order, not a broad migration push. |
| Current actor/hooks/Terms/finalization | Five definition hashes, owners and ACLs exactly match the reviewed baseline. | C1 preserves actor and pointers, changes documented hook bodies/Terms-finalization only. |
| Hook selectors | User confirmed read-only today: Before User Created `private.mitsa_before_user_created` enabled; Send Email `private.mitsa_isolated_send_email` enabled. | Keep selectors unchanged. User confirmation is the source; public settings do not expose them. |
| Existing RLS | Thirty-four private tables enabled/FORCE-RLS; anon SELECT denied throughout; authenticated SELECT only on `shops` through its existing policy. | Preserve prior policies; verify exact new private permissions. Catalog state is not a new signed-JWT tenant test. |
| Collisions/installer privileges | No prospective function/legacy-backup or intent-column collision; role/schema creation and workspace-role assumption privileges present. | Repeat as immediate installation preflight. |
| New Edge service/signer | `mitsa-registration-service` not deployed; new local signer absent. Existing legacy `mitsa-registration-intent` active, version 3. | Separate disabled-service/secret approval; do not replace legacy endpoint. |
| Local selection and old mode | Persistent engine not selected; historical `development-open` mode still fails closed on DB policy/runtime gates. | Switch to the new engine only in a separately approved compatible stage. A mode string alone is not activation. |
| Old lease/worker and release gates | Pilot/signup/SMTP disabled and expired; heartbeat stale; registration/mail/eligibility/legal-publication/disposal gates false. | Do not reopen the old window. New persistent generation/health/budget controls replace it after approval. |
| Provider public settings | Signup provider enabled, email confirmation required, anonymous signup disabled; health reports v2.197.0. | No change proposed. Actual JWT/CAPTCHA/rate/password settings are not exposed by that endpoint; preserve their approved values. |
| Capture/delivery | Encrypted capture enabled; three historical SMTP claims, zero recent-hour/day claims. No delivery worker was started. | Approve new correlation/worker path and limited external mail separately. Capture enabled does not mean external delivery enabled. |
| Security readiness | Original strict failure remains; recovery inbox/browser binding evidence incomplete. | Separate supported correction or explicit testing-policy decision, then approved live evidence. Not a DDL prerequisite. |

Fresh catalog/migration/service evidence: `artifacts/registration-installation-catalog-20261023.json`; collisions/privileges and user-confirmed pointers: `artifacts/registration-installation-preflight-20261023.json`; closed runtime/provider/queue summary: `artifacts/general-registration-readiness-audit.json`. Both preservation audits were freshly rerun read-only and passed. Sandbox connection attempts produced no result; the reviewed operator environment then passed without changing assertions or data. The first MCP batch exposed only its last SELECT, so the catalog review was consolidated into one read-only JSON result. No hidden result was counted as verified.

## 3. Stage C1 — exact next approval

Review `persistent-registration-stage-c-database-only-approval.md`. The two SQL sources and recovery source still match their reviewed SHA-256 values. Offline `npm run registration:package -- --check` passes without rewriting the manifest: eleven reviewed files, seventeen effective functions, forced-RLS disabled defaults, original actor and zero-cohort restoration; retained-cohort recovery remains covered separately. Seventeen package/negative-installation cases passed today. Two real Deno-entrypoint fail-closed tests passed with network/subprocess access denied and the frozen public module graph. No new migration file or SQL body was generated.

C1 adds the inactive private schema/command/worker boundaries and documented hook-body/Terms-finalization compatibility branches. It keeps admission, delivery, transport and session readiness false, policy/generation/worker IDs null, and leaves the runtime on the legacy engine. No session-policy acceptance, account creation or existing-user backfill. Fresh encrypted preservation snapshot and all pre/postflight checks remain mandatory immediately before installation.

Suggested exact approval wording:

> I approve only Stage C1 inactive database/hook-body installation in isolated project mjtejwafxriwntweussc, using the two exact sources/hashes in docs/persistent-registration-stage-c-database-only-approval.md, with its preflight, read-only postflight and scoped recovery. Preserve Strict Option A and keep all readiness/admission/delivery controls disabled. This does not authorize Edge deployment/secrets, provider-setting or hook-pointer changes, new identities, live Auth tests, worker launch, email, registration activation, a one-hour policy or production deployment.

This is a request for new approval, not a record that approval was granted. Supabase's response is not needed merely to install disabled infrastructure safely under this separate scope.

## 4. Remaining service, email and verification stages

| Stage after approved C1 | Prepared implementation | Separate authorization/evidence needed |
|---|---|---|
| C2 disabled private service | Versioned project-bound HMAC, strict command schema, sixty-second signed envelopes, replay ledger, pinned Deno imports/lock and disabled-by-default handler. Public API key/Origin alone do not authorize it. | Exact isolated deployment and protected signer configuration; enabled flag false. No credentials in chat/client bundles. Hosted bundling/runtime smoke protocol is not proved by local Deno. |
| Correlation/OTP integration | Canonical exact-origin/path/single-UUID callback, one-use action/recipient/intent/provider/generation permit, atomic signup claim and encrypted provider payload. | Approved disposable identities and provider-request budget; test current callback settings first, hosted signature/replay/Terms/bypass rejection, provider signup/pending continuation and exact hook/capture/dispatch binding. No new allowlist or widened callback automatically. |
| Notices/security readiness | Versioned test Terms/Privacy snapshot and durable acceptance; no automatic roles. | Review applicable isolated-test notices and policy IDs. This is not legal publication. Independently choose/verify the security path before opening signup or marking security ready. |
| Worker and mail | Prepared separate supervisor, DB heartbeat/ownership lease/fencing, quotas, at-most-once claim, explicit unconfirmed outcomes, encrypted private SMTP credentials. | Approve supervised startup, exact sender/recipient/attempt/capacity budget and external Gmail delivery. Hook handles provider email; enabling Supabase SMTP alone is not a substitute. No worker starts during C1/C2. |
| Genuine onboarding/recovery | Existing code-entry/resend, pending recovery, MFA/trusted-factor and atomic workspace/Owner gates. | Newly authorized disposable/consenting test identities only. Signup/Turnstile → six-digit inbox verification/resend → MFA → workspace/Owner/location → sign-out/return → recovery with retained MFA. Test direct-API/tenant denial, cooldown/expiry/replay, safe failures and persistence. |
| Stability and continuing availability | Persistent DB controls, independent admission/delivery shutdown, restart health recovery without repeated manual thirty-minute windows. | Approved worker/server restart, stale heartbeat, provider/SMTP outage and uncertain-send tests; emergency shutdown/recovery and protected data integrity. No production/Vercel release inferred. |

Capture, mock-provider and historical Yuno tests are not a substitute for the new engine's hosted integration. Gmail remains for conservative isolated low-volume testing; sustained public release requires separately reviewed transactional sender/domain/capacity, monitoring and delivery-event/suppression handling. No paid upgrade is assumed.

## 5. Separate session-security decision

`registration-security-paths-20261023.md` compares Path A and Path B, attack scenarios, direct Auth limitations, exact enforcement tests, rollback and public-release exclusions. Path A remains selected. No new policy choice is needed to approve inactive C1.

Path B could only permit a precisely reviewed limited isolated-testing scope after explicit residual-risk acceptance, separate actor SQL approval and passing hosted boundary/compatibility tests. Its one-hour resource cutoff does not terminate provider renewal or bound account takeover; recent stolen AAL2 factor actions and direct Auth remain material limitations. It is not a silent downgrade, general release permission or a fix for the strict regression.

## Stop point and preservation

The next genuine boundary is approval of C1, not another refresh-reuse experiment. No C1 installation, provider change, retained-account sign-in, new account/factor/workspace, worker, SMTP connection, support message or deployment occurred. Both protected account/workspace baselines passed; all preexisting work remains. The new code in this pass consists only of six regression tests; application behavior and security policy are unchanged. Stop before installation and await the exact approval.
