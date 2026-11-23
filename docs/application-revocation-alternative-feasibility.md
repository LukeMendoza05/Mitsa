# Mitsa — application-owned revocation feasibility

**Local assessment only; no schema, provider configuration or application authorization behavior changed.** The internal Auth trigger remains unapproved and not recommended in its current form.

An application-owned denylist can be safer operationally than writing to provider-managed Auth tables. It does not by itself detect a provider-side refresh-family event. Detection and enforcement must be reviewed independently.

## Requirements for a complete alternative

1. A trustworthy terminal-revocation event must identify the exact provider session, including events initiated directly through Supabase Auth rather than Mitsa routes.
2. Recording that revocation must be durable and irreversible for the compromised session, with independently authenticated operator actions if exceptional recovery is permitted.
3. Every protected API/RLS path must consult it. A Next.js page guard alone cannot stop direct PostgREST access.
4. Revocation must win races against token refresh and protected operations according to an explicitly chosen in-flight-request policy. A refreshed JWT for the same revoked session must not restore access.
5. Other sessions, identities, factors, memberships and workspace data must remain untouched. Normal concurrent refresh and legitimate parent retries must remain usable.

## Detection limits in the present architecture

| Candidate event source | What it can establish | Missing guarantee |
|---|---|---|
| Mitsa's own refresh-error handling | A terminal error seen by that server request; supported local logout can close that exact session | Direct Supabase Auth errors bypass this handler |
| Browser callback/storage event | The browser's local state | Not an authoritative security event; attacker may omit the browser entirely |
| `getUser()` | Provider identity validation | Tested: accepted the identity after family revocation |
| Session row/expiry read | Confirmed logout or elapsed provider expiry | Tested legacy reuse leaves the row active |
| Read-only live-refresh count | The all-revoked state at the moment read | A replacement issued during grace can make the count live again; no durable event history |
| Periodic provider-log processing | Potentially a retrospective security signal | Delivery, identity attribution, completeness and detection delay need proof; cannot be called immediate |
| Documented provider event/hook or supported corrected release | Potentially a complete authority source | Supported event coverage/configuration for failed refresh reuse has not been established |

No available evidence establishes a complete immediate application-only substitute today. Adding a private table while ignoring the detection gap would merely move the uncertainty.

## Recommended sequence

Keep the existing supported local logout and read-only session validation. Use the prepared sanitized provider reproduction to clarify terminal reuse semantics and supported release/configuration options. No external message has been sent.

The user has since selected private provider clarification and requested submission guidance. The [support package](supabase-support-submission.md) is prepared for the user to submit; no agent has sent it. The separately requested [bounded-session-risk assessment](bounded-session-risk-assessment.md) is non-implemented and does not accept or change the immediate-revocation requirement.

If a documented event source is available, prepare a narrowly scoped application-owned ledger and enforce it in the existing verified-actor boundary and all sensitive APIs. Such a migration, grants and any hook configuration require a separate concrete review/approval. Do not implement a second authentication architecture or mint impersonation JWTs.

If the provider offers only bounded JWT validity, present that as an explicit limitation and a product/security decision for the isolated environment. Keep the immediate-revocation gate unresolved until the user changes that requirement or a verified correction meets it. Do not relabel a shorter expiry, UI redirect or passing happy-path test as immediate terminal revocation.

No registration or email-delivery activation is part of this feasibility work. The completed onboarding, MFA, workspace and exact-browser logout milestones remain intact.
