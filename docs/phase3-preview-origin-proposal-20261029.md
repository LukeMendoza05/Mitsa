# Closed Preview origin proposal — offline only

This supplements the Phase 3 review; it does not change its approval, published source or hosted configuration. Final target remains **mitsa-fireworksinventory**, requested production URL **https://mitsa-fireworksinventory.vercel.app**. No new hostname is selected.

## Problem and supported mechanism

The published app requires an exact APP_ORIGIN in both `src/proxy.ts` and `src/lib/supabase/server.ts`. A new Vercel Preview gets a generated deployment hostname. Setting the production origin for that different Preview would fail the existing CSRF/redirect checks; trusting Host or forwarded-host headers would introduce an unsafe authority source.

Vercel documents `VERCEL_URL`, project ID/name, deployment ID and Git source metadata as available at build and runtime in its [system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables). A **server-only runtime** resolver can validate those values against the exact approved project/source before deriving one HTTPS Preview origin. It is not necessary to choose a substitute production hostname or weaken the existing exact-origin comparison.

The local candidate is `artifacts/phase3-preview-review-20261029-v2/origin-proposal/preview-origin.mjs`. Its opt-in mode is `MITSA_PREVIEW_ORIGIN_MODE=vercel-deployment-v1` and it requires:

- Vercel Preview environment/target, the reviewed project ID and exact project name, valid deployment metadata and the exact approved GitHub repository/source SHA.
- A canonical generated `.vercel.app` hostname for that project; no schemes, credentials, ports, paths, query, fragments, foreign prefixes, production alias or oversized/noncanonical labels.
- Registration and mail disabled, registration service false and the closed legacy preview engine; it refuses production, development, custom targets and persistent activation.
- Any explicitly supplied APP_ORIGIN must already match the derived origin. A mismatch is rejected, never silently replaced. Request headers and branch/production aliases provide no authority.
- The original runtime validator must still reject an unapproved Supabase target or administrative credentials. The resolver authorizes neither the backend nor a session.

This relies on trusted hosting configuration/administrators. It does not itself prove Vercel access protection, authenticate a visitor, revoke a Supabase session, or satisfy Strict Option A. Provider-side **All Deployments** protection remains a mandatory independently verified precondition.

## Actual offline evidence

**13 OFFLINE tests PASSED**, including the actual unchanged exported `parseRuntimeConfig`; zero hosted requests. Strict JavaScript/TypeScript checking and Node syntax checking PASSED. The original failed test import is preserved separately; it executed no test cases and was corrected before the passing run.

This is a tested isolated candidate, **not an applied application fix or hosted Preview pass**. A full app build is not claimed for an unapplied patch. The published application/configuration and its 170-file inventory remain unchanged.

## Exact future integration, requiring source review

If selected in the separately approved P3-B scope:

1. Copy this reviewed resolver into a server-only application module. Read the approved Preview project ID and source SHA from server-only reviewed bindings; enable system environment exposure through the separately scoped Vercel setting.
2. In **both** `src/proxy.ts` and `src/lib/supabase/server.ts`, pass the resolved environment to `parseRuntimeConfig` and `expectedRuntimeProject`. No other origin consumer or session rule is replaced. Keep explicit APP_ORIGIN behavior when the mode is absent/disabled.
3. Keep browser form requests relative to the current site so Vercel authentication cookies accompany them. Do not add server self-fetches or a protection-bypass secret. Vercel's [protection guidance](https://vercel.com/docs/deployment-protection) explains why absolute generated-URL self-fetches can lose protection cookies.
4. Prepare and test the actual source delta, clean backend mapping and production build; source-freeze the new commit before asking for its separate push/deployment approval. The completed Phase 2 push allowance cannot be reused.
5. Configure only Preview values after approval. This option requires the additional server-only policy/project/source bindings; it is **not** included in the existing proposed ten-setting batch. Bind the final list/count explicitly in P3-B. Verify the returned Vercel deployment metadata before any authenticated application test.

Do not use `next.config.env` for these bindings or any secrets: the installed Next.js documentation states that config values enter JavaScript bundles and computed/destructured process.env access is not equivalent to literal build-time replacement. Runtime resolution avoids that mismatch and keeps private values outside browser bundles.

This candidate supplies a concrete origin strategy, but a separately approved clean preview backend, actual Vercel project ID and reviewed source commit are still missing. It must not be wired, pushed or deployed by an automatic continuation. Restoring the prior explicit-origin source is the proposed code rollback; it is not a provider/session workaround. Production still requires its explicitly approved production origin.
