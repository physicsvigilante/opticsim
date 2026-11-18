# JEE observer-positioned single-plane refraction query v1 (draft)

**New standalone analytical engine candidate, based independently on production `main`. Not merged or released.** This is a different input problem from the separately reviewed, unmerged [explicit-angle apparent-depth PR #144](https://github.com/physicsvigilante/opticsim/pull/144). The current milestone accepts the **source and observer positions** instead of requiring an assumed incident direction. It is not a new PhyDemo scene/schema, inverse native ray tracer, real eye, visibility engine, detector or physically reconstructed image.

The [PR #148 independent R3 review](https://github.com/physicsvigilante/review_sandbox/blob/main/projects/opticsim/pr-148/reviews/review-01-chat-b.md) cleared only a **test-only feasibility study**: the local Snell root exists for one oriented infinite interface and finite opposite-side points, and moderate-angle ray direction predictions agree with actual pinned native detector hits in a separately authored scene. It did **not** certify the full binary64 shooting envelope. This public analytical source requires its **own** exact-head review.

## Typed authoring request

```json
{
  "format": "opticsim-planar-observer-point-query-v1",
  "kind": "source-to-observer-transmission",
  "lengthUnit": "mm",
  "source": {"x": -60, "y": 0},
  "observer": {"x": 100, "y": 40},
  "interface": {
    "x": 0, "y": 0, "normalDeg": 0,
    "sourceIndex": 1.5, "observerIndex": 1
  }
}
```

All geometry and indices are **explicit**; missing source, observer, plane point, orientation or material index is rejected. The oriented plane is infinite; its `x,y` is any point on that line. The normal `n=(cos(normalDeg),sin(normalDeg))` points **from the source medium to the observer medium**. In world x-right/y-up, `t=(-n_y,n_x)` is its CCW tangent. The source must lie strictly on the negative side and the observer strictly on the positive side, with at least 0.01 mm normal clearance; the query never reverses the normal, guesses an observer or invents a ray direction from the source question. Coordinates are converted from mm/cm/m to mm, and all stated positions must be within ±10000 mm. Indices are finite [1,4]. Unknown keys and nonfinite inputs reject.

## What is calculated

Set `d_s=−(S−P)·n>0`, `d_o=(O−P)·n>0`, `u_s=(S−P)·t`, `u_o=(O−P)·t`, `span=u_o−u_s`, and `v=q−u_s`. The conditional transmitted ray must intersect the one ideal boundary at `Q=P+(u_s+v)t`. Stationary optical path / Snell geometry requires

`n_s v/hypot(d_s,v) − n_o (span−v)/hypot(d_o,span−v)=0`.

This scalar difference is strictly increasing with v when distances and indices are positive, so the bracket between 0 and `span` contains one stationary transmitted path for these **two fully specified endpoints across one infinite plane**. The calculation solves v using local-coordinate bisection, not absolute world tangent q. The returned source direction, signed incidence/refraction angles, analytical interface crossing and outgoing unit vector are **conditional mathematical predictions only**.

If the one transmitted ray is nonaxial and numerical admission succeeds, its **backward mathematical extension** intersects the source-normal axis at a conditional apparent depth `v*d_o/(span−v)`; it is not a real image. The query also reports the separately labelled paraxial comparison `d_s*n_o/n_s`, never equating it with the finite-angle result. If `span=0`, the *ray direction and boundary crossing are still determined* but a single exactly axial ray does not identify its apparent depth: the output has `axisInterceptStatus:'not-identifiable'`, `conditionalApparentDepthMm:null`, without falsely classifying the whole ray as physically unavailable.

For the example the ideal crossing is `Q=(0,11.24615577120923)` mm, signed source incidence `10.61610894°`, refraction `16.04197771°`, conditional apparent-axis depth `39.11183382 mm`, and paraxial comparison `40 mm`. No detector/eye has been authored merely by supplying O.

## Numerical refusal policy and evidence

This draft deliberately uses a **conservative, bounded numerical admission policy**, not a universal guarantee of observer-hit accuracy:

- Require absolute local stationary Snell residual at most `1e−12`. If not representable, return `numerically-unstable / LOCAL_ROOT_UNRESOLVED` with null value.
- Reconstruct world crossing Q after solving locally and independently check the *world-coordinate represented* Snell residual against `1e−12`. Return `WORLD_COORDINATE_ROUNDING` when the local mathematical root exists but world geometry cannot represent it adequately.
- For incoming **or** outgoing normal cosine below `0.02`, return `NEAR_GRAZING_INGRESS` or `NEAR_GRAZING_EXIT` respectively. The arbitrary 0.02 research boundary is **not** a physical critical angle and does not prove all admitted rays will land within a particular native detector tolerance.
- For a *nonzero* transverse displacement smaller than `1e−10 mm` in the one-ray axis inversion, return `NEAR_AXIAL_INFERENCE`, not the exact-axial status.
- Reject or withhold nonfinite/out-of-domain crossing, ray or apparent-axis coordinates rather than silently clamping into a physical solution.

The statuses are either `conditional` (analytically available) or `numerically-unstable` (entire numerical value withheld). Invalid authoring inputs **throw and are reported as rejected** by the CLI. A stationary transmitted path between an opposite-side S and O exists in the ideal model for finite positive indices, so a separate `TIR-no-transmission` status is **not** applicable to this *endpoint-conditioned* query. It is still essential for **forward problems with an independently given incident angle**.

The engine and CLI **never run native PhyDemo**. Every result records `native.status:'not-run'`, `native.observations:null` and `nativeImageDetected:false`. Crossing coordinates are analytic, **not native plane-hit `pointMm`**. Apparent positions are conditional line extensions, **not** an observed image, path/source ancestry, optical power, visibility, wave optics, or detector crossing.

## CLI and regression boundaries

```sh
node scripts/planar-observer-point-query.mjs capabilities
node scripts/planar-observer-point-query.mjs query.json --out test-artifacts/llm-authoring/new-observer-trial
```

A fresh output directory is required. The original JSON input bytes are preserved verbatim, recorded with SHA-256, and an analytical result is saved **before any optional or imagined native check** (none exists in v1). Invalid JSON or physically incomplete input produces a structured rejection and no analytical result. Exclusive file writes and SHA references detect overwrites/mismatches, **not hostile tampering or external immutability**.

Tests explicitly cross-check source/observer geometry against independently known scalar values, signed ± tangent directions, 90°/180° rotation, point-on-infinite-plane lateral shift, length units, index equality/reversal, axial/near-axial, the review's y≈9000 **world-precision** counterexample, the 135° **incoming-grazing** counterexample and its mirrored negative span, and an outgoing near-critical/grazing case. **Separate test-only** complete canonical v5 physical scenes with explicit source brightness, selected Fresnel-off approximation and finite detector compare native PhyDemo's actual hit/direction to the calculated moderate-angle reference. Stale and incomplete real native runs suppress measurements, but those tests do not promote this analytical query to a native result.

Before public release: an independent review of **this new source**, documented numerical/scope limitations, owner release decision and separate handling of branch-protection issue #123. Reviewed but held PRs #141, #143, #144, #145, #146, #148 are unchanged; production main remains unchanged.
