# Current-main source-backed transfer and native-lineage feasibility (test-only)

This is a **test-only GitHub Actions experiment** on a feature branch based at Opticsim main `00e6211d6d40c0db8c62910f9e57b910b6aeb6f5`, under supported Node `24.19.0`. It neither modifies production optics nor publishes a new authorable observable or a general ray tracer. Keep this draft research branch **unmerged** pending any separate implementation decision.

## Replay — immutable first attempts

The `frozen-inputs.mjs` module reconstructs the **exact original six input JSON byte sequences** from the developmental 2026-11-15 six-image Problems trial plus two separately labeled teaching analogues. `run.mjs` asserts SHA-256 of `JSON.stringify(value,null,2)+'\\n'` against the original preexecution input hashes *before* each public `runProblemEvidence` invocation. The source archive's separately verified digest was `03fa29dc8a09f157692ea389354bc7393a96e49f792b60329164c03e56bc5939`; frozen pre-image selection digest `e26b38854d0bf2bddf3dbf22d6bcd40bce41e5f3413813289ff0a50c27a96d77`. No Solutions images or image bytes are bundled here.

- T1 plane-mirror virtual image enumeration — expected unavailable
- T2 plate + convex mirror image coincidence — expected unavailable
- T3 pole-and-water shadow — existing conditional refracted **angle only**; continuous shadow unavailable
- T4 layered refraction branch angles — **exposed B06 control**, not eligible unfamiliar transfer
- T5 silvered prism retracing inverse — expected unavailable
- T6 glass slab + thin lenses symbolic inverse — expected unavailable
- C1R2 explicitly authored **finite-mirror teaching analogue**, not source-faithful image enumeration
- C2R explicitly authored **one-ray water teaching analogue**, not continuous shadow

Every original source physical input is preserved as originally submitted. The two analogues were constructed after earlier recorded refusals. A fixed qualified physical edit of C2R changes only water index `4/3→1.5` and records its input SHA; it is a teacher hypothetical, never a textbook given. A passing replay measures deterministic **current-head software compatibility** of the existing claims; it does not upgrade same-assistant interpretation to an independent blind evaluation.

The runner uses public `runProblemEvidence` and the same `evaluateDocument` / pinned compiled native checker. A prebuilt current-checkout core is injected to avoid redundant Webpack builds, not to replace the engine. The public qualified-revision CLI is used for the physical edit. Evidence is written only to the fresh ignored `test-artifacts/llm-authoring/source-backed-transfer-v2` folder.

## Test-only ray identity/branch probe

`lineage.mjs` instruments **individual loaded PhyDemo native instances**, wrapping `onSimulationStart` and `onRayIncident` while delegating exactly once without changing return data, ray geometry, the native pin, the module prototype or a physics law.

A `WeakMap` maps only actual JavaScript ray object references from native emissions to per-run test tokens; when PhyDemo `onRayIncident` returns a `newRays` array, the probe associates those returned **real objects** with the observed parent token. Tokens and source labels are **test-local observations**: they are not original engine IDs, public source-attribution evidence or certified global ray paths. Compare a fully authored finite-mirror scenario with a distinct two-source Fresnel scene and **two separate actual detectors**, one for transmitted primaries and one for reflected children. The baseline official checker verifies processed segments and passive crossing counts remain unchanged by observation.

Adversarial/deferred cases: native near-critical/TIR, ambiguous/merged dielectric faces, corner hits, lossy Fresnel truncation, stop/pause, more than a few rays, unsupported media and asynchronous browser updates. `rayIndex` remains a mutable simulator-array position and is never treated as source identity. No image, continuous illumination, correct question interpretation or geometry missing from the source is inferred.

## Execution and evidence

This feature branch adds one disposable read-only step to the existing unified CI workflow after `npm test`: run `run.mjs`, run `lineage.mjs`, and upload their raw evidence under `source-backed-transfer-v2-evidence` even on a failed study. Run on a **fresh complete checkout** with `npm run setup` (already in CI) and Node `24.19.0`, leaving all existing workflow steps intact. No new external provider, secrets or independent model call.

**No full-coverage or classroom score:** evaluate source interpretation fidelity, native numerical correctness, supported simulation breadth, educational affordances and optional answer completeness separately; T4 is a known exposure. A negative control refusal is not a failed simulator trace, and a synthetic ray trace is not an original problem answer.

If the probe supports a more general identity design, follow with a separately scoped R2 design/production PR and a review packet in `physicsvigilante/review_sandbox`. Do not silently promote the test wrapper into production.
