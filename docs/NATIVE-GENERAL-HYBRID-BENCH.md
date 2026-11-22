# Composable hybrid native optical & refractive bench (`schemaVersion: 39`)

`native-general-hybrid-bench` (`schemaVersion: 39`) unifies Opticsim's reflective/thin-lens primitives (`v37`) and finite dielectric bodies (`v38`) under **one** strict whole-system native PhyDemo contract (`811f508d2b070898c241a568b0c167dcb8645251`). Authors and LLMs can freely compose hybrid optical systems — such as a coaxial ideal thin lens paired with a finite glass slab or prism, or a finite dielectric paired with a concave/convex curved mirror, opaque stops, and passive detectors — without altering any historical `v1`–`v38` schema.

## Explicit selection & component bounds

Select explicitly via `model: "native-general-hybrid-bench"` in `prepareScene` (or directly in a canonical `schemaVersion: 39` document). Unmarked authoring requests preserve their historical profile selection.

- **Emitters (mutually exclusive, strictly external to all dielectrics, lens planes, curved disks, opaque circles, and supporting lines by `>= 0.01 mm`):**
  - `1–4 point-source` (`single-ray` emission mode only), **OR**
  - `1 parallel-beam` (`width` in `[10, 100]` mm, `brightness <= rayDensity`, `1–100` deterministic samples clear of the `1e-10` half-integer threshold).
- **Finite dielectrics (`1–2` total, shared explicit `outsideIndex`, mutually disjoint by `>= 0.01 mm`):**
  - `0–2 triangular-prism`, `0–2 polygon-dielectric`, `0–2 circular-dielectric`, `0–2 spherical-lens` (reusing exact `v38` per-body geometry bounds).
- **External thin lenses, curved/plane mirrors, stops & detectors (max 14 total components):**
  - `0–2 ideal-lens` (vertical coaxial thin lenses, distinct planes `>= 0.01 mm` apart; `focalLength` is the effective focal length in the shared exterior medium `outsideIndex`)
  - `0–2` curved mirrors (`ideal-curved-mirror` and/or `circular-arc-mirror`)
  - `0–2 plane-mirror`
  - `0–2` opaque stops (`line-blocker`, `circle-blocker`, `finite-aperture`)
  - `0–2` passive `ray-detector` segments

## Pairwise geometry, clearance & emitted/incoming/outgoing qualification

- Every pair of distinct components maintains `>= 0.01 mm` clearance (disjoint dielectric bodies, curved-mirror vertex bounding disks outside every dielectric/circle/segment/emitter, ideal-lens segments outside every dielectric/disk/circle/segment, and non-intersecting external segments).
- Initial forward rays and deterministic beam samples must clear every dielectric corner/vertex, every finite component endpoint (including ideal-lens rims and all four `finite-aperture` endpoints), and every circular/spherical/arc/circle-blocker tangency line by `>= 0.01 mm`.
- **Observed native endpoint, corner & tangency audit (`v39EndpointsVerified`):** Wraps instance-local `onSimulationStart` on emitters and `onRayIncident` on all optical, stop, and detector objects once (delegating pinned PhyDemo untouched). Audits both actual incident callbacks and all emitted/outgoing native ray states (bounded at `V39_NATIVE_STATE_LIMIT = 10000` states) for `< 0.01 mm` near-misses of finite endpoints, dielectric vertices/corners, and circular/spherical/arc/circle-blocker tangencies (including same-body critical-refraction departure grazing). Any near-miss, tangency, truncation, stop, undefined behavior, or audit fault fails closed and withholds accepted measurements.

## Scope limits

- Explicit `partialReflection: false` omits Fresnel partial reflections with an explicit `'qualified'` warning while retaining native TIR; `partialReflection: true` enables Fresnel splitting and suppresses accepted readings if weak-branch/depth truncation occurs at `maxRayDepth = 8`.
- `ideal-lens` `focalLength` operates directly in the shared exterior medium `outsideIndex` (not automatically rescaled from air).
- No route-independent analytical image prediction, source-specific detector attribution, continuous irradiance, interior emitters, or nested/cemented media are implied.

See [examples/native-general-hybrid-bench.json](../examples/native-general-hybrid-bench.json) and [test/native-general-hybrid-bench.test.mjs](../test/native-general-hybrid-bench.test.mjs).
