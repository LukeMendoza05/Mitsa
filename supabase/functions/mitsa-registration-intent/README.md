# mitsa-registration-intent (isolated deployment)

Read `../../../docs/registration-intent-security-audit.md`. Fresh explicit user approval was received and the function/configuration deployed only to the isolated project on 2026-10-14. Eight live smoke/provider-setting checks passed. Public signup, provider-hook activation, external email, legal publication and production remain disabled or unauthorized.

The reviewed isolated target is `mjtejwafxriwntweussc` only. Deployment must use `verify_jwt: false` for this function because it authenticates a private server signature before any user login. This setting is not authorization by itself.

Required Edge settings:

- Built-in `SUPABASE_URL`, exactly the isolated project URL.
- Built-in `SUPABASE_SERVICE_ROLE_KEY`, never copied into ordinary Next.
- `MITSA_PUBLISHABLE_KEY` (routing only).
- `MITSA_APP_ORIGIN`, exact approved origin without path/trailing slash.
- `MITSA_REGISTRATION_INTENT_KEY`, independently generated random 32-byte lowercase hex, private Next server and Edge only; never `NEXT_PUBLIC_`, never reuse another credential.

All configuration must pass validation or the handler returns 503 without constructing an administrative client. A valid configuration still requires a fresh HMAC signature and the database's atomic replay, policy and rate checks.

The caller serializes the exact strict input once and uses `signIntentRequest` over those bytes. It sends POST JSON plus Origin/apikey and the returned x-mitsa-* headers. Never offer a generic signing proxy or assume that a signature establishes end-user email ownership. Keep the future signup route gated; verify email through native Supabase Auth. Never pass passwords or role selections into this function.

The service RPC is `api.mitsa_signed_registration_intent`. Apply only reviewed isolated migrations with the expected marker/recovery snapshot. Its database allowlist permits synthetic recipients while public release gates remain false. No function here sends email, creates a provider account or grants membership.

After explicit approval and configuration, smoke-test missing/invalid signatures, body tampering, replay, expiry, unchecked Terms, unknown recipients, direct public RPC, rate limits, missing configuration and one synthetic positive path. Confirm provider public signup and external mail remain disabled. Recheck the exact function project after deployment. Do not enable registration, activate the provider hook, publish policy or deploy production as part of this action.
