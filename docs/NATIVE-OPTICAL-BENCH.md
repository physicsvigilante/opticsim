# Unified Optical Bench (`native-optical-bench`, Schema v40)

`native-optical-bench` (`schemaVersion: 40`) is Opticsim's unified modern native ray-tracing bench for JEE-level physical exploration, teaching, and LLM-directed experimentation. It composes finite dielectric bodies, ideal thin lenses, curved and plane mirrors, opaque stops, and passive ray detectors through physical data — without requiring specialized per-apparatus schemas.

Pinned PhyDemo (`811f508d2b070898c241a568b0c167dcb8645251`) owns all ray intersections, refraction, TIR, Fresnel partial reflection, mirror reflection, thin-lens deflection, and absorption.

## 1. Quick Capability Summary

Fetch the self-contained JSON contract directly without reading historical `v1`–`v39` schemas:

```powershell
node scripts/author-scene.mjs bench-capabilities
```

| Field / Component | Admitted Scope | Notes |
| --- | --- | --- |
| `model` | `"native-optical-bench"` | Explicit selection (`schemaVersion: 40`). Historical unmarked requests stay on `v1`–`v39`. |
| `backgroundIndex` | Required number in `[1, 4]` | Explicit ambient refractive index (`doc.physics.backgroundIndex`), preserved across structural edits and `2 → 1 → 0` body deletion. Every finite dielectric body's `outsideIndex` must match it. |
| `randomSeed` | Optional string (`1–64` printable chars) | Defaults to `"opticsim-v40-seed-v1"` during authoring; required in canonical saved v40 JSON and compiled into native PhyDemo `Scene.randomSeed`. |
| `runPolicy` | `bench-v40` (default), `bench-v40-dense`, `preview-v1`, `dense-v1` | `bench-v40` sets `maxRayDepth: 16` (`0..16` admitted in v40), enabling multi-element returns across two glass bodies, thin lenses, mirrors, and detectors. |
| **Emitters** (choose one mode) | `1–4` `point-source` (`single-ray`, `directional`, or `full-circle`) **OR** `1` `parallel-beam` | Point sources may start in the ambient medium **or strictly inside** a `circular-dielectric`, `triangular-prism`, or `polygon-dielectric` (`>= 0.01 mm` from boundary). `spherical-lens` sources and `parallel-beam` emitters must lie strictly outside all bodies. |
| **Finite dielectrics** | `0–2` total (`circular-dielectric`, `triangular-prism`, `polygon-dielectric`, `spherical-lens`) | Pairwise disjoint (`>= 0.01 mm`), clean coincident flat-face contact (stacked slabs, water-on-glass, prism-on-slab, flat lens on slab; tolerance `1e-11 mm`, overlap `>= 1 mm`), or coaxial cemented doublet (matching opposite-signed curvature at shared apex; tolerance `1e-11 mm`). Touching or cemented dielectric pairs require matching `partialReflection` flags. Zero-body deletion closure (`2 → 1 → 0`) and equal-index neutral bodies (`insideIndex === outsideIndex`) are admitted. In `v40`, `spherical-lens` admits signed radii (`+` convex outward, `−` concave inward, `null` flat/planar face; textbook Cartesian $R_1 = \text{frontRadius}$, $R_2 = -\text{backRadius}$). |
| `ideal-lens` | `0–4` vertical thin lenses (`x`, `y`, `focalLength`, `apertureHeight`) | Independent transverse center `y` (vertically separated split lenses at the same `x` are admitted when disjoint by `>= 0.01 mm`); `focalLength` is defined in the ambient medium `backgroundIndex`. |
| **Curved mirrors** | `0–2` total (`ideal-curved-mirror`, `circular-arc-mirror`) | Disjoint bounding disks (`>= 0.01 mm`), OR `circular-arc-mirror` concentric & flush on a curved `spherical-lens` face or `circular-dielectric` boundary (curved-silvered lens / silvered sphere). |
| `plane-mirror` | `0–2` finite plane mirrors | Center `(x, y)`, tangent `orientationDeg`, finite `length`. Disjoint (`>= 0.01 mm`) OR flush on a physical flat dielectric face (silvered slab, silvered prism, flat-silvered lens, or mirror table). |
| **Opaque stops** | `0–2` total (`line-blocker`, `circle-blocker`, `finite-aperture`) | Fully opaque native absorbers. |
| `ray-detector` | `0–2` passive finite detectors | Crossing counts, signed native relative power, and bounded `detector-hit-events` (`<= 32` hits). |
| **Total components** | At most `16` | Emitters and all non-source surfaces keep `>= 0.01 mm` exact finite-segment / body clearance (sources may sit along a finite mirror, detector, stop, or lens line extension when `>= 0.01 mm` clear of the actual finite segment). |

## 2. Minimal Authoring Example

```json
{
  "title": "Interior circle source through slab and return mirror",
  "model": "native-optical-bench",
  "lengthUnit": "mm",
  "backgroundIndex": 1,
  "components": [
    {
      "id": "B1",
      "type": "circular-dielectric",
      "parameters": {
        "x": 0, "y": 0, "radius": 10,
        "insideIndex": 1.5, "outsideIndex": 1, "partialReflection": false
      }
    },
    {
      "id": "S1",
      "type": "point-source",
      "parameters": { "x": 0, "y": 4, "brightness": 0.1 },
      "emission": { "mode": "single-ray", "directionDeg": 0 }
    },
    {
      "id": "B2",
      "type": "polygon-dielectric",
      "parameters": {
        "x1": 20, "y1": -20, "x2": 40, "y2": -20,
        "x3": 40, "y3": 20, "x4": 20, "y4": 20,
        "insideIndex": 1.6, "outsideIndex": 1, "partialReflection": false
      }
    },
    {
      "id": "M1",
      "type": "plane-mirror",
      "parameters": { "x": 50, "y": 0, "orientationDeg": 90, "length": 40 }
    },
    {
      "id": "D1",
      "type": "ray-detector",
      "parameters": { "x": 15, "y": -12, "orientationDeg": 90, "length": 8 }
    }
  ]
}
```

## 3. Structural Revisions, Sweeps & Proportionate Safeguards

- **Targeted edits (`reviseScene`):** Modify any component parameter or emission angle in place while keeping `backgroundIndex` and `randomSeed` fixed.
- **Structural add/remove (`reviseComponents`):** Add or remove dielectric bodies (`2 → 1 → 0`), lenses, mirrors, stops, or detectors within v40's limits without changing schema versions. Deleting a source's host body cleanly turns the source into an ambient-medium emitter in `backgroundIndex`.
- **Parameter sweeps (`runParameterSweep`):** Supports v40 scenes up to `maxRayDepth = 16`, revalidating each sample from the unchanged baseline.
- **Proportionate runtime audit (`v40EndpointsVerified`):** Reuses the shared emitted/incoming/outgoing `< 0.01 mm` endpoint, vertex, and circular/spherical/arc tangency audit plus deterministic seed verification, near-grazing dielectric incidence refusal (`|d · n| <= 1e-4`), and high-to-low near-critical refusal (`|n_i sin θ_i - n_t| <= 1e-6`). Truncation, stops, or audit faults fail closed and withhold accepted measurements.
- **Browser starter:** Available in the **Scene** dropdown as `v40 / Unified optical bench (interior sources + glass + lens + mirror)` (`scenes/native-optical-bench.json`, `examples/native-optical-bench.json`).

## 4. Paraxial-vs-Native Witness Bridge (`v40`)

For coaxial paraxial stacks (`opticsim-coaxial-paraxial-stack-facts-v1` or `opticsim-coaxial-paraxial-stack-package-v1`), `src/optical-bench-witness.js` and `scripts/witness-optical-bench.mjs` compile supported coaxial stacks directly into validated `v40` scenes (`maxRayDepth = 16`):

```powershell
node scripts/witness-optical-bench.mjs capabilities
node scripts/witness-optical-bench.mjs plan <stack-or-package.json> <witness-spec.json>
node scripts/witness-optical-bench.mjs run <stack-or-package.json> <witness-spec.json>
```

- Compiles `0–2` finite dielectric bodies (planar slabs or signed/flat `spherical-lens`: biconvex, plano-convex, plano-concave, meniscus, biconcave; disjoint, touching layered slabs, or coaxial cemented doublets), `0–4` coaxial ideal thin lenses, and `0–1` terminal mirror (separated or flush flat/curved silvered on the final dielectric body) into `v40`.
- Strictly separates conditional exact binary64-rational ABCD predictions (`nativeObservation: false`) from observed native PhyDemo ray geometry (`nativeObservation: true`), gating corroboration on `v40EndpointsVerified === true` and exact per-element / per-axial-face encounter accounting (including PhyDemo `surfaceMergingObjs` ownership on touching glass and flush silvered mirrors). Never claims native image detection (`nativeImageDetected: false`).

## 5. Known Boundaries & Upgrade Notes (Current Milestone 4A)

- **Milestone 1 → 2A `ideal-lens` note:** Milestone 2A extended `v40` in place to support decentered vertical lenses (`parameters.y`). Any pre-Milestone-2A `v40` save or authoring request containing an `ideal-lens` without `y` needs explicit `"y": 0` to preserve the original centered geometry.
- **Milestone 2B `spherical-lens` signed/flat convention:** `frontRadius` and `backRadius` use the outward-convex sign convention (`+R` convex outward, `−R` concave inward, `null` flat/planar face) so all pre-existing biconvex `v15`–`v40` lenses keep identical geometry. Textbook Cartesian radii are $R_1 = \text{frontRadius}$ and $R_2 = -\text{backRadius}$. `spherical-lens` remains exterior-source-only; require `|radius| >= apertureHeight/2 + 1 mm` (or `null`), `centerThickness >= 2 mm`, and `edgeThickness >= 1 mm`.
- **Milestone 2B finite-segment clearance:** Emitters in `v40` require `>= 0.01 mm` clearance from actual finite segments (`ideal-lens`, `plane-mirror`, `line-blocker`, `finite-aperture` arms, `ray-detector`) rather than infinite supporting-line extensions, admitting L-shaped and side-by-side JEE setups while retaining full endpoint and runtime grazing protection.
- **Milestone 3 touching layered media & silvered optics:** Coincident flat dielectric contacts, coaxial cemented `spherical-lens` doublets, flat-silvered `plane-mirror` faces, and curved-silvered `circular-arc-mirror` faces rely on pinned PhyDemo's native `surfaceMergingObjs` / `mergesWithGlass = true` (which merges intersections within `1e-6 mm`). Admission enforces `BENCH_CONTACT_TOL_MM = 1e-11 mm` (rejecting near-contact gaps in `(1e-11, 0.01) mm`) and matching `partialReflection` flags on touching/cemented glass pairs so the shared interface has one unambiguous Fresnel policy. At a merged glass-glass boundary, PhyDemo invokes `onRayIncident` only on the primary body (earliest in `components`), which reports the true effective merged `incidentIndex`, `destinationIndex`, and `mergedWithId`, and audits dielectric grazing (`|d·n| <= 1e-4`), high-to-low near-critical TIR, and failed-merge fallback against those effective merged contacts; no duplicate callback is fabricated on the secondary body. At a silvered glass-mirror boundary, PhyDemo invokes the mirror's `onRayIncident` directly (reflections are counted on the mirror ID; mirror-owned callbacks are covered by endpoint/tangency audits rather than the dielectric grazing guard, and any dielectric hit that bypasses a flush silvered mirror fails closed).
- No route-independent `ideal-image` prediction or continuous irradiance/flux claim is fabricated on arbitrary multi-element benches.
