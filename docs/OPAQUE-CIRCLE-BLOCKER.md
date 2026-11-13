# Milestone 23 — native opaque circular blockers

This is an extension of the existing v4 `general-component-tracing` family, **not** a new optical model, ray tracer, or schema version. The engine is the unchanged pinned PhyDemo v5.4.0 commit `811f508d2b070898c241a568b0c167dcb8645251`.

## Native mapping and exact semantic input

The LLM-authored `circle-blocker` requires **explicit** `x`, `y` and **positive `radius`** (all canonical mm, unit conversion only when supplied). The adapter uses PhyDemo `CircleBlocker`, with `p1={x,y:-y}`, `p2={x:x+radius,y:-y}`, and `filter:false`. This is a filled **opaque 2D disc boundary for geometric absorption**, not a dielectric circle, a 3D sphere, a wave/diffraction calculation, or an inverse-designed stop. Native circle intersections and termination are selected by PhyDemo, not by Opticsim.

The general scene retains **1–4 point sources, 0–4 coaxial ideal lenses, 0–4 finite plane mirrors, 0–2 passive detectors and at most TWO opaque stops TOTAL** (line plus circle). The 16-component upper bound is unchanged. All optical families outside the general scene remain separate; all historical schemas remain strict.

The minimum radius is 1 mm; the entire disc must lie within the ±10,000 mm coordinate box. A source must lie strictly outside the disc with at least 0.01 mm clearance. Other discs must be disjoint, and the nearest point on every finite lens, mirror, opaque line, or detector segment must be at least 0.01 mm outside the circle. This conservative geometric rejection includes crossing, touching, nested disks, and endpoint encounters, without asking the native simulator to arbitrate coincident interactions. Scene validation does not run a second ray engine. Parameter changes to radius and centre are atomic and revalidated.

## Measurements and safety gates

The existing stable-ID `blocker-absorptions` observable accepts either blocker shape. `observeBlockerSet` wraps each actual native `onRayIncident` exactly once and counts only `isAbsorbed:true`, preserving the native ray/return. Any nonabsorbing native blocker return causes a run diagnostic rather than a fabricated hit. Readouts require a complete matching-hash native run; incomplete/stale/invalid/failed runs suppress values. A **zero detector crossing** is not continuous darkness, visibility, or a measured image.

Authoring inspection, strict unit normalization, native scene compilation, fit-to-apparatus extents, sidebar edits, results, parameter sweeps and qualified export/reopen all reuse existing shared paths. The static 23-scene distribution allowlist is unchanged; the separate synthetic circle example can be opened as a qualified package. No source archives, credentials, engine changes, or public deployment are involved.

## Acceptance and limitations

The synthetic `examples/circle-blocker-detector.json` has one directional source at (-200,0) mm, brightness 0.08, full cone 20°; a radius-40 mm circle centred at (0,0); and a vertical passive detector centred at (100,0) of length 80 mm. Expected finite preview sampling: 6 emitted, 6 absorbed, 0 crossings. Moving the circle to y=100 mm yields 0 absorptions and 4 detector crossings, matching an independently executed scene with no stop. A smaller radius gives partial sampled blocking; dense sampling changes counts. These are synthetic engineering checks and make no claims about original JEE questions or continuous visibility.

Node regressions cover native mapping, both stop shapes, strict radius/bounds/clearance and tangency, nonintersecting composability, legacy isolation, target resolution, native callback preservation, stale/incomplete suppression, qualified edits, Fit and multi-source counts. The synthetic evidence runner also exercises invalid authoring, hashes and four immutable radius samples. Chrome is checked through the existing opaque-blocker browser acceptance workflow. **Finite apertures and diffraction remain separate milestones.**
