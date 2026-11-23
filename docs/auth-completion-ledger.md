# Mitsa authentication completion ledger

## Current persistent-registration checkpoint — 24 October 2026

C1 corrective identity boundary, C2 disabled service, C3A eight-request integration and **C3B(a) inactive test-notice installation are PASSED**. The exact test Terms/Privacy pair is installed, unpublished and unselected. Fresh encrypted preservation and postflight confirm only those two additions; all retained account/MFA/workspace/history/security data and both C3A ledger rows remain unchanged. C3B(a)'s retry used 144/200 additional reads and its single transaction; the earlier 120 reads remain historical. See [C3B(a) authoritative result](stage-c3ba-retry-result-20261024.md).

General registration, delivery, transport and security readiness remain disabled. No new account, worker, message or provider setting is authorized by this milestone. Strict Option A remains BLOCKED under SU-519045, independently of the completed inactive infrastructure. Remaining C3B(b)/D/E/F/activation need their exact approvals and dependencies; an independent transport-only D addendum may be prepared with zero messages/admission. The older checkpoints and table below retain their dated evidence and must not be read as a current general-registration/security sign-off.

Current continuation checkpoint, 2026-10-15: the developer authentication/MFA/Owner workspace milestone remains complete and protected. The approved controlled Gmail test is now complete: two inbox receipts, fresh six-digit code verification, unexpired compromised-code rejection, replay denial, cooldown and automatic closure passed. Original consent finalized only for the separate synthetic account; no membership, workspace or MFA factor was assigned. All original 4,755 rows/grants/RLS and the existing developer account/MFA/workspace are preserved. See [Gmail results](controlled-gmail-test-results.md).

Latest authorization supersedes earlier indefinite isolated signup/email prohibitions: general isolated registration may activate after security and controlled onboarding pass. Both real Turnstile credentials are configured; regular-browser server success and replay rejection passed. The cancelled expiry attempt is not a pass; a corrected automatic retest is pending. Local development-open eligibility and a bounded mail service are implemented but inactive. A fresh dedicated-sender +alias was prepared privately without registration or developer allowlisting. The additional recovery-hook predicate is prepared and requires its separate scoped approval. See [current implementation](isolated-open-registration-progress.md) and [candidate](development-recovery-approval.md). Older table entries below describe their original milestones rather than overruling this current checkpoint.

Turnstile application keys and live widget/token validation remain pending. Broader delivery and public signup, production, deployment, legal publication and personal reset remain closed. See [current readiness](email-next-phase-readiness.md). Historical milestone statements below describe their earlier checkpoints; current external-mail status is the completed, closed two-message test above.

Goal: the complete authentication and workspace experience in the user-supplied objective, not the registration Edge prerequisite alone. Goal remains active. The previous goal turn was **progress**: isolated deployment/configuration and eight hosted smoke checks changed authoritative state and proved the endpoint's behavior.

## Current completion checklist

| Area | State | Evidence / remaining work |
|---|---|---|
| Sign in, sessions, MFA, workspace entry, logout, route protection | Milestone A verified in actual local browser | Dedicated synthetic Owner used native product screens, real Supabase password/MFA, workspace entry, reload, logout, signed-out denial and unrelated-workspace denial |
| Synthetic signup interface, verification, registration integration | Milestone B verified in actual browser | Native signup → private captured verification → explicit verification POST → password confirmation → MFA enrollment/binding → atomic Owner workspace → dashboard; public registration remains closed |
| Owner onboarding and workspace switching | Verified | Actual desktop/mobile signup → verification → MFA → atomic sole-Owner workspace; two independent workspaces and different memberships verified |
| Workspace management interface | Implemented | Business settings, locations, members/invitations, permissions/financial setting, access history, dual-party ownership, account profile/password and security screens |
| Owner/Admin/Staff and financial permissions | Verified | Server/database denial of forged role/financial actions; Staff assigned-location access; cross-workspace denial; dual transfer resets Admin financial access |
| MFA lifecycle | Verified, reviewed reset not activated | Actual native and enhanced enrollment, backup, replacement, disable, reenrollment and stale-session safeguards; loss of all authenticators supports independent requests/review only |
| Invitations and ownership transfer | Verified in isolated capture | New Admin signup/acceptance/MFA; new Staff signup/acceptance; existing-account acceptance; resend rotation, expiry, revocation, concurrent idempotency and outgoing-Owner removal |
| Verification/recovery capture | Implemented and live verified | Private SQL hook encrypts only explicitly allowlisted synthetic mail; private key stays operator-local. Resend external delivery still lacks an approved sender/domain and remains disabled |
| Three legal pages and privacy workflows | Drafts plus scoped execution verified | `/privacy`, `/terms`, `/cookies`; immutable test agreement acceptance; independent request review; subject-only export and actual profile correction; closure/deletion requests stay unexecuted |
| Scoped support operators | Approved and verified | Exactly two synthetic accounts, real MFA before scoped grants, zero workspace memberships; reviewer/executor separation, self-review denial and revocation tested |
| Resend foundation | Local adapter tested; live integration incomplete | Original account mail templates, pinned SDK, bounded idempotent send adapter and raw signature/minimized-event validation; no active external worker/webhook/SMTP |
| Controlled provider signup/hook configuration | Separately approved and configured | Rejecting registration-intent hook and encrypted Send Email hook enabled first; provider email signup permits only valid intent/allowlist flow; confirmation mandatory, anonymous off, public gates false |
| External mail, legal publication, production | Not authorized | No action in this implementation changes these gates |
| Core complete-journey verification | Passed; remaining privileged executors excluded | Desktop/mobile Owner/Admin/Staff/signup/recovery/switching/transfer/review journeys passed; actual lost-factor reset and disposal have not been activated or tested |

## Milestone A — actual access

The local port-3000 process was serving an older production build, including obsolete invitation-only sign-in copy. Its exact workspace path and port ownership were verified; only that stale project process was stopped. `npm run dev -- --port 3000` now serves current Mitsa source. Other processes were preserved.

Working local URL: `http://127.0.0.1:3000`. Sign in: `/login`. Workspace picker: `/workspaces`. A dedicated synthetic Owner's exact authorized workspace is recorded privately by `scripts/provision-test-access.mjs`.

The operator-only setup uses the pinned isolated project, database marker, closed gates, supported synthetic Auth creation, actual TOTP verification/application binding, current synthetic Terms and atomic workspace creation. It never auto-grants access to an existing business and never changes provider signup settings. It preserves an existing setup and refuses credential/factor bypass.

Credentials and the development authenticator key are in ignored `.secrets/development-access.json`, never in source, documentation, logs or captures. For manual test access, open that file privately on this computer, add its authenticator key to your own authenticator app, sign in at `/login`, then complete the authenticator challenge. Do not share or commit that file. These are synthetic test credentials, not production access. The application is already open in the authenticated workspace in the in-app browser.

Observed browser checks: actual password sign-in → AAL1 membership picker → mandatory trusted TOTP challenge → Business Owner workspace; reload preserves access; logout returns to sign-in; requesting the protected workspace while signed out returns to sign-in; an unrelated slug returns access denied; restoring MFA returns to the authorized workspace. No authorization/RLS/MFA bypass was used.

Screenshots without credentials are under `docs/previews/auth-workspaces/development-workspace-{1440,768,390}.jpg`. Production build and typecheck passed before the browser walk-through; final production regression remains required after subsequent interface changes. Development-only CSP now follows the installed Next.js guide's React debugging permission; production retains the strict nonce policy and has an explicit browser assertion against unsafe eval.

## Preservation

`artifacts/landing-preservation-baseline.json` records hashes of the landing source, motion files and served assets before this continuation. Landing design, typography, models, animation and choreography must stay intact. Unrelated/uncommitted files are preserved.

## Milestone B — registration in the actual app

User separately approved controlled synthetic signup and captured-mail configuration. Exact project and marker were rechecked before each migration/configuration change. Migrations `20261014014343`, `20261014015632` and `20261014021816` add UI dependencies, isolated encrypted capture and provider PKCE-hash compatibility. The rejecting registration hook and private Send Email hook were activated while signup was still disabled. Email signup was then enabled only behind these hooks. Confirmation stays required; anonymous login and every public release gate remain off. No external mail provider was contacted.

`artifacts/controlled-signup-smoke.json` records seven successful real-provider groups: unauthorized direct API rejection; absent mail configuration rejection with no Auth account; native signup with no session before verification; verification/finalization/Terms without role grants and replay denial; no workspace without MFA; captured recovery and old-session revocation; actual TOTP binding, idempotent sole-Owner workspace creation and logout.

The actual Mitsa browser also completed signup, captured verification, explicit verification POST, password confirmation, authenticator setup, workspace form and authorized dashboard. The new synthetic credentials and authenticator key remain only in ignored `.secrets/signup-access.json`. Neither setup secrets nor links are printed or captured. Opening a verification link alone does not consume it.

Observed integration details: managed Before User Created hooks commit separately from a subsequent failed mail operation, so a failed signup's consumed nonce remains bound; the application issues a fresh intent for each retry. Supabase SSR uses `pkce_` hashes; capture and verification preserve the prefix unchanged. The provider email quota was raised to 100 captured messages/hour for isolated tests; SQL still enforces 10/recipient/hour and 100/project/hour. This grants no external-mail permission. Original quota readback was redacted by browser tooling; no original numeric value is asserted. Latest postflight preserved all 2,551 snapshot records and confirmed forced RLS, safe roles, sole Owners and closed gates.

The pending approval document is now an approval record; it must not be used to ask for the same configuration again. Reconfiguration of another project or public/external release remains unauthorized.

## Milestones C–F — verified continuation on 2026-10-14

Applied `20261014034721_mitsa_captured_invitations` and, after fresh scoped user approval, `20261014044022_mitsa_reviewed_requests`. No production target or real customer information was used. The latter preserves original cases and grants no operator capability by itself. The explicit operator setup created exactly two synthetic accounts, verified actual TOTP/application bindings, then assigned only the approved independent scopes. No workspace role was assigned.

The full desktop and actual mobile-device journeys passed for new Owner signup, scanner-safe verification, mandatory MFA, workspace/location creation, Admin invitation/signup/acceptance/MFA, Staff invitation/signup/acceptance without mandatory MFA, assigned-location isolation, direct forged-action denial, switching between two workspaces, independent permissions and dual ownership transfer with financial reset. Password recovery passed on desktop/mobile with its own trusted-authenticator challenge, password update, old-password denial, old-session denial and MFA sign-in afterward. Provider revocation racing rendering now returns sign-in instead of a Server Component cookie-write error. Proxy checks the live provider user; the database still checks signed session provenance.

Independent review passed through actual desktop/mobile forms: a verified subject submits a request, a scoped reviewer records independent verification, a separate executor creates the export or corrects the profile, and only the subject downloads the export. Self-review, unauthorized review/execution, unrelated export access and revoked operator access were denied. An approved MFA-recovery case remains approved, not completed: no factor reset was performed. Export access expires after 24 hours; disposal/retention promises remain proposed.

The development server intermittently served a stale module with an undefined invitation-cookie export. A controlled restart preserved browser cookies and database state. Focused staging tests then passed on desktop/mobile; the complete mobile invitation journey passed. Production staging checks passed independently. A repeated-URL test assertion was corrected to wait for the actual review decision; no permission check was weakened.

Verification evidence:

- `npm run typecheck`, `npm run build`, and all **120 unit tests** passed.
- Full hosted integration suite: **50 passed**. Three added invitation/ownership cases also passed across the initial run (two) and corrected second-workspace-Owner fixture rerun (one). The targeted rerun intentionally selected only that case; two other cases were filtered, not unavailable.
- Production authentication/browser suite: **24 passed** on desktop/mobile, including JavaScript-disabled Terms and the entire MFA replacement/disable/reenrollment lifecycle, refresh, session isolation, CSRF, membership denial, replay/expiry and logout.
- Public-page quality: ten checks passed initially; two ambiguous password locators were made exact and both native-navigation checks passed. These cover eleven public routes, automated WCAG checks, 320/390/768/1024/1440px reflow, 200% text, reduced motion, keyboard focus, branding/title/draft disclosures, no external assets and no unexpected browser errors.
- Reconciliation: **193 commands/events**, zero projection, missing-event or outcome mismatches. Latest postflight preserved **2,741 original records**, with forced RLS, safe roles, no legacy roles, no invalid Owners and all release gates closed.
- All **14 landing/motion/asset hashes unchanged**: `artifacts/landing-preservation-final.json`. Development experiment returns 404; production check is in the browser suite.
- Final authenticated management audit: both desktop/mobile cases passed across overview, business settings, locations, members, permissions, ownership, access history, account, MFA, privacy and recovery pages. Automated accessibility, five widths, 200% text, clean console/storage and logout passed. An actual scrollable-table keyboard-focus issue was fixed in permissions/access history before the passing rerun. Production experiment checks passed twice.
- Production laboratory loading checks passed: reduced-motion desktop/mobile plus enhanced desktop; LCP ≤2.5 seconds, CLS ≤0.1 and existing bundle/model budgets. The enhanced-desktop case is intentionally not applicable to the mobile project (one explicit filtered case).
- Security advisor: only the existing leaked-password-protection warning; no RLS advisory. No paid service upgrade was performed.

Credential-free screenshot evidence is under `docs/previews/auth-workspaces/`: `login-final-*`, `signup-final-*`, `journey-owner-*`, `privacy-*` and production security captures. Desktop/mobile screenshots have been visually inspected. Test credentials, recovery links and TOTP keys remain only in ignored `.secrets/`; no raw token or key is put into report artifacts.

## Remaining implementation and release limits

Core account/workspace access and scoped request review are usable. The broader goal remains active: an actual independently authorized lost-all-factors executor, account/workspace disposal/restore verification, and activated durable Resend delivery/webhook processing are not complete. The latest approval expressly excluded MFA reset and deletion; the two active support identities have no recovery-execution privilege. Do not infer that an approved recovery/deletion request permits execution.

External mail needs an approved verified sender/domain, provider credentials, reviewed durable outbox/webhook persistence and separate delivery approval. Legal operator/contact, eligibility, retention/backup schedules and final policy publication remain unapproved. Retention proposals do not enable disposal. No production, public registration, external-mail, deletion or legal-publication gate is opened by these results.

Next: prepare and audit the narrow recovery-execution boundary without activating it, then obtain fresh scoped approval before any reset capability or disposable synthetic reset test. Preserve completed core journeys and current records.

## Later scoped follow-up: developer registration and auth layouts

The user redirected work to personal developer signup and intentional desktop/mobile auth pages. After explicit fresh approval, only migration `20261014055453_mitsa_developer_registration`, the private singleton email activation and bounded registration Edge diagnostics (version 3) were activated in the same isolated project. No developer Auth account/password/factor/membership was created by the agent. Existing synthetic access, confirmation, Terms, MFA, tenant isolation and closed release gates remain enforced.

Final verification for this follow-up: typecheck/build passed; 129 unit tests, 21 relevant hosted integration checks and 50 browser checks passed (14 auth-refresh, 2 captured-recovery, 34 production regressions). Both pages were captured and inspected at all six requested viewports; actual doubled text, reduced motion, keyboard/error focus and automated WCAG checks passed. All 14 tracked landing files/assets are unchanged. Postflight preserved 3,544 original application/probe records. The private-value/public-bundle audit found no exposed private email or configured secrets; the testing guide returns 404 in production. Root cause, approvals, recovery, file list, screenshots and personal account instructions are in [developer-registration-handoff.md](developer-registration-handoff.md). The broader release/execution limits in the earlier checkpoint remain unchanged.
