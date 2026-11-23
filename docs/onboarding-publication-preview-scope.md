# Publication and protected preview: local preparation only

No remote was added, commit staged, repository pushed, project created or deployment started. The existing repository is LukeMendoza05/Mitsa; the user reports that it is public and empty. Read its refs again immediately before an approved push. Stop if any unexpected remote history exists. Never force push.

## Publication decision

The local seven-commit history is implementation/evidence history, not an automatically safe public release. The local scanner inventories every tracked/untracked nonignored file, examines reachable Git blobs, flags sensitive categories without printing matched values, and emits a file/hash allowlist under ignored `artifacts/`. A clean regex scan is not proof of publication safety. Large history blobs need explicit manual review; source dependency closure and asset rights also require review. The allowlist excludes docs, private evidence, tool directories, approvals, encrypted captures and environment files. No `git add .` is permitted.

Recommend making the existing repository private before uploading unreleased authentication/security work. That visibility change is not authorized here. Public publication additionally requires reviewing every flagged source, generating clean target configuration, and verifying that no retained-business/account information or private provider URL remains in the export. Current application imports of `config/test-target.json` and `config/registration-deployments.json` must resolve in the reviewed export; deleting them to satisfy a scanner would break the build. Neither file may silently be replaced in the operational checkout.

If history is unsuitable for publication, prepare a **separate clean export checkout** from the approved file/hash allowlist. This preserves the entire current checkout, branch, commits and uncommitted work. The export gets one new review commit, with no old private blobs in its ancestry. This does not overwrite history in the existing empty GitHub repository. Do not run `git switch --orphan` or clean/reset commands against the operational checkout.

After exact export approval, the proposed operations in that separate directory are:

```powershell
git init --initial-branch=codex/publication-review
# Copy ONLY the reviewed file/hash allowlist, then rerun build/privacy checks.
# Stage ONLY the enumerated relative paths from that reviewed allowlist.
git diff --cached --check
git diff --cached --name-status
git commit -m "Prepare Mitsa application for protected preview review"
git remote add origin https://github.com/LukeMendoza05/Mitsa.git
git ls-remote --heads origin
git push --dry-run origin HEAD:refs/heads/codex/publication-review
git push --set-upstream origin HEAD:refs/heads/codex/publication-review
```

These are proposed commands, not authorization. Approval must name the exact allowlist hash, export commit, repository visibility, branch and whether Git-connected deployment side effects are disabled. No automatic merge or production push is included. If the remote is no longer empty, reconcile its refs before proposing a non-destructive integration.

## Preview configuration

`config/vercel-preview-proposal.json` intentionally has no invented team/project/domain/target. Framework Next.js, root `.`, Node 24, `npm ci`, `npm run build`, default Next output. Use normal Next deployment, not the loopback acceptance harness/custom server. `scripts/` and the worker are excluded from the Vercel app upload; shared server imports remain included.

First approve a clean, separate preview Supabase project and exact HTTPS preview origin. Do not connect the retained isolated database to public or protected previews. Provision the approved inactive schema/functions in that target separately; do not copy retained accounts/business rows or test inbox data. Production gets another clean target and distinct keys. Verify the selected Vercel plan supports access protection without unapproved charges; if protection cannot be guaranteed before the first deployment, stop.

| Runtime setting | Placement and requirement |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `APP_ORIGIN` | Ordinary server runtime; exact clean preview target/origin. Publishable is not a privilege credential. No wildcard callback origins. |
| `AUTH_FLOW_KEY`, `MFA_ENROLLMENT_KEY` | Separate random 32-byte base64url secrets for preview only; sensitive server environment values. |
| `MITSA_REGISTRATION_SERVICE_KEY` | Separate project-bound server/Edge signer, never browser public. Deployment alone does not enable its service. |
| `MITSA_TURNSTILE_SITE_KEY`, `MITSA_TURNSTILE_SECRET_KEY` | Site key may be rendered; secret stays server-side. Widget and server must bind the exact preview hostname/actions. |
| `MITSA_DEPLOYMENT_PROFILE`, `MITSA_REGISTRATION_ENGINE` | Require the reviewed clean deployment mapping; do not select the retained loopback profile. |
| Registration, mail, transport, legal and strict-readiness controls | Closed in app, Edge and database; preview creation does not approve any activation. |

Never provide `TEST_AUTH_ADMIN_KEY`, `TEST_DATABASE_URL`, `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`, SMTP credentials, management tokens, evidence private keys or operator files to the Next.js project. Do not prefix private settings with `NEXT_PUBLIC_`. Enter secret values through protected provider controls; do not paste them into chat or commit them. Do not pull production environment values into `.env.local`.

The persistent email worker needs a separately approved supervised container/service with outbound TLS, private credentials, health/heartbeat monitoring, bounded restart policy and durable DB fencing. Ordinary short-lived Vercel requests and a scheduled function are not substitutes for that worker. No worker hosting/vendor/cost has been approved.

## Exact preview approval selection, after missing values are supplied

Approve one existing-repository link, one Vercel project creation if still absent, the explicitly listed preview-only environment settings, and one protected Preview deployment of the reviewed commit. Name team/project, exact clean Supabase target, HTTPS origin and zero/approved cost ceiling. Include access-protection verification before deployment, no production alias, no signup/mail/worker activation, and a maximum read-only smoke budget: 20 HTTP checks and one build-log retrieval. No Auth accounts, database mutations, SMTP or provider Auth changes are included. All counts must be bound in the final provider-specific approval before execution.

Acceptance: unauthenticated access is denied by deployment protection; approved operator can load the landing/login/closed signup screens; HTTPS, CSP, no-store/security headers, redirects, asset loading and server-only secret exclusion pass; callbacks match the exact approved origin; no retained project identifier or data is present. Monitor aggregate route/error/latency signals without request bodies, cookies, tokens or email addresses. Roll back/delete the preview deployment and revert only its reviewed configuration if checks fail. Closing signup/delivery remains independent of deployment rollback.

Public release still requires real hosted onboarding, recovery, tenant/operational acceptance, proven Strict Option A, production legal/privacy/retention/contact decisions, a verified-domain transactional provider and final activation approval. A protected preview or green build establishes none of those.
