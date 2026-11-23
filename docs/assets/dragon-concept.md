# Dragon Family Package 2 — concept reconstruction

This asset is a **user-approved visual reconstruction**, not a manufacturer-verified digital twin. The displayed website heading is exactly “Dragon Family Package 2”. The label retains the wording already present in the supplied artwork rather than inventing new packaging printing.

## Source and permissions

Source: `assets/source/cinematic/references/image-5.png`, a 1672 × 941 user-supplied cinematic concept. The user expressly authorized Blender modeling, extracting image-derived textures and website use. No manufacturer endorsement or independent verification of the packaging artwork is asserted. Spectra's supplied screenshot is reference-only and is not a website texture. No third-party firing footage was downloaded or embedded.

## Created assets

- Editable source: `assets/source/dragon-concept/dragon-family-package-2.blend` (packed source images).
- Authoring/export script: `scripts/blender/build_dragon_concept.py`.
- Approved visible label, perspective-rectified: `assets/source/dragon-concept/label-derived.png`.
- Neutral reconstructed cardboard grain: `assets/source/dragon-concept/cardboard-neutral.png`.
- Blender preview: `assets/source/dragon-concept/preview.png` (transparent studio/shadow-catcher render).
- Round-trip inspection: `assets/source/dragon-concept/validation.json`.
- Web asset: `public/marketing/dragon/dragon-family-package-2.glb`.
- Runtime-matched intro/burst/resolved and mobile WebP fallbacks: `public/marketing/dragon/`.

Blender 5.2.2 LTS generated a closed beveled cuboid with a separately UV-mapped label surface. The original complete PNG is kept only as an editor reference. The GLB contains genuine body geometry and depth; it is not a complete photograph placed on a plane. Its group pivot is centered, the visible front faces +Z in Three.js, and transforms are applied. No preview lights, cameras or reference empty are exported.

Inferred proportions: **5.8 width × 2.25 height × 1.05 depth in arbitrary scene units**, with the label extending 0.004 units beyond the front face. These are artistic proportions estimated from perspective, not physical measurements. Hidden sides remain neutral; no unseen graphics, certification marks, safety claims, printed dimensions or manufacturer logos were added.

Validated by re-importing the GLB in Blender: two mesh objects, 190 triangles, two UV-bearing meshes and two embedded texture images. GLB size: 690,640 bytes. Re-imported Blender XYZ bounds: approximately 5.8 × 1.054 × 2.25; Three.js Y-up bounds: 5.8 × 2.25 × 1.054. Unit tests check mesh depth, embedded images, UV attributes, applied scale and reconstruction metadata. Browser tests load the actual GLB and inspect its posed dimensions/framing.

## Reproduction

```powershell
node scripts/prepare-cinematic-assets.mjs
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --python-exit-code 1 --python scripts/blender/build_dragon_concept.py
```

The image-preparation script uses the project-local originals by default. For first intake, pass the folder containing `image-1.png` through `image-6.png`. Source hashes and resized derivatives are recorded in `docs/assets/cinematic-assets.json`.

## Remaining authentic-product requirements

Manufacturer photographs for all six faces, a confirmed packaging edition, measured external width/depth/height, folds/seams/finish details, and corresponding image-use rights remain missing. The published P22 product identity exists, but it does not authenticate this concept artwork. Replace inferred geometry/textures only after the authentic intake is complete and approved. Retest camera, framing and animation against the measured replacement.
