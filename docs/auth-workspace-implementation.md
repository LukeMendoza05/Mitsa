# Mitsa authentication implementation

Approved basis: the final authentication, workspace, RBAC, MFA, privacy and retention plan reviewed on 2026-10-14.

**Current state:** the authoritative continuation is [auth-completion-ledger.md](auth-completion-ledger.md). Core desktop/mobile signup, verification, MFA, authorized workspace management, invitations, ownership transfer, password recovery and scoped independent privacy review/export/correction are working and verified. Strict controlled provider hooks are active in the isolated project; unrestricted public registration remains disabled. Later sections below retain the original checkpoint and pre-hook evidence; their remaining-work lists are historical and superseded by the completion ledger.

## Definition of done

- Provider-backed signup, email verification, password recovery, native POST forms and MFA lifecycle work end to end.
- Workspace creation is atomic; exactly one Owner, Admin and Staff permissions, location restrictions and financial restrictions are enforced in the database.
- Invitations, ownership transfer, independently reviewed recovery and privacy requests are auditable, concurrency-safe and tested.
- Retention proposals and legal drafts cannot silently become published policy or real-data disposal rules.
- Existing authentication contracts, synthetic proof records, landing design and motion remain compatible.
- Typecheck, build, unit, integration, security, relevant browser/accessibility checks and reconciliation pass; unavailable configuration is reported.

## Release gates

Implementation approval covers repository work and the established isolated test target only. Production migrations, public registration, real external invitations, legal publication, subscription purchases and real-data disposal require their separate approvals.

The isolated target is identified by `config/test-target.json` and its database marker. Never infer permission from Supabase's default-branch PRODUCTION label. Runtime administrative credentials remain forbidden.

## Interface reference lock

Primary: existing approved Mitsa pages, derived from the user's Steep reference. Preserve Source Serif 4 headings, Inter controls, white/fog surfaces, ink buttons, persistent labels and restrained motion. Reuse existing header/footer and 440px authentication forms. Settings use readable responsive rows and clear permission descriptions; no decorative scenes or invented business modules.

Refero live styles/screens were queried on 2026-10-14 and returned NO_SUBSCRIPTION. Bundled craft guidance is the fallback, particularly native forms, visible focus, password-manager attributes, touch targets and semantic error announcements. No subscription change is authorized.

## Progress

- Repository, current Auth adapter, isolated target and existing tests re-inspected.
- Isolated database marker verified; 164 existing synthetic workspaces have exactly one active Owner each.
- Implementation underway. This document is a checkpoint, not evidence that the full plan is complete.

## Applied isolated migrations

- `20261013181012_mitsa_workspace_foundation`: converts only synthetic manager/cashier memberships to Admin/Staff; adds workspace metadata, deferred sole-Owner invariants, account/factor security state, protected command implementations, and the gated request/legal/retention/outbox structures.
- `20261013181135_mitsa_membership_commands`: adds permission-checked membership/location/invitation commands, dual-confirmation ownership transfer, workspace-wide financial reset and audit reads.
- `20261013185440_mitsa_account_security_terms`: enforces exact current Terms in workspace commands, adds provider-backed factor removal/disable, service-only registration intents, the unconfigured provider hook, and verified finalization.
- `20261013223908_mitsa_registration_boundary`: atomic signed-request replay ledger, shared limits and revoked legacy service entry point. The later isolated Edge deployment followed a separate audit and fresh explicit user approval.
- `20261014001000_mitsa_reenrollment_session`: requires the authorized reset session or a fresh password sign-in for reenrollment, and rejects pre-reset permits.
- Supabase-generated migration versions are reflected in the local filenames. No production target was accessed.
- First hosted attempt failed on the incoming function owner's schema CREATE permission and rolled back completely. A narrowly scoped temporary grant corrected it; CREATE is revoked at the end. Both migrations then committed successfully.
- Preflight confirmed 347 synthetic accounts, 164 synthetic businesses, 328 memberships and no Storage objects. The private recovery snapshot contains original application/probe records and function definitions, not managed Auth secrets.
- Postflight verified all 1,521 original records/relationships, with only the approved role conversion. Forced RLS, sole Owners, non-login/non-bypass roles, lack of managed Auth access, inability of clients to assume command roles and closed release gates were verified.

## Working interfaces

- `/proof` remains the existing fixed login/callback destination and now bridges to `/workspaces`.
- Workspace picker, server-authorized workspace shell, explicit synthetic onboarding, access-denied state, and native POST MFA challenge are implemented.
- Current test Terms review/acceptance, authenticator QR/manual setup, backup/replacement, recent-password confirmation, safe removal/disable and retryable provider-removal completion are implemented. Setup secrets are encrypted in a five-minute, identity/session-bound HttpOnly/Secure/Strict cookie and are not retained in the database or captures.
- Progressive form enhancement preserves native POST and generic error/pending feedback. A hidden `action` field previously shadowed the DOM form destination; requests now use the component's explicit destination. Password visibility controls remain hidden without JavaScript.
- Owner/Admin workspace reads and commands require a live, verified, application-bound factor and AAL2. Staff remain location-scoped. Existing provider factors without a prior trusted Mitsa enrollment permit fail closed rather than becoming trusted automatically.
- Authentication pages retain the Mitsa design; the landing page's source, motion and assets were not modified by this implementation.

## Verification completed so far

- `npm run typecheck` passed.
- `npm run build` passed, including the workspace/security routes.
- `npm run test:unit`: 99 passed at the latest checkpoint. Executes actual migrations in disposable PostgreSQL, verifies the synthetic TOTP fixture against RFC vectors and covers signed registration/entrypoint failures.
- `npm run test:integration`: 43 hosted tests passed at the latest checkpoint, including the registration boundary, factor reset lifecycle, role/location/tenant isolation and existing compatibility tests.
- `npm run test:security`: 15 passed, including 8 new workspace/MFA/invitation/transfer scenarios.
- Supabase security advisor: only the known leaked-password-protection warning, which requires the separately approved production hardening/subscription decision.
- Unit/build commands required execution outside the Windows sandbox after its temporary-module-cache and filesystem-canonicalization errors; no application workaround or weaker test was introduced.
- Targeted `npm run test:e2e -- authentication.spec.ts hosted-authentication.spec.ts foundation.spec.ts`: 22 passed on desktop/mobile, including JavaScript-disabled sign-in, MFA challenge and workspace access, membership removal, session isolation, CSRF, cookie renewal, logout and recovery-link regressions.
- The production browser test server used port 3001 (`MITSA_E2E_PORT=3001`) because the user's existing server occupied port 3000. The existing server was not stopped. Playwright validates its override against the two allowed loopback ports and supplies the matching APP_ORIGIN.
- Picker layouts were checked at 320/390/768/1024/1440px; desktop, tablet and mobile captures were visually inspected. Axe checks passed. Captures are under `docs/previews/auth-workspaces/`.
- Expected provider warnings appeared only in deliberate forged-cookie/revoked-refresh negative tests; those requests returned generic denial and cleared invalid cookies as asserted.
- `npm run db:reconcile`: 182 committed synthetic commands/events at the latest checkpoint, zero projection, missing-event or outcome mismatches.
- Latest browser verification covers all 24 cases. The full aggregate passed 22; two native cases hit a substring selector that matched both authenticator-code fields. Both passed the targeted rerun after making that selector exact. Earlier password-selector/setup-deadline failures are superseded by these results. The full native Terms/MFA lifecycle, JavaScript enhancement/error focus, accessibility and responsive screenshots passed.
- Latest postflight preserved all 2,101 snapshot records; forced RLS, safe roles, sole Owners and closed release gates passed. See the [registration security audit](registration-intent-security-audit.md) for exact snapshots, coverage, risks and pending deployment approval.
- Automatic review initially blocked an elevated test due to its usage limit; no action ran. Review later recovered, and the original check passed through normal review. Windows sandbox cache/DNS failures were handled through approved escalation, without weakening application checks.
- Fresh user approval authorized only the isolated registration Edge deployment/configuration. The reviewed function is ACTIVE version 2 with custom signing authentication and gateway JWT verification disabled. Eight live smoke/provider-setting checks passed, including 21 HTTP requests; actual missing configuration returned 503 before settings were added. Public signup, provider-hook activation, external email, legal publication and production remain disabled. The private settings match local/dash digests and remain ignored by Git.

## Remaining approved work — goal still active

1. Registration UI/server signing path, separately approved controlled provider hook setup, captured verification delivery and end-to-end finalization. The isolated Edge function, protected SQL and Terms enforcement are implemented and verified; public registration stays disabled.
2. Independently reviewed lost-all-factors recovery and scoped operator execution. Full ordinary MFA lifecycle UI and recent-password confirmation are implemented.
3. Invitation acceptance/resend UI, captured test delivery, Resend SMTP/API integration and signed webhooks. External delivery stays disabled.
4. Membership/location/business/financial/audit/ownership settings interfaces and additional concurrent/negative transfer cases.
5. Forgot/reset-password flow, safe new email-link interstitials, abuse controls and complete session lifecycle regressions.
6. Actual privacy-request review/execution, completed legal drafts, holds/disposal execution and restore/erasure tests. Versioned test acceptance, category retention proposals and a fail-closed pure disposal preview exist; no real disposal or legal publication is enabled.
7. Final browser, accessibility, enlarged-text, reduced-motion, metadata/storage/branding audits and full aggregate checks/reconciliation.

Schema structures alone do not satisfy these remaining workflows. Current Terms are enforced in workspace creation and commands; provider registration remains disconnected and disabled. Eligibility and retention proposals remain unapproved production policy, as specified in the plan. The user first held deployment, then explicitly approved isolated function deployment/configuration after the audit. This does not authorize provider-hook activation, public signup, external email or production. Preserve all completed implementation work.
