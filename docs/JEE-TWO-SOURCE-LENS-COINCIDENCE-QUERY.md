# JEE J17 — Two-source ideal-thin-lens coincidence inverse (draft)

**Not a generic native image detector. Not a claim of a solution to arbitrary noncoaxial sources. Not independently reviewed.**

## Original frozen source

The source is the real **Problems-only** image `08_Ray_Optics_Explanations/07_Lens_Formula/Problems/001.png`, exact SHA-256 `42364c9242e377fbdf4de4360450e980530626cbfe14992ac1fa089908a62e7b` in the frozen 20-case JEE audit PR #165. We independently reopened only that original problem PNG and confirmed the statement:

> Two point sources are 24 cm apart; where would a converging lens of focal length 9 cm give images at the same point?

**We did not open the solution image.** It does not state aperture, finite ray samples, detector placement, illumination brightness or a 3D point-source arrangement. The analytical model **explicitly** adopts the usual ideal/paraxial **coaxial two-source** arrangement, with source 1 at x=0, source 2 at x=d, and a thin lens placed somewhere between. This assumption must not be silently attributed to the source.

The original J17 problem was recorded as *inverse-image-coincidence-model-gap* in PR165; this new query is source-relevant conditional analytical functionality, not a native proof that a physical image exists or that two distinct light fields overlap on a detector.

## Physics and two branches

Let focal length f>0, separation d>0, and lens coordinate a measured right from source 1. In this restricted model 0<a<d. The two waves illuminate the lens from **opposite sides**. Writing Gaussian image distances **along each ray's incident direction**:

- Source 1: u₁=a, v₁=f a/(a−f), **global** image x₁=a+v₁.
- Source 2: u₂=d−a, v₂=f(d−a)/(d−a−f), **global** image x₂=a−v₂.
- Requiring finite x₁=x₂ gives 2a(d−a)=fd. Thus **a=(d±√(d(d−2f)))/2**.

For d>2f two finite candidate placements arise, each with a **real image for one source and a virtual image for the other**. The shared mathematical coordinate is x=ad/(2a−d). For d=2f the only algebraic midpoint root corresponds to both objects at the focal planes; no *finite* coincident image exists. For d<2f the discriminant is negative; no finite between-source placement exists. A lens outside the two sources sees both at distinct distances on the same side, and the first-order imaging map is injective; moving the lens beyond both does not create a second finite solution.

For the stated d=24 cm, f=9 cm, the conditional positions from source 1 are **6 cm** and **18 cm**. The corresponding *global* Gaussian image coordinates are **−12 cm** and **+36 cm** relative to source 1. Each pairs **one virtual image and one real image**; neither position is an observed physical image reconstruction. The image branch identities reverse when the lens moves from 6 to 18 cm.

## Strict reusable query

`src/two-source-lens-coincidence-query.js` and `scripts/two-source-lens-coincidence-query.mjs` are standalone additive reduced-facts modules. Input is exactly seven fields:

```json
{
  "format": "opticsim-two-source-lens-coincidence-v1",
  "kind": "coincident-image-lens-placement",
  "model": "ideal-thin-lens-paraxial",
  "coordinateConvention": "source-1-at-zero-source-2-at-positive-separation",
  "lengthUnit": "cm",
  "sourceSeparation": 24,
  "focalLength": 9
}
```

All fields are mandatory, unknown fields fail; numerical input must be finite, positive and within [1,10000] mm after conversion from mm, cm or m. The lens-between-sources, coaxial geometry, sign convention, paraxial model, real/virtual classifications and analytic reporting bounds are explicit. The narrow near-double-root/focal guard withholds numerically ill-conditioned values (`numerically-indeterminate`) instead of emitting arbitrary huge positions. Safe d<2f and exact d=2f return `no-finite-placement`, which is a *negative mathematical result*, not a runtime error or simulated zero hits. Improper/missing physical inputs return a rejection.

The CLI is byte-bound and writes `input.json`, `analytical-result.json` and `report.json` under a fresh exclusive `test-artifacts/llm-authoring` directory. Input hash is SHA-256 of original bytes. It does not create or compile a native PhyDemo scene or store inferred detector/image events. All results are `native.status="not-run"`. See `examples/jee-two-source-lens-coincidence-v1.json`.

## Separately added genuine pinned-native research witness

`test/jee-two-source-lens-coincidence-native.test.mjs` sets up **additional teaching apparatus** via raw pinned `SingleRay`, `IdealLens` and passive `Detector` objects, without adding any new public scene family or changing native optical code. Two real native rays from each source at ±5 mm lens offsets are traced **one source at a time** at each derived lens placement to avoid pretending source attribution from mixed ray counts. Native lens callbacks and detector crossings are recorded without mutation of the pinned optical solver.

The predicted common global image coordinate is the **detector plane for the real-image source only**: it must have actual native crossings. The virtual-image source's rays should point *away* from that coordinate; only a backward continuation of **observed outgoing** native rays passes through it. Such a continuation is an analytical comparison of genuine native segments, **not a physical detector event**. Test controls for rays that miss the finite native lens require genuine misses, not invented images.

The native experiment uses stated **additional** aperture 100 mm, heights ±5 mm, finite source brightness, detector length/plane and explicit native Fresnel/illumination policy. None are supplied by J17's original text, so they never become source facts or independent original-question success.

## Evaluation and release

Keep five axes distinct: source interpretation fidelity; physical correctness of conditional Gaussian conjugates; genuine native simulation coverage of declared teaching experiments; educational usefulness; optional textbook answer completeness. Node-native builder CI is not an independent teacher/student study. The original frozen J17 trial data/first attempts and all historical native schemas remain unchanged.

**Release gate:** one focused independent review of the final source and real native evidence, with exact Git tree and CI artifact verification. Do not merge the new analytical API on builder test success alone; do not claim two native physical images at the same spot. No review repetition of unchanged v25 GRIN or historical lens physics is needed.
