# Mitsa editorial redesign

> Editorial baseline record. The approved subsequent motion enhancement, reintroduced rendering dependencies, original Blender assets and current verification are documented in [Mitsa motion implementation](mitsa-motion-progress.md). Animation-removal and performance statements below describe the earlier baseline.

Mitsa is the permanent product name. The category is fireworks inventory and business management. Technical package, project, database, route, and environment identifiers are retained for compatibility.

## Reference lock

The user-provided Steep style reference is the primary visual source. Refero live research was attempted but unavailable because the subscription was inactive. Bundled typography, motion, and accessibility guidance supplemented the supplied reference.

| Decision | Source and role | Implementation |
| --- | --- | --- |
| Canvas and type | Steep editorial hierarchy | White canvas, Source Serif 4 display, Inter body |
| Color restraint | Steep surface roles | Neutral sections and cards; one peach packaging callout with sienna ink |
| Product imagery | Steep floating artifacts | Original server-rendered HTML and SVG previews; all business data illustrative |
| Controls | Steep paired pill actions | Dark sign-in action with outlined exploration action |
| Small text contrast | Accessibility guidance | Muted ink #626773 replaces the reference's lighter gray |
| Motion | Bundled motion guidance and approved plan | One short preview entrance, functional transitions, reduced-motion support |

Layout: 1200px maximum width; desktop/tablet/mobile gutters 48/32/20px; section spacing 80/64/48px; card radii 24px; preview radii 20px; input radii 16px; pill buttons. Landing order: header, hero, workspace, capabilities, locations, packaging, access, closing actions, footer.

## Implementation and preservation

The shared identity is in `src/lib/brand.ts`. Shared presentation, navigation, forms, and original previews are in `src/components/site`. Routes `/`, `/login`, `/proof`, and the 404/error views use the same design system. Sign-in and sign-out progressively enhance existing native POST forms with generic inline errors and pending states.

Authentication route handlers, identity and membership checks, session cookies, API responses, security headers, database schemas, and environment configuration are unchanged. No new business modules, public registration, deployment, or migrations were introduced. The isolated synthetic-test notice remains visible.

Removed: old landing layout/styles/components, storefront artwork and screenshots, dragon models/shaders/effects, the development-only product-burst route and tests, visual asset-generation scripts, and unused source artwork. After auditing consumers, removed Three.js, React Three Fiber, GSAP, and Three.js types from the package manifest and lockfile. Historical documentation and review evidence remain, marked superseded. Experiment absence remains covered by a 404 regression test.

## Font and icon provenance

Inter and Source Serif 4 Latin WOFF2 files were obtained from Google Fonts on 2026-10-13. Their SIL Open Font License files are stored beside the fonts in `src/app/fonts`. Files are loaded with `next/font/local` and served from the application origin. Georgia and Arial are fallbacks. The M favicon is an original typographic SVG; the compatibility ICO is generated from that SVG using Sharp. Interface icons and charts are original SVG primitives.

## Verification

Verified on 2026-10-13 with Node 24.21.0, npm 11.19.0, Next.js 16.4.0, and installed Edge:

- `npm run build`: passed; no experiment route is emitted.
- `npm run typecheck`: passed.
- `npm run test:unit`: 41 tests passed across four files.
- `npm run test:integration`: 26 tests passed across four files against the approved isolated target.
- `npx playwright test`: 43 of 44 cases initially passed after the layout and metadata fixes. The remaining performance case sampled an observer before delivery; it was corrected to wait for a measured paint. `npx playwright test tests/e2e/landing-performance.spec.ts` then passed on both projects. All 44 desktop/mobile cases are verified across these runs.
- `npx playwright test --grep 'captures the rebuilt|Mitsa authenticated'`: four additional targeted cases passed after switching screenshots to CSS resolution to avoid oversized mobile capture artifacts.
- Hosted checks prove JavaScript and native-form login/logout, membership denial with logout access, identity isolation, HttpOnly cookies, refresh, revoked sessions, and fixed-destination single-use callbacks.
- Automated WCAG 2.2 AA checks pass on landing, sign-in, 404, authenticated, and membership-denied views. Responsive checks pass at 320/390/768/1024/1440px and enlarged root text. Navigation works without JavaScript, and reduced-motion preferences disable animation.
- Lab LCP: 360ms desktop / 364ms emulated mobile; CLS: 0 in both runs. Total initial JavaScript: 137,531 gzip bytes (approximately 134 KiB). These are unthrottled local Edge measurements, not field performance or physical-device qualification.
- The removed experiment returns 404 in both production and development. Static audits find no legacy branding in runtime source, no remaining rendering-library imports or packages, and no changes to auth route handlers, proxy, API, Supabase client, schema, or environment configuration.

Screenshots in `docs/previews/mitsa` were visually inspected at desktop, tablet, and mobile sizes. Historical performance captures measure the removed development renderer rather than comparable total production JavaScript transfer; no measured before/after percentage is claimed. Physical-device Safari/Android qualification remains outside this local verification. Business workflows remain planned concepts; nothing was deployed.

