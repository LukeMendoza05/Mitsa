> Historical record — superseded by the Mitsa editorial redesign on 2026-10-13. Legacy names, screenshots, commands, and source paths below describe the retired implementation. See [current implementation](mitsa-redesign.md).

# Landing page execution ledger

Approved specification: user's Fireworks Inventory landing-page design proposal, 2026-10-12. Foundation baseline: d9fd220. Scope: public landing only; no business workflows, auth/database changes, production access or deployment.

## Plan and finishing criteria
1. Scoped static shell and navigation, tested against the existing page first.
2. Ten responsive content sections with original stills and truthful planned labels.
3. Five interface concepts, original shared model source, assets and license register.
4. Deterministic desktop animation with tested progress mapping.
5. Shared renderer, transfer conservation, preferences and robust fallbacks.
6. Responsive/a11y/performance checks, all foundation regression commands, fresh code review.

Use Superpowers executing-plans/TDD, Addy frontend guidance and React performance review. Finish only after checking actual outputs; disclose physical-device, screen-reader and field-performance limits.

Pre-flight: asset generation and runtime share model/camera definitions; static story and animation share deterministic progress; desktop tabs and stacked mobile figures share a single content tree. No backend interfaces change.

Ruling: continue in the user's dedicated existing checkout on codex/foundation-proof; no unrelated checkout or service is accessed. Keep an auditable tracked ledger instead of platform-specific shell helpers. Cost if wrong: branch separation must be performed before integration.

Ruling: use code-defined original meshes as editable model sources and generate GLB plus raster posters from them. No external model/texture procurement is needed. Cost if wrong: later art-direction changes require regeneration.

## Results
Public-shell acceptance observed RED against the original heading before implementation. Motion unit suite initially failed on the absent module, then passed all five cases. Desktop/mobile shell tests found one ambiguous test locator, corrected by heading level.

Build and typecheck passed. 18 landing browser tests passed on desktop/mobile, including all eight widths, menu focus, tabs, no-JS, axe WCAG tags, text resize, WebGL absence, reverse progress, and runtime reduced-motion changes. Two additional lifecycle/data-saving tests passed on desktop. Full foundation regression and final review remain pending.

The accessibility test reproduced a prohibited label on a generic chart div; assigning the image role resolved it. The WebGL test reproduced immediate fallback: R3F mounts canvas fallback children even when WebGL works. Removing the fallback side-effect resolved it. Browser console exposed SSR inline chart styles blocked by the existing CSP; replaced them with stylesheet classes, without changing CSP.

Ruling: approximate the runtime lighting in generated poster renders from the same geometry/camera rather than install a separate rendering engine. Posters remain original raster assets, documented as illustrations rather than WebGL captures. Cost if wrong: exact lighting parity would require regenerating posters from an approved browser renderer.

Visual inspection: local desktop hero and sticky story, plus phone 390px hero, inspected through the browser. Original procedural 3D runs; phone uses static assets. No unrelated websites or projects changed.

## Resumed verification and independent review
The interrupted aggregate actually completed: 46 unit, 26 hosted integration, and 40 E2E tests passed. The process handle expired, but the complete captured log retained all suite summaries.

Fresh reviewer found no critical issues and three important animation defects. Fixed in one review correction pass: full-track progress aligns all chapter centers; all visible enhancement tracks can trigger renderer import; quality decisions use rendered-frame timing instead of input event cadence. Chapter-center browser test reproduced wrong chapter 3 instead of 2, then passed. Seven motion unit tests pass, including slow-frame/idle-window behavior. Direct transfer, blocked download, and long-copy tests passed. Scene pose survives canvas resize.

Final: minor (deferred): showcase uses accessible tabs from 768px, while the reviewer interpreted the tablet requirement as stacked figures. Phones below 768px use stacked figures; no inaccessible carousel. Keep this visible for user review rather than silently changing the approved presentation.

Final: Ruling: physical GPU performance, Safari and real screen-reader behavior are not certified by Edge emulation/axe. Record them as remaining device qualification; cost if wrong: platform-specific issues may remain before public release.
Final: Ruling: poster lighting parity remains approximate as disclosed in the asset register; cost if wrong: exact lighting parity needs poster regeneration.
Final: Ruling: reviewer did not verify aggregate regressions; executor reads fresh outputs before claiming passes. Cost if wrong: an unexecuted gate could otherwise be mistaken for evidence.

Local unthrottled lab before the final copy polish: LCP 444ms static / 240ms WebGL, CLS 0, added initial marketing chunk 4,283 gzip bytes, deferred chunks 288,050 gzip bytes. Model has 53 meshes, 636 triangles, nine materials. Physical-device FPS/field INP remain unverified.
