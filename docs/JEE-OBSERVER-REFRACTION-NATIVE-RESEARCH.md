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

The difference between those sides is strictly increasing in `q` when `d_s>0`, `d_o>0`: there is a unique solution between `u_s` and `u_o` for this **single interface, specified ray connecting the source to a finite observer point**. The test-only independent numerical reference uses bounded bisection, never a guessed interface point or fabricated native ray path. It computes a **declared initial SingleRay direction** from `S` toward `Q`.

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
