# Mitsa — controlled onboarding checkpoint

Latest update: the user completed returning sign-in and reopened the same workspace after MFA. A new trusted AAL2 session and unchanged workspace/factor/location records are confirmed. The functional journey is complete; strict session-revocation proof and general-registration security sign-off remain pending. See [final controlled onboarding report](controlled-onboarding-final-report.md). Earlier pending-return instructions below are historical.

Current state, **15 October 2026**: the new unallowlisted controlled test account completed real inbox delivery, six-digit email verification, trusted MFA enrollment and workspace/initial-location onboarding. Do not treat this identity as pending email verification, repeat signup, recreate it, reset its MFA or reopen an email window to test returning sign-in.

## Completed and verified

- User confirmed receipt of the fresh Gmail message and successful code entry. Provider records confirm verified email, one original finalized signed intent and one registration consent acceptance. Encrypted capture remains private; no OTP or authentication secret was reported.
- One message was accepted by Gmail SMTP during the delivery-only continuation. The same private test identity and original intent were retained. No extra verification message was requested by the agent.
- The account is distinct from the original developer account. Its stored profile matches the user's reported **Yuno**.
- Exactly one active membership belongs to **L.F Fireworks**, with **Business Owner** role. The new identity is the primary owner and sole active owner. A single `workspace.created` audit event records this identity as the creator; workspace creation occurred after this account's registration.
- The workspace has exactly one active initial location matching **Bulacan · Warehouse**.
- One provider-verified TOTP factor has an unrevoked current-generation trusted Mitsa binding. The account is initialized and not recovery-locked. A live provider session records **AAL2**, matching this trusted factor, with password and TOTP authentication methods.
- There is no membership in another workspace for this test account. The original developer has no membership in L.F Fireworks, and the new account has no membership in the original developer-owned business.
- Six relevant private tables retain enabled, forced RLS. Anonymous/authenticated direct probes expose no tenant rows: they are permission-denied or RLS-filtered to zero rows. API membership and MFA predicates remain intact. No SQL impersonation of the provider authenticator or manufactured bearer token was used. A direct cross-tenant request from the user's actual Guest browser remains untested; do not describe that specific black-box check as completed.
- The original developer account, verified authenticator, D Extacy Fireworks, membership, initial location and all 11 historical baseline application rows passed the read-only preservation comparison.

## Email window closed

The operator closed the now-completed delivery portion early. The lease and SMTP flags are closed, and the worker exited after its lease was revoked. Its bounded `capacity` stop diagnostic reflects that explicit operator stop, not a new delivery failure. Exactly one real message was accepted and received. No window extension or reopening occurred. Returning password/MFA sign-in works independently of email-delivery availability.

## Remaining

The user has been guided to sign out in the same Guest profile, confirm Sign In, sign in with the private test alias/password, verify the existing test authenticator, then reopen L.F Fireworks and confirm Yuno / Business Owner / Bulacan Warehouse. No new QR enrollment, developer-factor change or email OTP is needed for returning MFA.

Returning sign-out/sign-in and workspace reopening are **pending**, not passed merely because an AAL2 session already exists from enrollment. A private pre-return checkpoint retains only identity IDs and hashes of session IDs; it reads no bearer/refresh token, password or factor secret. Read-only comparison will distinguish a genuinely new password+TOTP AAL2 session from the enrollment session and check prior-session revocation and unchanged workspace/location/factor IDs. Human confirmation still establishes the actual browser journey.

General registration remains disabled. Complete returning access, remaining tenant/browser and recovery/security evidence before general activation under the user's conditional authorization. Do not begin unrelated inventory, POS, analytics or dashboard feature work here.

Evidence: `artifacts/controlled-onboarding-progress.json`, `artifacts/controlled-workspace-authorization.json`, `artifacts/controlled-returning-signin.json`, `artifacts/developer-reset-preservation.json`, and the private Git-ignored returning checkpoint. No private address, OTP, QR, password or token is included in this document.
