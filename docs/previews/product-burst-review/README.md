# Product-burst visual review — 13 October 2026

Review only. No implementation or design changes. Source and test file SHA-256 hashes were compared before and after capture and remained unchanged.

## Shareable evidence

- `0.png`, `25.png`, `50.png`, `75.png`, `100.png`: fresh actual Edge screenshots, 1440 × 900; matching progress values verified from the running page.
- `mobile-static.png`: 390 × 844 viewport, full-page screenshot. Static fallback verified, zero canvas elements, document width 390px (no horizontal overflow).
- `slow-forward-pause-reverse.webm`: actual browser recording, VP9, 1440 × 900, 25fps, 42.48 seconds. Slow forward motion to 50%, three-second pause at maximum spread, continuation to 100%, then reverse through 50% to 0%. No simulated/interpolated frames. Decoded pause and ending frames were inspected.
- `85-overlap-detail.png`: additional rendered checkpoint illustrating reassembly overlap.
- `performance-existing.json`: copied existing measured performance evidence, not a new benchmark.
- `capture-manifest.json`: capture timestamp, browser version, verified progress values and recording schedule.

The Playwright official FFmpeg recording helper and companion Winldd were downloaded into the ignored `.superpowers/capture-tools` folder. No application dependency, lockfile or security setting was changed. Capture scripts and temporary frames are also in ignored tooling folders. The recording is a browser viewport capture, not a physical camera recording or complete Windows desktop capture.

## Observations and approval priorities

1. **Overlap / apparent intersection — needs review.** At 0%, the front ivory box hides much of the central group. At 25%, the right-side pair and central group still overlap visually. During reassembly around 85%, the lower-right ivory packages produce a visibly cut-through silhouette; another slate box disappears behind the large front package. At 95%, the central ivory/slate pair still overlaps. These paths do not read as collision-free physical package movement. The final 100% row has distinct silhouettes.
2. **Depth / cinematic impact — restrained.** The 50% pose has legible separated objects, but the composition occupies a modest central area and reads as an airy product diagram more than a dramatic foreground/background burst. The large camera pullback offsets the outward movement. This is an art-direction judgment, not a functional failure.
3. **Grounding and lighting — needs review.** Shadows are pale but visibly angular and offset. The 100% packages remain floating above their ground shadows instead of appearing supported on a display surface. Some object-on-object shadow patches during overlap look like cutouts. Lighting direction appears consistent in the captures; no visible light flicker was found in sampled recording frames.
4. **Pacing / trajectories — uneven emphasis.** The objects settle at maximum spread around 50%; most gathering happens after approximately 72%, while the camera moves closer. This makes the last quarter feel more compressed and visually expansive. The gathering paths cross other packages, as illustrated at 85–95%. No teleport was apparent at the inspected checkpoints; the capture returns to the starting composition. This is not a frame-by-frame stutter certification.
5. **Rotations.** Rotations stay restrained rather than tumbling. Narrow background packages sometimes show very little front surface. No inverted or distorted package proportions were apparent in inspected frames; label readability will require a separate review with authentic artwork.
6. **Clipping.** No package or heading clips the viewport at the five 1440 × 900 checkpoints. Occlusion between packages is the primary issue. This review does not certify every viewport.
7. **Mobile/static.** Readable stacked illustrations, no canvas, no horizontal overflow. The static illustration shows a spread composition while the progress output reads 0%; that output can be confusing in static mode. The full-page development capture includes a Next.js development-control artifact at the bottom; it is preserved in the screenshot and is not part of the proposed visual design.

## Existing performance evidence

Edge 155.0.4283.45, ANGLE/AMD Radeon Graphics via Direct3D11, viewport height 900px, DPR 1. Each width used 180 animation-frame samples during scrolling. At 1280px: median 16.7ms, P95 16.8ms. At 1440px: median 16.7ms, P95 17.1ms. Both recorded 15 draw calls, two geometries and three renderer textures including shadow resources.

These are the prior development-build browser scheduling measurements, not newly measured results, GPU timer queries, production performance or physical mobile-device certification. Video capture overhead is separate; the 25fps recording is not the renderer's measured frame rate.

## Next step

Review the video and overlap detail before approving any motion, camera, shadow or static-interface changes. No fixes, branded assets, landing-page integration, database work or deployment were performed during this review.
