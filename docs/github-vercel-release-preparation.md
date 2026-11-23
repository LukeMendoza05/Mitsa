# Existing repository and hosted release preparation

Read-only inspection on 27 October 2026 identified the accessible existing repository **[LukeMendoza05/Mitsa](https://github.com/LukeMendoza05/Mitsa)**. Its reported default branch is `main`, visibility is public and repository size is zero. These metadata do not prove its branch/commit contents. No repository was created, renamed or modified.

The local checkout is on `codex/foundation-proof`, latest commit `d9fd220`, with substantial preserved uncommitted implementation. `git remote -v` returns no remote: this checkout is not yet connected to the existing repository. Do not substitute FireStock or create another repository. No commit, stage, remote change, fetch/push, PR or force-push occurred.

The connected Vercel account returned zero projects matching `mitsa` and zero teams. This is a scoped observation, not proof that no project exists in another account. There is no verified public Mitsa URL or local `.vercel` link. No Vercel project, environment, domain or deployment was changed.

## Source and secret boundary

`.secrets/`, environment files, local runtime/dependency directories, browser outputs and temporary Supabase state were already ignored. New local ignore rules also exclude `artifacts/`, private support drafts and approval documents. They preserve every local file and do not remove tracked history. Actual human approval records remain under the ignored private tree. Before any commit, inspect the exact staged names and bytes; `.gitignore` cannot protect a file that was already tracked or explicitly force-added.

The existing `.vercelignore` excludes evidence, documents, tests, scripts, migrations/prepared SQL, temporary files, local secrets and standalone Edge entries. Shared modules imported by Next remain available. Neither ignore file is permission to publish the checkout. Public commit selection must separately review code/configuration for private identities, credentials, retained business details and unsupported operational claims. Fresh-clone tests depending on local evidence/private fixtures need a separately reviewed CI selection or generated public test fixtures; never upload private evidence to make CI pass.

## Exact future Git scope for review

1. Read the existing remote repository's branch/commit state and agree the intended integration base. Do not infer that `size=0` guarantees an empty repository. Preserve the local branch and unrelated changes.
2. Prepare an explicit file/hash allowlist for one reviewed implementation commit. Include only reviewed application/source/config/test material. Exclude private evidence, support/approval records, `.secrets`, `.env`, build outputs and browser state. Review cached diff and scan those exact bytes privately before committing. No broad `git add .` or force-add.
3. After the user approves the exact repository, branch, commit allowlist and public visibility, add `origin` as `https://github.com/LukeMendoza05/Mitsa.git` if it remains absent. Push only a `codex/…` review branch with an explicit refspec and no force flags. Creating a public PR and merging to the release branch remain separately scoped actions. An unexpected existing remote or divergent history stops the operation for review.

This document prepares that scope; it grants none of those mutations. The final commit cannot be source-frozen while the execution controller is unfinished.

## Hosting and production environment

Keep the current isolated Supabase project and all retained developer/synthetic data private. Public Vercel deployment must use a separately approved clean production Supabase target; current production/pilot mappings remain null. Production needs its own registration signer, application/enrollment keys, Turnstile hostname/secret, exact HTTPS origin/redirect configuration, hooks and provider-supported security rollout. The isolated loopback-only hook/Edge sources are not production-compatible merely by changing `APP_ORIGIN`.

Scope production secrets to production and distinct preview values to a separate nonproduction target. Keep all secrets server-only; never prefix them `NEXT_PUBLIC_`, expose operator/admin/SMTP credentials to Next, pull production secrets into this checkout or overwrite `.env.local`. The persistent delivery worker needs a supervised execution environment; a Vercel Next deployment alone does not supervise a long-running Gmail worker. Production also needs an approved verified-domain transactional sender, quotas, lawful production notices/consent/retention/contact policies, monitoring and incident procedures. The Gmail diagnostic and test notices do not satisfy these requirements.

The future Vercel scope must name the exact team/project, reviewed commit, environment, domain and cost ceiling. First stage a protected deployment with admission and mail disabled. Verify source exclusions, HTTPS, headers, secret exposure, origin/CAPTCHA/callback binding, rollback and production-target separation. Only the separately approved final activation may enable ordinary registration after real onboarding, recovery, tenant/operational acceptance and the applicable session-security policy pass. Never expose the isolated database or retained records to obtain a public preview.

Prefer Vercel Git integration after repository review, with required release checks and approval before production promotion. A push can trigger a deployment once Git integration exists, so future push approval must explicitly account for its deployment side effects. No workflow that automatically promotes or opens registration is installed here. Rollback must independently close admission/delivery and restore the previously verified application deployment; a deployment rollback alone does not undo provider or database changes.
