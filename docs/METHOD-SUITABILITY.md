# Method suitability audit — exact typed optics requests

This diagnostic is the next generalization milestone after the six original case audit. The **LLM still reads and interprets the physical question**. The software accepts only a selected **registered** `opticsim-problem-v1.requests[].kind` and exact source facts; it does **not** perform text recognition, semantic inference, image interpretation, method invention, or automatic kind remapping.

## What changes

`planProblem`, the existing read-only `preflight-problem.mjs` CLI and hash-bound `run-problem.mjs` report now emit `methodSuitability`: a per-request explanation of **which existing method contract was selected** (if any), **which input family it expects**, whether the supplied facts have a potentially compatible shape, and what the **actual dispatcher** returned.

The readiness classes are deliberately distinct:

| Readiness | Meaning |
| --- | --- |
| `conditional-result` | The existing analytical method already returned a value, with its own limitations. |
| `requires-native-execution` | The native measurement is planned and uniquely targeted, but has **not** executed yet. |
| `missing-facts` | A selected kind requires facts or a compatible native scene not supplied. |
| `invalid-input` | The selected known method rejected authored data. |
| `unavailable` | The selected method reported an unavailable result/scope. |
| `ambiguous-candidates` | The chosen analytical method found several branches; none is silently selected. |
| `numerically-indeterminate` | An uncertainty/singularity prevents a reliable result. |
| `unregistered-kind` | No exact registered quantity kind exists; **no replacement or near-name alias is guessed**. |

The registry is **derived from the existing live `problemWorkflowCapabilities().requestKinds`** (inverse, angular, mirror, native observables) rather than a second manually maintained list of optics formulas. `form-compatible` checks only the declared family and cannot establish fact completeness. A known kind, valid preflight, or completed simulation **does not prove** a faithful match to the source problem. Native measurements still require a successful, matching PhyDemo execution. An original unsupported question may admit a different mathematical reduction that **this classification has not evaluated**.

### How to inspect

```sh
node scripts/preflight-problem.mjs capabilities
node scripts/preflight-problem.mjs problem.json
node scripts/run-problem.mjs problem.json --out test-artifacts/llm-authoring/<fresh>
```

The zero-native preflight shows `methodSuitability`, existing results, target binding and preparation issues without writing output files or starting the native engine. The regular runner stores the *same* audit alongside SHA-256 input and final result evidence.

## Verification without inflated model scores

The fixed regression matrix includes 9 earlier reduced-inverse controls (conditional, ambiguous, incomplete and physically unavailable), 16 archival original-question **first attempts** (10 from milestone 27 plus 6 from milestone 29, 19 exact submitted requested quantities), and two **already exposed** native synthetic scenes. The original first attempts remain untouched. All 19 original descriptive kinds stay unregistered: a deterministic refusal from the requested envelope **does not** prove that each physical problem is unsolvable or that the author picked the best method.

This milestone adds *diagnostics*, not new optics primitives, inverse equations, source defaults, provider inference, or solution accuracy scores. No original image or Solutions access is needed by the acceptance runner. No upstream PhyDemo, native adapter, browser app, external API credentials or deployment is changed.
