# v19 — bounded JEE-first native parallel-beam authoring (DRAFT)

**Research engine candidate, NOT RELEASED.** This is a distinct versioned physical authoring contract, not a new PhyDemo solver, an apparatus-specific ray controller, a migration of older saves or a replacement for an angular point-source fan.

## Why version 19?

Production `main` currently has v1–v13. Unreleased, independently reviewed physics releases reserve v14–v18. This feature is branched from the JEE parallel-Beam research PR #126, based directly on production `main`. Its isolated v19 number avoids *colliding* with those held source versions; it **does not** imply that the intervening versions are already released, that future integration is automatic, or that v19 may be merged before the dependency decisions. The combined release version/catalog must be tested again once the held stack is released.

## Physical source and signed coordinates

`parallel-beam` is a true **finite line emitter** with exactly these physical fields:

```json
{"id":"B1","type":"parallel-beam","parameters":{"x":-100,"y":0,"width":40,"directionDeg":0,"brightness":0.08}}
```

Centre x/y and width are length quantities in the declared input units; width is perpendicular to propagation. Direction is degrees counter-clockwise from +x in world y-UP. The native PhyDemo `Beam` is compiled with the exact emitted segment endpoints, native y-DOWN conversion, `brightness`, `emisAngle:0`, `lambert:false`, `random:false`. Source position and ray travel are **not** approximated by a distant point source or rewritten into `AngleSource` or `SingleRay`.

In the pinned native implementation the deterministic sample positions are midpoint-spaced on the finite segment: for source width 40 mm and `rayDensity=0.2`, exactly eight native rays leave at the signed y coordinates +17.5, +12.5, …, −17.5 mm for a horizontal beam. A width 40 mm beam at dense density 1 emits 40 rays. Changing sampling changes the finite sample population; it does not turn the beam into a 3D wavefront, a continuous irradiance distribution or a pixel-perfect shadow.

`brightness` remains relative native ray strength, **not watts, radiance, or certified intensity**. This initial bounded profile refuses `brightness>rayDensity` to prevent silently clipped native ray brightness. Native emission counts and the native brightness scale are observed through the same instance-local once-delegated source callback used elsewhere. Source identity is not silently assigned to later detector events.

## Strictly supported JEE-style arrangements

Both models share schema/adapter version **19**, and each requires **exactly one** finite `parallel-beam`, no extra point source, no other optical types and **0–2 passive native ray detectors**.

- `native-parallel-lens-tracing`: **0–1 native ideal thin lenses** (vertical, y-centred), **0–1 vertical native finite-aperture stop** with an explicitly empty centred gap. Beam direction for this first lens/stop family is exactly 0°, +180° or −180°, allowing forward and reversed horizontal illumination. An empty lens/stop list permits native free-space beam evidence. **When both the lens and aperture are forward of the source, the aperture must precede the lens along the initial beam direction. A post-lens aperture is not yet admitted**, because refracted samples can encounter its gap endpoints after initially passing a simple straight-line source-to-stop clearance check.
- `native-parallel-planar-tracing`: **1–2 parallel, same-normal native `PlaneGlass` refracting boundaries** with explicit negative/positive side indices and matching adjacent indices; no lenses or opaque stops. Oblique incidence, forward/reverse refraction and native total internal reflection are supported only where the native scene remains complete.

The scene authoring selector identifies a candidate solely from explicit component types; rejected mixtures are not rescued by downgrading, deleting or reinterpreting any component. Every historical v1–v13 save keeps its original model, component limits, source modes and depth budget. The default public `preview-v1` and `dense-v1` run policies use processing limit 10,000 and interaction depth 8. A direct, otherwise valid canonical v19 scene may deliberately specify smaller integer processed/depth limits; such a numerical edit is not treated as an optical property or silently restored to the default. Native stopped/incomplete states suppress requested measurements.

## Whole-emitter geometry and uncertainty guards

The admission validator applies to the **entire** finite emitting segment, never only its centre:

1. Explicit physical width is 10–100 mm, all emitting endpoints inside the ±10,000 mm world bounds. At the chosen numeric density, at least one and at most 100 true native samples must be possible.
2. Every emitting endpoint remains at least 0.01 mm from the supporting line of each passive detector, with the whole segment on one side; native detector boundaries are separately validated against other physical surfaces. No beam may begin on a detector.
3. For ideal lenses, the whole emitting segment starts at least 0.01 mm off the lens x-plane; the aperture/lens planes cannot coincide or nearly touch. The full native aperture, including the gap endpoints, lies inside coordinate bounds and has strictly vertical tangent.
4. For initial rays moving toward the lens or stop, each actual deterministic emitted **starting sample** is checked against the lens rim and both native aperture arm/gap endpoint positions. A sample within 0.01 mm is refused; no fallback ray route is supplied. This check predicts only the straight, initial path to the first finite x-plane, not the refracted or reflected optical journey. In addition, **when source → lens → aperture is the forward plane order, the whole scene is refused before native execution**; only an upstream stop is supported in the initial combined lens/stop arrangement. Reversed illumination is checked by the same signed forward order.
5. For planar media, the **entire beam segment** lies on the same unambiguous side of each interface, so its starting medium cannot straddle a boundary. Near-grazing incident direction and inconsistent/near-coincident planes are refused. Every detector also lies wholly within a single medium.
6. Source brightness exceeding ray density is refused to avoid uncalibrated brightness clipping. Density and processed-ray limits are still numerical controls, not added physical facts.

**Post-review correction and evidence:** A separately retained test-only native experiment (PR #128) showed that at a 40 mm source, f=100 mm lens and x=50 mm post-lens stop, an initially safe y=±17.5 mm sample reaches a gap endpoint at y=±8.75 mm for a 17.50 mm opening. PhyDemo reported a complete trace and counted two terminal native absorptions at those exact endpoints, while the previous v19 validator had admitted the geometry. This is evidence of a **missing secondary-corner admission guard**, not proof that PhyDemo traced an incorrect ray. The corrected conservative profile refuses any post-lens stop forward of both source and lens; tests still admit before-lens stop configurations from either direction. Original reviewed PR #127 is unchanged; this separately authored correction requires its own CI and independent review.

**Important limitation:** 0.01 mm admission margins are not universal binary64 error guarantees. A ray **after** refraction/reflection may still encounter ambiguous corners or solver truncation; the engine preserves actual native decisions and suppresses incomplete, stopped or undefined requested measurements. No simulated ray path is prescribed.

## Results and evidence

The existing public `opticsim-problem-v1` JSON workflow, validator, PhyDemo compiler, source emission observation, interface/reflection/absorption/detector measurements, requested `detector-hit-events`, qualified source/edit/save and browser UI are reused. The new `source-emissions` observable admits the finite Beam without redefining any historical point-source result.

For beam width 40 mm, medium density 0.2, a native ideal lens of focal length 100 mm and a 12 mm central aperture opening, the sample set has **eight rays, six native absorptions and two actual detector crossings** at the focal plane. The two rays are not themselves horizontal on arrival: their nonzero outgoing slopes are approximately ±0.025 rad, consistent with the thin-lens mapping. A detector crossing at the mathematical focus is not a measured physical PSF or full image.

For a 60 mm parallel slab at 30° incidence with index 1.5, the native Snell angle is approximately 19.4712° and the perpendicular lateral displacement approximately 11.6288 mm. With native Fresnel partial reflection disabled, this is an **explicit transmitted-only approximation**, retaining native total internal reflection. With full native Fresnel-on branching, weak-ray/depth truncation can make a run incomplete, in which case all qualified measurements are withheld even if partial native callbacks occurred.

No JEE textbook answer, original interpretation fidelity, instrument magnification, observer visual perception, 3D glass behavior, diffraction, ray lineage, PSF or continuous power is certified by these synthetic controls.

## Required release gate

Before any owner release decision, verify real pinned-native tests and the ordinary public problem workflow, actual real-Chrome physical edit/export/reopen and invalidation, preserved historical save/version behavior, exact source tree identity, and separately authored second-context physics review. Missing or ambiguous information must remain explicit. Preserve old review reports and original frozen source hashes.

**Separate owner authorization, source CI and independent physical review are distinct.** No automatic merge of this new candidate or the held PR #107/#110/#113/#116/#118/#120/#122/#125/#126 is implied by this document.
