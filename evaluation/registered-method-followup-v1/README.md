# Registered-method corrective follow-up

This is an **answer-known, same-assistant reauthoring exercise**, not a new first-attempt, blinded, representative or independent model benchmark. Three deliberately selected, previously exposed original questions already match methods added in PR #50. The purpose is to execute correctly typed requests rather than treat earlier invented/unregistered result names as an exhaustive coverage assessment.

## Explicit decisions

| Case | Source | Selection |
| --- | --- | --- |
| F01 | R01 | `plane-mirror-reflection-point`, using the two stated point heights and foot separation. |
| F02 | R03 | `paraxial-focal-length-inverse`, spherical-mirror-paraxial model, real-object distance and erect signed magnification. |
| F03 | R08 | The same inverse kind, ideal-thin-lens model, both unsigned magnification observations for one lens. |
| F04 | Synthetic information-loss variant of R08 | Retain only one unsigned observation; do not infer its orientation from the known original answer. |
| F05 | Synthetic information-loss variant of R03 | Omit object distance; do not carry the original distance into the new task. |
| F06 | V02 | No direct registered interval-of-visibility method selected. A point-reflection calculation is not an observer-interval result. |
| F07 | V05 | No direct registered silvered-lens equivalent-power method selected. Do not replace the whole apparatus by its already solved mirror. |

Only F01–F05 are submitted to `runProblemEvidence`. F06/F07 remain explicit **author scope decisions**, with no made-up quantity names or simulated engine refusal. These judgments do not prove that no alternative mathematical reduction is possible.

No input contains the solved focal length, a guessed physical aperture, brightness or native emitter. Coordinate origins/sign conventions are stated. The existing solver derives reflection geometry, mirror classification/radius and common focal length. All analytical outputs remain conditional on the chosen ideal/paraxial models; no native scene or ray measurement is claimed.

## Evidence

`decisions.json` is pinned by its Git blob in `replay.mjs`. The two historical first-attempt files are separately verified against their existing Git blobs and never edited. Each submitted request uses the existing fresh, nonsymlink evidence-directory guard and retains exact input bytes, SHA-256, plan, calculations and report. The summary copies actual results; it does not use reference answers to construct them. Regression tests separately check the numbers and withheld results.

Run after normal project setup:

```sh
node evaluation/registered-method-followup-v1/replay.mjs
```

Evidence is written under `test-artifacts/llm-authoring/registered-method-followup-v1/`. Reusing the same directory fails rather than overwriting evidence. Ordinary CI stores this folder with the existing unified-workflow artifacts.

Keep the three reauthored original cases, two synthetic variants and two unexecuted scope decisions in separate counts. **Do not replace the old 0/13 or 0/6 first-attempt records or combine these answer-known follow-ups into an unseen accuracy score.** This improves the use and demonstration of existing capabilities, not the underlying physics or a general natural-language classifier.
