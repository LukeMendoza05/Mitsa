# Mitsa — completed controlled Gmail verification

Verified 2026-10-15 in isolated project mjtejwafxriwntweussc. The final one-message window closed at **04:24:06 UTC / 12:24 PM Manila**. No further delivery is active or authorized by that completed window.

| Check | Verified result |
|---|---|
| Gmail SMTP and receipt | Two accepted attempts across both windows; the user confirmed receipt of both. First-message Mitsa branding, six-digit format, 60-minute expiry and instructions were confirmed. No SMTP error recorded. |
| Fresh-code verification | Normal Resend Code produced a fresh encrypted six-digit Supabase code. Mitsa verified it and finalized the original consent record. |
| Earlier exposed code | Rejected while still inside its 60-minute lifetime. Never used for successful verification. |
| Replay | Newly consumed code rejected on reuse. Independent negative probes explicitly returned HTTP 403 / otp_expired for both codes with no user/session; network, rate-limit and server errors cannot count as invalidation. |
| Cooldown and limits | Immediate resend rejected; the locked one-message final-window limit and existing SQL rate/cap/claim tests pass. Exactly one new and two cumulative accepted claims remain; no automatic retry. |
| Closure | Both pilot flags/helper closed, local isolated-test mode restored, active approval manifest removed, all public/global external gates closed. |
| Synthetic access | Confirmed account, finalized original Terms, zero memberships and zero MFA factors. No workspace or role auto-created. |
| Existing developer data | Account, verified MFA, workspace, Owner membership, location/history unchanged. All original 4,755 rows, function owners/grants and RLS policies preserved. |
| Local regression checks | 221 unit tests/35 files, TypeScript and eight local browser checks passed. |

Evidence: artifacts/controlled-gmail-test-results.json, controlled-gmail-completion-postflight.json, controlled-gmail-code-rejections.json, developer-reset-preservation.json and pilot-relay-postflight.json. No email, code, password or token is included in these reports.

The previous browser, timestamp and same-URL waiting failures are retained in [history](history/controlled-gmail-test-results-before-completion.md). The timing correction waits for the actual POST and a new document, after the button's real cooldown, rather than a URL already on screen.

Public registration remains disabled. Turnstile private key setup and real widget validation, broader-recipient/recovery transport, abuse/direct-provider/end-to-end checks, provider capacity and final eligibility/legal/security approval remain separate prerequisites. No Supabase SMTP/CAPTCHA setting, production, developer reset or deployment was changed. See [current readiness](email-next-phase-readiness.md) and [the completed approval record](controlled-gmail-finish-approval.md).
