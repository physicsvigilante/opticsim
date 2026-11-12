# Minimal problem-to-scene authoring

This is a bounded preparation layer over the existing `prepareScene()`
component contract, not an image interpreter or a general JEE answer engine.
PR #13 introduced it; the audit corrections clarify its guarantees without
changing canonical scene schema v4 or pinned PhyDemo physics.

## Physics, numerical sampling and presentation are different

Lens aperture, source brightness and source emission pattern are physical
modelling choices. They are **not cosmetic rendering defaults**: they can
change which surfaces are hit, clipping, and detector readings. Ray density
is a numerical sampling choice. Camera position, grid and labels are
presentation choices. Do not conflate these three categories.

The original strict interface never supplies missing active physics. The
problem preparation interface operates on a copy and offers a separate,
explicitly opted-in illustration policy. It cannot establish whether a
supplied value is true, whether an object is actually an emitter, or whether
the requested answer is observable.

## Two modes and five preparation statuses

Strict mode is the default. `--illustrate` permits only policy
`illustration-v1`: omitted relative source brightness becomes `0.08`, omitted
ideal-lens aperture height becomes `100 mm` converted into the request's
length unit, and entirely omitted/empty source emission becomes `full-circle`.
These arbitrary choices are for illustration, not inferred question facts.
Existing values, including invalid/null values, are never replaced.

| Status | Meaning |
| --- | --- |
| `fully-specified` | The request satisfies the supported contract without applied physical choices. Not a claim of fidelity to the original question. |
| `illustrative` | An accepted scene incorporates explicitly opted-in physical choices. |
| `needs-information` | Required information is missing. No accepted scene. |
| `unsupported` | A component, physical arrangement, mode, unit or policy is unavailable under the current contract. No substitute is manufactured. |
| `invalid-input` | Malformed structures, unknown schema fields, duplicate IDs, nonnumeric or out-of-bounds values. No accepted scene. |

Independent field issues are collected across components using the same live
parameter names and bounds as the strict authoring interface. Invalid input
has priority over unsupported input, which has priority over missing data;
the full issue list remains available. Complete-scene geometry is still
checked by the canonical validator, not a second ray tracer.

There are no defaults for positions, focal length/sign, mirror/detector
geometry, component identity, source count, or missing directional angles.
No synthetic source is created from an extended object or a construction ray.

## Provenance and scope

`proposedChoices` lists possible defaults. `appliedChoices` lists only those
incorporated in an accepted scene, with final stable component IDs. Strict
or blocked requests have no applied choices. `choices` is retained as a
compatibility alias for proposed choices; new consumers should use the
explicit names. `policyVersion` records which policy was considered.

The chosen numerical values are necessarily present in the canonical scene;
their **provenance** stays in its accompanying report. `interpretation`,
`physicalFidelity` and `questionSupport` remain `not-assessed-by-engine`.
Native execution, measurement warnings and analytical availability are
separate results. Neither successful execution nor request completeness
certifies an image location or the answer to a textbook question.

## CLI and evidence

```powershell
node scripts/author-scene.mjs problem-capabilities
node scripts/author-scene.mjs problem <request.json>
node scripts/author-scene.mjs problem <request.json> --illustrate --out test-artifacts/llm-authoring/<fresh-attempt>
```

Use the existing `lengthUnit` and `components` request: there is no second
apparatus language. The interpreter must select the supported components
and supply the known physical values.

Every `--out` target must be a **new directory** below the repository's
`test-artifacts/llm-authoring/`. Existing directories are refused, including
empty ones. Existing symbolic-link ancestors and non-directory ancestors
are rejected. Files use exclusive writes. This guards accidental reuse and
pre-existing path escapes; it is not an isolation boundary against a hostile
concurrent process or arbitrary network filesystem behavior.

An evidence directory contains `input.json` with the exact submitted bytes,
`report.json` with the same summary printed by the CLI, and an input SHA-256.
Accepted preparation also produces `scene.ray-optics-2d.json` with its
canonical SHA-256. Revision attempts preserve the original scene input and
`changes.json`. Blocked preparation produces **no scene and no native run**.
No earlier attempt is erased to make room for a new attempt. Storage errors
are reported rather than described as a successfully saved bundle.

Keep the entire directory together. The existing browser can open the scene,
but it does **not** yet load its qualification sidecar. Saving/revising a
scene alone cannot recover which numbers were assumptions. Revision output
explicitly reports that prior assumptions are unknown from the scene alone.
Browser-visible qualification and provenance-preserving revisions are still
follow-up work, not guarantees implemented here.

## Verification and remaining gap

Tests cover strict/illustrative preparation, unit invariance, missing and
invalid inputs, unsupported-component ordering, proposed/applied provenance,
symlink paths, reused output, preserved input bytes and real native execution.
The CLI acceptance script additionally runs an illustrative problem through
the actual CLI and verifies input/report/scene hashes and reuse rejection.
These are deterministic software and physics-integration tests.

No independent model accuracy or previously unseen five-image end-to-end
trial is established by these checks. That experiment must separately record
source question, initial interpretation, explicit assumptions, original
request, native output, requested observable, manual fidelity review and any
later repairs. A successful ray drawing alone is not the success criterion.

See [project audit and recommended direction](PROJECT-AUDIT-2026-11-12.md).
