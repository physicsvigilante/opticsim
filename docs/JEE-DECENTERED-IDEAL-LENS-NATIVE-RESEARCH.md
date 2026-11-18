# JEE decentered ideal-lens pair — native feasibility, not a public capability

**DRAFT RESEARCH ONLY. No production source, schema, adapter, workflow or pinned PhyDemo code is changed.** This study starts directly from merged production main `8b4ffee3c9deb34fcf7d657221f917fab321de4c`, not the unmerged evaluation branch or a held thick-lens branch. It is builder preflight for a future reusable ideal-lens composition capability. Do not interpret this test as a new JSON-authorable scene family, reviewed release, general image reconstruction or real optical bench.

## Source basis and the actual gap

The completed post-PR164 coverage trial uses the supplied `08_Ray_Optics_Explanations.zip` (SHA256 `03fa29dc8a09f157692ea389354bc7393a96e49f792b60329164c03e56bc5939`). Case **J19**, chapter **07_Lens_Formula**, original question **027**, explicitly has two thin convex lenses of equal symbolic focal length `f`, horizontal separation `3f`, transverse optical-axis displacement `d << f`, and leftward-to-rightward parallel illumination. Origin is the first lens centre. It asks the final focal coordinates. The source question image was directly inspected; no solutions were consulted and no lengths were obtained from the drawing's pixel scale.

The source does **not** state numerical `f`, `d`, finite source width, finite lens aperture, detector, brightness or sampling density. This study declares a **separate numerical illustration**: default `f=200 mm`, `d=2 mm`, source width `40 mm`, ideal-lens segment length `200 mm`, source brightness `.08`, native preview density `.2` and depth 8, a 400-mm finite passive detector at the reference plane. None of these added values is silently attributed to the original source. The source asks a symbolic thin-lens result, not a brightness/PSF/real-eye measurement.

[Coverage PR #165](https://github.com/physicsvigilante/opticsim/pull/165) correctly leaves J19 unsupported: the existing reduced lens-train query is coaxial; v19 Beam admits at most one ideal lens; current `ideal-lens` parameters do not encode a transverse centre. The ordinary two-lens axial case **J18** is already covered by a different reduced analytical contract and separately declared native illustration. Do not call J18 unsupported to justify thick-material-lens work, or silently substitute `d=0` for J19.

## Native geometry and provenance boundary

Pinned upstream: `ricktu288/ray-optics` commit `811f508d2b070898c241a568b0c167dcb8645251`. The inspected native [IdealLens implementation](https://github.com/ricktu288/ray-optics/blob/811f508d2b070898c241a568b0c167dcb8645251/src/core/sceneObjs/glass/IdealLens.js) uses the midpoint of its endpoints and its stated focal length when propagating an incident ray. Changing the endpoint midpoint therefore tests a transverse optical centre without modifying the solver.

The helper first compiles a valid public **one-lens** canonical v19 Beam scene. It clones the native scene, shifts native first-lens endpoints if a common translation is requested, and appends a second **native IdealLens** whose endpoints explicitly encode its own centre. Native y is down; project y is up. `core.loadNative` and the actual pinned `Simulator` then propagate ordinary native rays. The detector and source are genuine native Beam/Detector objects; the second lens is not an analytical ray patch.

**The resulting research native scene differs from the admitted canonical seed.** Its native JSON and SHA256 are recorded separately. It is **never** passed to public `evaluateDocument`/`evaluateObservables` under the one-lens canonical hash, and no canonical authoring/qualification success is claimed. Existing observer helpers are used only to read the unchanged source/detector instances; the research-only second lens is observed directly via its real native callback. The native input is saved as `native-input.json`, not as a falsely qualified canonical Opticsim scene.

Research wrappers snapshot actual lens callback positions/directions, call each native callback exactly once, and return its original result. They do not redirect, resample, relocate or insert propagated rays. Source observations record the real emitted samples. Detector positions/directions come from the existing opt-in native detector instrumentation. Neither a known detector crossing nor a traced sample is a physically reconstructed image or proof of an arbitrary ray lineage.

## Independent calculation used only after native tracing

Use a local propagation coordinate `u` (increasing with illumination), transverse coordinate `y`, first lens centre `c1`, second centre `c1+d`, focal lengths `f1,f2`, and separation `L`. For a parallel input sample at `y0=c1+h`, the independent ideal-thin-lens reference is:

- After lens1: slope `m1=-h/f1`.
- At lens2: `y2=y0+L*m1`.
- After lens2: slope `m2=m1-(y2-c1-d)/f2`.
- At a detector `uD>L`: `yD=y2+(uD-L)*m2`.

For `f1=f2=f` and `L=3f`, `y2=c1-2h`, `m2=(h+d)/f`, so at `uD=5f` every ideal sampled ray has `yD=c1+2d`. With the source's origin `c1=0`, the symbolic thin-lens reference is **(5f, 2d)**. This is derived here from the declared model and source geometry, not read from an answer key, and is never supplied to native propagation as an itinerary or forced crossing.

For unequal positive focal lengths, when `L-f1-f2` is nonzero, the finite focal distance beyond lens2 is `f2*(L-f1)/(L-f1-f2)`. A separate unequal-lens native control tests this generic affine composition instead of hardcoding J19. At `L=f1+f2`, the reference is **afocal**: outgoing slopes are equal, distinct ray heights remain, and the helper must not invent a finite focus. Omitting lens2 also must change actual detector crossings from the expected focused arrangement.

These are ideal-thin-lens/reference calculations, not exact thick-material-lens refraction or a universal physical imaging model. The original `d << f` and chosen small beam angles keep the teaching interpretation explicit.

## Builder preflight controls

The test file checks:

1. Production canonical authoring still rejects two ideal lenses in the v19 Beam family, and rejects an unknown lens `y` parameter instead of ignoring it.
2. Actual native focal-plane samples for equal lenses with positive, negative and zero offset. Default illustration expects **eight emitted samples at (1000,4) mm**, not an asserted physical image.
3. Half/double geometric scales and common transverse translation preserve independently predicted native sample geometry; sample counts follow native density/width, not forced constant counts.
4. Reverse illumination with both +180 and -180 headings crosses both native lenses with correct outgoing signs and reflected x placement.
5. Unequal positive lens focal lengths obey independent affine transfer, rather than a special-case final point.
6. Afocal separation and omitted second lens produce spatially separated samples, not fictitious finite image formation.
7. Deliberately depth-zero native tracing is incomplete and the normal detector-hit evidence is withheld. The research trace is not promoted to a complete measurement after a stopped/undefined/truncated run.

For completed cases, require an actual completion callback, no native errors/truncation/undefined behavior, native-emitted counts and all actual detector events, two real lens encounters per emitted sample, safe distances from finite native lens endpoints, and measured incident/outgoing slope consistent with each native lens's stated centre/focal length. Evidence under `test-artifacts/llm-authoring/decentered-lens-research-*/` includes actual native scene JSON/hash, declared illustration settings, raw real emission/lens/detector observations and independent mathematical references. Native counts/positions are **builder executions**, not independent reviewer reruns.

## Next development boundary

Passing research is only evidence that pinned native objects can support this bounded geometry. A future **public versioned** authoring profile needs explicit lens transverse centres, bounded multiple-lens Beam admission, whole-source/aperture/ordering and endpoint-clearance policy, old schema isolation, stale/incomplete measurement handling, native-vs-analytical provenance, save/reopen and real browser controls. It should support reusable compositions rather than embed an answer to J19. Source symbolic parameters must remain symbolic unless an explicitly labelled numerical illustration is requested.

No separate independent physics review is requested merely for this preparatory test file. Bundle the completed native evidence and adversarial scope tests with the final proposed production capability for **one meaningful independent source/integration review**, following the user's review-reduction preference without omitting the independent gate. No merge of this research branch or held thick-lens/CI branches is implied. The frozen original coverage attempt remains unchanged and J19's original authoring disposition is not retroactively upgraded.
