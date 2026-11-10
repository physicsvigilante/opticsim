# Small image-to-scene authoring workflow

Status: approved and implemented, 2026-11-02. The repo-owned skill, Node checker
and small authored evaluation set are complete; see the image-authoring section
of [VALIDATION.md](VALIDATION.md) for actual results and limitations. No production,
schema, upstream or dependency changes were needed. Existing schema-v4 composition
work was left intact. Local checkpointing was approved on 2026-11-02; no push or
global installation is included.

The following records the approved design and pre-implementation investigation;
future-tense statements describe that proposal, not outstanding implementation.

## Inspected sources and compatibility

Verified the unchanged PhyDemo checkout at v5.4.0 commit
`811f508d2b070898c241a568b0c167dcb8645251`. Inspected its `ai-tools/README.md`,
`instructions.md`, and `knowledge/{objects,module,integrations}.md`, plus our
current contract, adapter, analysis and session code.

| Upstream guidance | What this workflow takes from it |
| --- | --- |
| Look up object definitions before authoring; distinguish ideal lenses, point sources and linear mirrors | Use the vocabulary to interpret symbols, then map to sandbox semantic types. Native support is broader than sim_ro support. |
| Emit native version-5 scenes/modules, allow JSONC, use y-down viewport coordinates | Do not copy this output format. Emit strict sandbox JSON, current schema/adapter version, mm and x-right/y-up. Only our adapter creates native objects. |
| Module control points, math.js templates, loops and custom surfaces | Out of scope. Keep concrete component parameters and stable IDs, including a single lens ID for both return encounters. |
| Python/Julia integrations, CropBox rendering and optional node-canvas | Reuse our bounded native-core execution and browser preview instead. No Python, canvas package, external AI/OCR service or upstream runner download. |

The upstream finite-angle example uses a slightly offset angle; it is not a rule
for our scenes. Never alter labelled emission angles to add samples. Preserve
native sampling and existing source/simulation/presentation separation.

## Minimal reusable skill

After approval, add only:

- `skills/sim-ro-image-to-scene/SKILL.md`: concise instructions, referring to
  AGENTS.md, the current contract/adapter and maintained examples rather than
  duplicating their schema. Invoke by explicitly asking Codex to use this file;
  no global discovery/configuration installation is included.
- `skills/sim-ro-image-to-scene/scripts/check-scene.mjs`: a small Node entry point
  for a candidate file, reusing validate/loadDocument/Session/Simulator and existing
  diagnostics. No new validator, solver, dependency or test framework.
- Six small evaluation fixtures under `test/fixtures/image-to-scene/`: raw diagram
  images and statements, with separate reviewer-only expected facts/outcomes.

No changes to app UI, contract, adapter, engine, build scripts, pin or locks.
The skill is an interactive Codex authoring aid; the browser app gains no AI
runtime. A skill's successful syntax check would not establish authoring accuracy.

## Workflow and outputs

1. **Inspect inputs and current scope.** Read the diagram and statement together.
   Distinguish optical components from dimensions, normals, axes, construction
   rays and decorations. An extended object arrow is not automatically a point
   emitter; principal rays are not SingleRay components or evidence of a narrow
   emission cone. Unsupported prisms, curved mirrors, extra sources and layouts
   must be reported without substitutions or production edits.
2. **Record interpretation before encoding.** Write `interpretation.md` containing
   a compact table: component/quantity, exact label or statement reference, value
   and unit, and status (stated, derived, assumed or missing). Include conflicting
   readings and the specific unresolved question. Do not use confidence scores
   as substitutes for evidence. Keep this outside the strict sandbox document.
3. **Resolve physical meaning.** Labelled dimensions outrank apparent pixel
   lengths; convert explicit cm to mm exactly. Conflicting text/diagram labels
   require clarification. Choose and document an origin and coordinate frame;
   rotating/translating the entire supported bench is a coordinate choice, not
   permission to move components relative to each other. Convert a normal angle
   to the mirror's tangent angle explicitly. Do not infer f from lens drawing
   curvature, source distances from an unscaled sketch, or aperture from pixels.
4. **Handle missing information.** Missing focal length, separation, off-axis
   height, mirror orientation or physical segment size can affect the result or
   which rays hit. Ask the minimum clarifying question and withhold an authoritative
   scene when essential data are absent. An illustrative scene with assumed
   aperture/emission is allowed only when the user agrees to that interpretation;
   label it as illustrative. Never silently copy physical values from an example.
   Camera/grid and Medium sampling may use declared workflow defaults. Relative
   brightness (e.g. 0.15) is an authoring default, not measured power. Unspecified
   source emission is a source-characteristic assumption, not a sampling setting.
   Inactive full-circle angle/direction defaults are recorded as inactive.
5. **Emit and check a scene.** Write current-version strict JSON with only allowed
   fields and semantic component names. Assign IDs once and preserve them through
   corrections. Native class names/endpoints remain adapter details. Use only the
   three supported current layouts; a failed validator is not permission to add
   support or alter known facts. Record any native two-sided-mirror idealization;
   reject tasks requiring an unsupported reflecting-side distinction.
6. **Validate behavior and preview.** Run the small checker, then open the saved
   sandbox through the existing browser's Open sandbox flow. Inspect controls,
   values, ray rendering and actual run/analysis statuses; save/reload and verify
   IDs. Check the interpretation against the input again. Do not tune facts until
   a picture resembles the supplied construction rays or a desired answer.

Deliver `authoring/<case>/scene.ray-optics-2d.json` plus its `interpretation.md` for
resolved supported cases. Ambiguous/unsupported cases get an interpretation and
question/rejection, not a fabricated complete scene. Generated execution reports
and preview screenshots go under ignored `test-artifacts/image-to-scene/`.

The checker accepts strict current-version documents, calls the existing validator
and native adapter, runs with the document's bounds, and reports native completion,
errors/warnings/truncation/undefined behavior separately from analytical availability
and prediction. It must not repair/quantize inputs, change ray density for a pass,
or add test detectors to the authored/exported scene. Record input/document hashes,
pin, schema version and actual Git/dirty state so results identify the code used.
Its report certifies execution checks, never interpretation accuracy.

Checker and preview commands, from this workspace:

```powershell
node skills/sim-ro-image-to-scene/scripts/check-scene.mjs authoring/case-01/scene.ray-optics-2d.json --evidence test/fixtures/image-to-scene/inputs/case-01.png --evidence test/fixtures/image-to-scene/inputs/case-01.md --report test-artifacts/image-to-scene/example/checks.json
npm run build
npm start
```

The checker builds the test core from current sources before checking, rather than
reusing a potentially stale bundle. It does not auto-install dependencies; report missing
setup and use the project's existing setup instructions. At implementation and
evaluation, local schema v4 was uncommitted and the published baseline had schema
v3. The workflow records the actual Git/dirty state rather than assuming a
published checkpoint.

## Small initial evaluation

Author simple readable diagrams and explicit statements after approval, with
finite apertures/lengths and isotropic point sources stated in the supported cases.
Keep expected facts and analytical answers out of the authoring input. Use new
numbers rather than copying existing scene files as the interpretation task.

| Case | Labelled facts / reviewer expectation |
| --- | --- |
| Single lens | Point source 24cm left and 1.2cm above axis; ideal converging lens f=8cm, aperture=16cm. Canonical lens x=0: source (-240,12), image (120,-6) mm, m=-0.5. |
| Two lenses | Source as above; first lens x=0/f=8cm, second 28cm right/f=12cm; apertures 20cm/24cm. Image (760,18) mm, m=1.5. |
| Vertical plane mirror | Source 15cm left and 2cm above mirror centre; surface vertical, length=16cm. Image (150,20) mm in the centre-origin frame. |
| Normal-labelled mirror | Source (-12cm,4cm) relative to centre; mirror length=16cm; normal 45 degrees counterclockwise from +x. Tangent 135 or -45 degrees; image (-40,120) mm. |
| Ambiguous lens | On-axis point source, f=8cm and aperture=16cm, but source distance missing. Must ask for that distance; no guess from drawing. Follow-up supplies 24cm: generate image (120,0) mm, preserving assigned IDs. A conflicting text/diagram distance variant must also request clarification. |
| Unsupported prism | Unmistakable point-source/prism arrangement, despite native PhyDemo having prisms/glass. Reject as outside the sandbox contract; no substituted lens, raw-native output or code edits. |

Render a second deliberately stretched/non-scale version of the first case with
identical labels. Physical values must be identical; only presentation may vary.
This tests the label-over-pixels rule directly. No model training or fine-tuning.

Score **two independent checks**:

- **Interpretation:** correct components/topology, all explicit quantities/units/
  signs, source versus object semantics, angle convention, provenance, and honest
  assumptions/missing data. Compare physical invariants under the declared frame;
  accept equivalent mirror angles modulo 180 degrees. No invented physical facts.
- **Optical execution:** validator acceptance for supported cases; native run
  diagnostics; independent lens-equation/reflected-point expectations above;
  unchanged values/IDs on save/reload; preview checked. Existing lens/mirror/return
  numerical regressions provide native-law coverage. For each accepted evaluation
  output, also use the existing test technique (a few native incident-method or
  bounded detector probes on a derived copy) to check outgoing rays against the
  independent expectation. Keep probes out of the authored/exported document;
  do not merely compare our predict() output with the expected answer. A screenshot
  or analytical formula alone proves neither ray behavior nor interpretation.

Pilot acceptance: every supported case preserves all stated physical facts and
validates; ambiguous and unsupported cases stop appropriately; the distorted
diagram preserves physical data; clarification preserves IDs. Supported ordinary
fixtures complete without errors/truncation/undefined behavior and match the
independent expected image within 1e-7mm / magnification within 1e-9. Never average
a serious interpretation failure into a passing execution score. Record first-pass
outcomes and each correction; do not claim statistical accuracy from six examples.
Mixed return documents remain supported by the current contract but image-authoring
interpretation of them is not evaluated in this initial lens/mirror-only pilot.

## Pre-implementation investigation evidence and blockers

Four data-level candidates corresponding to the fully specified cases above were
constructed in memory, accepted by the current validator/adapter and completed
native runs with no errors/truncation/undefined behavior. Predictions matched
the independent expected points. Processed segments: 110, 123, 116 and 112,
respectively (full-circle, density 0.2, relative brightness 0.15). These are
structured-data feasibility checks, not image-reading or preview evaluations.

No user diagram/statement pair was supplied, and no perception trial has been run.
The remaining work is to author the raw fixtures, implement the small skill/helper
and evaluate actual outputs after approval. The existing app has no candidate-file
checking CLI; the proposed helper fills that gap by reusing existing APIs. No
contract/engine blocker was found for the four in-scope cases. Missing physical
data, unreadable/conflicting labels, extended-object semantics and unsupported
components/layouts must remain explicit boundaries, not targets for silent repair.

Approval requested: this repo-owned skill, one Node checker and the small manual
evaluation set, with no production/schema/upstream/dependency changes. No global
skill installation, external service, model training, commit or push is included.
