# Mitsa — controlled signup evidence decision

Status: **the user explicitly approved this scoped evidence criterion** for isolated development. The approval is recorded in artifacts/controlled-registration-evidence-decision.json. Expiration-specific attribution remains unconfirmed. The separately approved recovery-hook migration is already applied and verified; neither decision requires repeat approval. The controlled window opens only after fresh target, capacity, recipient and preservation checks; general registration still requires completed controlled onboarding/security evidence.

## Established facts

- Real regular-browser server verification and provider replay rejection passed.
- The latest 301-second hold received a real server/provider rejection: **invalid-input-response**. This is successful rejection of an unusable proof, **not confirmed expiration-specific rejection**.
- Cloudflare defines that code as invalid, malformed or expired. The code alone cannot identify which cause occurred. Its expiry documentation also discusses timeout-or-duplicate; the observed result must not be relabeled to match that wording.
- Source inspection finds no assignment replacing the held proof during the wait. It is separate from the widget's current token; only test start, final cleanup, cancellation or component unmount writes/clears it. The updated diagnostic keeps the widget mounted and prevents diagnostic refresh/resize replacement.
- Desktop/mobile browser regressions explicitly replace the widget's current proof, trigger expiry and error callbacks, change viewport size and advance the clock. They confirm **one submission of the exact original held proof**, with no widget removal during the hold. This is automated fixture evidence, not a retroactive byte comparison of the user's private live token, which was never retained.
- New tests run the actual signup handler with the actual validator, replacing only provider HTTP and downstream side effects. Generic invalidity, provider expiry/replay, missing/oversized proofs, wrong host and network/malformed-response failures are refused before issuing an intent. Provider-success proofs aged 300000, 300001 and 301000 milliseconds are also refused. A fresh matched proof reaches only the signed-intent boundary. Native POST uses the same rejection path.
- No invalid/stale proof is accepted. No signature, CSRF, Terms, rate, email confirmation, MFA or RLS guard is proposed for removal.

## Proposed decision

The user's original requirement was: **“Confirm the five-minute Turnstile expiration test passes before activating registration.”** Its expiration-specific provider attribution remains unconfirmed. Another identical manual wait would not reliably remove the provider-code ambiguity.

Recommend accepting the **demonstrated held-unusable-proof rejection plus strict signup freshness/lifecycle regressions** as sufficient evidence to begin the already-authorized controlled isolated signup test, while permanently recording this run's expiration-specific attribution as unconfirmed.

This changes only the operator's evidence prerequisite. It does not change the real signup validator: Cloudflare must still return valid success with the exact hostname/action and a fresh timestamp; every invalid, expired, replayed or unavailable result is rejected.

The prepared service requires an explicit recorded human decision before using this alternative evidence. Without it, the existing gate still refuses activation. The record must identify the exact isolated project and evidence criterion; frontend success, missing regression evidence, another project or production scope is refused. No decision file is written automatically.

## Exact subsequent scope

- Isolated **mjtejwafxriwntweussc**, marker **fireworks-foundation-proof-01a12e38**, loopback **http://127.0.0.1:3000** only.
- One 30-minute controlled run; the privately prepared fresh dedicated-sender Gmail +alias only, never developer-allowlisted; at most four legitimate authentication email attempts.
- Keep real Turnstile on signup, private signed/replay-protected intents, Terms, six-digit/3600-second provider email verification, resend cooldown and existing MFA/workspace/RBAC/RLS safeguards.
- Mail is durably claimed, encrypted capture retained, limits 10/hour and 20/day plus one/recipient/minute enforced; no blind SMTP retry. Stop on critical failure; the DB lease expires within 60 seconds if the worker fails.
- Run the full new-user signup, actual inbox, verification/resend, MFA, workspace/initial location, Business Owner, logout, returning sign-in, persistence, recovery and cross-tenant tests. No existing real account/business records are disposable.
- General isolated registration may activate under the user's existing conditional authorization **only after** the controlled journey and remaining security checks pass. It would use the explicitly approved evidence criterion without claiming provider-specific expiry was observed. Production, Vercel deployment, paid changes, legal publication and unrelated invitations/modules remain excluded.

Alternative: keep controlled registration closed until separate provider-level evidence establishes the specific expiry cause. No further five-minute manual run is requested without a concrete reason it would add evidence.

References: [Cloudflare validation/error meanings](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), [widget lifecycle/refresh](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/).
