# Single-spherical-interface query: native witness study

This is an additive verification study in draft PR #177, not a new canonical optical family. The analytical query remains **native: not-run**. The query, its explicit physical assumptions, and these separately authored native experiments are distinct pieces of evidence. Production main and the frozen PR #165 source audit are not changed by this study.

## 1. What the native experiments establish

`test/jee-spherical-interface-native-witness.test.mjs` executes the unmodified pinned PhyDemo engine at `811f508d2b070898c241a568b0c167dcb8645251`. It records real `SingleRay`, `Glass`/`CircleGlass`, `Detector` and `Blocker` callbacks. Every wrapper delegates its saved original method exactly once, preserves native arguments and returns, and only records snapshots. No analytical direction is installed in a native ray and no callback manually terminates it.

A source ray is propagated through one actually encountered curved dielectric boundary, then crosses two passive detector segments. The straight line defined by the two **measured** detector points is extended mathematically to the axis. That derived intercept is compared with the standalone paraxial calculation as the illumination becomes progressively more nearly axial. **The extrapolated intercept is not a native detected image or a point the ray necessarily reaches.** Finite-angle discrepancies are expected, retained, and tested; the Gaussian formula is not exact finite-angle Snell refraction.

## 2. Entry experiment: one encounter, without deleting a second surface

The J15-motivated entry fixture is a raw, research-only native scene. It uses a closed native `Glass` region with:

- A genuine circular-arc entrance of radius 100 mm, pole `(0,0)`, circle centre `(100,0)` and arc endpoints `(100,+/-100)` mm.
- An explicit distant planar closure at x=600 mm, joined by boundaries at y=+/-100 mm. This closure is present in the scene and is never removed from recorded evidence.
- One actual `SingleRay` starting at x=-60 mm and an explicitly selected transverse height, initially parallel to +x.
- Passive native detector segments at x=20 and x=40 mm, spanning y=+/-80 mm **inside** the material, followed by a real opaque native `Blocker` at x=60 mm.
- Explicit incident/transmitted indices 1 and 4/3. `partialReflect=false` deliberately omits partial Fresnel reflections; it does not disable native TIR.

The opaque screen causes genuine absorption before any ray can reach the remote material closure. The completed native callback sequence must be exactly `Glass -> Detector -> Detector -> Blocker`, with one emission and no secondary branches. The screen and inside-medium detectors are explicit synthetic test apparatus, not source-original JEE facts or newly accepted canonical components. The public compiler is not asked to qualify this raw composition under an old document hash.

Heights 8, 4, 2, 1 and 0.5 mm test convergence toward the +400 mm paraxial focal distance. Both detectors and the absorbing screen are well before that mathematical focus; **no focal-plane hit is claimed**. Additional controls change height sign, reverse propagation, translate the complete scene, move the remote closure, and move the absorbing screen while preserving the measured local optics. An explicit lower-index receiving medium tests a virtual intercept. A finite real axial object at -300 mm with indices 1 to 1.5 tests convergence toward a +900 mm conjugate.

Removing the blocker, or putting it beyond the closure, permits native rays to meet the second boundary. Those scenes may complete normally, but they must fail the one-crossing witness gate. This guards against relabelling a two-interface trace as a single-interface verification.

## 3. Exit experiment: a legitimate one-crossing full-circle trace

The J16-motivated experiment places a source **inside** a genuine `CircleGlass`: centre `(-150,0)` mm, radius 150 mm, source `(-100,0)` mm. For the selected forward directions, the ray exits at the right curved boundary once and then reaches the external detectors and screen. The complete circle is retained; no second surface is deleted. A native exterior ray through a complete circle would be a different two-interface problem.

Glass index 1.5 and the separately declared exterior index 1 yield signed local radius -150 mm and real object coordinate -100 mm. Native incidence angles are not prescribed: source directions +4, +2, +1, +0.5 and +0.25 degrees are declared, and PhyDemo selects the intersection and refraction. The two-detector mathematical intercept converges toward -600/7 mm, rather than the planar shortcut -100/1.5 mm.

A separate **public schema-v7** case prepares and executes the existing canonical inside-circle model with two external detectors and no added blocker. Its completed interface-first-event and detector-hit measurements are tested through the existing `evaluateObservables` qualification path. Changing the material index after execution suppresses stale measurements; a depth-limited run suppresses incomplete ones. This uses existing capabilities, not a new public single-surface API.

The exterior index, numerical illumination, geometry scale and detector apparatus are declared teaching choices where absent from the source. This is a 2D meridional witness, not validation of the original question's complete interpretation, a 3D apparent image, or human vision.

## 4. Numerical and evidence boundaries

A successful raw native completion alone is insufficient for this study. A usable single-crossing witness requires one emission, zero errors/warnings/truncation/undefined behavior, exactly one material encounter, one crossing at each detector, one actual absorption, no secondary rays, and the full observed four-event sequence. Near-axis mathematical convergence is checked separately from these native execution conditions.

Stopped/depth-exhausted runs, Fresnel branching, trapped TIR, extra material crossings and missing absorbers have no published derived comparison. An exactly axial ray can give two genuine detector crossings but has no identifiable axis intercept; it is not assigned the analytical focal point. The Snell invariant, radius residual, incoming/outgoing half-space signs and detector incoming directions are checked against actual native callback data.

Every run archives the complete raw native JSON, its SHA-256, explicit fixture parameters, terminal status, diagnostics and raw diagnostic events under a fresh `test-artifacts/llm-authoring/spherical-native-witness-v1-*` directory. `researchOnly=true`, `canonicalAuthoringAvailable=false`, `originalProblemSolved=false` and `nativeImageDetected=false` are explicit. Unusable experiments retain diagnostic observations but their `derived` field is null. The public-v7 source, canonical document, requests, native summary, qualified measurements and negative controls are archived separately. No research-native scene is exported as a qualified portable scene.

## 5. Input-validation correction

The new query originally tested a unit by looking up an object key. JavaScript could coerce an array such as `["cm"]` to that key, despite the contract requiring a string. PR #177 now requires `typeof lengthUnit === 'string'` before enum lookup. Regression cases include JSON arrays and non-JSON boxed/coercing objects. The correction changes no optical formula or legacy contract.

## 6. Replay and review

Use the repository's supported Node 24 setup and pinned dependencies:

```sh
npm run setup
npm test
# After the test core has been built:
node --test test/jee-spherical-interface-native-witness.test.mjs
```

Actual results, source/tree identity and final CI run links are recorded in PR #177; this protocol document alone does not claim that tests passed. Native executions are builder-operated CI, not an independent reviewer replay. No browser-facing feature is added; existing native/browser suites remain regression checks, not a browser interface for the new query.

One focused independent review should cover the analytical sign convention, strict input validation, near-singular numerical outcomes, original-input evidence binding, genuinely observed native crossings, the retained closure/absorption distinction, convergence versus exact finite-angle optics, and the separation of public-v7 evidence from raw research geometry. No repeat review of the merged v22/v23 implementation is needed unless the actual diff changes it.

Primary references for the physical distinction: OpenStax *University Physics Volume 3*, section 2.3, describes the small-angle single-spherical-interface construction and distinguishes it from two-surface optics (https://openstax.org/books/university-physics-volume-3/pages/2-3-images-formed-by-refraction). Its real-object-positive convention maps to this query by u=-d_o. PhyDemo documents actual incident callbacks and absorption semantics (https://phydemo.app/ray-optics/docs/sceneObjs.CircleGlass.html). Execution authority is the exact repository pin above, not the moving online documentation.
