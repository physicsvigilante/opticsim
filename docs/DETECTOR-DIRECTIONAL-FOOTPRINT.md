# Direction-resolved native detector footprint — draft measurement contract

**Status:** opt-in measurement proposal, draft PR #118; not released. This is an extension to the measurement/observation layer **independent of the unreleased v14–v17 optical composition branches**. No new PhyDemo object, light propagation, ray history, brightness cutoff or canonical scene version is introduced.

## Request

Add one result request to any otherwise accepted scene with a finite `ray-detector`:

```json
{"id":"crossing-spread","kind":"detector-directional-footprint","componentId":"Dhit"}
```

The new request *alone* enables the preexisting, opt-in `detector-hit-events` native observer. There is no need to include a second `detector-hit-events` request to capture the positions. Normal detector crossing counts and signed native power values remain unchanged. An old scene with no such request has exactly the same default observation keys and native execution cost.

## Physical meaning

A finite detector has authored centre `(x,y)`, tangent `orientationDeg` in the y-up plane, and full `length`. Its ordered endpoint coordinates `p1→p2` follow the unchanged canonical `mirrorEndpoints` convention.

Define unit tangent **t** from p1 to p2, and unit left normal **n** = (−t_y, t_x). The observer receives each actual completed native crossing's point, distance from p1 along the detector and pre-interaction incoming unit direction **u**.

- **Toward positive normal**: native sampled rays with **u·n** positive.
- **Toward negative normal**: native sampled rays with **u·n** negative.

These are **detector-relative crossing directions**, not labels for a source, image, positive/negative power, or an optical return. A mirror can cause a ray to cross the same detector twice, in opposite groups, but no source-to-return pairing is inferred.

Each direction group exposes: `count`, `minDistanceFromP1Mm`, `maxDistanceFromP1Mm`, `meanDistanceFromP1Mm`, `meanPointMm` (a derived coordinate on the detector), `spanMm` and `rmsSpreadMm`. For n measured crossings at projected distances s_i, the unweighted population RMS sampled spread is sqrt((sum (s_i−mean(s))²)/n). It is calculated from mean-centred residuals for numerical stability, never an extrapolated optical image width. It is **not** a point spread function, physical beam width, flux-weighted spot, radiometric power, reconstructed image or continuous irradiance.

When a group contains **zero observed hits**, `count=0` is a valid native sampled observation, but the centroid, spread, extremes and span are **null** (not fabricated zero-width measurements). With only one observed hit, the sampled RMS spread is exactly zero but does not imply a zero-size physical image.

## Admission and fail-closed boundaries

The new result is only available if the full native run completed with no unqualified truncation, undefined behavior or failed/stopped execution, and its canonical SHA matches the current scene. It reuses the existing **32-hit-per-detector bound** and the existing 0.01 mm endpoint exclusion and 1e−5 mm on-segment hit-position check.

The summary independently rechecks native count agreement, physical detector segment geometry, each event's finiteness and unit direction, endpoint clearance and positional consistency. An incoming unit direction whose projection on the detector normal has magnitude at most 1e−8 is too close to grazing for a signed classification: the **entire directional footprint becomes unavailable**. No ray is adjusted, rerouted, clipped or attributed to a source. More than 32 native crossings withholds the whole footprint, not just the overflow rows. Incomplete native runs suppress results, while a complete native run with inconsistent event geometry makes **only the new footprint unavailable**; the original qualified detector crossing count is unchanged.

## Verification scope

Unit/native integration controls cover a planar refractive interface followed by a mirror (one crossing in each direction), the existing lens/mirror sample (multiple crossings with distinct forward/back populations), exact source misses, overflow, Fresnel-branch truncation and scene staleness. An independent arithmetic control uses a rotated finite detector to check the mean, extrema and RMS of two signed crossing populations without a ray tracer. Existing counts, native results and saved scenes must remain byte-for-byte compatible.

The browser should import a qualified bundle requesting **only** the new measurement, perform fresh native simulation, display per-direction spreads, update after a physical material edit, withhold after an incomplete run and reopen without inherited results.

**Review boundary:** CI passing is software evidence, not independent optical image certification. The released physical engine is still the pinned PhyDemo source `811f508d2b070898c241a568b0c167dcb8645251`. The new derived statistics need a separately authored review of event completeness, geometry and numerical semantics before owner release approval.
