# Mitsa registration-intent security audit

Status: **deployed and configured only in the approved isolated project**, following fresh explicit user approval on 2026-10-14. Hosted smoke checks passed. This audit records the original pre-hook deployment checkpoint. Subsequent separate approval activated strict registration and captured-mail hooks, and actual signup/workspace journeys passed; see [the current ledger](auth-completion-ledger.md). Public registration, external delivery, legal publication and production remain disabled or unauthorized. Historical statements about unactivated hooks below describe the original audit, not current configuration.

## Scope and target

Only `mjtejwafxriwntweussc`, database marker `fireworks-foundation-proof-01a12e38`, is approved. The function's configuration and signature audience are pinned to that project. Before deployment the function inventory was empty. After deployment/configuration it contains only `mitsa-registration-intent`, ID `7bf33324-e141-4c3e-bd07-84923eb1f62b`, ACTIVE version 2, `verify_jwt: false`. Its source bundle SHA-256 remains `4700d9612add94e23444e39082219c165a984a106da8c2367ed7f8a11f46c93e`; saving the secrets refreshed its version without changing the reviewed source. Production, public registration, external email, legal publication, disposal and paid upgrades remain unauthorized.

Recovery snapshots (ignored, private):

- Before the registration boundary: `workspace-before-1791931037833.json`, SHA-256 `4a8e53a8004c6be42adc0576fc85171708187423c887dd5ebac40533ddb4fb91`. Postflight preserved 2,058 original records.
- Before the MFA safeguard: `workspace-before-1791931546792.json`, SHA-256 `a091f025aeefc3db62fde196abd9ff668eee6e09b89e3f8a1131674045143ced`. Postflight preserved 2,101 original records.

Both preflights verified the exact project and marker, zero unexpected users/businesses and zero Storage objects. Follow `workspace-migration-recovery.md` for a forward repair; do not reset the project, delete histories, or restore unrelated Auth data.

## Why gateway JWT verification is disabled

Registration starts before a user has a signed-in session. Consequently, deployment uses `verify_jwt: false` **for this function only**, as explicitly approved. That removes the platform's user-JWT prerequisite; it does not authorize the request. Supabase documents this distinction in [Function configuration](https://supabase.com/docs/guides/functions/function-configuration) and [API keys](https://supabase.com/docs/guides/getting-started/api-keys).

The function is now a private server-to-server registration boundary. An independently generated 32-byte `MITSA_REGISTRATION_INTENT_KEY` must be held by Next's server and the isolated Edge runtime only. It is not a Supabase administrator credential, browser credential or end-user identity proof. Ordinary Next still rejects administrative credentials.

Each POST requires HMAC-SHA-256 over a versioned project/function audience, POST method, Unix timestamp, random 256-bit request nonce and SHA-256 of the **exact received body**. WebCrypto verifies the signature. The clock window is 60 seconds in either direction; SQL verifies freshness again. Modified bodies, other signing keys, missing/malformed signatures and stale/future requests fail before a privileged RPC.

A publishable/anon API key and request Origin **are not sufficient authentication or authorization**. They remain routing and CSRF hints. Knowing both cannot create an intent without the private signature. Browser CORS is not enabled for this server-only endpoint.

## Authorization and privilege boundaries

1. The Edge runtime alone holds its built-in Supabase service credential. The handler calls only `api.mitsa_signed_registration_intent` and never receives a password, creates a provider account, bypasses email verification, chooses a role, grants membership or publishes policy.
2. Anonymous and authenticated clients cannot execute the registration RPC, read its private ledger or mutate private records. The old service RPC entry point has been revoked to prevent bypass of the new replay/rate boundary.
3. Database implementations run as the existing non-login, non-superuser, non-bypass `app_workspace` role, with explicit policies and forced RLS. Ordinary clients cannot assume that role.
4. With current gates closed, only an operator-approved, enabled `foundation-...@example.invalid` test recipient can receive an intent for the exact current test Terms version. Unknown and real-world recipients are denied. Test fixture allowlisting does not enable public registration.
5. Input must contain exactly email, full name, Terms UUID and `accepted: true`; extra role/password fields and unchecked Terms are rejected. Legal versions and hashes cannot be silently rewritten.
6. The independent registration token is 256-bit random, stored only as a hash, email/policy-bound, expires after 24 hours and is bound to one provider user during the hook. A different provider user, wrong email, expired or finalized token is denied. Same-user hook retries are intentionally idempotent.
7. Finalization requires an actually verified provider identity and creates profile/acceptance records only. New workspace ownership remains a separate explicit MFA-protected action.

Acceptance is an explicit application assertion; no system can prove that a person read the text. The future native signup form must validate the unchecked-by-default checkbox and exact version before the server signs a request. That signup route is not yet connected, and the provider hook is not configured. Neither is implicitly enabled by deploying this function. Supabase's [Before User Created hook](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook) remains a separate controlled configuration and end-to-end test.

## Replay and abuse enforcement

`private.registration_requests` stores only a request nonce hash and timestamps. A shared transaction lock and primary key prevent the same signed request from succeeding twice across instances. Ledger consumption and intent creation commit together; an input/policy failure rolls back both. Successful signed requests are limited to three intents per email per hour, 30 globally per minute and 100 globally per hour. Limits are server-side database checks, independent of caller IP or in-memory counters.

Invalid requests cannot consume privileged database capacity without a valid signature. These limits do not prevent every unauthenticated network invocation from reaching the Edge runtime; gateway-level traffic controls and monitoring remain production prerequisites. No paid upgrade or provider configuration was made. Ledger expiry/disposal is not activated; minimized records remain until an approved retention procedure exists.

## Verification

- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm run test:unit`: **99 passed**. Includes 37 registration-specific checks and seven PostgreSQL workspace/MFA cases; actual SQL is executed in disposable PostgreSQL.
- Targeted hosted integration: **10 passed** before the final aggregate run, including actual disabled signup, account/MFA lifecycle and four registration-boundary cases.
- Registration HTTP handler was exercised against the **real isolated database**: three concurrent copies of a signed request yielded exactly one success; a fourth same-email intent was denied; direct anonymous RPC and the legacy service entry point were denied; global limits were verified in rolled-back transactions.
- Forged signatures, correct public key/Origin without a signature, changed recipient/Terms, expired/future requests, invalid inputs, oversized bodies, unknown recipients and unchecked Terms are covered.
- The actual Edge entry module was loaded with a mocked Deno environment contract: each missing required setting and a different project return 503 before creating an admin client. A valid configuration still rejects unsigned requests. This is not a hosted Deno runtime smoke test.
- Provider hook logic runs with exact Auth-role grants/RLS in disposable PostgreSQL. Hosted logic/catalog checks use a rolled-back operator transaction because Supabase forbids the operator from assuming its managed Auth role. Actual provider invocation remains pending configuration.
- Read-only postflight: forced RLS true, no unsafe roles, no legacy membership roles, no invalid Owners, all release gates false, original rows/relationships preserved.
- Final reconciliation: 182 committed synthetic commands/events, zero mismatches. This proves only the existing security probes, not future business ledgers.
- Full `npm run test:integration`: **43 passed across seven files**, including the real provider MFA reset/older-session/new-sign-in checks, RBAC, tenant/location isolation, ownership and API compatibility.
- Browser regression: **all 24 cases verified on desktop/mobile**. The aggregate passed 22; two native cases hit an ambiguous authenticator-field selector. After making that locator exact, both cases passed a targeted rerun. No application change or weakened assertion was needed.
- Native POST/JavaScript-disabled login, Terms, full MFA lifecycle and logout passed; progressive enhancement/error focus, CSRF, session isolation, membership denial, refresh and recovery-link regressions passed. Axe checks and 320/390/768/1024/1440px layouts passed; latest desktop/mobile security captures were visually inspected with no exposed setup secrets or clipped controls.
- Predeployment postflight preserved all 2,101 original snapshot records, with forced RLS and safe role/Owner invariants. Security advisor returned only the existing [Leaked Password Protection Disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) warning; no subscription or Auth configuration was changed.

## Approved isolated deployment and live smoke results

- User initially held deployment, then explicitly approved isolated deployment and private configuration after the audit. MCP deployed only the reviewed five source/configuration files to the pinned project.
- A live request **before secret configuration returned 503**, proving the actual deployed Deno entrypoint fails closed. After configuration, a request with the correct public key and Origin but no signature returned 401.
- Dashboard configuration added only `MITSA_REGISTRATION_INTENT_KEY`, `MITSA_PUBLISHABLE_KEY` and `MITSA_APP_ORIGIN`. Local and dashboard SHA-256 digests matched for all three. The independently generated signing key is preserved in ignored `.env.local` and `.secrets/registration-intent.env`; its value was never printed. No administrative credential was copied into Next. Temporary browser/host clipboards were cleared and the screenshot contains digests only.
- `npm run test:integration -- --run tests/integration/registration-edge.test.ts tests/integration/auth-settings.test.ts`: **eight passed**. The deployed function handled 21 HTTP checks: a valid signed request succeeded; simultaneous and later replay failed; modified input, forged/missing signatures, stale/future timestamps, invalid fields, wrong Origin/key, unknown recipients, noncurrent/unchecked Terms and oversized bodies were denied. The fourth same-email intent was rejected. Direct anonymous RPC was denied. Actual public signup and anonymous sign-in remain disabled.
- Database checks confirmed only hashed registration credentials, three intents for the successful synthetic fixture, zero provider accounts for **both** smoke recipients and zero remaining enabled smoke recipients. No email, workspace or membership creation was performed by the function. Every release gate remains false.
- Initial smoke evidence is retained in `artifacts/registration-edge-smoke-first-run.json`. Its future timestamp was generated before preceding network calls and aged into the allowed clock window, consuming a legitimate signed request slot. The fixture was corrected to remain outside the window; the rerun passed. No function security rule was relaxed. An added fixed-clock unit test verifies both exact 60-second boundaries and rejection immediately outside them; all 25 focused signature tests passed.
- Sanitized live results: `artifacts/registration-edge-smoke.json`. Safe dashboard evidence: `docs/previews/auth-workspaces/registration-edge-secrets.jpg`. Typecheck passed after the smoke test was added.
- Final postdeployment preservation check again passed: all 2,101 original snapshot records preserved, forced RLS true, zero unsafe/legacy roles, zero invalid Owners and all release gates closed.

## Remaining deployment risks and approval boundary

Hosted Deno/gateway behavior and private secret wiring are now smoke-tested. The built-in Edge service credential remains privileged: restrict configuration access, never log it, rotate on exposure, and keep the handler limited to the reviewed RPC. Never put it in Next's ordinary runtime. Edge secrets are project-scoped, so future functions must preserve the same trust boundary. Gateway traffic controls, the existing leaked-password warning, retention disposal and complete provider signup/verification remain production prerequisites.

The received approval covered this function and dedicated private signing configuration in the isolated project only. Those actions are complete; missing configuration remains fail-closed. Production release, public signup, external delivery, hook activation and published legal policy remain separate decisions. The registration UI/server signing path is not connected yet. To contain an incident, invalidate or remove only this function's custom signing setting so configuration fails closed, verify 503, and investigate without deleting histories, resetting the database or changing public registration gates.
