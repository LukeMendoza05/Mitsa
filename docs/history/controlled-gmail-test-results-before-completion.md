# Historical evidence — superseded

# Mitsa — controlled Gmail test execution

Updated 2026-10-15 at 2026-10-15T04:10:49.359Z. The exact synthetic retry sent **one** Gmail SMTP-accepted message, and the user confirmed actual inbox receipt, Mitsa branding, six digits, 60-minute expiry and correct formatting. The code exposed in a screenshot is treated as compromised and has not been used to verify this account. Do not use it.

The runner stopped at subsequent resend: its URL wait was already satisfied by the current ?resent=1 page, so it read the previous capture before the request completed. It closed at **03:59:05 UTC**. Read-only evidence confirms no second capture or delivery claim, both flags closed, active manifest absent, local isolated mode restored and public/global external gates closed.

The same-URL race is reproduced and corrected. Seven local browser checks, 218 unit tests/34 files and typecheck pass. Existing developer account/MFA/workspace/location/history and all original 4,755 rows, grants and RLS remain preserved. **Fresh-code verification and compromised-code rejection remain incomplete in this Gmail run.** The synthetic account is unverified with zero memberships/factors.

A [one-message completion window](controlled-gmail-finish-approval.md) is prepared but requires fresh approval because this window closed on failure. It preserves the old claim and permits at most one new resend email, two total across both windows. No account is recreated or reset.

## Historical checkpoint — superseded by the current result above

Updated 2026-10-15. The approved replacement run registered one authorized synthetic account and captured its six-digit Supabase code. It stopped before a claim or SMTP attempt because of a verified PostgreSQL/JavaScript timestamp precision bug. The window closed at **03:21:09 UTC**, both flags are false, and the active approval manifest is absent. No email was sent and the developer account/MFA/workspace remain unchanged.

The local claim query is corrected and offline regressions pass. The original synthetic account and its encrypted credential/capture are retained. A fresh exact-identity retry requires the separately reviewed [resume approval](controlled-gmail-resume-approval.md). No account will be deleted or recreated.

The first historical window below opened on 2026-10-14 at **15:37:04 UTC** and closed at approximately **15:37:06 UTC**, before signup or SMTP because bundled Chromium was absent.

## Latest replacement failure

A read-only comparison of the exact synthetic capture showed that passing its rounded JavaScript Date into `created_at > $timestamp` incorrectly matched that same row. PostgreSQL retained microseconds while JavaScript retained milliseconds. There was no newer capture. The corrected query compares `created_at` with the timestamp selected by the candidate's ID inside PostgreSQL, preserving native precision. This keeps the stale-message guard and all limits intact. The runner also now retains only bounded child/SMTP error classifications, preventing a private raw provider exception from entering logs.

The retry preflight verifies the retained synthetic account has no membership or MFA factor, still has its original valid unfinalized signed intent/current Terms, and can be resumed without changing the developer identity. Actual SMTP authentication and inbox delivery remain untested: **zero claims, zero connections, zero messages**.

## Historical first run

| Requested evidence | First run |
|---|---|
| Gmail SMTP connection | Not attempted; zero durable attempts |
| Real inbox receipt | No message sent |
| Actual six-digit verification | Previously proven with synthetic encrypted capture; not reached in this Gmail run |
| Delivery error or Gmail restriction | None observed; Gmail was never contacted |
| Test window closure | Both flags false, helper closed, local mode restored to isolated-test, active manifest removed |
| Existing account/MFA/workspace | Read-only private preservation comparison passed |

## Root cause and correction

The new one-shot runner used Playwright's default bundled Chromium, which is not installed on this machine. The established project browser tests use installed Microsoft Edge. A blank launch diagnostic confirmed the missing executable; a corrected Edge-only diagnostic then loaded Mitsa's local signup page successfully with no registration or SMTP action.

The runner now uses `channel:'msedge'` and launches/loads the browser **before** opening any delivery window. It still closes flags and restores isolated mode in `finally`; database expiry independently fails closed after 30 minutes. The failed run is retained as evidence and is not silently retried. A replacement window requires approval because the first approved window closed on failure.

The postflight audit initially required never-used, null pilot timestamps, even after a legitimately closed test. Its read-only expectation now accepts only the exact recorded approved start/end, recipient fingerprint, 3600-second lifetime, closed flags and at most three retained ledger entries. Original row hashes, grants, RLS, unknown-identity rejection and all live security guards remain enforced. Approval history is retained rather than erased to satisfy a pristine-installation assertion.

The actual developer account was not signed in, reset, revoked, re-created or changed. No new Gmail test account was created in the first run. Public registration, production, Supabase SMTP configuration, external recovery/invitations and deployment remain unchanged.

## Remaining work

After approval for a replacement window, send one message to the dedicated sender's own inbox through the existing capture-backed relay. The runner pauses at a bounded receipt checkpoint; the user confirms only inbox/spam receipt, Mitsa sender display, readable formatting and six-digit/expiry presentation. Never request the code. SMTP acceptance alone is not inbox proof. The operator supplies only the non-secret `received` signal after that confirmation; stop, unexpected input, closed stdin or approval expiry closes the window.

After the receipt checkpoint, the runner uses the normal Resend Code button after its real cooldown, reads the newest encrypted Supabase code, checks replacement of the old code, and makes one second explicit SMTP invocation. It verifies the newest code privately through Mitsa and checks one-time replay rejection, zero workspace memberships and zero factors, then closes the window. A second-message inbox receipt must still be confirmed separately; SMTP acceptance is not delivery evidence. It does not use all three permitted attempts automatically. The dedicated synthetic account credential is retained only as private PGP ciphertext, so a failure never requires altering the real developer account or silently recreating a test identity.

Broader recipients and recovery delivery still need their own reviewed scope. Real Turnstile validation, signup-abuse tests, provider capacity and final legal/product/public-release approvals remain pending. See [Turnstile private setup](turnstile-development-setup.md) and [exact approved transport scope](controlled-gmail-test-approval.md).

Evidence: `artifacts/controlled-gmail-test-results.json`, `pilot-relay-postflight.json`, `developer-reset-preservation.json`, `email-public-audit.json`.
