# Native spherical thick lenses — proposed v15 physical capability

**Status: independent R2 physics review pending. Draft PR #110; NOT released to `main`.**

This milestone adds an explicit, bounded **physical thick-lens** model, distinct from the ideal thin-lens abstraction. It reuses pinned upstream PhyDemo commit `811f508d2b070898c241a568b0c167dcb8645251` and its original `SphericalLens` implementation, without introducing another optical propagation solver or altering numerical cutoffs.

## Physically authored apparatus

An accepted new `physical` request must include 1–2 `spherical-lens` components, 1–4 explicitly directed `single-ray` point sources, and 0–2 passive external detectors, with no additional optics or media. New scenes select **`schemaVersion:15`, `adapterVersion:15`, `model:'native-thick-lens-tracing'`**. Existing v1–v14 saves remain isolated and unchanged.

Every lens requires these exact named physical fields:

| Parameter | Meaning | Admitted domain |
| --- | --- | --- |
| `x`, `y` | Centre of lens on its horizontal optical axis, mm, y-up | Finite; complete lens inside ±10000 mm |
| `apertureHeight` | Full finite vertical aperture, mm | At least 4 mm |
| `centerThickness` | Axial thickness between spherical vertex apices, mm | At least 2 mm, with 1 mm or more remaining rim thickness |
| `frontRadius` | Positive radius magnitude of left spherical face, mm | At least half-aperture + 1 mm |
| `backRadius` | Positive radius magnitude of right spherical face, mm | At least half-aperture + 1 mm |
| `insideIndex`, `outsideIndex` | Explicit homogeneous material indices | Both in [1,4]; outside index equal for two lenses |
| `partialReflection` | Explicit native Fresnel-branch policy | Required boolean |

This **first scope is biconvex only**. Both lenses are stationary, upright, nonrotated and optically independent. It does not admit concave/meniscus lenses, arbitrary tilted surfaces, overlapping volumes, graded-index media, wavelength-dependent dispersion, a third lens, mixing with external mirrors, or sources inside the glass.

## Geometry and conservative separation

For half-aperture `a=apertureHeight/2` and positive radii `R_front,R_back`, each spherical sag is
`s(R,a)=a²/(R+sqrt(R²−a²))`.
Both curved segments plus two physical finite rim faces are explicitly present in native `SphericalLens`. The contract requires
`centerThickness − s(front) − s(back) >= 1 mm`.
This prevents crossed surfaces, a vanishing rim, and a degenerate finite glass body. Bounds and 0.01 mm clearance are **admission geometry guards**, not guarantees of native binary64 ray accuracy.

The entire x extent of each thick lens is `[x−centerThickness/2, x+centerThickness/2]`. For a two-lens train, these extents must be separated by at least 0.01 mm; distinct lenses may have independently specified y-centres and radii. Sources and both endpoints of each detector must be outside this full extent on one common side, with at least 0.01 mm x clearance. This is deliberately conservative: some physically valid off-axis arrangements are refused instead of guessed. Forward rays too close to finite rim vertices or tangencies to the generating circles are also refused.

## Native execution and observable trust boundary

The compiler sends each authored component to an original upstream `SphericalLens` with `defBy:'DR1R2'`, `r1=frontRadius`, `r2=-backRadius`, explicit `d=centerThickness` and `refIndex=insideIndex/outsideIndex`. Pinned PhyDemo chooses the true intersections and reflection/refraction directions; Opticsim never assigns a ray route or computes its focal image.

The read-only observer inspects the **actual native callback point**, identifies one of `front-arc`, `back-arc`, `top-rim` or `bottom-rim` at that point, and reports each body's first incident and sampled counts. This classification is not a second ray tracer. Ambiguous rim/arc corners, nonfinite observations or invalid surface geometry invalidate otherwise accepted measurements. A full Fresnel tree can be truncated by unchanged native cutoffs. `partialReflection:false` explicitly omits partial Fresnel reflection but retains native total internal reflection; its readings are marked qualified with approximation warnings. Incomplete/truncated runs, mismatched canonical SHA, stop or undefined behavior suppress requested measurements. No source-attributed path, continuous irradiance, virtual image or textbook answer is invented.

The browser permits **physical edits of both lenses** through guarded canonical revalidation. Invalid overlap/rim edits hide stale readings, while valid edits re-run the original native tracer. Qualified exports retain the exact scene and source provenance.

## Reproduction and review

The synthetic fixture is `examples/native-thick-lens-train.json`, with a ray at (−200,10) mm and two biconvex lenses (radius magnitudes 100 mm, aperture 100 mm, centre thickness 30 mm) at x=0 and x=150, with separately authored inside indices 1.5 and 1.3. It is not a newly evaluated student exercise.

From a pinned Node >=24.19 checkout:

```sh
npm run setup
npm test
node scripts/run-problem.mjs examples/native-thick-lens-train.json --out test-artifacts/llm-authoring/native-thick-lens-manual-01
npm run build
node scripts/native-thick-lenses-browser.mjs
```

Keep output directories fresh. The bounded tests check native curved-face events against separate spherical/Snell reference values, geometry refusals, true misses, source/cardinality and material isolation, UI revisions, Fresnel incompleteness and request suppression. The browser CI verifies actual Chrome behavior; a screenshot is not independent physics validation. The earlier research-only [PR #109](https://github.com/physicsvigilante/opticsim/pull/109) remains separate feasibility evidence, not a production admission.

**Release gate:** post-implementation full Node/Chrome CI and an independent adversarial R2 physical/numerical review on an exact source HEAD. Preserve known near-critical/grazing limitations and the existing Stage-2 withholding policy. Chat B and the project owner may block release even when CI is green.
