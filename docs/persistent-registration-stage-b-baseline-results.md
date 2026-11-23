# Mitsa — Stage B synthetic baseline result and continuation

16 October 2026. **The separately approved continuation completed successfully. This is not full security sign-off or activation.** The first interrupted run remains recorded below; no provider setting, Auth hook, schema, worker, external email or registration gate changed.

## Completed continuation

The user approved the bounded continuation on 16 October. Artifact `artifacts/stage-b-security-baseline-1792140823126-05cc84a7-455d-4e1b-8b44-dd8be5d99623.json` records successful execution at 16:55 Manila. The original inconclusive attempt was not refunded. Aggregate limits/results: two original fixtures, **five password attempts**, one private Admin recovery link, six password sign-ins, one refresh attempt, three enrollment requests (one expected denial) and two verified factor enrollments. Zero additional accounts, workspaces or memberships were created.

The fixed protocol confirmed normal MFA-bearing AAL1 password denial; AAL1 factor enrollment/removal denial; recent trusted-AAL2 factor enrollment; rejection of unbound-factor access and binding without its permit; approved binding; native removal of only the secondary fixture factor; private recovery identity binding and token replay rejection; recovery AAL1 password denial; successful recovery password update after verifying the retained primary factor; and returning password-plus-primary-TOTP access.

Both fixture sessions are closed. One verified/trusted primary factor remains. The two nonrevoked binding rows include the historical secondary binding: its provider factor was removed, so it is no longer a live trusted factor and cannot satisfy `mitsa_mfa_ready`. SELECT-only reconciliation now distinguishes raw binding history from live provider-backed trust. No history was deleted. Capture counts and the three historical SMTP claims remain unchanged. Both retained-account preservation audits pass. Exact hook/actor/Terms/finalization definitions, owners and ACLs remain unchanged.

This resolves the **remaining unchanged-setting baseline checks**, not the cause of the first interrupted response; that cause stays unconfirmed. It does not prove current-password enforcement while the setting is off, the new mail-hook chain, genuine inbox recovery delivery, full-hour token expiry, all protected direct API paths, or strict terminal refresh-family denial. The next restricted action is the [separate current-password configuration and compatibility test](persistent-registration-stage-b-hardening-approval.md).

## Historical first-run result

The runner created exactly the two approved random `example.invalid` fixtures, made four password sign-ins and one refresh request, completed the ordinary fixture's password update, and enrolled/verified/bound one new MFA fixture authenticator. It then stopped at the normal AAL1 password-update check: the result did not satisfy the expected `insufficient_aal` assertion. Two password-attempt slots were consumed. No recovery link or second factor was created.

The first runner retained the operation and counts but not the failed response's status/code. Therefore the exact provider/transport cause **cannot be established from that run**. Sanitized provider logs contain one successful password update, but absence of a second matching log is not proof that its request never arrived. Do not classify this as a demonstrated MFA bypass, a confirmed provider denial or a confirmed transport failure. The runner's missing response diagnostics were a local observability defect; the updated inactive source preserves only bounded status/code/failure categories before testing the assertion.

Further local review found and corrected an evidence weakness: a failed security-status RPC could previously satisfy an expected `ready=false`. The inactive runner now requires a successful authenticated response for AAL1 and unbound-factor checks. Session denial is permitted only immediately after the intentionally removed synthetic secondary factor, where provider session invalidation is itself an acceptable outcome. This strengthens the test; it changes no application or database authorization. A network-free test using the installed Auth SDK confirms an ordinary simulated HTTP 401 `insufficient_aal` response retains that code correctly. This does not establish which response the earlier hosted attempt received or resolve its cause. The two additional local tests pass (22 focused tests total); TypeScript passes. The 377-test full-suite result remains prior evidence, not a rerun after these two tests were added.

| Evidence | Result |
|---|---|
| First baseline artifact | `artifacts/stage-b-security-baseline-1792136294662-06c93dc4-83be-4796-9672-8cd9d432cdc0.json`: stopped at password; counts create 2, password 2, recovery 0, sign-in 4, refresh 1, enroll 1, new verified factor 1. |
| SELECT-only reconciliation | `artifacts/stage-b-baseline-reconciliation-1792136614271-66ab47bf-3165-4862-a755-8d436eec93b9.json` from `scripts/inspect-stage-b-security-baseline.mjs`. Both fixtures active/verified; zero sessions and memberships. Ordinary replacement password matches; MFA fixture's original password matches and pending replacement does not. One verified/trusted MFA fixture factor remains. |
| Cleanup | Supported fixture-only logout completed; SELECT-only checks confirm zero sessions for both new users. No retained account was signed out or changed. |
| Email and availability | Capture count and three historical SMTP claims unchanged; all release gates and pilot delivery/admission closed. Zero external email requested. |
| Retained data | Both existing preservation scripts passed after the stop: developer account/MFA and eleven historical application rows; Yuno's identity, factor, sole owner workspace and location checkpoint invariants unchanged. These checks do not claim a full-row snapshot of every Yuno historical record. |
| Local verification | **377 tests/55 files** pass after continuation preparation, `artifacts/persistent-registration-stage-b-continuation-unit-results.json`; TypeScript passed. Includes 20 focused protocol/guard tests. The initial sandbox suite had temporary transform-file `ENOENT` collection failures and is retained as failed evidence. The nonsandbox local suites passed; no hosted integration suite was invoked. |
| Stage C | Pinned-source/hash audit and local safety audit pass; reviewed SQL and Stage C manifest remain unchanged. |

Ordinary no-current-password updating is an observed baseline risk, not a passing hardening control. The continuation above completes the remaining baseline assertions. The strict refresh-family finding is unchanged and unresolved. No development residual risk has been accepted.

## Reviewed continuation scope — approved and completed

The continuation was executed through `scripts/run-stage-b-security-baseline.mjs --resume`, with the pure protocol in `scripts/lib/stage-b-security-protocol.ts` and exact proposal in `config/persistent-registration-stage-b-resume-proposal.json`.

It reused only the exact two encrypted-checkpoint identities. It created **zero accounts or memberships**, preserved the existing primary fixture factor and never reenrolled it. The source/checkpoint-bound private resume approval was created only after the user's separate authorization. The completed checkpoint has a different digest and phase; neither original mode may be rerun to recreate fixtures or repeat this continuation.

Requested additional work:

1. Repeat the inconclusive normal AAL1 password denial with bounded response evidence; test direct AAL1 factor denial.
2. Complete the previously approved secondary factor enrollment/binding/removal checks: at most **one additional verified fixture TOTP factor**, for two cumulative verified enrollments. No retained factor is touched.
3. Generate at most two private Admin recovery links for the existing fixture, testing replay, recovery AAL1 denial and password update after verifying its original MFA factor. This sends no email and does not validate the new registration mail-hook chain or a full-hour token expiry.
4. Verify returning password-plus-TOTP access for the fixture, then revoke its sessions and repeat preservation/closed-delivery checks.

The repeated inconclusive attempt is **not refunded**. Three more password attempts are needed, raising the aggregate ceiling from four to **five**. Cumulative sign-in/refresh limits remain twelve each; recovery-link limit two; account limit two; external email zero. New fixture accounts/factor/audit history are retained. Unexpected results stop the protocol; cleanup uses only supported APIs and existing cumulative budgets. No automatic second continuation is authorized.

This request does not include current-password hardening, session-risk acceptance, the one-hour SQL policy, Stage C installation, service/secret deployment, SMTP/worker activation or general signup. Those remain separate decisions after the baseline results are available.
