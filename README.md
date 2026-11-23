# Mitsa

Mitsa is a fireworks inventory and business management platform. The website uses a shared editorial design system across its public overview, sign-in, verified access, and error pages. Business-facing previews contain illustrative data; product management, inventory, checkout, customer orders, and reports are not implemented operational modules. The existing Next.js App Router, TypeScript, and Supabase access foundation remains in place.

Current registration work, 24 October 2026: **corrective inactive C1, disabled C2 and eight-slot no-account C3A passed**. See the [C3A results and preservation evidence](docs/stage-c3a-hosted-integration-result-20261024.md) and [single remaining-work approval package](docs/registration-completion-approval-package.md). The database infrastructure and private service are installed; registration, delivery and worker controls remain closed. Strict Option A remains unresolved under the existing Supabase support ticket. Later hosted Auth/mail/onboarding tests and final activation need their separate approvals. Earlier controlled onboarding and Gmail reports remain historical evidence, not current activation authorization.

Stages B–F have resumed at the [current continuation checkpoint](docs/persistent-registration-resume-progress.md). The [first scoped provider-security test](docs/persistent-registration-stage-b-test-approval.md) and [updated installation-readiness report](docs/persistent-registration-installation-readiness.md) are prepared for separate review. No live fixture, setting, migration, email or activation is authorized by those documents.

- [Mitsa design, branding, cleanup, and verification](docs/mitsa-redesign.md)
- [Current motion, original Blender assets, and verification](docs/mitsa-motion-progress.md)
- [Authentication and multi-workspace implementation status](docs/auth-workspace-implementation.md)
- [Current authentication handoff, screenshots and remaining limits](docs/auth-workspace-handoff.md)
- [Developer registration and refined authentication experience](docs/developer-registration-handoff.md)
- [MFA enrollment timing repair and private onboarding](docs/mfa-enrollment-repair.md)
- [Email code verification, signup resend and Mitsa email previews](docs/email-verification-implementation.md)
- [Approved isolated encrypted code capture and verification](docs/code-capture-activation-results.md)
- [Dedicated Gmail and Vercel testing proposal](docs/gmail-vercel-testing-proposal.md)
- [Current registration, protected Gmail preparation and reset phase](docs/public-registration-reset-phase.md)
- [Proposed personal reset impact, archive and recovery boundaries](docs/developer-account-reset-approval.md)
- [Installed disabled pilot schema, Gmail relay and separate approvals](docs/controlled-pilot-relay-approval.md)
- [Disabled pilot installation results and preservation checks](docs/pilot-schema-installation-results.md)
- [Prepared six-digit email switch and exact provider approval](docs/six-digit-email-approval.md)
- [Verified six-digit activation and captured-code browser results](docs/six-digit-email-results.md)
- [Separate controlled Gmail test scope and rollback](docs/controlled-gmail-test-approval.md)
- [Current six-digit email, controlled delivery and CAPTCHA readiness](docs/email-next-phase-readiness.md)
- [Turnstile root cause, private PowerShell setup and hostname guidance](docs/turnstile-development-setup.md)
- [Current isolated open-registration implementation and gates](docs/isolated-open-registration-progress.md)
- [Additional recovery-hook candidate requiring scoped approval](docs/development-recovery-approval.md)
- [Controlled Gmail execution and closure results](docs/controlled-gmail-test-results.md)
- [Scoped retry using the retained synthetic Gmail account](docs/controlled-gmail-resume-approval.md)
- [One-message completion scope after the closed resend failure](docs/controlled-gmail-finish-approval.md)
- [Resumed authentication, CAPTCHA and email verification checkpoint](docs/auth-email-resume-report.md)
- [Outstanding security findings for the read-only Supabase audit](docs/supabase-optimization-audit-brief.md)
- [Registration-intent security audit and deployment gate](docs/registration-intent-security-audit.md)
- [Isolated migration recovery procedure](docs/workspace-migration-recovery.md)

- [Approved architecture](docs/superpowers/specs/2026-10-12-foundation-design.md)
- [Requirements and stages](docs/requirements-traceability.md)
- [Implementation plan](docs/superpowers/plans/2026-10-12-foundation-proof.md)
- [Diagrams](docs/diagrams.md)
- [Local setup and credential boundaries](docs/local-setup.md)
- [Execution ledger](docs/progress.md)
- [Tasks 1–3 verification checkpoint](docs/foundation-checkpoint.md)

Use Node 24 and npm 11.19.0. Run `npm ci`, `npm run typecheck`, `npm run build`, then `npm run test`. Lifecycle scripts are disabled. `npm run test:e2e`, `npm run test:integration`, `npm run test:security` and `npm run db` (alias of `npm run db:reconcile`) are independently runnable. Hosted tests require the explicit isolated target and operator credentials; missing configuration fails rather than silently skipping.

For a local preview, run `npm run build` then `npm run start`, and open `http://127.0.0.1:3000`. The retired development experiment returns 404. The large-desktop landing preview includes the original Blender-authored inventory assembly, reversible scroll composition and restrained section motion. Mobile, shorter screens and reduced-motion preferences retain readable authored alternatives. Fonts, icons and 3D assets are self-hosted; no external visual services are required at runtime. `fireworks-inventory` remains the technical package name for compatibility; the official product name is always **Mitsa**.

The audited `mitsa-registration-intent` Edge Function is deployed only to approved isolated project `mjtejwafxriwntweussc`. Its private signatures, strict provider hook and mandatory email verification remain enforced. Legacy test/pilot facilities remain for compatibility. The current authorization covers inactive local implementation only; persistent admission, email delivery, provider changes and the session-risk decision require separate review. Production, deployment, disposal and legal publication remain closed. Exactly three workspace roles are enforced: Business Owner, Admin and Staff. Two MFA-protected synthetic support identities have separate review/execution scopes and no workspace memberships.

Working local routes: `/login`, `/signup`, `/workspaces`, `/onboarding`, `/settings/account`, `/settings/account/security`, `/settings/account/privacy` and `/settings/account/recovery`. Workspace settings, locations, members, invitations, financial permissions, ownership and audit history sit under `/w/[workspaceSlug]`. Legal pages `/privacy`, `/terms` and `/cookies` are review drafts. See the [completion ledger](docs/auth-completion-ledger.md) for current verification and remaining limits, and [local setup](docs/local-setup.md) for private synthetic credentials and captured verification links.

Stage A performs no production change, external delivery, personal account/workspace reset or paid upgrade. Previously completed controlled Gmail delivery and onboarding remain intact. Disposable isolated reset rehearsals do not authorize a personal reset. The synthetic foundation probe is not an inventory or sales module and does not prove future checkout correctness.
