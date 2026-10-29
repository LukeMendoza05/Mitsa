# Mitsa

Mitsa is a Next.js application for business workspaces. This source release contains the complete existing landing, account, authentication and workspace interfaces, their server routes, shared registration contracts and prepared Edge Function sources.

## Local checks

Use Node.js 24 and npm 11.

```sh
npm ci --ignore-scripts
npm test
npm run typecheck
npm run build
```

Dependency versions and package integrity are pinned in `package-lock.json`. The build needs no live provider credentials. Fonts and landing assets are local.

## Configuration and release status

This is an inactive source publication, not a production deployment or completed registration release. It contains no accounts, business records, operator tools, database snapshots, mail credentials or local authorization evidence. No environment files are included.

All deployment profiles are unset. `unconfiguredpreviewx` is a placeholder, not an approved backend. Isolated-project bindings in legacy compatibility code were replaced with that placeholder in this export only. Configure a separately approved clean backend and exact HTTPS origin through a reviewed target-mapping change before running authentication. Do not connect this public source release to retained private development data.

Registration and email delivery stay disabled. Activation requires real hosted verification, TOTP MFA, trusted workspace ownership, returning login, recovery, tenant isolation, the approved session-security guarantee, production legal documents and operational approval. Local tests do not establish those hosted guarantees.

`vercel.json` disables automatic Git deployments. Publishing source does not authorize deployment. See [deployment preparation](docs/deployment.md) and [environment handling](docs/environment.md).

The persistent mail-worker implementation is included under `src/lib/mail/`. Its private operator launcher, credentials and execution approvals are intentionally excluded. It needs separate supervised hosting; ordinary short-lived website requests are not its supervisor.

`supabase/functions/` contains prepared backend sources, not deployed services or a database-installation package. Do not deploy or enable them without a separate reviewed backend configuration.

The application is not yet approved for general public registration. Existing authentication and authorization checks remain in the source; no weaker session policy is introduced by publication.
