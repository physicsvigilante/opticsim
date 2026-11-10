# ray-optics-2d: bounded implementation proposal

Status: approved for milestone 1 on 2026-11-01. The investigation below records the original proposal; its statements about untested/unimplemented behavior describe that investigation, not the current implementation. See README.md and VALIDATION.md for current commands and evidence. User clarifications: component types and stable IDs remain central; bench cardinality is a milestone scope rule; analytical predictions and run completion remain distinct; the third example uses scene data only.

Use the existing `C:\Users\samee\Documents\sim_ro` workspace with the project name `ray-optics-2d`. Do not rename it or create a sibling project. There are no dependencies on the user's mechanics sandbox or future 3D work.

## Findings and dependency decision

Recommend release **v5.4.0**, resolved through GitHub to commit **`811f508d2b070898c241a568b0c167dcb8645251`** (2026-08-22). Record and verify the full commit, not just the tag. The observed default-branch head was `9dd7706097ec8b93171e04e7985be12c3309533c` (2026-10-30). It includes newer features, including ideal-lens primitives for the beta engine; its Scene fields differ from the release even though both use native JSON version 5. Version 5 alone is therefore insufficient to establish compatibility. The released CPU simulator is sufficient for this milestone. [Release][release], [release commit][commit], [current lens source][head-lens].

| Inspected area | Finding and consequence |
| --- | --- |
| Core integration | `src/core/index.js` exports `Scene`, `Simulator`, `Editor`, `sceneObjs`, and `geometry`. The browser app adds Vue UI around these classes. Use the core in a small local browser shell; there is no need to transplant the whole editor UI. [Core entry][core], [app service][app] |
| Construction and saves | `new Scene()`, `scene.loadJSON(jsonString, callback)`, `scene.toJSON()`, and scene-object constructors are real APIs. Native format is numeric `version: 5`. Loading reports failures through `scene.error`, including unknown scene/object keys. Callbacks indicate loading completion, not success. Serialization omits defaults and adapts viewport settings. Validate before loading and inspect errors after loading. [Scene][scene], [base object][base] |
| Metadata | Common native object fields include `type`, `name`, and `locked`; arbitrary `id`, semantic metadata, and parameter bindings are not accepted. Keep them in the sandbox document and an adapter-owned ID-to-object/index map. Do not infer identity from array positions or editable native names. [Base object][base] |
| Lens and source | `IdealLens` accepts `p1`, `p2`, `focalLength`; `PointSource` accepts `x`, `y`, `brightness`, and `wavelength`. The point source emits through 360 degrees. IdealLens supplies native intersection and incident-ray behavior; its finite segment does not block rays that miss it. [Lens][lens], [source][source] |
| Units | Upstream explicitly uses arbitrary consistent length units except for wavelength in nm. Choose mm for this sandbox and map one mm to one native length unit. Canvas coordinates have y downward; `scale`/`origin` control the viewport, and `lengthScale` affects drawing sizes. None should be mistaken for a physical unit conversion. [Unit description][locale], [renderer][renderer] |
| Rendering/execution | `Simulator` accepts canvas contexts or null contexts for numerical runs, has `updateSimulation`, timer yielding, a processed-ray limit, completion/stop events, truncation statistics, and errors/warnings. Use Canvas2D/default color mode and the released CPU path. [Simulator][simulator] |
| Editing | Native `Editor` directly mutates native objects and implements native JSON undo/redo. Object locks exist but do not make a semantic synchronization layer. Avoid attaching its physical editing controls in milestone 1. [Editor][editor] |
| Numerical access | The integration runner outputs detector power/normal/shear, optional irradiance bins, crop images, and status. It does not return complete ray histories. `pendingRays` is mutable work storage and processed entries are cleared. Its no-canvas path uses an infinite processed-ray limit and listens only for completion. Use the core directly in bounded tests rather than treating this runner as the sandbox execution API. [Runner][runner], [Simulator][simulator] |
| Existing tests | Object tests cover construction, dragging, rotation, scaling, and properties. Scene tests compare Detector CSV/CropBox PNG baselines, including positive/negative ideal lenses. They are useful regression evidence, not independent proofs of the lens equation. The README reports no automated browser end-to-end suite. [Lens tests][lens-tests], [scene tests][scene-tests], [README][readme] |

The upstream package is marked `private: true`; do not assume an installable public optics package. After approval, place an unmodified checkout at `vendor/ray-optics`, detached at the recorded SHA. Preserve its lockfile and build only the required parts. Use JavaScript ES modules, a small DOM UI, and a separate Webpack entry/config for the sandbox, resolving core imports and dependencies from the pinned checkout. Webpack is already upstream's build tool. No extra UI framework is needed. Bundle local locale resources so errors remain readable without hosted resources. [Package][package], [browser build][webpack], [Node build][webpack-node].

The README's Node 18+ advice is older than its dependency requirements: the pinned lock resolves `webpack-dev-server` 6.0.0 requiring Node >=22.15.0, and `copy-webpack-plugin` 14.0.0 requiring >=20.9.0. Upstream CI uses Node 22. This machine has Node 24.19.0, npm 11.17.0, and Git 2.43.0.windows.1. Propose retaining those installed versions initially and recording them in reproducible setup instructions, subject to an actual clean-install/build check. [Lockfile][lock], [CI][ci].

After approval, first attempt a frozen `npm ci --omit=optional` in the pinned checkout, using workspace-local npm cache/build output. This is the documented npm lockfile install mechanism, not an upstream script. It omits optional native image-generation dependencies and also omits Jest; do not claim that it enables upstream's whole test suite. Use Node's built-in test runner with bundled test entry points for our focused tests. The lock includes Git-based `canvas2svg` and `mathquill` dependencies resolved to specific commits via `git+ssh` URLs; verify installation access and retain those revisions. Any needed HTTPS transport adjustment must be scoped to setup, without changing global Git configuration. A lock mismatch or inability to install is a setup blocker to report, not a reason to silently update dependencies. [npm ci][npm-ci], [lockfile][lock].

Verified upstream commands, for reference only until approval:

| Command in upstream checkout | Purpose |
| --- | --- |
| `npm run start` | Development app at `http://localhost:8080/simulator/` by the README's default setup |
| `npm run build-app` | Production browser app |
| `npm run build-node` | CommonJS `dist-node/rayOptics.js` for headless use |
| `npm run test:sceneObjs` | Object interaction/property tests, requiring Jest |
| `npm run test:scenes` | Builds Node module, runs scene regression tests; optional dependencies required |

Do not run the full site/gallery build for this milestone. The separate sandbox run/test commands will be created and documented after approval, then actually verified in Windows PowerShell. No installation or application commands above have been executed in this investigation. [README][readme], [package scripts][package].

Preserve upstream `LICENSE` (Apache-2.0), source headers, and attribution to the Ray Optics Simulation authors and contributors. Retain `CITATION.md` and a link to the pinned release; include a small About/attribution link. The complete release tree contains no `NOTICE` file. Review notices of dependencies actually redistributed when building the artifact; this investigation did not audit installed dependencies. [License][license], [citation instructions][citation].

## Minimal authoring contract and adapter

One versioned sandbox JSON document is the sole authored authority. It contains:

- `format: "ray-optics-2d"`, `schemaVersion: 1`, and the expected adapter version/upstream commit.
- `physics`: explicit `lengthUnit: "mm"`, `coordinates: "x-right-y-up"`, `model: "ideal-thin-lens-geometric"`, and components with unique persistent string IDs.
- Two supported kinds only: one `point-source` with named `x`, `y` parameters, and one or two `ideal-lens` components with named `x`, `focalLength`, and `apertureHeight` parameters. Lens centres lie on y=0 and lenses are perpendicular to the x axis. Positive f means converging, negative f diverging. Source x must lie left of every lens. There is no material index, thickness, dispersion, diffraction, or absorption model.
- Named parameter addresses such as `source-1.x` and `lens-1.focalLength`. These address the component's actual numeric value; do not maintain a second table of values or implement an expression language. Optional control ranges/steps belong to presentation metadata and reference these addresses.
- `presentation`: title, component display labels, view centre, zoom, grid, ray/extended-ray mode, and relative visual brightness. Brightness is an upstream display/intensity convention, not a claimed SI source power.
- `simulation`: the selected bounded sampling/interaction settings, separate from physical parameters and camera settings.

This deliberately describes a small optical bench, not PhyDemo's entire schema. New source positions, signed focal lengths, spacings, and apertures are data changes. A future scene graph can emit this document through the same validator/compiler; it does not get a second execution path.

The adapter has a small proposed interface: validate document, compile to native JSON plus ID map, load/execute the compiled scene, and export native JSON. These are sandbox interfaces to implement, not claimed upstream APIs. Map `(x,y)` mm to native `(x,-y)` and lens endpoints to its two aperture endpoints; focal lengths retain their signed numerical value. Camera pan/zoom acts on presentation only. Export through the pinned `Scene.toJSON()` after successful native loading. Do not include IDs, parameter references, analysis results, or the sandbox envelope in native JSON.

Validate strict known fields, document/adapter/upstream versions, duplicate IDs, unknown component/model/unit choices, finite numbers, positive aperture, nonzero focal length, separated lens planes, and source placement. Initial numerical domain: coordinate magnitudes <=10,000 mm, focal-length magnitude and aperture height in [1,10,000] mm, and source/lens or lens/lens x separation >=0.01 mm. These are declared sandbox numerical limits, not fundamental optics limits. Invalid edits return an error code, document path, and useful message without silently clamping, repairing, or partially applying values.

## State, annotations, and editing policy

Every supported parameter change follows one transaction: create candidate document -> validate -> compile -> load/check native scene -> replace authored state and invalidate old results -> simulate and calculate annotations for that revision. Failed validation keeps the last accepted scene with a clear error. Run failure marks the accepted revision as failed and suppresses any stale success results. Rapid changes cancel/retire previous runs and use revision checks so an older completion cannot overwrite current labels.

Milestone 1 exposes parameter fields/sliders and viewport controls. Native physical dragging, object creation/deletion, native JSON editing/import, and native undo/redo are unavailable in this managed view. Native export is an independent copy that may be opened in the upstream editor; subsequent external edits cannot be reimported as a semantic sandbox save. The sandbox importer explicitly rejects native-only JSON. No full bidirectional conversion or second editing mode is proposed.

Derive image positions/magnification from the same accepted physics values, using a small ideal-lens calculation (single lens equation and two-lens transfer matrices). Label results as **analytical ideal-lens predictions**. PhyDemo alone draws simulated ray paths, including native extensions when selected. Do not draw analytical paths as simulated rays. Predictions concern the rays passing through all lens segments; show that qualification and do not imply that rays missing a finite lens segment are blocked. Analysis is recomputed, not saved as authoritative data.

Use `finite-real`, `finite-virtual`, and `at-infinity` analysis states. At infinity, show collimated output and no finite image distance or transverse magnification; never serialize Infinity/NaN. Near infinity, use a documented dimensionless tolerance (initial target 1e-10 on the scaled matrix denominator), identify the numerical classification, and test either side. Two-lens calculations must handle intermediate collimation/virtual objects without division by an intermediate image distance.

Initial runtime settings: one native point source, ray density 1 (approximately 500 emitted angular samples), `simulateColors: false`, `colorMode: "default"`, native `maxRayDepth: 8`, Simulator processed-ray limit 10,000, and timer yielding enabled. Offer no unbounded density control. Surface running/completed/stopped/failed status, processed count, `totalTruncation`, undefined-behavior status, and scene/object/simulator warnings. A stop or any truncation is incomplete even if a partial picture exists; the processed-ray guard can exceed its threshold by one because upstream checks `>` rather than `>=`. Analytical predictions remain explicitly separate from run status. [Source sampling][source], [Simulator][simulator].

## First milestone and acceptance

After approval, deliver the local preview, one-lens and two-lens documents through this same pipeline, parameter controls, sandbox save/reload, native export, concise PowerShell setup/run/test instructions, and updated AGENTS.md commands. Serve from localhost and keep browser runtime resources local. Opening, simulating, or changing supported parameters requires no LLM or external service.

| Acceptance area | Focused evidence |
| --- | --- |
| Setup | Fresh pinned checkout verification, frozen installation, successful browser and headless builds using the recorded toolchain; reproducible PowerShell instructions. No hosted simulator dependency. |
| Contract/adapter | Reject malformed/unsupported documents with paths; stable IDs survive edit/save/reload; verify mm/y-axis/sign mapping and lens endpoints; load emitted native JSON with no native errors; compare semantic values after native serialization rather than expecting byte equality/default retention. |
| Single-lens analytics | Source (-300,10) mm, lens x=0, f=100: image (150,-5), m=-0.5. Source (-50,10), f=100: virtual image (-100,20), m=2. Source (-100,10), f=100: collimated output, no finite image/magnification. Include f=-100 with source (-300,10): image (-75,2.5), m=0.25. |
| Numerical optics | Compare independent formula/matrix expectations with outgoing rays returned by the pinned lens's public `checkRayIntersects`/`onRayIncident` methods for several incident rays. Initial tolerance: 1e-7 mm position residual and 1e-9 direction/slope error for well-conditioned fixtures. Use backward line extensions for virtual images and parallelism for infinity, not a finite-image intersection. |
| Complete simulator path | Run additional small native `SingleRay` + `Detector` fixtures through bounded `Simulator` with null canvas contexts. Read irradiance bins at two downstream planes, in separate runs if necessary, and compare the observed crossing intervals against independent predictions. Detector bin bounds set tolerance; start with 0.01 mm bins. These are test fixtures, not additions to the authored component set. Check both stop and complete events; require no truncation/errors. Do not read `pendingRays` as history. |
| Two lenses | Source (-300,10), lens 1 at 0 with f=100, lens 2 at 350 with f=100: final image x=550, y=5, total m=0.5. Also test intermediate collimation and an arrangement whose final image is at infinity using matrix-based independent expectations. |
| Browser | Open both scenes; change source x/y and focal lengths; verify document values, native values, run revision/status, and annotation text update together. Exercise rapid edits, invalid inputs, finite/virtual/infinity transitions, sandbox save/download/reload, and native export loaded in the local pinned upstream app. Check console errors and local-only runtime requests. Visual inspection verifies rendering/usability, not numerical physics. |
| Reusable authoring | Add a third fixture using changed spacing and a diverging second lens through document data only. No core/adapter branches keyed to example names. |
| Failure visibility | Deliberately lower limits in tests to cause truncation/stop; verify visible incomplete status. Reject incompatible sandbox versions/upstream pins and native files offered as sandbox saves. |

Independent analytical tests and simulator tests have not been run. No browser build, rendering, Windows installation, dependency fetch, export compatibility, or save/reload behavior is yet verified. Static source inspection identified no blocker requiring an upstream core change. Clean installation, source bundling, and the public numerical hooks still need their first runtime verification after approval; failures will be reported rather than covered by new physics or silent fallbacks.

Approval requested: this pinned source dependency approach, the one-source/one-or-two-coaxial-lens scope, parameter-only physical editing, and the bounded milestone above. This is the user's explicit approval gate before application implementation or dependency installation. No broader roadmap is proposed.

[release]: https://github.com/ricktu288/ray-optics/releases/tag/v5.4.0
[commit]: https://github.com/ricktu288/ray-optics/commit/811f508d2b070898c241a568b0c167dcb8645251
[head-lens]: https://github.com/ricktu288/ray-optics/blob/9dd7706097ec8b93171e04e7985be12c3309533c/src/core/sceneObjs/glass/IdealLens.js
[core]: https://github.com/ricktu288/ray-optics/blob/811f508d2b070898c241a568b0c167dcb8645251/src/core/index.js
[scene]: https://github.com/ricktu288/ray-optics/blob/811f508d2b070898c241a568b0c167dcb8645251/src/core/Scene.js
[base]: https://github.com/ricktu288/ray-optics/blob/811f508d2b070898c241a568b0c167dcb8645251/src/core/sceneObjs/BaseSceneObj.js
[lens]: https://github.com/ricktu288/ray-optics/blob/811f508d2b070898c241a568b0c167dcb8645251/src/core/sceneObjs/glass/IdealLens.js
[source]: https://github.com/ricktu288/ray-optics/blob/811f508d2b070898c241a568b0c167dcb8645251/src/core/sceneObjs/lightSource/PointSource.js
[locale]: https://github.com/ricktu288/ray-optics/blob/811f508d2b070898c241a568b0c167dcb8645251/locales/en/simulator.json
[renderer]: https://github.com/ricktu288/ray-optics/blob/811f508d2b070898c241a568b0c167dcb8645251/src/core/CanvasRenderer.js
[simulator]: https://github.com/ricktu288/ray-optics/blob/811f508d2b070898c241a568b0c167dcb8645251/src/core/Simulator.js
[editor]: https://github.com/ricktu288/ray-optics/blob/811f508d2b070898c241a568b0c167dcb8645251/src/core/Editor.js
[app]: https://github.com/ricktu288/ray-optics/blob/811f508d2b070898c241a568b0c167dcb8645251/src/app/services/app.js
[runner]: https://github.com/ricktu288/ray-optics/blob/811f508d2b070898c241a568b0c167dcb8645251/integrations/runner.js
[lens-tests]: https://github.com/ricktu288/ray-optics/blob/811f508d2b070898c241a568b0c167dcb8645251/test/sceneObjs/glass/IdealLens.test.js
[scene-tests]: https://github.com/ricktu288/ray-optics/blob/811f508d2b070898c241a568b0c167dcb8645251/test/scenes/scenes.test.js
[readme]: https://github.com/ricktu288/ray-optics/blob/811f508d2b070898c241a568b0c167dcb8645251/README.md
[package]: https://github.com/ricktu288/ray-optics/blob/811f508d2b070898c241a568b0c167dcb8645251/package.json
[lock]: https://github.com/ricktu288/ray-optics/blob/811f508d2b070898c241a568b0c167dcb8645251/package-lock.json
[webpack]: https://github.com/ricktu288/ray-optics/blob/811f508d2b070898c241a568b0c167dcb8645251/webpack.config.mjs
[webpack-node]: https://github.com/ricktu288/ray-optics/blob/811f508d2b070898c241a568b0c167dcb8645251/webpack.node.config.mjs
[ci]: https://github.com/ricktu288/ray-optics/blob/811f508d2b070898c241a568b0c167dcb8645251/.github/workflows/test.yml
[npm-ci]: https://docs.npmjs.com/cli/v11/commands/npm-ci/
[license]: https://github.com/ricktu288/ray-optics/blob/811f508d2b070898c241a568b0c167dcb8645251/LICENSE
[citation]: https://github.com/ricktu288/ray-optics/blob/811f508d2b070898c241a568b0c167dcb8645251/CITATION.md
