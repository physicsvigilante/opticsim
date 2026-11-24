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
| **Finite dielectrics** | `0–2` total (`circular-dielectric`, `triangular-prism`, `polygon-dielectric`, `spherical-lens`) | Pairwise disjoint (`>= 0.01 mm` clearance). Zero-body deletion closure (`2 → 1 → 0`) and equal-index neutral bodies (`insideIndex === outsideIndex`) are admitted. |
| `ideal-lens` | `0–4` vertical thin lenses (`x`, `y`, `focalLength`, `apertureHeight`) | Independent transverse center `y` (vertically separated split lenses at the same `x` are admitted when disjoint by `>= 0.01 mm`); `focalLength` is defined in the ambient medium `backgroundIndex`. |
| **Curved mirrors** | `0–2` total (`ideal-curved-mirror`, `circular-arc-mirror`) | Disjoint bounding disks (`>= 0.01 mm` clearance). |
| `plane-mirror` | `0–2` finite plane mirrors | Center `(x, y)`, tangent `orientationDeg`, finite `length`. |
| **Opaque stops** | `0–2` total (`line-blocker`, `circle-blocker`, `finite-aperture`) | Fully opaque native absorbers. |
| `ray-detector` | `0–2` passive finite detectors | Crossing counts, signed native relative power, and bounded `detector-hit-events` (`<= 32` hits). |
| **Total components** | At most `16` | All non-source surfaces keep `>= 0.01 mm` clearance from bodies, emitters, and each other. |

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

## 4. Known Boundaries & Upgrade Notes (Current Milestone 2A)

- **Milestone 1 → 2A `ideal-lens` note:** Milestone 2A extends `v40` in place to support decentered vertical lenses (`parameters.y`). Any pre-Milestone-2A `v40` save or authoring request containing an `ideal-lens` without `y` needs explicit `"y": 0` to preserve the original centered geometry.
- `spherical-lens` remains biconvex and exterior-source-only (signed-radius plano-convex / meniscus / biconcave lenses are scheduled for Milestone 2B).
- No route-independent `ideal-image` prediction or continuous irradiance/flux claim is fabricated on arbitrary multi-element benches.
