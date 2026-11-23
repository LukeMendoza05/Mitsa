# Mitsa email verification — reference lock and decisions

Scope: code verification and signup resend only; preserve the approved landing, account and multi-workspace architecture. Supabase remains the only authentication-code issuer and verifier.

Primary reference: existing Mitsa Sign In/Sign Up composition and `auth-refresh-design.md`. Preserve Source Serif 4 headings, Inter controls, white canvas, fog story panel, 420–464px form width, ink pill actions and neutral focus rings. Mobile keeps the form in one column. Refero's live screen search returned `NO_SUBSCRIPTION`; bundled `craft-details.md` supplies bounded label/paste/focus/touch guidance. No new palette, artwork or animation system.

| Decision | Source / role | Reason |
|---|---|---|
| Reuse two-column auth shell; original workspace preview on the left | Existing approved Mitsa design | Intentional desktop composition without another visual system |
| One persistent code label and one text input with numeric keyboard and one-time-code autofill | User requirements; Refero form guidance | Paste, password-manager support and accessible editing without six separate focus stops |
| Code input currently requires eight numeric characters | Captured provider codes and owner dashboard confirmation | Preserve the working eight-digit flow; requested six-digit standardization awaits coordinated provider/application approval |
| Primary Verify email; outlined Resend code below with quiet countdown | User brief; existing CTA roles | Keep confirmation primary and suppress repeated sending |
| Native POST remains available; JavaScript only enhances pending states/countdown | Existing Mitsa authentication architecture | Accessible operation without script-dependent verification |
| Generic invalid/expired feedback, newest-code guidance, clear return to sign in | User requirements; actual provider resend behavior | Avoid account enumeration and outdated-code confusion |
| Explicit confirmation after opening legacy links | Existing scanner-safe implementation | GET never consumes a one-use confirmation token |
| No recipient, code, token or private configuration in screenshots | Existing security boundary | Review layout without exposing authentication material |

Verify in actual browsers at desktop/mobile sizes, all five required widths, enlarged text, keyboard access, reduced motion and without JavaScript. Preserve the 14 landing fingerprints. Screenshots use only synthetic pending registrations and mask the code field. Do not claim Gmail delivery or live template activation from browser/provider verification tests.
