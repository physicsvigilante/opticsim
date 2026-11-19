# Native two-thick-lens + finite mirror — prospective v17 engine capability

**Status:** DRAFT, not on production `main`. New physical/numerical scope must pass full supported Node 24 + actual Chrome CI, a new independently authored R2 physics review and explicit project-owner release approval. The independently R2-cleared but unreleased v14/15/16 branches remain separate prerequisites.

## Bounded physical authoring

New canonical schema and adapter **17**, model **`native-two-thick-lens-mirror-tracing`**, accepts **exactly two stationary, upright, separate, physical biconvex spherical thick lenses**, **one independent finite plane mirror**, **1–4 explicitly directed single native rays** and **0–2 passive finite detectors**, with no additional optics or media. Geometry/material fields of each lens are unchanged from reviewed v15: `x,y,apertureHeight,centerThickness,frontRadius,backRadius,insideIndex,outsideIndex,partialReflection`. The lenses have individually specified indices in **one explicitly shared outside medium**; the radii are positive biconvex magnitudes (not focal lengths). The mirror has exact `x,y,orientationDeg,length`.

All v15 spherical-cap geometry, minimum 1 mm physical rim thickness, aperture/radius bounds, disjoint lens x-extents separated >=0.01 mm, initial forward ray/corner+tangency restrictions, external source and detector limits, common exterior material and unmodified original event observers are reused *verbatim* on a **validation-only subset**. The complete canonical and native scene retains both lenses, mirror and all sources/detectors. The entire mirror **finite segment** must lie horizontally >=0.01 mm outside each lens's full x envelope, including endpoints. Existing general-optical finite mirror/source checks and passive-detector checks also run. This is a conservative collision-admission certificate, not a proven intersection-accuracy margin; it may refuse valid tilted or off-axis arrangements.

There is **no requirement** that a ray visit either lens, that the mirror lie beyond both lenses rather than between them, that any ray reflect at the mirror, or that a return path exist. All native rays, branch surfaces, TIR and misses remain chosen by original pinned PhyDemo `811f508d2b070898c241a568b0c167dcb8645251`. Opticsim does not compute or inject an itinerary, source-to-detector ancestry or a complete image.

## Explicit version-scoped native depth policy

This physically longer train can encounter at least **four curved lens faces outbound, one finite mirror and four faces returning**, followed by an observed passive detector crossing. Native test-only [PR #115](https://github.com/physicsvigilante/opticsim/pull/115) demonstrated this real 11-callback path **cannot complete under the existing public maxRayDepth 8**. For the particular synthetic axial return, depth 8–10 produced a real incomplete/truncated run; first completion occurred at native depth **11**. Depth 12 and 16 completed without truncation. This does not guarantee a complete run for another apparatus or full Fresnel tree.

Only the **isolated v17 format** admits the bounded **`native-deep-v17`** authoring policy:

| Property | v1–v16 unchanged | v17 new |
| --- | --- | --- |
| Default authoring maxRayDepth | 8 | 16 |
| Maximum permitted native ray depth | 8 | 16 |
| New named run policy | Not available | `native-deep-v17`, `rayDensity=0.2`, `maxRayDepth=16`, `processedRayLimit=10000` |
| Explicit legacy `preview-v1` in v17 | n/a | 8; incomplete results are withheld |
| Completeness/undefined/truncation rule | Existing strict gate | **Unchanged strict gate** |

The v17 higher maximum is a contract-specific *execution budget*, not an accuracy guarantee or a retroactive change to any existing scene, policy or historical evaluation. Native weak-ray truncation, processed-ray limits, undefined behavior, invalid finite-face evidence, depth exhaustion, stale scene hash or a stopped/failed run still **suppress requested measurements**. Even with ray depth 16, a full-Fresnel branch tree may be incomplete. `partialReflection:false` explicitly neglects ordinary partial Fresnel reflection while preserving TIR.

Saved v15 or v16 scenes attempting `maxRayDepth:16` are rejected, rather than silently upgraded or reinterpreted as v17. New v17 authoring defaults to `native-deep-v17` **only when no run policy is supplied**; explicitly requesting the legacy preview policy retains depth 8 and the correct withholding behavior. Any authoring request with one thick lens and a mirror remains v16, and one/two thick lenses without a mirror remain v15. No old save migrates automatically.

## Physical correctness, inspection and limits

Public observables include first real native local-normal interface event, per-lens and per-face sampled counts, real native mirror reflection counts and detector crossings. They do not calculate focal images, wave optics, irradiance, wavelength, phase, a guaranteed optical return, 3D rays, continuous power, source-attributed ray paths or an original textbook answer.

The synthetic fixture `examples/native-two-thick-lens-mirror-v17.json` specifies source S1 at (−200,0) mm pointing 0°, L1 at x=0 (inside n=1.5), L2 at x=150 (inside n=1.3), two biconvex bodies each with full aperture 100 mm, central thickness 30 mm, radii Rfront=Rback=100 mm, outside n=1, mirror M1 at (300,0) mm oriented +90° with finite length 400 mm and detector D1 at (−100,0) mm of length 400 mm. Both lenses explicitly use Fresnel-off. Native test-only evidence predicts the actual return sequence `D1,L1,L1,L2,L2,M1,L2,L2,L1,L1,D1` under depth 16. This is an **outcome to verify**, never an authored route.

The v17 Node/Chrome tests must separately verify that the canonical public v17 scene produces those real surface events, two distinct material IDs, bounded numerical guards, mirror miss, independent multiple sources, input-unit conversion, revisions, staleness suppression, qualified export/reopen and full-Fresnel incompleteness. Original v1–v16 fixtures, historical freeze source hashes, native solver and existing brightness/cutoff thresholds are immutable.

From a supported checkout:

```sh
npm run setup
npm test
node scripts/run-problem.mjs examples/native-two-thick-lens-mirror-v17.json --out test-artifacts/llm-authoring/native-two-thick-mirror-manual-01
npm run build
node scripts/native-two-thick-lens-mirror-browser.mjs
```

Use fresh artifact output directories. **All synthetic checks are software/physics reference evidence**, not a human optics-expert certification or proof across all near-critical, sharp-corner, near-coincident and high-order reflected trajectories. Release requires a separately authored R2 independent numerical/physics review of the *exact final candidate tree*, plus owner authorization following v14→v15→v16 dependency order.
