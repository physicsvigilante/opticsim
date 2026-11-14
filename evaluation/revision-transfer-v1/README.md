# Milestone 34 — prospective cross-family revision transfer

The question is whether a compact, source-faithful revision can be expressed through the existing APIs across different optical families. It is **not** whether the simulator can reproduce an examination answer.

## Exposure and chronology

The two baselines are existing, exposed repository models: `general-two-source-lens.json` and `circular-dielectric.json`. Their complete source bytes are pinned. The eight textual investigation requests are new to this trial, but the same assistant authored the prompts, first decisions and later review. They are not a blind or independent model evaluation, and the baselines are not claimed to be unfamiliar to the model.

Prompts were frozen first at `0c111037b5a8d9b4a7604312432c393b256520f1`, blob `2d07fb32b0811668def5e43c7106826e479d653e`. First machine-readable decisions were frozen before execution at `e83cb9135fa8655c27e1e718c519a0604b5cbcf0`, blob `a0b6cdef3df367901105fb14f057a0498923972b`. Review constraints were written afterward. No optical answer key or expected native count is supplied to the authored patches. The frozen decisions must not be corrected after execution.

## Investigations

The requests cover a relative source displacement in cm, addition of a passive detector without fabricated source attribution, ambiguity about which source to rotate, removal of a named source without rebinding old readouts, an explicit inside-index change, adding a second external detector, deletion that would violate the retained physical family, and a missing numerical material value.

Each decision references a supplied baseline model handle and contains only the delta or a missing-information explanation. The evaluator resolves that handle to the exact verified source scene SHA mechanically. It does not infer geometry, material properties, target IDs or physics. Hypotheticals branch independently from the original model; they do not accumulate through previous attempts.

## Existing public interfaces only

Parameter changes use `reviseScene`. Structural changes use `prepareQualifiedStructure`, including recorded-lineage and stale-hash checks. Observables are selected separately through the existing qualified bundle interface. The canonical model family, pinned native compiler, numerical settings and presentation remain unchanged unless the original prompt explicitly requests otherwise. There are no production code changes in this milestone.

Valid candidates are independently executed through native PhyDemo, with exact input/result hashes and portable packages retained. Old requested targets that no longer exist remain unavailable. A request for missing information is **not submitted**, makes no native call, and is recorded as a provisional same-assistant judgment—not an engine refusal or an independently adjudicated correct response.

## Evidence dimensions and denominators

- Requested-change fidelity: compare the resulting complete scene with the post-freeze, same-assistant review constraints. This catches unintended changes even when the scene is valid and runnable.
- Physical/numerical evidence: record the real execution status, warnings, truncation and admitted model. Existing regression coverage is not a new independent physics oracle for every scene.
- Simulation coverage: report accepted/rejected structural proposals and unavailable readouts without replacing the physical task.
- Educational usefulness: not assessed; no teacher/student participants.
- Textbook-answer completeness: not requested.

Baseline runs, executed revisions, engine rejections and unexecuted missing-information decisions have separate denominators. Do not combine them as an overall success score. A passing CI replay means evidence was retained correctly, not that all original decisions were faithful or physically admissible. Inspect `report.json`.

## Reproduce and inspect

After normal setup:

```sh
npm test
node evaluation/revision-transfer-v1/run.mjs
```

Evidence is written only to a fresh ignored `test-artifacts/llm-authoring/revision-transfer-v1/` directory. It includes original source packages, frozen requests and decisions, per-case authoring/fidelity/execution records, and a summary. Reuse of an output directory fails. A runner infrastructure error preserves its partial record separately; it is not a repaired model answer.

This trial provides developmental transfer evidence for new requests on known supported systems. Genuine unfamiliar-source interpretation and independent-model reliability remain separate future evaluations. No external provider calls, public deployment, new physics, defaulted missing active inputs, or new canonical schema are involved.
