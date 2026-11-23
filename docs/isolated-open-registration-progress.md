# Mitsa — isolated open registration implementation

The latest user authorization supersedes older instructions to keep isolated open signup and real authentication email delivery disabled indefinitely. Activation is conditional on live expiry rejection, security checks and a complete controlled new-account journey. Production, Vercel deployment, legal publication, existing account/MFA resets and unrelated business modules remain outside scope.

## Implemented locally

- `development-open` runs only in development at **http://127.0.0.1:3000**, using the existing isolated test agreement and pilot schema. It does not turn on production/legal release gates.
- General development eligibility has no developer email allowlist. Before activation, controlled mode restricts one new recipient by hash without inserting it into the developer allowlist.
- Server-side Turnstile is required before the private signed intent. Exact hostname/action/freshness, single-use proof, origin/CSRF, Terms, provider hook, durable intent limits and mandatory confirmation remain enforced.
- Signup creates no workspace role. Existing verified/MFA-backed workspace creation assigns Business Owner atomically and creates the initial location.
- A separate operator email service keeps database administration, Windows DPAPI credentials and PGP decryption outside Next.js. It authorizes only fresh/latest bound provider captures, claims durably before SMTP and never blindly retries an uncertain delivery.
- Limits: 10 messages/hour, 20/day, one/recipient/minute. Controlled run: at most four authentication messages in 30 minutes. General local sessions: at most two hours, explicitly restartable. A database lease expires within 60 seconds after the worker stops/crashes; a stale heartbeat closes the app signup path within 15 seconds.
- Already-delivered codes remain verifiable when new signup closes, with the sealed continuation, provider OTP and original-intent finalization still required. Resend requires available delivery.
- Expiry diagnostic now automatically submits a held fresh proof after 301 seconds. Cancellation requires confirmation; no replacement widget runs during the wait. Network/provider failure cannot count as expiration rejection.

## Evidence and pending work

| Requirement | Current result |
|---|---|
| Earlier email rejection | Deliberate development frontend and provider intent/hook allowlist, not a Gmail or MFA failure. The earlier mocked readiness failure was separately an invalid signing-key fixture. |
| Real Turnstile success/replay | User-confirmed regular-browser server verification and replay rejection passed. |
| Real Turnstile expiry | Latest timed live run rejected the held proof with **invalid-input-response**. Successful unusable-token rejection is confirmed; expiration-specific attribution remains unconfirmed. No repeat five-minute wait requested. Exact original-proof retention and actual signup rejection are independently regression-tested. See [bounded evidence decision](controlled-registration-evidence-decision.md). |
| Embedded browser | Cloudflare 300030 challenge failure; regular-browser success is confirmed. No CAPTCHA bypass added. |
| Hostname | Real 127.0.0.1 token passed exact hostname validation. For widget configuration, enter `127.0.0.1` and `localhost` without scheme/port. The app's approved origin remains 127.0.0.1:3000; localhost is not substituted for it. No live localhost claim until tested. |
| Supabase built-in CAPTCHA | Unchanged. Application-side Siteverify consumes the proof before the signed intent; provider hook denies missing/forged intents. Enabling the provider-wide toggle with that consumed token would be incompatible and could affect existing sign-in/recovery. |
| Existing Gmail milestone | Two confirmed inbox receipts; fresh six-digit verification, compromised previous-code rejection, replay rejection and cooldown passed. Completed window remains closed. |
| Controlled new account | The same alias completed the approved delivery-only continuation: one Gmail message received, email verified, original intent/Terms finalized, one trusted authenticator and AAL2 session, and L.F Fireworks sole-Owner workspace with Bulacan Warehouse. Delivery is now closed. Returning sign-in remains pending. See [current checkpoint](controlled-onboarding-current-status.md). |
| Password recovery for new addresses | Exact separately approved candidate applied as 20261015072934; helper and capture predicate verified, original functions/owner/ACL preserved, rollback snapshot integrity/decryption verified. Positive unallowlisted real-email recovery awaits the controlled lease; no activation to bypass the expiry gate. [Exact changes/hash/rollback](development-recovery-approval.md). |
| Local checks | 268 unit tests, including clock-skew, delivery-only continuation, controlled-recipient separation and the actual signup handler + real validator boundary; 12 desktop/mobile diagnostic checks plus three GET-only closed-delivery verification cases including JavaScript disabled. Accessibility and overflow checked. |
| Hosted checks | 40 tests across nine registration, session, MFA/RBAC, tenant, captured-code and invitation/security suites passed. Eight further captured-email desktop/mobile browser journeys passed, including native/enhanced verification, MFA, workspace creation, returning sign-in, resend/cooldown and invalid/expired/replayed codes. These use synthetic allowlisted accounts and do not substitute for the pending fresh unallowlisted real-email test. |
| Preservation | Read-only comparison confirms the developer account, verified MFA, workspace, membership, location and historical rows match their encrypted baseline. No real account used as disposable data. |
| General activation | Not active. The functional controlled journey, including returning password/MFA sign-in and reopening the same workspace, completed. Strict session-specific logout revocation proof, direct authenticated cross-tenant checks and new-user recovery evidence remain pending. The prior-session evidence flag has not been relabeled as passed. See [final report](controlled-onboarding-final-report.md). Existing account/MFA/workspace data remain preserved. |

## Commands and personal test sequence

These are local commands, **not deployment**. Do not activate before evidence and the separately approved recovery candidate pass.

```powershell
Set-Location -LiteralPath 'C:\Users\Luke\OneDrive\Documents\ChatGPT\Fireworks_Inventory'
node --conditions=react-server .\scripts\isolated-registration-service.mjs --check
```

After the required gates pass, the operator starts the controlled worker with `--activate-controlled`. It verifies the project and marker before opening the lease. The user completes the real human challenge in regular Chrome/Edge; automation does not solve CAPTCHA. The controlled address remains private in `.secrets/onboarding-recipient.json`; copy it privately rather than posting it in chat.

After all controlled evidence passes, start with `--activate-general` and use **http://127.0.0.1:3000/signup** for a fresh valid inbox without developer allowlisting. Accept the development agreement, complete Turnstile, enter the latest six-digit email code (60-minute expiry), confirm identity and enroll Google Authenticator, create a new workspace and initial location, enter its Owner dashboard, sign out, then sign back in using password and MFA. Do not reuse or modify the existing developer account or D Extacy Fireworks workspace.

Stop with Ctrl+C or, from a private terminal:

```powershell
node --conditions=react-server .\scripts\isolated-registration-service.mjs --stop
```

The worker closes on failure/timeout. Database/API signatures and RLS remain enforced even while registration is open. Existing login remains available when new signup closes. If delivery capacity is exhausted, wait rather than bypassing limits. Codes, passwords, addresses and MFA setup material must never enter reports, screenshots or logs.

Gmail is a low-volume development transport, not the larger-launch plan. Google may restrict sending despite available local quota. A verified-domain transactional provider with bounce/suppression monitoring is needed before scaling. The leaked-password protection warning remains documented as a launch concern. See [provider limits and migration path](development-recovery-approval.md#capacity-and-remaining-conditions).
