# Single-spherical-interface query: native witness study

This is an additive verification study in draft PR #177, not a new canonical optical family. The analytical query remains **native: not-run**. The query, its explicit physical assumptions, and these separately authored native experiments are distinct pieces of evidence. Production main and the frozen PR #165 source audit are not changed by this study.

## 1. What the native experiments establish

`test/jee-spherical-interface-native-witness.test.mjs` executes the unmodified pinned PhyDemo engine at `811f508d2b070898c241a568b0c167dcb8645251`. It records real `SingleRay`, `Glass`/`CircleGlass`, `Detector` and `Blocker` callbacks. Every wrapper delegates its saved original method exactly once, preserves native arguments and returns, and only records snapshots. No analytical direction is installed in a native ray and no callback manually terminates it.

A source ray is propagated through one actually encountered curved dielectric boundary, then crosses two passive detector segments. The straight line defined by the two **measured** detector points is extended mathematically to the axis. That derived intercept is compared with the standalone paraxial calculation as the illumination becomes progressively more nearly axial. **The extrapolated intercept is not a native detected image or a point the ray necessarily reaches.** Finite-angle discrepancies are expected, retained, and tested; the Gaussian formula is not exact finite-angle Snell refraction.

## 2. Entry experiment: one encounter, without deleting a second surface

The J15-motivated entry fixture is a raw, research-only native scene. It uses a closed native `Glass` region with a genuine circular-arc entrance of radius 100 mm, pole `(0,0)`, circle centre `(100,0)` and arc endpoints `(100,+/-100)` mm. An explicit distant planar closure at x=600 mm is joined by boundaries at y=+/-100 mm. The closure is present in the scene and is never removed from recorded evidence.

One actual `SingleRay` starts at x=-60 mm with an explicitly selected transverse height, initially parallel to +x. Passive native detector segments at x=20 and x=40 mm span y=+/-80 mm **inside** the material, followed by a real opaque native `Blocker` at x=60 mm. Incident/transmitted indices are explicitly 1 and 4/3. `partialReflect=false` deliberately omits partial Fresnel reflections; it does not disable native TIR.

The opaque screen causes genuine absorption before the ray reaches the remote material closure. The completed native callback sequence must be exactly `Glass -> Detector -> Detector -> Blocker`, with one emission and no secondary branches. The screen and inside-medium detectors are synthetic test apparatus, not source-original JEE facts or newly accepted canonical components. The public compiler is not asked to qualify this raw composition under an old document hash; a regression explicitly confirms that raw native JSON is not a canonical document.

Heights 8, 4, 2, 1, 0.5 and 0.25 mm test convergence toward the +400 mm paraxial focal distance. Both detectors and the absorbing screen are well before that mathematical focus; **no focal-plane hit is claimed**. Each measured two-detector intercept is also compared to an independently written exact scalar Snell calculation for the single curved entrance, with tolerance 1e-7 mm. Exact-Snell agreement and paraxial-limit discrepancy are stored separately in `SPHERICAL_NATIVE_ENTRY.json`.

Additional controls change height sign, reverse propagation, translate the complete scene, move the remote closure, and move the absorbing screen while preserving the measured local optics. An explicit lower-index receiving medium (n1=1.5, n2=1) tests a virtual intercept at heights 1, 0.5 and 0.25 mm, independently checking exact Snell and convergence toward -200 mm. A finite real axial object at -300 mm with indices 1 to 1.5 tests convergence toward a +900 mm conjugate.

Removing the blocker, or putting it beyond the closure, permits native rays to meet the second boundary. Those scenes may complete normally, but must fail the one-crossing witness gate. This prevents relabelling a two-interface trace as a single-interface verification.

## 3. Exit experiment: a legitimate one-crossing full-circle trace

The J16-motivated experiment places a source **inside** a genuine `CircleGlass`: centre `(-150,0)` mm, radius 150 mm, source `(-100,0)` mm. For the selected forward directions, the ray exits at the right curved boundary once and then reaches the external detectors and screen. The complete circle is retained; no second surface is deleted. A native exterior ray through a complete circle would be a different two-interface problem.

Glass index 1.5 and the separately declared exterior index 1 yield signed local radius -150 mm and real object coordinate -100 mm. Native incidence angles are not prescribed: source directions +4, +2, +1, +0.5 and +0.25 degrees are declared, and PhyDemo selects the intersection and refraction. The two-detector mathematical intercept converges toward -600/7 mm, rather than the planar shortcut -100/1.5 mm.

A separate **public schema-v7** case prepares and executes the existing canonical inside-circle model with two external detectors and no added blocker. Its completed interface-first-event and detector-hit measurements use the existing `evaluateObservables` qualification path. Changing the material index after execution suppresses stale measurements; a depth-limited run suppresses incomplete ones. This uses existing capabilities, not a new public single-surface API.

The exterior index, numerical illumination, geometry scale and detector apparatus are declared teaching choices where absent from the source. This is a 2D meridional witness, not validation of the original question's complete interpretation, a 3D apparent image, or human vision.

## 4. Numerical and evidence boundaries

A usable raw single-crossing witness requires an actual `simulationComplete` terminal event, completed status, one emission, zero errors/warnings/truncation/undefined behavior, exactly one material encounter, one crossing at each detector, one actual absorption, no secondary rays, and the complete observed four-event sequence. Near-axis mathematical convergence is checked separately from these native execution conditions.

Stopped/depth-exhausted runs, Fresnel branching, trapped TIR, extra material crossings and missing absorbers have no published derived comparison. An exactly axial ray can give two genuine detector crossings but has no identifiable axis intercept; it is not assigned the analytical focal point. The Snell invariant, radius residual, incoming/outgoing half-space signs and detector incoming directions are checked against actual native callback data.

Every run archives the complete raw native JSON, its SHA-256, explicit fixture parameters, processed-ray limit, terminal status, diagnostics and raw diagnostic events under a fresh `test-artifacts/llm-authoring/spherical-native-witness-v1-*` directory. `researchOnly=true`, `canonicalAuthoringAvailable=false`, `originalProblemSolved=false` and `nativeImageDetected=false` are explicit. Unusable experiments retain diagnostic observations but their `derived` field is null. The public-v7 source, canonical document, requests, native summary, qualified measurements and negative controls are archived separately. No research-native scene is exported as a qualified portable scene.

## 5. Corrections and retained red-test history

**Strict input correction.** The new query initially tested a unit through an object-key lookup. JavaScript could coerce `["cm"]` to that key despite the contract requiring a string. The query now requires `typeof lengthUnit === 'string'` before enum lookup. Regression cases include JSON arrays and non-JSON boxed/coercing objects. No optical formula or legacy contract changes.

**Do not confuse approximation error with native error.** Initial native-study commit `68507b7a0183786cb1677a66fde91463ef68a69d` passed 936/938 tests. Two newly written expectations were too strict: the h=0.5 mm, n1=1 to n2=4/3 entry intercept differs from the 400 mm paraxial limit by about 0.0028125 mm, not less than 0.002 mm; the h=1 mm, n1=1.5 to n2=1 intercept differs from -200 mm by about 0.022501 mm, not less than 0.02 mm. Actual native events satisfy exact local Snell refraction. The failed optical run is 44534020519, job 135594595993; its original 28 research inputs remain archived in artifact 14533699646 (ZIP SHA-256 `c25583d8d179115d0ca2e1450e51d30ee2a10c33c6d39b6c171afcbf68e0f4a3`).

The correction retains both larger-height cases and explicitly tests their nonzero paraxial discrepancies. It strengthens every parallel-entry comparison with an independent exact Snell reference and adds smaller heights until the original paraxial-accuracy requirement is met. Neither native geometry nor the analytical formula is adjusted to force agreement. The raw witness gate also explicitly requires the terminal completion event, and its output records the actual processed-ray limit.

## 6. Replay and review

Use the repository's supported Node 24 setup and pinned dependencies:

```sh
npm run setup
npm test
# After the test core has been built:
node --test test/jee-spherical-interface-native-witness.test.mjs
```

Actual final results, source/tree identity and CI links are recorded in PR #177; this protocol alone does not claim that the final tests passed. Native executions are builder-operated CI, not an independent reviewer replay. No browser-facing feature is added; existing native/browser suites are regression checks, not a browser interface for the new query.

One focused independent review should cover analytical signs, strict input validation, near-singular numerical outcomes, original-input evidence binding, genuinely observed native crossings, retained closure/absorption geometry, exact Snell versus paraxial convergence, and the separation of public-v7 evidence from raw research geometry. No repeat review of merged v22/v23 is needed unless the actual diff changes it.

Primary references: OpenStax *University Physics Volume 3*, section 2.3, describes the small-angle single-spherical-interface construction and distinguishes it from two-surface optics (https://openstax.org/books/university-physics-volume-3/pages/2-3-images-formed-by-refraction). Its real-object-positive convention maps to this query by u=-d_o. PhyDemo documents actual incident callbacks and absorption semantics (https://phydemo.app/ray-optics/docs/sceneObjs.CircleGlass.html). Execution authority is the exact repository pin above, not moving online documentation.
