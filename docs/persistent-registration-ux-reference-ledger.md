# Mitsa — authentication refinement reference ledger

The dominant reference is Mitsa's approved editorial interface: Source Serif 4, Inter, white/fog surfaces, restrained controls and text wordmark. The existing desktop/mobile previews in `docs/previews/ui-refinement/after` were inspected before editing. This is a refinement, not a landing-page or workspace redesign.

Refero style/screen/flow research was attempted during the approved planning work and returned `NO_SUBSCRIPTION`. No subscription was purchased. The bundled Refero craft guide supplied form labels, focus-visible treatment, input/autocomplete attributes, spacing and progressive-feedback guidance. The installed React review checklist was applied after the component edits; it supplements the established design direction.

| Reference | Specific adaptation |
|---|---|
| Approved Mitsa desktop/mobile layouts and Steep-inspired typography | Keep existing columns, serif hierarchy, neutral palette, wordmark, control shapes and spacing. Add only restrained disclosures, status text and recovery controls. |
| [Linear login methods](https://linear.app/docs/login-methods) | Keep email-code entry paste-friendly and a single field; distinguish account creation, pending verification and returning sign-in. |
| [Notion two-step verification](https://www.notion.com/help/two-step-verification) | Explain authenticator enrollment and confirmation as separate steps. Preserve verified-factor identity and avoid treating password recovery as MFA removal. |
| Refero bundled craft: forms/focus/feedback | Persistent labels and helpers, keyboard focus on errors, generous controls, clear waiting/disabled reasons, short transitions and reduced-motion support. |

Implemented choices: Account → Email → Authenticator → Workspace progress stays consistent; agreement/Privacy versions are reviewable before acceptance; Create Account explains its human-verification dependency; interrupted requests have a bounded wait and explicit own-request status; recovery uses its own challenge action; resend maintains cooldown; delivery status distinguishes SMTP acceptance from inbox receipt. Password visibility and confirmation remain native accessible controls.

The real page/component source is rendered with synthetic aliases for browser tests. That renderer has no environment files or provider credentials, rejects mutations, and blocks external requests. Its fake Turnstile proves layout/state behavior only. Screenshots contain empty password/code fields; no real account, QR, OTP or authentication credential is captured. Real provider lifecycle, delivery and onboarding verification remain the separately approved live stages.
