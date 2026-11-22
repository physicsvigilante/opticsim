# Composable native refractive bench (`schemaVersion: 38`)

`native-general-refractive-bench` (`schemaVersion: 38`) brings `v37`-style whole-system composability to Opticsim's finite refractive dielectric primitives (`triangular-prism`, `polygon-dielectric`, `circular-dielectric`, `spherical-lens`), combining them with external plane mirrors, opaque stops, passive detectors, exact single-ray point sources, and finite parallel beams under **one** strict non-overlapping clearance contract. All historical schemas `v1`–`v37` and pinned PhyDemo (`811f508d2b070898c241a568b0c167dcb8645251`) remain unchanged.

## Explicit selection & component bounds

Select explicitly via `model: "native-general-refractive-bench"` in `prepareScene` (or directly in a canonical `schemaVersion: 38` document). Unmarked authoring requests preserve their historical `v7`–`v18` / `v22`–`v23` selection.

- **Emitters (mutually exclusive, strictly external to all dielectrics by `>= 0.01 mm`):**
  - `1–4 point-source` (`single-ray` emission mode only), **OR**
  - `1 parallel-beam` (`width` in `[10, 100]` mm, `brightness <= rayDensity`, `1–100` deterministic samples clear of the `1e-10` half-integer threshold).
- **Finite dielectrics (`1–2` total, shared explicit `outsideIndex`, mutually disjoint by `>= 0.01 mm`):**
  - `0–2 triangular-prism` (edges and altitudes `>= 1 mm`)
  - `0–2 polygon-dielectric` (strictly convex 4-vertex quadrilateral, edges and opposite-vertex altitudes `>= 1 mm`)
  - `0–2 circular-dielectric` (`radius >= 2 mm`)
  - `0–2 spherical-lens` (`apertureHeight >= 4 mm`, `centerThickness >= 2 mm`, radii `>= half-aperture + 1 mm`, `edgeThickness >= 1 mm`)
- **External reflective, stop & measurement components (max 12 total components):**
  - `0–2 plane-mirror`
  - `0–2` opaque stops (`line-blocker`, `circle-blocker`, `finite-aperture`)
  - `0–2` passive `ray-detector` segments

## Pairwise geometry, clearance & endpoint qualification

- All finite vertices, endpoints, circles, and thick-lens extents must lie within `[-10000, 10000]` mm.
- Every pair of distinct components maintains `>= 0.01 mm` physical separation (separating-axis / separating-face proof for convex bodies and spherical-lens bounding boxes, Euclidean disk separation for circles, and finite-segment clearance for mirrors, stops, and detectors).
- Initial forward rays and deterministic beam samples must clear every dielectric corner/vertex, every circular-dielectric tangency line, and every external finite endpoint by `> 0.01 mm`.
- **Observed native endpoint & corner qualification (`v38EndpointsVerified`):** External finite segments are audited per run on every `onRayIncident` callback (failing closed if any hit lands within `<= 0.01 mm` of an endpoint); dielectric corners, vertices, and grazing tangencies are independently guarded by `observeInterfaceSet`. Incomplete, truncated, stopped, corner-ambiguous, or endpoint-grazing runs withhold accepted measurements.

## Scope limits

- Explicit `partialReflection: false` omits Fresnel partial reflections while keeping native TIR active (reported with explicit `'qualified'` warnings). Enabling `partialReflection: true` can produce weak-branch/depth truncation at `maxRayDepth = 8`, which suppresses accepted measurements cleanly.
- No route-independent image prediction, source-specific detector attribution, continuous irradiance, or nested finite media are implied.

See [examples/native-general-refractive-bench.json](../examples/native-general-refractive-bench.json) and [test/native-general-refractive-bench.test.mjs](../test/native-general-refractive-bench.test.mjs).
