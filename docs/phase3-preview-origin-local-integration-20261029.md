# Preview origin — actual local application integration

Status: **OFFLINE INTEGRATED AND VERIFIED; NOT PUBLISHED OR DEPLOYED.** This supersedes only the earlier candidate's not-yet-integrated local status. It grants no hosted authority and does not change the P3-A package.

## Implementation

The separate 171-file source copy is `artifacts/phase3-preview-source-20261029-v1`. Its base is the exact published 170-file inventory. The operational checkout, public export and GitHub branch remain unchanged.

One server runtime resolver was added at `src/lib/auth/preview-origin.mjs`. The existing environment passed into the validator was wrapped in **both** `src/proxy.ts` and `src/lib/supabase/server.ts`. No session, password, MFA, RLS, role, registration-intent or provider code was replaced. The existing validator still enforces the approved backend and rejects admin credentials.

The local copy's deployment/environment documentation uses the final requested project name `mitsa-fireworksinventory` and future production URL `https://mitsa-fireworksinventory.vercel.app`. No alternative production hostname was selected. No real backend reference, secret, account or private evidence was added to the copy.

## Actual checks

- **13 OFFLINE origin-guard tests passed** with the real unchanged runtime validator.
- **23 OFFLINE publication tests passed** in the assembled source copy.
- The assembled copy's **production build and TypeScript phase passed**. The resolver also passed separate strict JavaScript/TypeScript and Node syntax checks.
- **7 OFFLINE HTTP integration checks passed** against the actual built Next.js proxy/pages/route handler: login rendering with no explicit APP_ORIGIN; closed signup; foreign-Origin rejection; correct canonical validation-error redirect; forwarded-host rejection as an authority source; security headers; and protected workspace redirect without a session.
- The one fake policy read was intercepted locally. **Zero hosted requests, real Auth submissions, accounts, emails or external delivery.** The local application process terminated and cleanup was confirmed.

These checks establish the source integration in a local copy; they do not establish Vercel deployment protection or hosted signup/MFA/security acceptance. The first prototype test import and sandbox-only dependency-cache miss are recorded as local setup failures, not hidden or counted as passes. Cached dependencies were then installed offline with lifecycle scripts disabled.

## Remaining source/environment approvals

The backend remains the intentionally unconfigured placeholder. The pending clean-preview-backend decision must supply an approved target before final mapping/source freeze. No retained Supabase target may be silently reused.

If this resolver is selected, the final P3-B setting list becomes **12 entries**, rather than the earlier ten-entry explicit-origin option: remove APP_ORIGIN and add MITSA_PREVIEW_ORIGIN_MODE, MITSA_PREVIEW_VERCEL_PROJECT_ID and MITSA_PREVIEW_SOURCE_SHA. The other nine settings remain project-bound backend/public key, private application/enrollment keys, engine and closed admission/mail/service configuration. The new source and exact setting list must be reviewed; this is not an automatic expansion of any approved batch.

The actual Vercel project must expose system environment metadata. Deployment must use the approved GitHub source commit so its native project/deployment/repository/commit fields match the reviewed bindings. Do not manually forge Vercel metadata or add a bypass secret to force a passing result. All Deployments authentication must be verified through the provider before any later deployment.

After the clean target and project exist under their separate approvals, prepare the final mapping delta and source commit for review, then obtain approval for its separate push, exact Preview settings and one protected Preview deployment. The previously consumed Phase 2 push is not reusable.

Strict Option A remains **BLOCKED under SU-519045**. This origin resolver changes no Supabase guarantee and accepts no residual session risk. Registration, mail and all hosted testing remain unapproved/inactive.
