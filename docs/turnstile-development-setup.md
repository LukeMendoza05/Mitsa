# Mitsa — Turnstile preparation and private setup

Updated 2026-10-15. The user has created a Cloudflare account and the **Mitsa - Development** widget in **Managed** mode, with intended Free service and pre-clearance disabled. Keep that widget; no account creation or widget replacement is needed. Private local inspection confirms neither key has been supplied to Mitsa yet. Public registration and live Supabase CAPTCHA settings remain unchanged.

## Readiness-test root cause and correction

The new mocked registration-context test generated its synthetic signing credential using `randomBytes(32).toString('base64url')`. Mitsa's existing signing boundary intentionally accepts only 64 lowercase hexadecimal characters (`validSigningKey` in `supabase/functions/_shared/registration-intent-auth.ts`). Because this fixture was invalid, `registrationContext` correctly skipped provider readiness and returned `enabled:false`, even when the mocked policy and CAPTCHA configuration were ready.

This was an incorrect **test fixture**, not a registration-policy, CAPTCHA-readiness or feature-flag defect. The correction changes only that fixture to `.toString('hex')`. The three context tests passed, followed by all 191 then-existing unit tests and the production build. Three private-setup checks subsequently passed within the expanded 194-test suite. No live signing key, guard, database policy, role, hook or registration gate was relaxed.

The tests also verify that public registration stays closed without CAPTCHA configuration, that only the public site key enters page context, that provider email confirmation remains mandatory, and that isolated synthetic registration does not acquire an external CAPTCHA dependency.

## Cloudflare dashboard setup

1. Open Cloudflare Dashboard → **Turnstile** → **Mitsa - Development** → settings. Keep **Managed** mode and **pre-clearance disabled**. No paid plan is needed for this preparation.
2. In hostname management, allow `127.0.0.1` and `localhost` for this development widget. Enter hostnames only: no scheme, port, path or wildcard. Mitsa's current canonical local origin stays `http://127.0.0.1:3000`; use that origin for testing rather than switching between hosts mid-session.
3. Save the widget configuration. Obtain its **site key** and **secret key** privately. Do not paste either into chat, screenshots, source code or shell arguments. The site key will eventually be public in the widget; the secret is server-only.
4. For a future Vercel deployment, first obtain the actual assigned hostname. The preferred `mitsa.vercel.app` is not claimed or assumed available. Create a separate Managed widget for that environment and allow only the actual assigned Mitsa hostnames. Do not allow `vercel.app`, all preview deployments, or local hosts in a production widget. Domain, redirect-origin and hosting activation remain separate reviewed changes.

Cloudflare permits local hostnames for a development widget and recommends excluding them from production keys. Wildcard characters are unsupported; a configured hostname also authorizes its subdomains. [Local testing guidance](https://developers.cloudflare.com/turnstile/troubleshooting/testing/), [hostname requirements](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/).

For a future new Cloudflare account only: use the dashboard's account signup, verify the account, open Turnstile, select Add widget, give it an environment-specific Mitsa name, add the intended hostnames and choose Managed. This has already been completed for the current development widget.

## Exact private PowerShell command

Run in your own ordinary PowerShell terminal, not a shared terminal, transcript or chat:

```powershell
Set-Location -LiteralPath 'C:\Users\Luke\OneDrive\Documents\ChatGPT\Fireworks_Inventory'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\configure-turnstile.ps1
```

1. At the first hidden prompt, paste the development widget's site key and press Enter.
2. At the second hidden prompt, paste its secret key and press Enter.
3. Expect: **Private Turnstile configuration saved. Registration remains isolated-test. No network or Supabase change was made.** Report only that outcome or the generic error, never the keys.
4. Clear the clipboard after saving. Do not print `.env.local` or upload it. The helper requires Git to ignore both the file and its temporary replacement, checks the exact isolated target and loopback origin, refuses public/pilot modes and dummy keys, and changes only these three settings:

```text
MITSA_PUBLIC_CAPTCHA_PROVIDER=turnstile
MITSA_TURNSTILE_SITE_KEY=(entered privately)
MITSA_TURNSTILE_SECRET_KEY=(entered privately)
```

The keys are stored in the existing private, ignored `.env.local` server configuration, not encrypted by this helper. They are never put in command-line arguments, reports or logs. This follows the project's existing server-secret storage model; keep the Windows account and file private. The script-scoped execution-policy option changes no persistent PowerShell policy. The secret has no `NEXT_PUBLIC_` prefix and is not passed into the browser. No Supabase credential, hook, SMTP setting or public-registration flag is changed.

Saving keys alone does **not** open signup to the public or display a public signup widget in the isolated flow. After saving, open `http://127.0.0.1:3000/testing/registration` privately. Its development-only human-verification check uses the actual configured widget and the same server validator as public signup. Complete the challenge, then choose **Check server verification**. Report only whether **Server verification passed. No account was created.** appears, or the generic visible error. Do not copy browser request bodies or tokens. The check clears each proof after use and cannot issue an intent, create an account or assign a role. Production returns 404 for both the guide and diagnostic endpoint.

Live regular-browser server verification and replay rejection have now passed, confirmed by the user. The embedded browser's 300030 challenge failure does not invalidate the regular-browser result. The first expiration attempt was cancelled and proves no expiry rejection. The corrected diagnostic submits automatically after 301 seconds and requires confirmation before discarding the held proof; a second widget no longer runs during the wait. Reload once in regular Chrome/Edge, complete a NEW challenge, choose **Start expiry test** without first verifying that new proof, and keep the page open. No final click is needed. Report only **Expired proof was rejected. No account was created.** or the actual visible error. Expiry remains pending until that live result is confirmed.

The subsequent automatic live run returned HTTP 403 but the older diagnostic collapsed its reason into a generic message. That is neither a confirmed local discard nor a proven expiration-specific provider response. The current diagnostic keeps the original widget mounted, disables its automatic refresh only for this test and preserves the held proof across widget expiration callbacks. It shows bounded provider/origin/network classifications. `invalid-input-response` is ambiguous (invalid, malformed or expired), so it is not counted as an expiration-specific pass; neither is Mitsa's own freshness rejection. The earlier provider reason cannot be reconstructed. See artifacts/turnstile-expiry-investigation.json. No registration activation until the required live result passes.

Latest result: the user completed that mounted-widget timed run, and the server explicitly returned **invalid-input-response**. Successful rejection of an unusable held proof is recorded; expiration-specific cause is still unconfirmed. Source review and desktop/mobile regressions confirm original-proof retention even through replacement, expiry/error callbacks and viewport changes. Actual signup-handler + real-validator regressions reject invalid/replayed proofs and provider-success proofs aged 300 seconds or more, before issuing any intent. No further manual five-minute wait is requested. The original readiness gate remains closed unless the user accepts the narrowly documented [evidence criterion](controlled-registration-evidence-decision.md); that criterion does not weaken the validator or claim provider-specific expiry was observed.

## Prepared application integration

The public signup form renders the Managed widget with action `signup`, responsive sizing, nonce-compatible loading and accessible status feedback. Expiration, failure or a failed submission clears the one-use proof. A failed load cannot authorize signup. Public human verification requires JavaScript; existing sign-in and isolated native form submissions remain available.

The server submits each proof to Cloudflare Siteverify before creating any signed registration intent. It requires successful validation, the exact configured origin hostname, action `signup`, and a fresh timestamp. Missing, oversized, malformed, expired, replayed, wrong-host, wrong-action, failed or unavailable-provider results fail closed. No email, password or account identity is sent in that validation request. The browser widget itself necessarily communicates with Cloudflare; privacy disclosures must account for this before legal publication.

Cloudflare tokens expire after five minutes and are single-use. CAPTCHA validation must happen on the server. [Official Siteverify requirements](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

Supabase remains the email-code and session authority. The strict provider signup hook still requires a valid email-bound registration intent; direct Supabase signup cannot supply that private authorization by inventing a CAPTCHA field. CAPTCHA is an additional condition, not a replacement for Terms, signed-request/replay checks, durable rate limits, email confirmation, MFA or workspace authorization.

This design verifies Turnstile in Mitsa's server before the signed intent. **Do not enable Supabase's built-in CAPTCHA toggle with the same token**: a token cannot be consumed by both verifiers. The user's latest authorization permits necessary isolated provider-CAPTCHA changes after compatibility checks, superseding the older indefinite prohibition. The existing provider-wide toggle remains unchanged because enabling it without coordinating sign-in and recovery could lock existing users out. The strict provider signup hook and private signatures still enforce the CAPTCHA-backed intent boundary against direct API signup.

## Remaining evidence and release gates

- Both private credentials are detected; live server success and replay rejection passed in regular Chrome/Edge. The corrected live expiry retest remains pending. Mocked desktop/mobile diagnostic, keyboard, five-width and accessibility checks pass separately and do not replace live provider evidence.
- Test missing/failed configuration, forged and reused proofs, wrong hostname/action, direct provider calls and durable limits using separate synthetic identities.
- The user's latest prompt authorizes isolated open registration and necessary user-initiated email delivery after controlled end-to-end/security checks. It does not authorize production or legal publication. The prepared recovery-hook extension is beyond the prior signup-only review and still requires its separate approval; see [exact candidate](development-recovery-approval.md).
- Existing developer account, verified MFA, D Extacy Fireworks workspace, membership, location and history stay preserved. No deployment or database migration is needed for key storage.
