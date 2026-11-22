# Composable native optical bench (`schemaVersion: 37`)

`native-general-optical-bench` (`schemaVersion: 37`) unifies Opticsim's already-compiled PhyDemo reflective, thin-lens, opaque-stop, passive detector, point-source, and finite parallel-beam primitives under **one** reviewed whole-system admission contract. Teachers and LLMs can freely compose native ray-traced arrangements that previously sat in separate single-purpose schemas (`v4`, `v6`, `v19`, `v20`, `v28`), while keeping all historical schemas `v1`–`v36` frozen and untouched.

## Explicit selection & component bounds

Select explicitly via `model: "native-general-optical-bench"` in `prepareScene` (or directly in a canonical `schemaVersion: 37` document). Unmarked authoring requests preserve their historical profile selection.

- **Emitters (mutually exclusive):**
  - `1–4 point-source` (`full-circle`, `directional`, or `single-ray`), **OR**
  - `1 parallel-beam` (`width` in `[10, 100]` mm, `directionDeg` in `[-180, 180]`, `brightness <= rayDensity`, `1–100` deterministic native samples clear of the `1e-10` half-integer sample-count threshold).
- **Optics, stops & measurement (max 16 total components):**
  - `0–4 ideal-lens` (vertical coaxial ideal thin lenses, `apertureHeight >= 1 mm`, distinct planes `>= 0.01 mm` apart)
  - `0–4 plane-mirror`
  - `0–2` curved mirrors (`ideal-curved-mirror` and/or `circular-arc-mirror`)
  - `0–2` opaque stops (`line-blocker`, `circle-blocker`, and/or `finite-aperture`)
  - `0–2` passive `ray-detector` segments

## Pairwise geometry, clearance & endpoint qualification

Every pair of distinct components must maintain at least `0.01 mm` physical clearance (`>= 0.01 mm`):

- All derived physical endpoints (lenses, plane mirrors, line blockers, finite-aperture arms, detectors, curved-mirror vertices/endpoints, and parallel-beam emitters) and opaque circles must lie within `[-10000, 10000]` mm. The conservative curved-mirror vertex clearance disk (`radius = hypot(endpoint - vertex)`) is a separation envelope and may extend beyond `±10000` mm when the physical mirror points remain in bounds.
- Distinct point sources must be `>= 0.01 mm` apart; every point source must stay `>= 0.01 mm` from every lens plane, finite-surface supporting line, opaque circle, and curved-mirror vertex bounding disk.
- A `parallel-beam` emitting segment must lie completely on one safe side (`>= 0.01 mm`) of every lens plane and every finite-surface supporting line, and `>= 0.01 mm` outside every opaque circle and curved-mirror bounding disk. In addition, every initial deterministic beam sample must clear every finite component endpoint (and every vertical lens rim, including oblique incidence) by `> 0.01 mm`.
- Finite segments (lenses, plane mirrors, line blockers, finite-aperture opaque arms, and detectors) from distinct components must not intersect or come within `0.01 mm` of each other, and must lie `>= 0.01 mm` outside every opaque circle and curved-mirror bounding disk.
- Curved-mirror bounding disks and opaque circles must be separated by `>= 0.01 mm`.
- **Route-independent native endpoint audit (`v37EndpointsVerified`):** Every `v37` native run wraps `onRayIncident` once on each finite optical, stop, and detector object (delegating pinned PhyDemo untouched). Any observed native encounter landing within `0.01 mm` of a finite component endpoint fails closed and withholds all accepted measurements—even on arbitrary multi-bounce paths.

## Native execution, revisions & sweeps

- Reuses pinned PhyDemo (`811f508d2b070898c241a568b0c167dcb8645251`) compilers and per-instance observers (`source-emissions`, `mirror-reflections`, `blocker-absorptions`, `detector-crossings`, `detector-signed-power`, `detector-hit-events`).
- Fully compatible with `reviseScene`, `reviseComponents` (including atomic add/remove of lenses, curved mirrors, stops, detectors, or swapping emitter type with a new stable ID), `runParameterSweep`, qualified packages, and the static browser viewer.

## Scope limits

- Pinned PhyDemo traces all rays; no route-independent `ideal-image` prediction, source-specific detector attribution, continuous irradiance, or refractive dielectric media are included in `v37`.
- Incomplete, truncated, stopped, or undefined native runs suppress accepted measurements as in all other native schemas.

See [examples/native-general-optical-bench.json](../examples/native-general-optical-bench.json) and [test/native-general-optical-bench.test.mjs](../test/native-general-optical-bench.test.mjs).
