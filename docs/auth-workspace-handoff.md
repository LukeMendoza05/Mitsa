# Mitsa authentication and workspace handoff — 2026-10-14

The approved scoped synthetic request-review activation is complete in `mjtejwafxriwntweussc` only. Core authentication and authorized workspace access work. The broader recovery/disposal/external-mail foundation still has the explicit limits below; it is not a production release.

## Working local access

- Application: <http://127.0.0.1:3000>
- Sign in: <http://127.0.0.1:3000/login>
- Controlled synthetic signup: <http://127.0.0.1:3000/signup>
- Authorized workspace picker: <http://127.0.0.1:3000/workspaces>
- Existing registered Owner workspace: <http://127.0.0.1:3000/w/workspace-3b1477d2-4a6f-44fa-b6b4-438e5c8b83e3>

The development server remains running on port 3000. All browser tests used separate contexts; the user's tab/cookies were preserved. Production-mode tests ran on port 3001 and stopped their own test server.

See [local-setup.md](local-setup.md) for private account access. Existing synthetic credentials and TOTP setup key are in ignored `.secrets/signup-access.json` under `owner`; read them privately, import the key into your authenticator, sign in and verify a current code. No credential is included in this report. Captured messages/links are private ignored files, not external emails. Do not reuse these accounts for customer information.

## Implemented and verified

- Native and enhanced email/password sign-in, show/hide, pending/errors, session refresh, expiry/revocation handling, logout and protected-route denial.
- Controlled native signup with full name, matching passwords, explicit current test agreement, signed registration intent, strict provider hooks, encrypted captured verification and scanner-safe explicit confirmation. No role/workspace is granted merely by signing up.
- Actual provider TOTP enrollment, backup/replacement, challenges, recent password/authenticator confirmation, secure disable/reenrollment and mandatory privileged Owner/Admin MFA. Staff MFA remains optional. Password recovery challenges trusted MFA and revokes old sessions without removing factors.
- Atomic sole-Owner onboarding, initial shop/warehouse, workspace picker/switching, business profile, locations, members, role/location restrictions, Owner-controlled Admin financial access, access history and dual-party ownership transfer. Outgoing Owner may remain Admin or lose access; Admin financial permission resets.
- Owner invites Admin/Staff; Admin invites Staff. Capture, seven-day expiry, token hashing, resend rotation, revoke, new/existing verified-recipient acceptance and concurrent idempotency are verified. No external invitation was sent.
- Account profile/password management; privacy access/correction/deletion requests; Owner closure requests; lost-authenticator review requests; explicit platform operator UI. Exactly two synthetic support identities, actual verified MFA before scopes, no workspace membership. Independent review and separate execution create a subject-only export or update the profile before completion. Self-review/execution, scope escalation, unrelated export access and revoked operator access are denied; sensitive reads/decisions/execution are audited.
- Three accurately marked legal drafts, immutable synthetic agreement versions/acceptance, proposed category retention matrix and blocked disposal preview. Original Mitsa design and business-module limitations are preserved.
- Local original email templates, official pinned Resend adapter and raw signed-webhook verification foundation, with tests and no active external delivery.

## Verification

| Check | Result |
|---|---|
| TypeScript and optimized production build | Passed |
| Unit tests | 120 passed |
| Full isolated integration suite | 50 passed |
| Added existing-account invitation/transfer cases | 3 passed across initial run and one corrected-fixture rerun |
| Production authentication browser suite | 24 passed, desktop/mobile, including native JavaScript-disabled MFA lifecycle |
| Full new-account/workspace/recovery/review journeys | Desktop and actual mobile device passed |
| Public-page quality | All 12 cases verified; two ambiguous field locators passed after exact-selector correction |
| Management-page quality | Both desktop/mobile cases passed across 11 authenticated pages; keyboard-scrolling accessibility fixed before rerun |
| Responsive and accessibility | 320/390/768/1024/1440px, 200% text, reduced motion, keyboard, automated WCAG, clean unexpected console/storage checks passed |
| Retired experiment | 404 in development and production |
| Landing preservation | All 14 tracked source/motion/asset hashes unchanged |
| Database preservation | 2,741 pre-activation application/probe records preserved; forced RLS, safe roles, sole Owners, closed gates |
| Synthetic reconciliation | 193 commands/events; zero projection, missing-event or outcome mismatches |
| Local loading | Enhanced desktop LCP 288ms, reduced-motion desktop 384ms/mobile 380ms; CLS 0; unthrottled local laboratory, not field performance |

The enhanced desktop performance case intentionally does not run on mobile. The targeted integration rerun filtered two already-passing cases. Initial failures and their fixes are recorded in [auth-completion-ledger.md](auth-completion-ledger.md); they were not hidden by skipped configuration. Windows sandbox transform-cache failures were rerun outside that sandbox and passed. Deliberately forged/revoked cookie tests produced expected provider warnings while returning generic denial.

Credential-free screenshots:

- [Sign in](previews/auth-workspaces/login-final-desktop.png)
- [Sign up](previews/auth-workspaces/signup-final-mobile.png)
- [MFA settings](previews/auth-workspaces/security-final-mobile-390.png)
- [Workspace desktop](previews/auth-workspaces/workspace-final-desktop-1440.png)
- [Workspace tablet](previews/auth-workspaces/workspace-final-mobile-768.png)
- [Workspace mobile](previews/auth-workspaces/workspace-final-mobile-390.png)
- [Privacy request history](previews/auth-workspaces/privacy-mobile.png)

Desktop/tablet/mobile captures were visually inspected. Setup secrets and passwords are not displayed.

## Applied migrations and principal files

This continuation applied only these additive, approved isolated dependencies:

- `supabase/migrations/20261014014343_mitsa_account_workspace_interfaces.sql`
- `supabase/migrations/20261014015632_mitsa_isolated_auth_mail_capture.sql`
- `supabase/migrations/20261014021816_mitsa_capture_pkce_compatibility.sql`
- `supabase/migrations/20261014034721_mitsa_captured_invitations.sql`
- `supabase/migrations/20261014044022_mitsa_reviewed_requests.sql`

Original migrations and the deployed registration function were preserved. Recovery snapshot/digest and approved scope are recorded in [reviewed-requests-approval.md](reviewed-requests-approval.md). No automatic destructive rollback exists; use the documented forward-repair process.

Relevant application changes:

- `src/lib/auth/forms.ts`, `src/lib/auth/registration.ts`, `src/lib/security/auth-flow.ts`, `src/lib/supabase/server.ts`, `src/proxy.ts`.
- `src/components/site/AuthForm.tsx`, `PostForm.tsx`, `PasswordField.tsx`, `LegalDraft.tsx` and additive auth/legal CSS; `src/components/workspace/WorkspaceShell.tsx`, `SelectField.tsx`, `Management.tsx`, `workspace.module.css`; `src/lib/workspace-management.ts`.
- Signup/verification/forgot/reset pages and `src/app/auth/register/route.ts`, `auth/email/route.ts`, `auth/password/request/route.ts`, `auth/password/challenge/route.ts`, `auth/password/reset/route.ts`, `auth/account/route.ts`.
- Workspace child pages `settings`, `locations`, `members`, `permissions`, `ownership`, `audit`; `src/app/auth/workspace/route.ts`; invitation staging/acceptance and `src/app/auth/invitations/*` handlers.
- `src/app/settings/account/privacy/page.tsx`, `settings/account/recovery/page.tsx`, `operator/requests/page.tsx`, `auth/privacy/request/route.ts`, `auth/privacy/export/[requestId]/route.ts`, `auth/operator/requests/route.ts`; `src/lib/privacy/requests.ts`.
- `src/app/privacy/page.tsx`, `terms/page.tsx`, `cookies/page.tsx`; `src/lib/mail/messages.ts`, `resend.ts`; exact SDK/lockfile update.
- Private-safe setup/provision/mail tools; real journey/support helpers and new unit/integration/browser checks. Tests do not put admin keys into Next.js.

Commands used include `npm run typecheck`, `npm run build`, `npm run test:unit`, `npm run test:integration`, `npm run db:reconcile`, scoped Playwright journeys/production tests and the preflight/postflight scripts. Existing unrelated changes were preserved; landing files were hash-compared rather than overwritten.

## Remaining work and authorization limits

1. **Actual lost-all-authenticator recovery executor:** request/review works; no recovery-execution capability is assigned and no support reset was performed. Prepare/audit the narrow privileged boundary, then seek fresh scoped approval before any deployment, grant or disposable synthetic reset test. Workspace Owners cannot self-reset through support.
2. **Account/workspace disposal and restore verification:** requests/review/blocked preview exist; actual deletion, approved legal holds/retention execution and restore/erasure tests are unfinished. No disposal job or destructive test was activated.
3. **Live Resend integration:** templates/SDK/signature foundation and private capture work. Durable external worker/webhook/outbox transitions, sender/domain verification, credentials, SMTP arrangement and actual provider-delivery tests remain unactivated/incomplete. See [mail-integration.md](mail-integration.md).
4. **Public launch/legal:** legal operator/privacy contact, eligibility and minimum-age decision, final retention/backup schedule, production configuration and reviewed legal publication remain unapproved. No unrestricted registration, production changes, paid upgrades or external email occurred.
5. Existing Supabase advisory: [leaked-password protection disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No new RLS/security advisory appeared. No paid upgrade was authorized or performed.

This checkpoint predates the user's later developer-registration and authentication-layout request. That narrower follow-up is documented in [developer-registration-handoff.md](developer-registration-handoff.md); it adds the explicitly approved developer-email exception and refined auth pages. The broader recovery/disposal/delivery limits above remain unchanged and are outside that follow-up's scope.
