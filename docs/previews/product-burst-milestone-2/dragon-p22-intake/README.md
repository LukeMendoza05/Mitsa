# Dragon P22 asset readiness

Target supplied by the user: **Dragon’s Family Fireworks Package 2**, aliases **P22 / DFAMILY2**. Exact identity, packaging edition and external commercial form are not yet independently verified. Do not infer that the retail package is a single rigid box from the neutral motion proxy.

## Current result: blocked for authentic modeling

Project-local assets and documentation were inspected. There are no product photographs, measured dimensions, identity evidence or image-use permissions for this target. All six face references and all three dimensions in `intake.json` are deliberately null. No branded asset, authentic texture, dimensional model or Blender-generated asset has been created. The experiment's dominant hero is neutral arbitrary geometry; its label explicitly says dimensions and packaging are unverified.

## Intake and validation

1. Place real photographs in `references/` using its documented naming/orientation scheme. Record exact relative filenames for all six faces in `intake.json`.
2. Verify the actual product and packaging edition against the package and an attributable source supplied with it. Confirm that P22 and DFAMILY2 refer to that same edition; record evidence rather than assuming equivalence.
3. Verify the external package's form, unopened state, six-face adjacency and all visible folds/seams. If this is an assortment rather than a rigid retail box, obtain references for its actual outer presentation and revise the asset plan before modeling.
4. Record positive measured width, depth and height in millimetres, measured date/person, uncertainty and measurement photographs. No proportional inference from a perspective marketing image qualifies as a measurement.
5. Review each face for resolution, sharp print, correct orientation, consistent edition and unoccluded edges. Obtain print/gloss/fold/seam close-ups when the supplied faces cannot establish those details.
6. Verify permission covering source images, texture creation, derivative renders and web use. Record its scope and a controlled evidence reference.
7. A named reviewer records approval/date and changes `modelingApproved` only after every preceding item passes. A filled filename alone is not approval; inspect the actual source. Until then, retain `blocked-missing-source-materials` and the neutral proxy.

## When ready: Blender-to-website workflow

- Create a meter-based Blender scene, converting verified millimetres by dividing by 1000. Build the intact external form at those measured dimensions, with independently editable geometry and materials. Use small bevels and folds only where photographs support them.
- UV-map each documented face with correct orientation and scale. Preserve actual artwork and regulatory marks without inventing hidden faces or repairing them with generated graphics. Keep source photographs separate from derived textures and record all edits.
- Retain the editable `.blend`, UV layout and original image sources under this intake structure; export only approved web assets to a development-only asset path. Do not put the original photos or private rights documents into public static assets.
- Export a GLB with applied transforms, glTF PBR materials, embedded optimized textures and no cameras/lights unrelated to the asset. Verify bounding-box dimensions against the measured form, face orientation and the unopened silhouette after a test import. Start with one shared 1–2K texture atlas where print readability permits; retain higher-resolution masters. Review color space, roughness and transparency from evidence, not imagined luxury finishes.
- Measure bytes, texture memory, geometry, draw calls and visual quality. Use the existing Three.js/R3F loader; add compression tooling only if measured asset cost justifies it and approval permits. No new dependencies or optimization claims are made now.
- Replace only the hero once identity, geometry and image rights pass review. Keep the six supports explicitly neutral. Retest frustum fit, collision envelopes, camera-facing print readability, grounding, refresh/reverse behavior, cleanup and performance using the real dimensions. Generate static mobile/reduced-motion renders from the approved asset.

Missing inputs block authentic texturing/modeling, exact proportions and final branded camera approval. They do not block the separately approved neutral motion redesign. Broader product families and public integration remain outside this milestone.
