# JEE-first draft: consolidation and native ray bundles

Decision record: 2026-11-17. The owner has asked to prioritize a first draft close to JEE Ray Optics and continue consolidation followed by reusable ray-bundle authoring. This changes development priority, not the requirement for explicit physical data, native propagation, independent review or owner release authorization.

## Immediate scope

Work on **ideal thin lenses, simple refracting interfaces/slabs, prisms, reflection and TIR** before more complicated thick-lens arrangements, larger detector buffers or new reporting features. The existing JEE Optical Systems Atlas is a historical needs assessment, not current solved-problem coverage. Its earlier beam deferral and original judgments are preserved, not silently rewritten. New owner direction permits this prospective source study; it does not release a feature or retroactively make an old evaluation blind.

This branch starts directly from production main `d3509e82fb65d81aabe336666851f8f2962623f4`, rather than extending the held thick-lens/integration stack. It introduces a **test-only native parallel-beam study** and this plan; no `src/` changes, schema version, solver, source adapter or public authoring capability are added.

## Release consolidation: complete decisions, not another unreviewed merge stack

The recorded release dependency order is #107 (two finite regions) -> #110 (native thick lenses) -> #113 (lens/mirror) -> #116 (two lenses/mirror) -> #120 (finite aperture). The independently main-based #118 detector footprint has its own release decision. #119, #121, #122 and #125 are research/verification branches, not additional production optical families.

Before any production merge:

1. Recheck exact current HEAD, its applicable separate review, all required checks and dependencies. Preserve old reviewed SHA/tree identities. An approval for one source does not transfer to later edits.
2. Obtain the explicitly required owner release decision. A request to continue development is not silently treated as permission to merge every held PR.
3. Use the verified combined source evidence from #122/#125 when planning the footprint integration, but do not merge both a copied research integration and its original feature blindly. Choose and review the actual release candidate, with documented source ancestry.
4. Review #125's targeted follow-up separately; its recorded status is still pending independent review at this planning checkpoint. Its green CI is not reviewer-executed physics.
5. Keep branch protection / stacked-base CI work tracked in issue #123. The `main` branch currently reports `protected:false`; this research branch does not change repository administrator settings. Test required workflows against their real base rather than assuming a green unrelated tree applies.

No merge, auto-merge, review impersonation, historical evidence rewrite or deployment is performed by this change. Implementation, source-CI, separate review and release are distinct states.

## Next engine milestone: a reusable native source, not an apparatus-specific controller

A **parallel beam** consists of rays emitted at different positions along a finite line segment with a common direction. A **directional fan** consists of rays from one point with different directions. The earlier AngleSource research (#121) does not itself verify the native Beam contract. Neither is approximated by placing a fictional point source very far away.

Pinned upstream source for this study: PhyDemo `811f508d2b070898c241a568b0c167dcb8645251`, `src/core/sceneObjs/lightSource/Beam.js`. The study uses one real native `Beam`, with explicitly supplied centre, finite width, propagation direction, brightness, zero divergence, `random:false` and `lambert:false`. Pinned PhyDemo generates every ray and handles all optical encounters. No custom propagation, forced itinerary or postprocessed ray correction is used.

### Research acceptance matrix

| Control | Independent reference / expected distinction |
|---|---|
| Free space | Width 40 mm, density 0.2 yields eight actual parallel samples at y = +17.5, +12.5, ..., -17.5 mm in the declared test |
| Converging ideal lens | Incoming parallel rays cross its specified focal plane; also check propagation from the opposite side |
| Diverging ideal lens | Measure downstream ray positions against the ideal-lens relation; do not label a virtual image as a detector hit |
| Finite aperture before lens | For a centred 12 mm gap, only the two central samples pass; the opaque arms absorb six actual samples |
| Parallel-sided slab | Explicit 60 mm thickness, 30 degree incidence and indices 1.5 / 1.8; verify each measured ray against Snell's law, exit parallelism and lateral displacement |
| High-to-low index boundary | Explicit index 1.5 -> 1 at incidence 60 degrees; check real native TIR and reflected detector directions |
| Sampling repeatability | Compare density 0.2 / 0.4 (eight / sixteen rays), unchanged ideal focal plane and deterministic rerun |
| Incomplete execution | Full Fresnel and processed-ray stop controls must withhold the native position list; incomplete propagation is not zero light |

These are fully specified **synthetic teaching controls**, not copied original JEE questions, solved-problem scores or proofs of continuous illumination. Refraction examples with partial reflection disabled explicitly omit Fresnel partial reflections; native TIR remains active. Brightness is native relative brightness, not watts. Focal-plane ray agreement in an ideal model is not measured physical PSF or image reconstruction.

### Deliberate safety boundary of the research harness

`test/jee-native-parallel-beam.test.mjs` compiles already valid source-centre/optical geometry and replaces **only the source object in the test-native scene** with a real `Beam`. Every other native object must remain identical. The pre-existing canonical document does **not** authorize this new source family or validate its entire finite extent. The harness never runs public result qualification against that old document's hash and never exports a purportedly qualified beam scene. Tests confirm the current canonical compiler and authoring layer still reject a `parallel-beam` component.

An actual authoring extension must remove this bypass by introducing its own explicit reviewed contract. This experiment only establishes bounded native feasibility when it passes; it does not establish public API, Chrome beam editing, arbitrary rotated sources, instrument models or all source/edge combinations.

## Requirements for the authorable source milestone

Use a physical specification with source centre, finite perpendicular width, propagation direction and brightness, keeping sampling under a separately declared numerical policy. Validate the **whole emitting segment**, not only its centre: coordinate bounds, separation from every boundary / optical surface, a single unambiguous starting medium, and clearances to rims, corners and tangent/grazing encounters. Refuse unsupported source/media combinations without rewriting them into a more permissive profile.

Initially support one bounded deterministic parallel source in separately verified optical families. Reuse component validators and the native Beam generator; do not add one new ray controller per lens/slab/prism example. Preserve old saved contracts and explicitly report native saturation, sample count and incomplete propagation. Include unit/orientation checks, reversed direction, actual misses, parameter edits, public CLI, Chrome and fresh export/reopen before claiming LLM authorability.

Do not increase the 32-hit retention limit for this milestone. The v18-specific overflow-feasibility question in #124 is deferred, **not answered or closed**. Existing withholding safeguards remain unchanged. Multiple sources, divergent Beam options, randomness, Lambertian illumination and energy calibration require separate admission, not implicit defaults.

## Following milestones

After a reviewed source contract: extend verified parallel/fan illumination to finite prisms and appropriate existing refractive families; then develop conditional apparent-depth / virtual-image and observer questions. Keep apparent-image mathematics distinct from native hit positions and observer visibility; a detector miss is not proof that an eye sees no light.

Select representative problems from the eight existing Atlas chapters and score **interpretation fidelity, physical correctness, simulation coverage and educational usefulness separately**. Textbook answer completeness is optional. Missing physical information must remain explicit. 2D geometrical rays cannot silently stand in for 3D or wave-optics effects. Preserve manual JSON exchange as a supported workflow; automated LLM calls and extra UI controls are not prerequisites for this first draft.
