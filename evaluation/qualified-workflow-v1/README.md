# Five original problem images: qualified-workflow development trial

**Same-assistant development experiment, not a blind or independent model
accuracy result.** No external model API was called. No Solutions image was
opened. Five file IDs were fixed before opening their Problems images, and the
first interpretations were committed before executing the new workflow.

## Evidence boundaries

Archive: `08_Ray_Optics_Explanations.zip`, SHA-256
`03fa29dc8a09f157692ea389354bc7393a96e49f792b60329164c03e56bc5939`.
Selected files: `07_Lens_Formula/Problems/002.png`, `003.png`, `005.png`,
`009.png`, `011.png`, under the archive root `08_Ray_Optics_Explanations/`.

Selection was frozen at commit
`04baefe73d9a05e6518fb74f6ce7a9e56e26d59b`. The temporary private preparation
workflow that obtained these inputs is removed from the final candidate; it
never copied Solutions images. First interpretations and requests are in
[first-attempt.json](first-attempt.json), sealed at commit
`ab875e46c0d3a02efc743cfa77fca79b6e1d0564`. Its Git blob is
`619ff812a498db2f0e9c3ba6d37d8c3b9551c715`; replay checks that it is unchanged.

These files were newly opened in this trial, but earlier project-wide exposure
cannot be excluded. Selection from one section is not representative and did
not produce the intended diversity of supported/multicomponent examples. We
retain that limitation rather than substituting easier questions afterward.

## Recorded first interpretation and execution plan

| Case | Original request | Recorded treatment |
|---|---|---|
| H1 / 002 | Infer focal length from magnification at two object distances. | External conditional thin-lens reasoning gives 12 cm. Two declared point-source illustrations check real and virtual forward predictions; this is not a native inverse solver or extended-object simulation. |
| H2 / 003 | Infer plano-convex lens material index. | Unsupported: ideal focal length does not expose curved surfaces, material index or lensmaker inference. No scene. |
| H3 / 005 | Focal length in different surrounding media. | Unsupported: no refractive-medium physics in the current adapter. No equivalent focal-length scene substituted. |
| H4 / 009 | Infer liquid index from changed image location. | Complete question unsupported. Execute only the explicitly labelled EMPTY-TANK baseline; do not fake the liquid with a moved source. |
| H5 / 011 | Symbolic image shift for a weak concave lens in contact. | Needs clarification of the optimization/sign convention and exceeds current numerical/contact-geometry scope. No scene. |

The three illustrative requests are exactly the ones frozen in the first
attempt: H1-real, H1-virtual and H4-empty-only. Representative-source assumptions
are kept alongside policy choices for aperture, brightness and emission.
They must not be attributed to the question statement.

## Reproduction and assessment

After normal setup, run:

```sh
node scripts/five-problem-trial.mjs
```

The runner checks archive/image hashes and the sealed attempt blob, preserves
only selected Problems PNGs in ignored private evidence, and executes the same
requests through `qualified-scene.mjs`. The reference forward predictions in
millimetres are H1-real x=480, magnification=-3; H1-virtual x=-240,
magnification=+3; H4-empty-only x=360, magnification=-0.8. These are conditional
ideal-lens expectations, not points independently detected in native rays.

The generated `test-artifacts/qualified-workflow/five-problem-review.json`
contains the actual native status, warnings, output paths, hashes and requested
result records. Final execution evidence is linked on PR #15. Code does not
publish an accuracy fraction or treat every no-scene outcome as independently
adjudicated correctness. All original-question-answer flags remain false: the
engine has not established the original inverse/material/symbolic answers.

No post-solution adjudication is claimed. Explanations need an independent
review, and the authoring request still comes from an LLM/human interpretation.
Repeated CI replay is not five fresh LLM attempts.

## What this changes in the roadmap

This sample exposes missing material/refraction and inverse/symbolic result
capabilities more than JSON-format friction. It does not, by itself, justify a
parallel-beam extension. Before adding physics, broaden the recorded sample to
include a truly supported complete experiment and a multicomponent arrangement.
Keep model interpretation failures, absent information, missing native physics
and missing analysis separate. Add one reusable capability only after a scoped
proposal and native/contract/round-trip tests; avoid per-question patches.
