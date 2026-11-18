# JEE observer-anchored planar refraction — native feasibility only

**Research status: unreleased, test-only, independently based on production `main`.** This file accompanies `test/jee-observer-native-feasibility.test.mjs`. It does not add an authorable observer model, new schema, PhyDemo optical algorithm, image reconstruction, real eye, a solver that prescribes native ray paths or a public inverse optical capability. Do not merge solely because the builder test suite passes.

## Why this is the next JEE question

The independently reviewed [PR #143](https://github.com/physicsvigilante/opticsim/pull/143) found that **actual native refracted directions and detector hits**, with an explicit incident angle, support conditional finite-angle apparent-depth geometry. The new, independently reviewed but **unmerged** [PR #144](https://github.com/physicsvigilante/opticsim/pull/144) makes that *explicit-angle* calculation JSON-authorable. Most introductory JEE questions specify an observer location or viewing geometry instead, not an incoming ray direction. Deriving a physically consistent angle **without guessing or silently changing the apparatus** is the next capability gap.

The research starts again from production main `d3509e82fb65d81aabe336666851f8f2962623f4` rather than making a dependency on the unreleased analytical module. The native experiment uses existing canonical **v5** `point-source`, `single-ray` emission, `planar-interface`, and `ray-detector` only.

## Fully specified optical reference

Let `P` lie on one infinite plane, unit normal `n` point from the physical source medium to the observer medium, and tangent `t=(-n_y,n_x)`. Given **explicit** source `S` and observer-side point `O`, define

- `d_s = -(S-P)·n > 0`; `d_o = (O-P)·n > 0`.
- `u_s = (S-P)·t`; `u_o = (O-P)·t`.
- The candidate interface crossing is `Q=P+q*t`.

With explicit isotropic homogeneous positive indices `n_s` and `n_o`, the stationary optical path satisfies

`n_s (q-u_s)/hypot(d_s,q-u_s) = n_o (u_o-q)/hypot(d_o,u_o-q)`.

The difference between those sides is strictly increasing in `q` when `d_s>0`, `d_o>0`: there is a unique solution between `u_s` and `u_o` for this **single interface, specified ray connecting the source to a finite observer point**. The corrected, test-only independent numerical reference uses **local-coordinate bisection** on the tangent offset \`v=q−u_s\`, not absolute world coordinate \`q\`. It never guesses a crossing or fabricates a native ray path. A mathematical stationary path can exist without a sufficiently accurate **binary64 world-coordinate representation** for native verification. It computes a **declared initial SingleRay direction** from `S` toward `Q`.

PhyDemo alone then propagates that authored ray through its real `PlaneGlass` object into the observer medium. A finite, passive native `Detector`, centered at the independently specified `O` and tangent to the plane, records **actual native ray arrival position and incoming direction**. The test checks a complete, hash-matched native run; exactly one emitted ray and detector crossing; actual outgoing direction against independent Snell reference; and agreement of detector coordinates with `O`. The mathematical back-extension from the measured outgoing direction to the plane is a **derived consistency check**, **not** a native interface crossing coordinate. Pinned v5 first-interface records do not expose `pointMm` on planar interfaces.

For nonaxial rays, a mathematical back-extension to the source-normal axis gives

`d_app = d_s * tan(|i|)/tan(|r|) = (q-u_s)*d_o/(u_o-q)`.

This is an **observer-dependent apparent-axis intercept**, not a physical detected image. A single exactly axial native hit yields `apparentDepth:null` because an axial ray does not locate the virtual source. In the near-axial paraxial limit, the ordinary `d_s*n_o/n_s` relation applies but must be requested/labelled separately in any future typed contract.

## Test matrix

- Source (-60,0) mm in index 1.5 to observer (+100,+40) mm in index 1.0; finite detector at that specified observer-side location.
- Observer at (+100,-40) mm: reflection symmetry in native hit and predicted source direction.
- Equal indices 1→1 and reversed contrast 1→1.5; no assumption that the observer is always in air.
- Rotate entire scene by 90° or 180° and laterally translate source/observer and infinite plane. Native detector remains finite, away from interface, orientation along its tangent.
- Exactly axial O=(100,0) yields a real native ray with no one-ray virtual depth inference.
- Missing physical separation or source/observer on the wrong medium sides rejects the reference before native work.
- Deliberately stale native execution and maxRayDepth=0 suppress all qualifying observed readouts.

## What this does NOT justify

There is **no direct observer's eye**, ray ancestry across arbitrary optical components, general Fermat path solving among several interfaces, Fresnel energy/irradiance, field of view, physical imaging, visibility determination, TIR at a fixed free angular input, diffraction, generalized inverse ray tracing, or image reconstruction. Source direction is mathematically chosen solely for the declared *test-only* inverse geometry: the test does not claim the native solver independently discovers an unspecified incident ray.

If native evidence passes and independent review agrees, the next public analytical feature should be a **separately typed source+observer+one-plane query**, with explicit frame/units/indices, unique stationary-path root, signed transmitted direction, conditional apparent-axis intercept, and bounded numerical statuses. Optional native comparison would need a fully authored and fresh single-ray scene with explicit numerical and Fresnel policies; the analytic contract must not silently synthesize those fields. Multiple rays, multiple observers and actual image perception remain future research.

PRs #143 and #144 and the separately reviewed v19 #141 are held and unchanged; branch protection issue #123 and future owner release decisions remain separate.


## Independent R1 P1 correction — local root and bounded native confidence

[Chat B's independent PR #145 review](https://github.com/physicsvigilante/review_sandbox/blob/main/projects/opticsim/pr-145/reviews/review-01-chat-b.md) found that the original test helper bisected **large absolute tangent coordinates**, then used an absolute 1e−12 sine-residual assertion. At source `(-0.02,9000)` mm, observer `(0.02,9000.01)` mm, interface x=0 and indices 1.5→1, a real stationary ray exists. Nevertheless, binary64 spacing of absolute y≈9000 mm makes a 1e−12 unscaled world Snell residual unattainable for the rounded crossing. Repeating 110 midpoint iterations cannot overcome representability and a generic assertion incorrectly called the valid configuration a test failure.

The correction bisects **`v=q−u_s`**, whose bracket is `[min(0,u_o−u_s),max(0,u_o−u_s)]`, and computes incoming/outgoing unit vectors from `d_s,d_o,v,u_o−u_s` in the local normal/tangent frame. It stops on adjacent representable local midpoints. Its local Snell residual must be finite and at most 1e−12. It then reconstructs the **world** crossing and separately checks that the representable world geometry also meets 1e−12, before permitting a test-only native source heading.

If a qualified local root **cannot** be represented faithfully in world coordinates, the result is **`status:'numerically-unstable',reasonCode:'WORLD_COORDINATE_ROUNDING'`** with null native heading, apparent position and crossing. It may preserve a diagnostic local residual and offset, *never* a fake native scene or a claim that the physically valid root does not exist. A failed local root similarly gives `LOCAL_ROOT_UNRESOLVED` rather than a thrown physics verdict. This policy is conservative and does **not** establish a general binary64 error bound.

A near-critical observer case O=(100,9000) mm (same S=(-60,0), indices 1.5→1) is explicitly classified `NEAR_GRAZING_EXIT` when predicted transmitted direction has normal cosine below **0.02**. That number is an **exploratory test-only admission threshold**, not the physical Snell critical angle, proof of visibility, or a guarantee above it. A nonzero but near-axial tangent offset with one-ray inversion displacement below 1e−10 mm is `NEAR_AXIAL_INFERENCE` rather than masquerading as an exactly axial ray. An exactly aligned axis remains a native single-ray control with no uniquely inferred apparent depth.

No native encounter path or observed detector point is modified to satisfy the mathematical oracle. All existing positive native cases still need actual emission, transmission, finite detector hit, complete status, matched hash and explicit Fresnel-off warning. The new unstable cases must **withhold** a native shooting direction and therefore make no claim of an independent native attempt at those geometries.

This narrowly corrects the R1 blocker on a **child research branch**, not the frozen reviewed PR #145 HEAD. New exact-head CI and another independent targeted review are required; neither PR is release-approved.

## R2 independent boundary finding — grazing INGRESS (child R3 correction)

[Chat B's independent PR #146 R2 review](https://github.com/physicsvigilante/review_sandbox/blob/main/projects/opticsim/pr-146/reviews/review-01-chat-b.md) found that the local-bisection correction genuinely resolves the original large-world-coordinate P1, but **world Snell residual alone does not certify arrival at a particular observer point after the initial heading has been rounded for authoring**. A nearly tangent *incoming* ray may have excellent local and world residuals while its rounded native `directionDeg` produces a substantial miss at an observer-side detector.

The independently calculated R2 counterexample has plane normal 135°, source index 1 and observer index 2:
- Source `(9758.080722152847, 9758.066438595866)` mm.
- Observer `(-9616.652224137046, -9475.230867899736)` mm.
- Both source and observer are on explicitly opposite sides of the interface, the minimum source clearance is satisfied (`d_s≈0.0101` mm), and all coordinates are within the declared ±10000 mm bounds.
- The computed incoming normal cosine is approximately `3.70747e−7`, **despite** a non-grazing outgoing normal cosine ≈`0.8660` and both mathematical Snell residuals below `1e−12`. A rounded authored direction can miss the observer even while the mathematical root exists.

This child study adds `NEAR_GRAZING_INGRESS` **before** permitting an authored native shooting direction whenever the predicted incoming normal cosine is under `0.02`. The preexisting `NEAR_GRAZING_EXIT` rule for outgoing cosine under `0.02` remains. Both are **test-only, deliberately conservative numerical-admission thresholds**, NOT Snell critical angles, universal floating-point guarantees or claims of physical nonexistence. In an excluded configuration, the result is explicitly `numerically-unstable` with null `Q`, initial direction and apparent point, and **no native ray or native-image claim**.

A direct regression uses the exact R2 counterexample and its reflection across the oriented normal (opposite signed tangent span while preserving source/observer medium sides). It requires each to withhold even though local and represented-world Snell residuals remain small. The previously verified moderate-angle native arrival remains an independent positive control, and the R1 y≈9000 rounding example remains separately withheld.

**R2 verdict remains frozen at CHANGES REQUESTED for PR #146.** This correction is on a new child source commit and requires fresh exact-head builder CI and independent review; it does not retroactively clear #145 or #146, authorize a merge, or change the pinned native PhyDemo solver.
