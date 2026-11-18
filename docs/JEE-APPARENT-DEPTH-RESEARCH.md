# JEE apparent-depth feasibility — test-only native evidence (unreleased)

**Status:** An independently main-based research experiment. No production `src/` code, schema, authorable scene family, public observer, UI, PhyDemo patch, image algorithm or claimed new released capability is added. This study must pass CI before its physical outcomes can be reported.

## Why the engine needs this

A JEE ray-optics teaching accompaniment should explain the **apparent location** of an object viewed across a plane refracting surface, while distinguishing it from the actual position of a physical object and from detector readings.

The current v5 native planar profile already supports explicitly authored single rays, plane refraction with ordered absolute refractive indices, actual native interaction directions and detector hit positions. It does **not** detect a virtual object image. A backward mathematical extension of a transmitted ray is an *inference* about where that ray appears to originate, not a ray that native PhyDemo propagated backward through the medium.

The usual JEE relation `apparent depth ≈ real depth × observer-index/source-index` is **paraxial**, not an exact formula for all angles. The exact ideal planar Snell model gives different intercepts for different finite-angle rays from the same point. A future engine must not assert a universal sharply focused apparent image from a few samples.

## Fully specified synthetic experiment

This test rotates the common horizontal-water-surface diagram into the existing interface-normal coordinate system (x right, y up). The interface is at x=0, with normal +x. One physical source is at (-60 mm, 0) on its **negative** side. Initially, the source medium has index 1.5, the observer side index 1.0. Pinned native PlaneGlass traces one explicit SingleRay at each declared direction. A finite passive detector at x=+100 mm samples actual transmitted rays. The experiment runs separately at ±5° and at 2°, 5°, 12°, 25°, 30°. It does not manufacture a fan or force native paths.

- Source `point-source`, emission `single-ray`, explicit direction, native relative brightness 1.
- Plane `planar-interface` with indices 1.5 and 1, `partialReflection:false`: an explicit *transmitted-only approximation* that still permits genuine native TIR.
- Finite `ray-detector` at x=100, orientation 90°, length 400 mm, stays wholly on the observer side.
- Opt-in `interface-first-event` and `detector-hit-events`, plus emitted and crossing counts. Only complete, scene-hash-matched native evidence is used.
- Reference controls: normal incidence, ray at 50° (above critical angle), index 1→1, index 1→1.5, and a deliberately incomplete depth-0 native run.

## Derivation kept OUTSIDE PhyDemo

For this one source at y=0, real depth d=60 mm and angle i from the interface normal, the native detector hit is (x_D,y_D), with native incoming unit direction (u_x,u_y). For a non-axial forward transmitted ray, the **mathematical backward extension**, which PhyDemo never traces, meets the source axis at

`x_virtual = x_D − y_D u_x/u_y`

An independent ideal Snell check computes `t=asin(n_source sin(i)/n_observer)` when transmission exists, yielding a finite-angle reference depth

`d_virtual(i)=d tan(|i|)/tan(t)`.

As `i → 0`, the paraxial ratio approaches `d*n_observer/n_source`. However at precisely i=0, a single on-axis ray does **not** determine the apparent source location, so the finite-angle back-projection routine explicitly returns no result. For TIR there is no transmitted hit to extrapolate; for incomplete native runs no measurement is admitted.

These derived locations are *conditional axis intercepts*, not actual optical surfaces, new native rays, a point-spread function, a 3D physical image, brightness map or evidence of a perceiving observer. The reference Snell calculation validates outputs after native execution and never dictates propagation.

## What the tests can and cannot demonstrate

**They can demonstrate:** native transmission and hit geometry consistent with Snell's law; finite-angle dependence of apparent-depth extrapolations; symmetric sign controls; index-reversal behavior; honest TIR/no-hit and incomplete/no-reading distinctions; compatibility with existing v5 canonical contract and unmodified native PhyDemo.

**They cannot demonstrate:** a finite-width native source bundle in a single run, attribution of an arbitrary detector ray to a particular source, image formation, continuous irradiance, a visible observer or a generally composable refracting scene. The test uses one isolated source and ray per run and hence makes no physical image claim.

## Admission direction after feasibility

If native feasibility passes and an independent review accepts its scope, implement a **separate typed JEE apparent-depth query** with explicit known source point, refractive boundary, source and observer media, and constrained observation angle or a deliberate paraxial assumption. Keep it analytical and conditional unless native evidence is separately requested and complete; never synthesize missing physical scene dimensions, indices or rays. Consider actual multiple rays in a single native scene before claiming observed intersection reconstruction. Add source-order, angle-side, TIR and near-critical numerical guards and stale-result invalidation.

The v14–v19 held release chain, PR #141 reviewed safety fix, and issue #123 branch protection are **unrelated release gates**. This branch starts from production main `d3509e82fb65d81aabe336666851f8f2962623f4`, not from the unreleased parallel-beam stack.
