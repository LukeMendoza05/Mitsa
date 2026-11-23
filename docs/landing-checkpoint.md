> Historical record — superseded by the Mitsa editorial redesign on 2026-10-13. Legacy names, screenshots, commands, and source paths below describe the retired implementation. See [current implementation](mitsa-redesign.md).

# Landing page implementation checkpoint

Scope: approved public landing page on `codex/foundation-proof`, preserving foundation baseline `d9fd220`. No Stage 1 Task 4, business transaction implementation, authentication change, migration, or deployment.

## Delivered

- Ten server-rendered sections with scoped white/mist/ink tokens, responsive navigation, keyboard controls, and existing `/login` links.
- Five clearly labeled planned interface concepts with synthetic data; desktop tabs and stacked phone figures.
- Original miniature shops, shelves, cartons, checkout counter, and receipt geometry. Shared editable model source, portable GLB, and 16 responsive WebP illustrations.
- One deferred desktop WebGL renderer shared across hero, four story chapters, and transfer sequence. Native scrolling, reversible deterministic poses, demand rendering, capped pixel ratio, visibility suspension, and resource cleanup.
- Illustrated phone/tablet chapters; reduced-motion, data-saving, short-screen, failed-download, unavailable-WebGL and context-loss fallbacks. Manual static view does not persist browser data.
- Transfer illustration conserves 16 units and leaves receiving availability at four until receipt confirmation.
- Automated motion, accessibility, responsive, lifecycle, performance, and foundation regression coverage. Actual desktop, phone, and story screenshots are in `docs/previews/`.

## File inventory

Modified:
- `package.json`, `package-lock.json`: pinned rendering and accessibility-test dependencies.
- `src/app/page.tsx`: public composition and metadata.
- `tests/e2e/foundation.spec.ts`: public-root expectation updated; foundation safeguards retained.

Added:
- `src/app/marketing.css`: marketing-only tokens and layouts.
- `src/components/marketing/Header.tsx`, `Poster.tsx`, `Showcase.tsx`, `Story.tsx`: accessible public presentation.
- `src/components/marketing/SceneController.tsx`, `StudioCanvas.tsx`, `motion.ts`, `model.mjs`: deferred renderer, original scene, and deterministic state.
- `scripts/generate-marketing-assets.mjs`, `public/marketing/*`: reproducible original models and posters.
- `tests/unit/landing-motion.test.ts`: seven deterministic motion/state tests.
- `tests/e2e/landing.spec.ts`, `landing-quality.spec.ts`, `landing-performance.spec.ts`, `landing-capture.spec.ts`: landing behavior and evidence.
- `docs/landing-progress.md`, `docs/marketing-assets.md`, this checkpoint, and three preview screenshots: decisions, provenance, and review evidence.

## Verification

Final command results are recorded below after completion. Regression credentials remain in the existing ignored operator file. Hosted tests are restricted by project identity and database marker to isolated Fire_Inv (`mjtejwafxriwntweussc`). They use existing synthetic foundation probes; no business ledgers exist yet.

## Review and limitations

Superpowers execution/TDD and a fresh independent review were used. Three animation findings were corrected: chapter synchronization, deep-link lazy loading, and measuring rendered frames rather than input cadence. A final phone-heading whitespace defect was reproduced by a failing browser assertion, corrected, and verified on both profiles.

The finished visual remains a stylized original illustration, not photorealistic retail imagery. Generated posters share geometry and camera but approximate WebGL lighting. Screens show planned capabilities, not completed operational modules. Tablet showcase tabs remain accessible from 768px; phone figures stack below 768px.

Browser evidence uses installed Edge on Windows, including emulated phone dimensions. Physical Android/iPhone, Safari, actual browser zoom, real screen-reader behavior, and hardware-specific sustained GPU performance still need device qualification. Tests include 320px reflow (equivalent width of a 1280px viewport at 400% zoom), 200% root text enlargement, landscape and short-screen layouts. Laboratory loading/frame metrics are not field INP or production performance guarantees.

FireStock camera mechanics and the references' mobile behavior remain unverified; the implemented scene and camera path are original design decisions. No reference artwork or fonts were copied. Dependency and asset provenance is recorded in `marketing-assets.md`.

## Local preview

Open `http://127.0.0.1:3001/` while the local preview process is running. To restart from this project directory:

```powershell
npm run build
npm run start -- --port 3001
```

For development use `npm run dev` (default port 3000). No service provisioning or deployment is needed for the public page. Review the page before authorizing further visual changes or business-module work.
