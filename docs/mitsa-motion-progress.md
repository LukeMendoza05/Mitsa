# Mitsa motion implementation

## Reference and design decisions

The supplied Steep editorial reference and [Steep’s live website](https://steep.app/) informed the pacing, reversible hero composition, staggered type, restrained depth, and product-first storytelling. The live page was reviewed forward and backward in the browser on 2026-10-13. Mitsa retains its own typography-focused identity, neutral materials, one peach callout, original packaging geometry, and illustrative HTML interfaces. No Steep assets, customer claims, or branding are copied. Refero live research was unavailable because the subscription was inactive; its bundled design guidance supplemented the supplied reference.

## Blender connection — repaired and verified

The Codex launcher incorrectly pointed at `C:\Users\Luke\.local\bin`, a directory. It now points at the existing `uvx.exe`. The installed extension is **Blender Lab MCP 1.0.3**, so its matching official bridge is pinned to `dbbf836ad4b1025f14a2b3b504c43903f39e0b04` in `https://projects.blender.org/lab/blender_mcp`, subdirectory `mcp`. Other Codex configuration is preserved, with a backup beside the original.

The running app retained its stale tool registration. `scripts/blender/mcp_client.py` therefore uses the official MCP SDK and repaired configuration to initialize the official bridge, discover advertised tools, and invoke them over MCP/stdio. Blender’s installed add-on runs on loopback port 9876 using its documented background-server command. This is the required MCP workflow, not substitute CLI modeling. Restart Codex to refresh its native Blender tool registration.

Actual successful calls verified scene inspection, modeled a separate test mesh, rendered PNG, and exported GLB before final authoring. Preflight artifacts remain ignored under `.tools/blender-preflight` and never ship. Final authoring and rendering also ran through `execute_blender_code`, preserving existing Blender scenes and exporting only the selected Mitsa collection.

## Final original assets

- Source: `assets/source/mitsa-inventory/mitsa-inventory.blend`.
- Authoring: `scripts/blender/build_inventory.py` and `render_inventory.py`.
- Runtime: `public/mitsa/mitsa-inventory-assembly.glb` — 534,976 bytes, 9,964 triangles, 21 meshes, five matte materials, nine independently animated groups, no embedded cameras or lights.
- Carton, two fitted trays, three folded packs and three individual sleeves explain inventory grouping. Dimensions are illustrative, not manufacturer specifications.
- Desktop/mobile WebP alternatives come from the actual Blender Cycles renders. No placeholder models, stock textures, external environments or decorative fireworks are used.

## Motion architecture and choreography

`LandingExperience.tsx` owns one GSAP ticker and, on eligible fine-pointer desktops, one Lenis controller. Wheel easing uses lerp 0.12. Touch, modified wheel gestures, horizontal wheel gestures, native-scroll regions, forms and browser navigation retain native behavior. Anchor history and keyboard target focus are preserved. Pointer navigation keeps its natural focus behavior; anchor clicks refresh scroll geometry immediately rather than using measurements from before a resize. Controllers, listeners, split heading markup and transforms are cleaned up when eligibility changes or the route unmounts.

`HeroStory.tsx` provides one normalized reversible ScrollTrigger timeline:

| Progress | Composition |
| --- | --- |
| 0–0.15 | Hold the separated original inventory composition and readable floating previews. |
| 0.15–0.45 | Gentle camera approach, staggered actor assembly and restrained card perspective. |
| 0.43–0.73 | Cards and initial legend leave as the workspace emerges. |
| 0.47–0.85 | The same live scene shrinks and docks into the workspace inventory panel. |
| 0.65–0.85 | The workspace sales line draws into view. |
| 0.85–1 | Hold the completed workspace before releasing the pin. |

The pin lasts 1.5 viewport heights. Assembly uses smoothstep interpolation; DOM composition uses short power easing. Refresh and scroll updates share the same progress signal so the WebGL pose cannot lag behind HTML. Canvas measurements use untransformed offset sizes to avoid resize feedback during scaling.

The final pin requires width ≥1024px and height ≥820px. Actual visual review showed shorter screens could not hold the complete readable workspace. They retain native scrolling, authored images and section motion. Tablet/mobile never download the GLB. Reduced motion or data saving disables the animation engine; no-JavaScript content and forms remain usable. Model-download failure or actual WebGL context loss restores the authored posters while the HTML story remains available.

`InventoryCanvas.tsx` uses demand rendering, capped DPR 1.5, a restrained camera path, matte neutral lighting, a light contact shadow and one shadow caster. It pauses updates offscreen or in hidden documents and disposes loaded geometry/materials on unmount. Context-loss listeners are removed before renderer disposal so an old canvas cannot disable its replacement after a breakpoint change.

Remaining sections use staggered word and card entrances, chart drawing, a small location-preview drift, a packaging-diagram reveal and at most two degrees of pointer tilt. Buttons have short hover/press feedback. Interior pages retain restrained entrances and existing form behavior. No looping animation, competing scroll controller or business module navigation is introduced.

## Visual refinement

Reviewed real forward/reverse wheel interaction, the recorded sequence, sampled video frames, and desktop/tablet/mobile browser views. Refined camera framing, the final dock geometry, neutral fill lighting, shadow strength, card departure timing and preview density. The opening legend fades before the workspace arrives. The complete final composition fits 1024/1440px widths at 820/900/1000px heights, without covering the header or extending below the pinned view. No production CSP relaxation was needed.

## Verification

- `npm run typecheck` and `npm run build`: passed.
- `npm run test:unit`: 43 passed, including reversible assembly endpoints, screen eligibility and final GLB budgets.
- `npm run test:integration`: 26 passed against the established isolated target.
- Final full `npx playwright test`: 52 passed, six intentionally excluded duplicate desktop-only cases on the mobile project; no failures (2.1 minutes). After the final keyboard and resize-anchor refinements, all 26 relevant desktop/mobile presentation, motion, accessibility and performance checks passed again (six desktop-only mobile exclusions).
- Automated checks cover WCAG, 320/390/768/1024/1440px reflow, enlarged text, menu keyboard/Escape behavior, target focus, no-JavaScript navigation and POST forms, actual WebGL context loss, failed asset downloads, live reduced-motion changes, breakpoint cleanup, forward/reverse poses, native anchors, pin exit and idle rendering.
- Existing hosted checks cover real native/enhanced login and logout, membership denial with sign-out access, identity isolation, refresh/revocation, HttpOnly cookies, CSRF and callback compatibility. Routes, API contracts, schemas, environment variables and security policy are unchanged.
- Local unthrottled Edge measurements: wheel animation p95 frame interval **16.9ms** over 238 frames; enhanced LCP **220ms**, CLS **0**; baseline JavaScript **141,969 gzip bytes**, total enhanced JavaScript **447,502 gzip bytes**, GLB **534,976 bytes**; settled rendering **23 draw calls**, **11,470 rendered triangles** including shadow work.
- Runtime/source branding is Mitsa. Legacy names remain only in necessary technical identifiers or clearly superseded historical evidence. The retired experiment remains 404.

Evidence: `docs/previews/mitsa-motion/forward-reverse.webm`, hero pose captures, supported workspace viewport captures and the responsive/interior captures in `docs/previews/mitsa`. These are laboratory results, not field performance or physical-device Safari/Android qualification. React development debugging can log its existing strict-CSP eval limitation; production was checked without those diagnostics or CSP violations. Use `npm run build` then `npm run start` for production visual review. No deployment or database migration was performed.


