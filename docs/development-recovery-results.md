# Mitsa — approved isolated recovery-hook results

Applied only to **mjtejwafxriwntweussc**, after verifying marker **fireworks-foundation-proof-01a12e38**, exact reviewed candidate SHA-256, closed gates, original function definitions, encrypted rollback integrity/decryption and the existing developer preservation baseline.

Migration: **20261015072934_mitsa_development_recovery_eligibility**. The local migration is an exact copy of the reviewed candidate, whose original path is retained for its hash/rollback manifest. No Auth hook pointer, table grant, OTP setting, provider SMTP setting, existing user/MFA/workspace data or production setting changed.

Postflight verifies:

- Only the reviewed recipient predicate changed in the encrypted Send Email hook.
- Original signup-intent and Before User Created functions are unchanged.
- Original hook owner, ACL, invoker security and pinned configuration are preserved.
- The new helper is an invoker; only supabase_auth_admin can execute it.
- All global production gates remain false; pilot and SMTP flags remain false.
- The private rollback snapshot still matches its hash and decrypts correctly. Offline PostgreSQL exercised exact hook restoration/helper removal and rolled back that rehearsal successfully.

Validation after application: **242 unit tests**, **eight hosted checks** across recovery/captured-code/provider/closed-pilot suites, **10 diagnostic browser checks**, and **two desktop/mobile captured password-recovery journeys** pass. The recovery journeys preserve synthetic MFA and revoke prior synthetic workspace sessions. Unauthorized direct recovery for a verified, unallowlisted synthetic account without its finalized intent is rejected, with no capture or delivery. No real email was sent by these tests.

Positive recovery for a newly registered nonallowlisted real inbox will be tested in the controlled lease after live Turnstile expiry is confirmed. Do not open the lease to bypass that prerequisite. Gmail’s earlier completed verification milestone remains intact. General signup is still inactive.

Evidence: artifacts/development-recovery-approval-recheck.json, development-recovery-postflight.json, isolated-registration-service-preflight.json and developer-reset-preservation.json.
