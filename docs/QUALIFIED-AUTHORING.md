# Qualified authoring: scene, assumptions, and requested results

This workflow builds on the audit corrections in PR #14. It retains the strict
canonical v4 scene contract and the pinned, unmodified PhyDemo engine. It adds
no optical component, material model, ray tracer, or external-model integration.

The LLM interprets the problem and supplies a normal authoring request. The
engine handles preparation, validation, execution, result applicability and
portable evidence. This is not an automatic image interpreter or independent
LLM benchmark.

## Start here

After the existing project setup (`npm run setup`), discover both contracts:

```sh
node scripts/qualified-scene.mjs capabilities
```

Create `request.json` using the existing component fields. For example:

```json
{
  "lengthUnit": "cm",
  "title": "Illustrative ideal lens",
  "components": [
    {"id":"S1","type":"point-source","parameters":{"x":-30,"y":1}},
    {"id":"L1","type":"ideal-lens","parameters":{"x":0,"focalLength":10}}
  ]
}
```

The omitted brightness, emission and finite aperture require explicit
illustration opt-in. The source position, height and luminous-point interpretation
in this example are author choices, not values inferred from a question.
Do not use this example to fill missing facts in an unrelated problem.

Create `observables.json` as a small companion array, not another apparatus DSL:

```json
[
  {"id":"image","kind":"ideal-image","componentId":"S1"},
  {"id":"emission","kind":"source-emissions","componentId":"S1"}
]
```

Create optional `interpretation.json` containing source identification, requested
quantity and a short evidence ledger. These statements are explicitly
**author-provided, not independently verified**:

```json
{
  "requestedResult": "Show the conditional image of a representative point",
  "stated": [],
  "derived": [],
  "assumptions": ["Use a luminous point at height 1 cm for this illustration."],
  "unknowns": []
}
```

Execute using a fresh output directory:

```sh
node scripts/qualified-scene.mjs create request.json --illustrate --observables observables.json --interpretation interpretation.json --out test-artifacts/llm-authoring/my-first-attempt
```

Omit `--illustrate` for strict preparation. Missing essential information,
unsupported apparatus and invalid input remain blocked before native execution.
A blocked attempt has input/report evidence but no scene or qualified package.
No implicit repairs, additional emitters, or equivalent-apparatus substitutions
are performed.

## What is saved

An accepted attempt saves original input bytes, optional original sidecars,
`scene.ray-optics-2d.json`, `qualified-scene.json`, and `report.json`. The report
separates native execution from requested results and question interpretation.
Existing output directories cannot be reused, preventing mixed old/new evidence.

`qualified-scene.json` is a portable envelope around an unchanged v4 scene.
It includes explicit observable requests, original input hash, preparation
status, illustration-policy version, applied physical assumptions, optional
author interpretation, and edit history. Scene SHA-256 binds results to exact
canonical scene serialization. A second SHA-256 binds the envelope contents.

Hashes detect accidental mismatch or uncoordinated changes. They are **not**
signatures, proof of authenticity, or evidence that interpretation is correct;
a person can change metadata and recompute a hash. The source hash binds a
reference but does not prove the contents of an unavailable source image.

## Requested result contract

| Kind | Required component | Method and limitation |
|---|---|---|
| `source-emissions` | Point source | Actual sampled native emitted-ray count. |
| `mirror-reflections` | Plane mirror | Actual sampled native interaction count, not unique-ray provenance. |
| `detector-crossings` | Ray detector | Sampled crossings; not continuous throughput. |
| `detector-signed-power` | Ray detector | Signed relative native power, not watts or source-specific power. |
| `ideal-image` | Sole point source | Existing applicable analytical model; conditional, never native image detection. |

The request limit is 16. Unknown kinds, missing targets and inapplicable
analysis return `unavailable`, not fabricated values. Stale or incomplete
execution evidence returns `suppressed`. Native warnings qualify observations.
A complete fully specified scene is not automatically faithful to a question.

For `ideal-image`, the engine tests the unchanged arrangement against existing
single-source lens-train, plane-mirror, or lens/mirror-return scope validators.
Only an analysis copy receives the applicable model tag. The executed native
scene is not modified and no components are removed or replaced. Results retain
explicit finite-aperture, illumination and optical-route conditions. A return
formula does not prove that sampled rays followed the required return route.
Multiple sources or arbitrary mixed layouts do not acquire an image solver.

Original problem support and physical fidelity remain separate, unassessed
claims. For example, calculating a conditional image after an author has solved
for focal length is not a native solution of the inverse focal-length problem.

## Browser preview, edits and export

Build/start the existing browser (`npm run build`, `npm start`) and use
**Open scene / qualified package** to open `qualified-scene.json`.
The qualification panel shows applied policy assumptions, author-declared
assumptions, unresolved information and requested results. Notes render as
text, never executable HTML. Native execution is rerun for the loaded scene;
saved measurements are not trusted as fresh results.

**Save qualified package** preserves original assumptions and later edits.
Physical edits are marked as revisions, not upgraded to facts from the source
question. Presentation and numerical changes are distinguished. Editing an
assumed field retains its previous assumed value and records the replacement.
Asynchronous result/import work is revision-guarded. Invalid input suspends
current results and qualified export; the panel labels any retained history as
belonging to the last accepted scene.

Ordinary **Save sandbox** and **Export PhyDemo JSON** remain compatibility
exports and omit qualification history. Reopening raw scene JSON shows
`unknown` provenance and cannot inherit the previously loaded scene's history.
Use qualified packages when preserving assumptions matters. Bundled examples
also have unknown source provenance rather than an invented fidelity claim.

## Qualified revision from the command line

Use the incoming package's `sceneSha256` as `expectedSha256` in an ordinary
atomic change request:

```json
{
  "expectedSha256": "COPY_THE_CURRENT_SCENE_HASH",
  "changes": [
    {"id":"L1","section":"parameters","key":"focalLength","value":12,"unit":"cm"}
  ]
}
```

```sh
node scripts/qualified-scene.mjs revise qualified-scene.json changes.json --out test-artifacts/llm-authoring/my-second-attempt
```

The original package, change request, scene hashes, parent package hash and
updated history remain reviewable. Stale patches and mismatched packages are
rejected. Metadata and history are bounded; reaching a limit fails explicitly
rather than discarding history silently.

## Validation and boundaries

The dedicated `Qualified authoring checks` workflow runs unit tests, real
create/revise acceptance, the sealed five-question development replay, and
Chrome import/edit/export checks. The original CI retains all existing native
and browser regression coverage. Generated reports and images remain private
Actions artifacts, not website assets.

The five-question trial is documented in
[the trial record](../evaluation/qualified-workflow-v1/README.md). It reads only
specified Problems PNGs, not Solutions. Replaying frozen requests in CI verifies
software consistency, not new model performance. No provider key is required.

Further work should address a broader problem sample and demonstrated missing
observables/physics. Do not silently add refraction, contact-lens reductions or
parallel-source approximations merely to make an unsupported question run.
