# Protected preview preparation

Requested project name: `mitsa-fireworksinventory`. Requested future production hostname: `mitsa-fireworksinventory.vercel.app`. These names are requests, not proof of an allocated or deployed service.

Use the Next.js framework, source root `.`, Node.js 24, `npm ci --ignore-scripts`, `npm run build` and the platform's default Next.js output. Do not use static export: authentication requires server routes. Do not use the local acceptance-test custom server as a deployment server.

Before creating a deployment:

1. Approve a clean separate preview backend, exact preview origin, target mapping and preview-only secrets.
2. Configure and verify Vercel Authentication for **All Deployments** (`ssoProtection.deploymentType: "all"`) before the first Preview deployment. Do not assign the requested production alias to an unapproved preview.
3. Obtain approval for the exact reviewed source commit, project scope and any cost. Leave automatic Git deployments disabled.
4. Deploy only a protected Preview. Confirm unauthenticated access is denied, then check landing/login/closed signup, HTTPS, security headers, assets, callbacks and server-only secret handling.
5. Keep registration, external delivery and persistent workers inactive. Record deployment ID and rollback instructions before further changes.

Standard Vercel protection covers preview/deployment URLs; it does not make the short production domain private. Use All Deployments for this preparation. Vercel [announced on September 9, 2026](https://vercel.com/changelog/protect-production-deployments-for-free-on-every-plan) that Vercel Authentication can cover production domains at no additional cost on every plan. Verify the actual project setting before any deployment. Do not start a trial, purchase a plan, add a public exception, bypass protection or deploy publicly without approval.

The requested `.vercel.app` hostname is first-come, first-served and cannot be guaranteed or reserved by a read-only lookup. Recheck allocation during approved project creation. If unavailable, stop and review an alternative rather than silently changing the requested name.

The email worker needs separately approved persistent hosting, outbound TLS, private secrets, database fencing, heartbeat monitoring, bounded restart behavior and delivery reconciliation. It must not be started inside a normal Vercel route or treated as a reliable long-running task there.

Use aggregate monitoring without cookies, request bodies, passwords, tokens, codes or addresses. Preview rollback restores only the reviewed deployment/configuration; admission and mail shutdown remain independent controls. Public production release requires the separate hosted security, legal, email, onboarding and operational acceptance gates.
