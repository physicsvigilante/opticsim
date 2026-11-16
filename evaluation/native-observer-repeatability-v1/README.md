# Pinned-native repeatability with and without opt-in v9 numerical observation

**Research only.** This experiment follows the separately reviewed and merged [Stage-1 advisory PR #89](https://github.com/physicsvigilante/opticsim/pull/89). It does **not** change the native PhyDemo engine, source code under `src/`, optical laws, authoring schema, ray budget, precision, detector counts, user-visible diagnostics, trusted-measurement policy or any original textbook task. It neither authorizes nor tests an implemented **Stage-2 mandatory measurement gate**.

**Frozen base:** Opticsim `main` at merge commit `50dd0f4d9530d0a61bb4c7064c4326a8ac0ce518`, pinned PhyDemo `811f508d2b070898c241a568b0c167dcb8645251`, Node `24.19.0`. [PR #89's final native and browser release report](https://github.com/physicsvigilante/review_sandbox/blob/main/projects/opticsim/pr-89/MERGE-REPORT.md) is immutable and remains separately authoritative.

## Question and limits

The same fully authored near-critical v9 Glass scene has already shown **different interaction counts and native statuses across separate unchanged-input runs** (including 4, 5 and 6 interactions in different genuinely executed cases). Chat B's [independent R2 implementation review](https://github.com/physicsvigilante/review_sandbox/blob/main/projects/opticsim/pr-89/reviews/review-02-chat-b.md) specifically identified the absence of a *reviewer-controlled fixed-input repeated native comparison* as a residual empirical limitation.

This prospective investigation asks:

1. Are **ordinary native results** themselves variable between repeated runs of exactly the same source document, and is variability concentrated near the computed critical angle?
2. How do the distributions of terminal states, actual native Glass interactions, branch outcomes, processed segments, detector counts and relative power appear with the **opt-in advisory disabled** compared with it **enabled**?
3. Does the ordinary no-request path remain without the optional `finiteHitDiagnostic` field? Does the requested advisory remain **noncertifying**, not create a complete measurement on incomplete native runs, and not alter the authored physical document?
4. What changes, if any, appear between repeated runs **within one Node process** and runs in **fresh Node processes**?

**Crucial interpretation:** Two separate simulations do **not** contain identical native JavaScript ray objects or the "same ray execution", even with the same scene hash. An observed difference between disabled and enabled distributions does **not** prove the observer *caused* that difference: upstream process state, deterministic order, JIT optimization, numerical conditioning, interpreter history and other uncontrolled factors are possible. A lack of observed difference is likewise **not a proof of observer neutrality**. All raw observed evidence is retained without retuning angles or calling a result "correct" because it finished. No source/LLM interpretation fidelity, exact critical-limit branch identity, optical images or student outcomes are inferred.

## Fixed prospective input matrix

The script freezes **9 fully explicit synthetic v9 documents** with their complete native save JSON and SHA-256:

- Normal entry and exit through an existing convex Glass with one SingleRay plus one real detector.
- The same native family with **two sources and two passive detectors**.
- High-index (1.6) to lower-index (1.3) Glass: incidence `critical−5°`, `critical−0.001°`, computed binary64 `critical`, `critical+0.001°`, and `critical+5°`.
- The **computed critical** case in three unchanged fully specified geometries: base, spatial translation, and a rigid 37° rotation. The reported critical angle is computed with `asin(1.3/1.6)` and is **not** claimed to represent the exact real-number boundary.
- Native Fresnel reflections remain explicitly omitted in this **particular research matrix** through `partialReflection:false`, except the pre-existing normal control's original policy; native total internal reflection remains native. Prior genuine full-Fresnel acceptance of PR #89 is preserved separately and **not rebranded** as part of this experiment.

Each case receives this **predeclared** execution order:

- **16 runs in one Node process:** `off, on, on, off` repeated four times (ABBA), eight runs of each mode. Their full authoring document, physical source, indices, geometric transformation, brightness, numerical limits, ray depth and up-front deterministic scene hash are **unchanged** between runs.
- **4 runs in separate fresh Node processes:** `off, on` followed by `on, off` (2 of each), checking whether process/JIT/global-state history is relevant without assuming either mode is a control for the other.
- **Expected total: 9 × 20 = 180 actual pinned-native executions**, each independently retaining real terminal status and first actual native encounter. These are **not** 180 independent scene interpretations, independent optical experts, original exam questions or blinded model judgments.

Two far-from-critical (`critical±5°`) cases also receive independent **scalar first-event Snell/TIR** checks. The code will not silently label an incomplete native trace complete or replace a near-critical branch with a preferred analytical result. A failure retains the originally written synthetic input and the complete captured run report.

## Reproduction and raw evidence

On the **research-only draft branch**, after the normal pinned native setup:

```sh
npm run setup
npm test
node evaluation/native-observer-repeatability-v1/run.mjs
```

The script writes to a **fresh, non-overwriting** `test-artifacts/llm-authoring/native-observer-repeatability-v1/` output directory, containing `inputs.json` and `report.json`, including the run order, within/fresh process designation, complete scenes and hashes, genuine native statuses/counters/first events, optional advisory status/counters, separate-run native fingerprint distributions, elapsed wall times, real far-angle scalar references, original errors and exact code/pin context. It rejects a dirty or incorrectly pinned PhyDemo. Every failure is recorded and is not automatically retried with modified optics.

A temporary unified GitHub Actions workflow step is added to the **draft research PR only**. It uploads raw evidence with `if: always()` even when the probe fails. It **must not be merged into production as-is**, and its results should guide a separate decision about **future observer-evidence tests**, not a native-ray physics patch or automatic Stage-2 withholding.

**Success here means the fixed matrix actually ran, source identities/hashes and no-request boundaries were preserved, and the far-angle scalar controls passed.** It does **not** mean all 180 native traces were completed or any exact-critical branch was certified physically valid.
