> Historical record — superseded by the Mitsa editorial redesign on 2026-10-13. Legacy names, screenshots, commands, and source paths below describe the retired implementation. See [current implementation](mitsa-redesign.md).

# Milestone 2 — motion redesign and Dragon P22 intake

Approved source: user's attached Milestone 2 request. Work is restricted to the existing development-only experiment, its tests and supporting documentation. Preserve public landing, auth, security, database and deployment files.

Finishing criteria: revised five-part choreography; dominant neutral hero; collision-tested paths; grounded final display by 85%; honest static messaging; production 404; desktop framing, lifecycle and responsive verification; build/typecheck; new performance measurements, five screenshots and forward/reverse video; asset-readiness report. Stop before public integration or broader modeling.

Workflow: small test-first steps, failing acceptance tests before changes, visual inspection and fresh executed verification. Superpowers tools/skill package is not exposed in this session; retain the established TDD/checkpoint workflow without claiming a new skill execution. Apply the available React review checklist after component changes. Reuse all existing dependencies.

## Intake finding

Project-local file and text searches found no Dragon P22 / DFAMILY2 reference photographs, measurements, packaging identity evidence or image-use permission. The existing `public/marketing/studio.glb` and posters are procedural concepts, not authentic source materials. The selected identity is user-supplied, not independently authenticated by those assets. Real-product modeling is blocked. Use neutral arbitrary scene proportions and label their dimensions unverified; do not claim a dimensionally accurate proxy.

## Independently verifiable steps

1. Write collision/phase/grounding and static-mode tests; record RED results.
2. Refine authored paths and camera, maintaining pure normalized-progress poses, fixed dimensions and quaternion interpolation. Sweep oriented bounding-box intersections through the complete sequence.
3. Refine studio lighting/ground contact and responsive framing; verify actual rendered checkpoints and late reassembly.
4. Prepare non-public asset-intake structure, blank measurement/permission fields and a readiness checklist. No fictional packaging.
5. Run unit/browser/build/typecheck and isolated foundation regressions; capture images/video and compare measured desktop cadence with Milestone 1.

## Execution evidence

Initial new unit tests: 4 failed, 3 passed against Milestone 1 (phase timing, depth, collision and grounding). Browser/static RED and subsequent results recorded in `.superpowers/landing-logs/burst-m2-*`.

The static-mode browser RED reproduced the misleading live percentage. Motion changes passed seven unit tests, including oriented-box intersection sweeps at 2,001 normalized positions across the full sequence. New real-camera framing checks exposed an insufficient 1280px margin and a high background corner at 1440px; both were corrected without relaxing the margin. A live browser then exposed Node/browser floating-point differences in SVG rotation strings. A dedicated hydration test reproduced the warning; four-decimal SVG formatting resolved it while leaving 3D poses unchanged.

The final visual design retains tight initial overlap in projection to establish a compressed hero cluster; those packages do not intersect in 3D. The maximum-spread composition has seven visible silhouettes, foreground/middle/background depth, and a large front-facing hero. Reassembly uses consistent lateral ordering with rotations settling before touchdown. Every final box has its base at the studio floor by 85%. Shared gradient contact shading supplements softened directional shadows; all added GPU resources are explicitly disposed.

## Files changed in this milestone

- `src/components/experiments/burst-motion.ts`: authored five-phase poses, hero proportions, safe final ordering, floor constant and responsive camera/target.
- `src/components/experiments/BurstCanvas.tsx`: camera/lighting, grounded contact shading, shared resource ownership, camera diagnostics for real framing tests.
- `src/components/experiments/BurstExperiment.tsx`: truthful Dragon P22 proxy label and loading/static/live controls.
- `src/components/experiments/BurstPoster.tsx`: updated geometry illustration, depth ordering, consistent baseline and deterministic SVG precision.
- `src/app/experiments/product-burst/burst.css`: scoped proxy-caption styling.
- `tests/unit/burst-motion.test.ts`, `tests/experiments/burst.spec.ts`, `tests/experiments/evidence.spec.ts`: geometry, collision/phase/grounding, hydration/static/framing checks, separate Milestone 2 evidence capture.
- `tests/e2e/experiment-access.spec.ts`: retains the production 404 check and adds a comparison with the existing security headers/CSP.
- `docs/assets/dragon-p22/README.md`, `intake.json`, `references/README.md`: asset intake and readiness workflow. No source photographs exist yet.
- This checkpoint and `docs/previews/product-burst-milestone-2/`: screenshots/video/performance and comparison report.

Hash comparison against the pre-Milestone-2 source/test snapshot found changes only in the nine experiment/supporting-test files listed above. Existing public landing, server production gate, auth and security source files were not edited. No dependency or deployment changes.

## Verification

The final static-SVG repair was followed by a passing build/typecheck and an eleven-test development suite. A subsequent dedicated header test also passed, comparing the experiment's live response with the unchanged login response and rejecting unsafe-eval/unsafe-inline. The production-access test now checks the same headers on its 404 response.

The first aggregate regression passed 55 unit and 26 integration tests; production browser results were 51 passed / one failed in the unchanged public landing's direct-story progress test (desktop profile). That test passed three unchanged desktop rechecks. The complete aggregate rerun again passed 55 unit and 26 integration tests, but production browser results remained 51 passed / one failed in the same public-story test, this time on the mobile profile. The desktop case passed on that rerun. Do not erase either failure or treat its cause as proven. The overall aggregate gate is **not green**. Public landing code and its tests are outside this milestone's approved modification boundary and were preserved.

Standalone security: seven passed. Final read-only Fire_Inv reconciliation: 130 synthetic committed commands/events; zero projection mismatches, missing events or result mismatches. This does not certify unimplemented business ledgers. Final desktop cadence: Edge 155.0.4283.45, AMD Radeon/ANGLE/D3D11, DPR 1, 900px height, 180 samples per width; P95 17.1ms at 1280px, 17.0ms at 1440px. Draw calls 22, geometries two, textures four. Similar cadence to Milestone 1, with increased rendering work for contact shading.

## Exact executed commands and final results

| Command | Result |
| --- | --- |
| `npm run test:unit -- tests/unit/burst-motion.test.ts` | 7 passed after RED; constant dimensions, deterministic reverse, phase holds, depth, final gaps/grounding and 2,001 collision samples |
| `npm run test:e2e -- --config playwright.burst.config.ts` | 11 passed after SVG repair, including capture/video/performance; final log `burst-m2-complete-dev.log` |
| `npm run test:e2e -- --config playwright.burst.config.ts burst.spec.ts --grep 'foundation security headers'` | Additional new header case passed; all 12 current experiment cases have been executed successfully across these runs |
| `npm run build` | Passed on final application source; `burst-m2-final-build.log` |
| `npm run typecheck` | Passed again after final test changes |
| `npm run test` | Failed twice: each run had 55 unit + 26 integration passed, 51/52 production browser passed; unchanged public-story progress case failed on desktop then mobile |
| `npm run test:e2e` | Executed by each aggregate run; failures above. Both production experiment 404/security-header cases passed in the final run |
| `npm run test:e2e -- tests/e2e/landing-quality.spec.ts --project desktop --grep 'direct story link' --repeat-each 3` | Three passed unchanged; does not negate the aggregate failures |
| `npm run test:security` | 7 passed, isolated Fire_Inv only; `burst-m2-security.log` |
| `npm run db:reconcile` | Passed after final aggregate: project `mjtejwafxriwntweussc`, 130 synthetic events/commands, all three mismatch counts zero; `burst-m2-final-reconcile.log` |
| `git diff --check` | Passed |

Additional RED/targeted framing/hydration commands and their output remain in `.superpowers/landing-logs/burst-m2-*`. No dependencies were installed for this milestone. No credentials were printed or changed. The existing ignored recording helper from the visual-review task was reused.

## Completion boundary and remaining risks

The isolated redesign, neutral asset intake, captures and scoped checks are delivered. The overall regression failure remains unresolved; do not claim global verification passed or deploy. Read-only inspection suggests the existing public-story readiness/reflow timing deserves investigation, but no root cause has been experimentally established and no public code/test change is authorized here.

Dragon P22 remains an unbranded, non-dimensional proxy pending authentic inputs. Shadow/render quality is studio stylization, and physical-device/production performance is unqualified. Await user review before broader modeling, public integration, any public-story repair or further design changes.
