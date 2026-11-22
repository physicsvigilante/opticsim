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
- Initial forward rays and deterministic beam samples must clear every dielectric corner/vertex, every circular-dielectric, spherical-lens generating-circle, and opaque `circle-blocker` tangency line, and every external finite endpoint (including all four `finite-aperture` arm/gap endpoints) by `>= 0.01 mm`.
- **Observed native endpoint & tangency qualification (`v38EndpointsVerified`):** Instance-local observers delegate pinned PhyDemo once and audit both actual `onRayIncident` impacts (external segment endpoints and incoming ray impact parameters on `circular-dielectric`, `spherical-lens`, and `circle-blocker` surfaces) and all emitted/outgoing native ray states (`onSimulationStart` and redirecting `onRayIncident` outputs, bounded at `10000` states) for `< 0.01 mm` near-misses of external endpoints (including transparent `finite-aperture` gaps with no arm callback), finite dielectric vertices and spherical-lens rim corners (including no-callback misses), and circular/spherical/circle-blocker tangencies. Dielectric corners and face ambiguity on incident hits are additionally guarded by `observeInterfaceSet`. Incomplete, truncated, stopped, corner-ambiguous, near-tangent, or endpoint-grazing runs fail closed and withhold accepted measurements.

## Scope limits

- Explicit `partialReflection: false` omits Fresnel partial reflections while keeping native TIR active (reported with explicit `'qualified'` warnings). Enabling `partialReflection: true` can produce weak-branch/depth truncation at `maxRayDepth = 8`, which suppresses accepted measurements cleanly.
- No route-independent image prediction, source-specific detector attribution, continuous irradiance, or nested finite media are implied.

See [examples/native-general-refractive-bench.json](../examples/native-general-refractive-bench.json) and [test/native-general-refractive-bench.test.mjs](../test/native-general-refractive-bench.test.mjs).
