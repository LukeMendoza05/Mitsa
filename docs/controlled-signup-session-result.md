# Mitsa — authenticated-session signup redirect

Historical checkpoint: the zero-account findings below describe the 09:28 UTC redirected attempt. The later Guest-profile submission created the one pending test account. See [current delivery diagnosis and pending-account continuation](controlled-verification-resume-approval.md); do not repeat signup or use this earlier checkpoint as the current account state.

## Read-only findings, 15 October 2026

The controlled alias has no Supabase Auth user, no signed registration intent, no legal acceptance, no verification capture and no SMTP delivery claim. Verification has not started; there is no duplicate or partially created test account to repair. The approved isolated project/marker and the existing developer account, verified MFA, Owner workspace, membership, location and historical baseline were rechecked and preserved.

The user reported landing on Your workspaces with the existing developer identity and business. In the signup handler, the only successful `/workspaces` destination was the existing-session guard: `client.auth.getUser()` returned an already authenticated user, and the handler redirected before server-side CAPTCHA validation, signed-intent creation or `auth.signUp`. That behavior, the observed existing identity and the absence of all new-user side effects identify the session guard as the cause. Supabase did not create the requested new identity. Browser-side widget success in this attempt does not prove server-side Siteverify was called.

The user's browser cookies and tokens were not inspected or retained. Private windows in one browser can share an incognito session; this is a possible explanation for the cookie's presence, not a verified account of which window or browser action created it.

## Local correction

- The signup page checks live provider identity first. An authenticated browser sees an explicit already-signed-in notice, a link to Your workspaces and separate-profile instructions; no signup form, CAPTCHA or identity details are rendered there.
- The POST handler rejects an authenticated session with bounded `already_signed_in` feedback instead of silently navigating into the existing account. Enhanced forms receive 409 JSON; native forms return to signup with the same feedback.
- The check runs before registration policy, CAPTCHA validation, signed intents and provider signup. Existing sessions are preserved; no automatic logout, session revocation, MFA reset or account switching was added.
- A user who signs in after loading an anonymous signup form is caught again at submission. No newly submitted address is used to replace the existing session identity.

## Verification and continuation

All 259 unit tests across 39 files passed. Tests cover native/enhanced existing-session refusal without downstream operations or signup cookies, signed-in server rendering without identity/form exposure, and signed-out rendering through the existing policy. TypeScript and the production build passed. All nine live anonymous registration/security probes passed after the correction, with zero account, intent or email creation.

The previously approved controlled window retains its fixed **2026-10-15 09:38:24.913 UTC / 5:38:24 PM Manila** deadline. It is not extended or reopened. The user has been guided to a separate Guest browser profile, to confirm the unsigned signup heading before submitting once, and to report only Verify Email and inbox receipt or bounded error wording. No code entry or resend is requested until the first receipt is confirmed. General registration remains conditional on complete controlled onboarding and security evidence.
