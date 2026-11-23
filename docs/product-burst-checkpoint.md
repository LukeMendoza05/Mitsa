> Historical record — superseded by the Mitsa editorial redesign on 2026-10-13. Legacy names, screenshots, commands, and source paths below describe the retired implementation. See [current implementation](mitsa-redesign.md).

# Product burst execution ledger

Scope: Milestone 1, neutral geometry, development-only route. Existing landing and foundation changes are preserved. No Blender assets, product identities, database changes or deployment.

Finishing criteria: deterministic seven-package motion; production 404; responsive/static/error fallbacks; executed tests, actual desktop metrics and five checkpoint captures. Recording when supported.

Ruling: use the dedicated existing project checkout on codex/foundation-proof to preserve uncommitted approved work. No new packages required. Existing React development debugging eval warning is tolerated without weakening CSP; the existing WebGL renderer works.

Tests first: motion unit contract and development route acceptance written before implementation. Production access regression tests the server boundary.

## Implementation and review

Delivered seven independent rounded package meshes, shared geometry, owned materials, authored curved paths and quaternion rotations, fixed proportions and depth layers. Scroll is native and controls every pose. Production checks NODE_ENV on the server and calls notFound before rendering the client experiment. No navigation links were added.

RED → GREEN evidence: absent motion module and route; duplicate SVG IDs; runtime reduced-motion preference collapsing scrollY from 1350 to 515; final display gaps; ineffective fallback controls. All have passing regression coverage. An already-read desktop track keeps its layout reservation when reduced motion is enabled, avoiding a reading-position jump. Fresh independent review found no critical security or deterministic-motion issue; endpoint overlap was treated as a required composition fix. Both review findings were corrected in one pass.

Ruling: no Playwright FFmpeg executable is installed. Do not install extra tooling for optional video. The capture test records the unsupported status and still captures all five checkpoints. Forward/reverse movement is verified by browser tests and observed in the actual browser.

## Files added by this milestone

- `src/app/experiments/product-burst/page.tsx`, `burst.css`: development-only server gate and isolated studio layout.
- `src/components/experiments/BurstExperiment.tsx`, `BurstCanvas.tsx`, `BurstPoster.tsx`, `burst-motion.ts`: lifecycle/controller, actual movable meshes, fallback illustrations, pure motion functions.
- `tests/unit/burst-motion.test.ts`: four motion/geometry tests.
- `tests/experiments/burst.spec.ts`, `evidence.spec.ts`, `playwright.burst.config.ts`: eight development-browser tests and evidence capture.
- `tests/e2e/experiment-access.spec.ts`: production-route denial, exercised on both existing profiles.
- `docs/previews/product-burst/`: five PNGs, performance and recording-status JSON.
- This checkpoint. Next.js also generated root `AGENTS.md` automatically when starting development.

No packages were installed. No existing landing, auth, proxy, schema, migration, configuration or transactional module was edited by this milestone. Previous uncommitted landing work remains in place.

## Performance and limits

Final development lab: installed Edge 155.0.4283.45, AMD Radeon (TM) Graphics via ANGLE/D3D11, 900px height, DPR 1, 180 animation-frame samples per width. P95 frame cadence: 16.8ms at 1280px, 17.1ms at 1440px; median 16.7ms; 15 draw calls, two geometries and three renderer textures (including shadow resources). This is browser scheduling cadence during actual scroll rendering, not a GPU timer query or production/mobile certification. No video captured: FFmpeg absent. React's development stack-reconstruction eval diagnostic remains blocked by the unchanged CSP; rendering works.

## Preview and evidence

`http://127.0.0.1:3002/experiments/product-burst`

Restart with `npm run dev -- --port 3002`. This project's previous dev server on 3000 was stopped to use the approved port; Next.js allows only one development server per checkout. A production start intentionally returns 404 at this path.

Captures: `docs/previews/product-burst/0.png`, `25.png`, `50.png`, `75.png`, `100.png`. Browser tests demonstrate stopped poses, reverse seeking, refresh, resize, three static-mode mount cycles, context loss, failed WebGL creation, dynamic motion preference, all eight requested widths, duplicate-ID detection and axe accessibility checks.

## Authentic replacement gate

Obtain verified product identity and packaging edition; front/back/left/right/top/bottom and three-quarter photographs; measured external width/depth/height with orientation; and image-use rights. Then create independently editable Blender geometry, UV textures and optimized GLBs. These milestones, branded modeling, public integration, storefront reconstruction and deployment remain unauthorized.

## Final command results

Executed on the final reviewed source:

| Command | Actual result |
| --- | --- |
| `npm run test:unit -- tests/unit/burst-motion.test.ts` | 4 passed |
| `npm run test:e2e -- --config playwright.burst.config.ts` | 8 passed (27.3s), including five captures and desktop measurements |
| `npm run test` | Passed: 52 unit, 26 hosted integration, 52 production browser tests |
| `npm run test:e2e` | Executed by the aggregate command; 52 passed (1.7m), including production 404 on desktop and mobile profiles |
| `npm run typecheck` | Passed |
| `npm run build` | Passed |
| `npm run test:security` | 7 passed; approved isolated Fire_Inv only |
| `npm run db:reconcile` | Passed; project `mjtejwafxriwntweussc`, 110 committed synthetic events/commands, zero projection mismatches, missing events or result mismatches |
| `git diff --check` | Passed |

Reconciliation covers the existing synthetic security probes, not unimplemented business ledgers. Logs are in `.superpowers/landing-logs/burst-dev-final.log`, `burst-regression.log`, `burst-security.log` and `burst-reconcile.log`. Credentials were neither printed nor changed. Optional video is unavailable as explained above; physical mobile and production animation performance were not certified. The local development server remains on port 3002 for review. Stop here before branded modeling, public landing integration or Stage 1 Task 4.
