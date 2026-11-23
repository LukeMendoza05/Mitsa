> Historical record — superseded by the Mitsa editorial redesign on 2026-10-13. Legacy names, screenshots, commands, and source paths below describe the retired implementation. See [current implementation](mitsa-redesign.md).

# Marketing asset register

All shop architecture, shelves, cartons, product packaging, receipt shape and screen geometry are original procedural artwork created for Fireworks Inventory in this workspace. There are no Apple, Collabify, or FireStock assets, downloaded textures, external fonts, logos, real business records, or third-party environment maps.

Editable source: `src/components/marketing/model.mjs`. Generated assets: `public/marketing/studio.glb` and 16 responsive WebP posters. Recreate with `node scripts/generate-marketing-assets.mjs`. The runtime builds the same meshes directly, avoiding a network GLB load. GLB is supplied for portability/editing. Posters use the identical geometry and camera with approximate directional shading; they are raster illustrations, not captured application screens. Application concepts use synthetic data and visible planned labels.

Dependencies pinned from npm metadata: Three.js 0.186.1 (MIT), React Three Fiber 9.8.1 (MIT; React >=19 <19.4), GSAP 3.15.0 (GSAP standard no-charge license, not MIT), @types/three 0.186.0 (MIT). Preserve their installed license notices. No visual animation authoring product or repackaged asset library is being distributed. Accessibility checks use @axe-core/playwright as development-only tooling.

Source assets are generated specifically for this project; no separate third-party artwork license is asserted or needed. No SF Pro is bundled. The UI uses installed system fonts. Product packaging ratios are illustrative; no operational catalogue data is implied.
