# Mitsa — Stage C2 disabled deployment: PASSED with recorded warnings

24 October 2026, Asia/Manila. The explicitly approved C2-only work is complete. `mitsa-registration-service` version **1** is deployed in isolated project `mjtejwafxriwntweussc`, with gateway JWT verification off and **`MITSA_REGISTRATION_SERVICE_ENABLED=false`**. The platform's ACTIVE status means deployed; it does not mean registration is enabled. No C3 action followed.

## Deployment and exact source provenance

Deployed bundle SHA-256: `dca295c28aaa37aea61b6a8db0849094f09f3eca40c42884f3f2d0494798819e`.

Only this function name was submitted for deployment. Entrypoint: `supabase/functions/mitsa-registration-service/index.ts`; import map: `supabase/functions/mitsa-registration-service/deno.json`. All seven approved files were submitted unchanged, with no private environment or credential file in the package.

| Submitted source | SHA-256 | Post-deployment evidence |
|---|---|---|
| `supabase/functions/mitsa-registration-service/index.ts` | `248965336eda834de507f842487673619dec677cf13d3947c500b22d66d485f0` | Retrieved bytes match. |
| `supabase/functions/mitsa-registration-service/deno.json` | `1b6167a0ee26abd3478ff5918e2de9eb6bc87d7c01f63892e1aeeea5277b6d8f` | Retrieved bytes match. |
| `supabase/functions/mitsa-registration-service/deno.lock` | `ce70e91004a0d31208a73048996e177b3adebb246cc1a422ace2c4e247d9b825` | Submitted unchanged; omitted by hosted source retrieval. Remote lock bytes are not claimed verified. |
| `supabase/functions/_shared/registration-service.ts` | `8dc648df54856937a6e0cce0b556297fd14b3146a4ddd96ac04abfc3592b452c` | Retrieved bytes match. |
| `supabase/functions/_shared/registration-service-auth.ts` | `74fb4d841f021c5db64856fc638e2268197faee13a22edddcaeba5b8330cca3f` | Retrieved bytes match. |
| `supabase/functions/_shared/registration-intent-auth.ts` | `969dab701f69c29f2acc33de991e47fe7c883ba50eddcc849e3aded215e1669b` | Retrieved bytes match. |
| `src/lib/auth/persistent-registration.ts` | `bbd62568f1b1e6cea779f4efeb60fa1ac89ca35d57202523e8e5c91128341cf3` | Retrieved bytes match. |

The approved frozen/cached local dependency check remains the lock provenance evidence. Hosted source retrieval returns six source/config files, not the lockfile; this is a stated verification limitation, not seven remotely retrieved hashes or proof of every transitive hosted build detail.

## Preflight and private configuration

CLI authentication and secret metadata access succeeded after the user's private sign-in. The dashboard current member was marked YOU/Owner. Exact project/marker, seven source hashes, C1's 23 definitions/owners/ACLs/settings, role restrictions and disabled controls passed. Existing legacy service/bundle matched before writes. No C1 migration was repeated.

The new signer and enable-flag names were absent. Existing `MITSA_APP_ORIGIN` and `MITSA_PUBLISHABLE_KEY` hashes matched the approved origin/current application key; neither was rewritten. The initial comparison failed because the local reader expected metadata named `digest`, while this CLI returns the SHA-256 under `value`. The reader was corrected to compare independently calculated full hashes; approved deployment sources and hosted values were not changed to make the check pass.

A distinct random 32-byte signer was generated privately and configured as `MITSA_REGISTRATION_SERVICE_KEY` in hosted Edge secrets and protected local Next server configuration. Only that new secret and the false enable flag were added remotely. The same values were added locally; every unrelated local setting remained unchanged. Postflight secret digests confirm both signers match, enabled=false, and **all pre-existing secret values unchanged**. No platform-managed Supabase key was replaced. The temporary upload file was removed after verification; the server key remains in ignored local configuration. No credential was printed, passed as a command argument, committed or included in the deployed files.

The [official secret guide](https://supabase.com/docs/guides/functions/secrets) describes project secret storage and supported private environment-file configuration. Secret presence/digest checks prove configuration, not enabled-path HMAC execution; that remains C3 work.

## Exactly three smoke requests

| Slot | Method | Status | Body | Cache |
|---|---|---|---|---|
| 1 | GET | 503 | Generic `unavailable` | `no-store` |
| 2 | POST | 503 | Generic `unavailable` | `no-store` |
| 3 | GET | 503 | Generic `unavailable` | `no-store` |

No credentials, cookies, API key, signature or body was sent. No retry or redirect following occurred. **Three of three slots are used; zero remain.** The durable local request ledger prevents rerunning the smoke helper blindly. No further endpoint request was made during postflight.

The disabled handler response, exact source and verified false configuration support rejection before command/client work. Database preservation independently confirms no new replay/request row, account, cohort, dispatch, capture or SMTP claim. This is not a test of enabled signing, live signup, OTP, MFA or recovery.

## Preservation and database postflight

A fresh encrypted snapshot was created and decrypted/digest-verified before writes. Its postflight comparison passed: all rows across **41 private/foundation tables**, server-computed account/MFA-factor digests, relation ownership/grants, RLS policies and column grants are identical. Developer and Yuno identity/authenticator/ownership/location audits passed before deployment. C1 postflight still matches all 23 reviewed definitions/owners/ACLs/settings, forced RLS and absent direct custom-role Auth-schema access. No application function or live Auth experiment was executed by the audits.

Both Auth hooks remained enabled in the loaded dashboard before and after. Before User Created visibly matches `private.mitsa_before_user_created`. Send Email's field remains browser-redacted; its exact name is based on the user's prior confirmation of `private.mitsa_isolated_send_email`, not a bypass of redaction or a new direct value read. No selector or Auth provider setting was written.

The public/private-file audit passed for 42 existing public files, including comparison against the newly configured signer. Protected configuration remains ignored/untracked. No application/UI source changed, and no full unit suite/build or retained-user login was repeated merely for deployment.

## Legacy version metadata warning

The legacy `mitsa-registration-intent` version counter changed **3 → 4** during the approved sequence. Its bundle remains exactly `70003dc2425a7c00b75ffeda59881a752e1dbb8cb1b95f3afcaddc66bd241af5`; all five retrieved source/config files match their expected local bytes. Gateway JWT setting, entrypoint, import-map path and update timestamp are unchanged. The legacy function was never submitted to the deployment tool, and its existing secret values are unchanged.

The cause of the counter change is **not independently verified**. Do not describe an inferred secret-revision/cache effect as a confirmed provider explanation. This warning does not indicate an observed source, gateway or identity change, and is not a finding that Strict Option A has passed. It is retained explicitly rather than claiming every metadata field was identical. No attempt was made to reset the counter, redeploy the legacy service or change unrelated settings.

## Recovery and remaining boundary

**Recovery performed: none.** Disabled deployment, source/configuration, smoke and data-preservation checks passed. No destructive rollback, legacy redeploy, database recovery or credential reset was attempted. No external email, worker, account, MFA, business data, RLS, ownership, production or Vercel change occurred.

Registration admission, delivery, transport and security readiness remain false; policy/generation/worker bindings remain unassigned; Next remains legacy. **General registration is not operational. Strict Option A remains BLOCKED under SU-519045**, with no residual-risk exception accepted.

The next separate approval is **C3A**, as described in [hosted integration preparation](stage-c3-hosted-integration-preparation.md): temporarily enable only the private service, keep all database gates false, perform at most eight specified no-account signing/replay/direct-API checks (at most two private request-ledger rows), and restore enabled=false. No user/account, email, worker, consent or Auth-provider change is included. Review the recorded metadata warning and current C2 baselines before that stage; stop on any further unexplained source/configuration drift. C3B provider-hook/account testing and D–F activation still require their own scopes and Strict Option A resolution where applicable.

Evidence: `artifacts/stage-c2-deployment-result-20261024.json`, `artifacts/stage-c2-source-secret-postflight.json`, `artifacts/stage-c2-disabled-configuration.json`, `artifacts/stage-c2-executed-smoke.json`, current C1 postflight/preservation and local privacy artifacts. Do not rerun C2 setup, regenerate the signer, overwrite the submitted package or reopen its exhausted smoke budget on an automatic continuation.
