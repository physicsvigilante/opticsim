# Milestone 32 — reuse one source-backed optical model

This is a bounded, **same-assistant developmental software qualification**, not a new physical solver, independent LLM authoring score, teacher study, or textbook answer benchmark. It exercises the existing versioned scenes, stable IDs, strict canonical validator, qualified hashes/history, native PhyDemo, passive observations and bounded parameter sweep.

## Pinned source and freeze

- Existing exposed fixture: `scenes/single-lens-detector.json`, blob `3dcdb0e8c01d1c950ee9bdbe2583b1892f6fc651`.
- Existing frozen minimal authoring plan: `evaluation/teaching-fidelity-v1/plan.json`, blob `17814c4b17134fa73f35ed153481b383a2576376`.
- This experiment's choices and teacher-intent metadata were frozen **before its CI execution**, in `plan.json`, blob `75ec9471d9107d4e6ee3408ac13269299d5e3a2c`. Every replay asserts these blobs and source geometry.
- The three-component baseline retains its source-backed physical fields and the prior numerical settings. The reused qualified baseline and full original interpreted input are saved, not modified. Results do not enter the authored inputs.

## Explicit scenario branches

| Investigation | Intended operation | Present engine boundary |
|---|---|---|
| Baseline | Trace source, ideal lens and original passive detector | Existing minimal authoring and native execution |
| Passive readouts | Add a second named source-emission readout, no physical edit | Existing observation selection |
| Lens focal length | Change 100 → 150 mm | Existing stable-ID `reviseScene` |
| Source geometry | Change source x from −300 → −400 mm | Existing stable-ID `reviseScene` |
| Numerical sample density | Change 1 → 0.25 | Clone canonical scene, validate and record a numerical edit |
| Structural branch | Add an explicitly specified passive detector at x=80 mm | **Evaluation-only canonical clone + validate**; the public targeted revision API cannot add components |
| Presentation | Change camera zoom only | Existing canonical presentation edit and qualification |
| Two negative proposals | Zero focal length; detector occupying lens plane | Reject each before native simulation |
| Focal sweep | Four separately validated sample values, including invalid zero | Existing immutable-baseline `runParameterSweep` |

All non-baseline choices are explicitly **teacher-authored hypotheticals**, not facts in the source fixture. A structural branch must not be called a successful *public* one-field authoring update: `reviseScene` only changes existing component fields. This experiment shows whether the existing compiled physics can handle the resulting valid arrangement. It does not add a general structural patch API.

## Verification and comparison contract

Each accepted branch is independently validated, executed with the pinned native engine, evaluated against the same requested observables, and exported as its own qualified package. Every branch is created from the original baseline, never from the preceding hypothetical. Preserve parent identity, source hash, scenario intent and the full physical/numerical/presentation edit history.

An independent scalar conjugate/height check verifies the *conditional ideal-lens prediction* when available. It does not call the production prediction routine; it also does **not** turn a predicted image position into native image detection or prove unfamiliar source interpretation. Native completion, zero truncation and distinct ray-detector readouts are verified separately.

Comparison is limited to the same named target, result type, method, unit, admitted physical model and accepted status. Native sampled comparisons require matching numerical policy. A valid zero is accepted; a missing new detector counterpart is not invented. The numerical-density scenario is *not* eligible for a direct physical-count or relative-power comparison. The native source brightness scale is checked, because clipping may be a numerical consequence of lower density. A conditional analytical image may still be compared across sampling settings as a model-equation result, not as a measured ray image.

An additional detector may collect another reading, but adding it is not the same as changing a source-given property. The sampled native detector count is not continuous flux; the signed power units are not watts. No result is compared to an answer key.

## How to run

After the normal repository setup and a pinned test-core build:

```sh
npm test
node evaluation/reusable-model-v1/run.mjs
```

Reports and qualified portable packages go into the fresh, ignored `test-artifacts/llm-authoring/reusable-model-v1/` directory. Reusing that directory must fail rather than overwrite evidence. `report.json` preserves the baseline/source hashes, actual native statuses, per-branch distinctions, comparison eligibility, negative controls and sweep samples. The workflow uploads this evidence separately from the original teaching pilot.

## Acceptance, non-goals and decision

Accept the **software experiment** only if every supported variant is revalidated and genuinely executed, negative variants never reach native tracing, all branch packages reimport with source provenance, the original baseline stays unchanged, the existing sweep retains its failed sample, and sampling-dependent quantities are not certified as physical effects. Preserve every failure and blocker without changing the pinned source or production optics.

Score five educational dimensions separately. Field matching to this exposed fixture is not an unfamiliar LLM interpretation result. Software/browser checks are not evidence of teacher/student learning; participants remain zero. No general structural-edit interface, arbitrary variable graph, new optics primitive, external model provider, simulation dynamics, or public deployment belongs in this milestone.

If the existing revisions/sweeps achieve meaningful reuse, **do not build a new scenario engine**. If the structural branch genuinely requires reauthoring or lower-level canonical editing, record it as an authoring-surface gap to be addressed only with a narrow, independently justified API. Teacher tasks would be the next source of educational evidence, not a retroactively inferred success score.
