# Mitsa — current-password compatibility checkpoint

16 October 2026. **Approved compatibility protocol completed at 19:34 Manila.** The current-password requirement is **on and retained** under the existing approval after all ten password checks passed. The earlier rollback and six-step interruption below are historical evidence. Registration, SMTP/worker delivery and all release gates remain closed. No session residual risk has been accepted.

## Hosted evidence

Only Require current password when updating was enabled and saved in isolated project `mjtejwafxriwntweussc`, marker `fireworks-foundation-proof-01a12e38`. Neighboring provider controls were unchanged. The setting was reopened and verified on before testing. Historical screenshot: `artifacts/stage-b-current-password-enabled-1792142122083.png` (this shows the test state, not the later rollback).

Artifact `artifacts/stage-b-security-baseline-1792142239314-2ba723b8-479b-4b4b-be01-ed6c15421417.json` records the stopped run. The public source used for that run is retained in `artifacts/stage-b-hardening-reviewed-source-*.json`; the original private authorization remains intact.

| Approved password step | Observation |
|---|---|
| 1. Ordinary session, missing current password | Expected denial passed. |
| 2. Ordinary session, incorrect current password | Expected denial passed. |
| 3. Ordinary session, correct current password | Update passed for the synthetic ordinary fixture. |
| 4. Ordinary recovery, no old password | Private recovery identity binding/replay rejection and update passed; logout and returning sign-in passed. No email was sent. |
| 5. MFA-bearing AAL1, correct current password | `insufficient_aal` denial passed; knowing the password did not bypass MFA. |
| 6. Trusted AAL2, missing current password | `current_password_required`, HTTP 400. Matches the expected denial. |
| 7. Trusted AAL2, incorrect current password | Expected current_password_invalid denial passed. |
| 8. Trusted AAL2, correct current password | Synthetic password update passed. |
| 9. MFA recovery at AAL1, no old password | Expected insufficient_aal denial passed. |
| 10. MFA recovery after retained primary TOTP, no old password | Update passed; returning password-plus-TOTP and readiness passed. |

Counts for this additional hardening phase are password **6**, private recovery **1**, sign-in **3**, refresh **0**, account/factor creation **0**. The earlier baseline's counts remain separate and unchanged. The encrypted checkpoint has no pending password operation; both known fixture passwords match the provider. Both fixtures have zero sessions and memberships. One live trusted primary authenticator remains; the removed secondary factor's binding history is preserved. Capture and SMTP counts are unchanged. Developer account/MFA plus eleven historical application rows and Yuno's factor/workspace/location checkpoint invariants passed the post-stop preservation audits.

The final recorded provider denial matched its expectation, and pending state was cleared. Since the transport reserves its counter before every HTTP attempt and the counter stayed at six, the seventh password request was not attempted. The stop was at a local/operator boundary; the exact original exception was not retained and remains unconfirmed. Do **not** attribute it conclusively to Cloudflare, Supabase, OneDrive, an MFA bypass or a failed password-control assertion.

## Local correction and verification

The original immediate checkpoint replacement was vulnerable to Windows sharing locks. A new real Windows regression demonstrates that immediate replacement fails while a public dummy file is held without delete-sharing; the bounded replacement succeeds after release. This proves that filesystem weakness, not the historical stop's precise cause.

`scripts/lib/stage-b-checkpoint.mjs` now provides unique encrypted temporary files, flushed writes, bounded retries for local sharing errors only, an exclusive operator-run lock and bounded exception categories. The operator never retries an Auth request as part of a filesystem retry. A failed publication retains the prior checkpoint and encrypted temporary evidence. A stale operator lock requires reconciliation and is never silently stolen. The runner freezes failure status/code before logout cleanup can overwrite transport evidence; no raw error message, stack, SQL detail or request body is logged.

Tests: **395 unit tests across 56 files**, including **38 focused** protocol/checkpoint cases; TypeScript and syntax pass. Artifact: `artifacts/persistent-registration-stage-b-checkpoint-repair-unit-results.json`. The real Windows file-lock case failed in the sandbox, then passed through normal nonsandbox review. One review attempt was not executed because the account hit a usage limit; after the reported reset, a fresh allowed-usage observation and normal review succeeded. No approval control was bypassed.

## Completed authorized continuation

The inactive `--hardening-continue` mode starts at step seven. Exact counters and stopped digest are in `config/persistent-registration-stage-b-hardening-continuation.json`. It requires a fresh source/writer/checkpoint-bound operator authorization linked to the **existing** hardening grant; it does not claim a new human approval or increase any bound.

It preserves six consumed attempts and can issue only four more password requests; cumulative hardening ceilings remain ten password attempts, two private recovery links, eight sign-ins and eight refresh calls. It creates no account, factor, membership or workspace and sends no email. It verifies the exact settled response, null pending state, fixture identities/passwords, primary-factor trust, zero sessions/memberships, marker, function hashes and closed delivery before proceeding. The first six requests and ordinary recovery are never repeated. Any mismatch or unexpected result stops the protocol.

Re-enabling the same approved setting to finish these four requests remains within the existing functional authorization. Retain it only when all required compatibility checks pass; otherwise perform the approved rollback. No registration/security-policy exception, Stage C installation, new provider setting, hook change, external delivery or production action is authorized.

The regular browser reconnected. Fresh preservation and fixture reconciliation passed; the same provider flag was re-enabled, saved and reopened to verify on. Global CAPTCHA remained off, confirmation stayed required, and both existing hooks remained enabled. The private source-bound execution record explicitly links the original human grant. No budget was reset.

Completion artifact: `artifacts/stage-b-security-baseline-1792150373315-dbc35309-9ff0-4bdd-b466-4aa18c2ddfac.json`. Final cumulative hardening counts: password **10/10**, private recovery **2/2**, sign-in **5/8**, refresh **0/8**, new accounts/factors **0**. All approved password slots are consumed. Do not rerun a completed mode. Postflight confirmed null pending state, matching fixture passwords, zero fixture sessions/memberships and one retained live trusted primary factor. Existing developer account/MFA and eleven historical rows, plus Yuno identity/factor/ownership/location invariants, passed read-only preservation again. Three historical SMTP claims and capture counts are unchanged. Hook/function definitions/owners/ACLs passed the runner preflight and postflight.

Saved-on proof: `artifacts/stage-b-current-password-continuation-1792150322225.png`. Current-password enforcement, private recovery replay rejection, recovery without the old password, recovery MFA assurance and returning fixture sign-in are demonstrated. This does not prove inbox delivery or the browser's sealed reset-cookie journey under this setting; those remain part of separately approved integration testing. Strict refresh-family denial is still failed; no residual risk was accepted. Stage C SQL/service and the one-hour actor proposal remain uninstalled; registration, SMTP and worker controls remain closed.

## Additional read-only finding

The non-secret provider panel screenshot visibly showed minimum password length **6**; the AX tree had redacted that value. Mitsa's application forms require eight characters, but that is not proof of an eight-character provider boundary. Complexity requirements remain unconfirmed. The provider minimum was not changed by this approval. Treat alignment to a reviewed password policy and the still-disabled leaked-password protection as separate readiness concerns, not silently passing controls.
