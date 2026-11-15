# Native ray-lineage boundary qualification — test-only research

**Status:** unverified until supported Node 24.19.0 CI finishes; this is NOT a production lineage feature, general ray-history API, source-attributed detector measurement or independent Chat B review.

The experiment is based directly on production `main` `00e6211d6d40c0db8c62910f9e57b910b6aeb6f5`. It intentionally does **not** incorporate the disposable scripts/workflow from draft PR #79. Study PR #79 remains draft and unmerged. All trials are separately authored synthetic controls; the frozen six-task source-backed evaluation is untouched.

## Method

`run.mjs` uses the current checked-out `dist/test-core.cjs`, which `npm run setup && npm test` builds from the pinned native PhyDemo. The runner **never implements optics or prescribes ray paths**. It wraps individual native `onSimulationStart` and `onRayIncident` methods and delegates each exactly once. An actual emitted ray object gets a `WeakMap` identity token. Only genuinely returned `newRays` child objects inherit that directly observed parent's token and source label. The native simulator controls all propagation and truncation. Native array `rayIndex` is recorded as diagnostic context only, **never used as a semantic ray ID**.

Every scenario has three runs of its **unchanged document**: ordinary unwrapped native, instrumentation-only native, and existing public `evaluateDocument`. Native completion/stoppage, processed segments, truncation and undefined-behavior totals must agree between instrumented and uninstrumented executions. Actual instrumented detector callbacks must agree with the existing public crossing count if available. All outcomes, including negative tests, are retained as raw JSON.

## Case matrix

- Finite two-mirror multiple bounces; two independently emitted sources and real Fresnel children later received at separate detectors (positive controls from earlier feasibility work but independently authored here)
- A high-index-to-low-index planar boundary at five separate incidences: below TIR, above TIR, infinitesimally below/above the critical angle, and exactly critical. Numerical failures and near-grazing re-hits are **results**, not evidence to repair
- One weak-intensity Fresnel source and a separate two-interface Fresnel scene that can produce truncation
- Deliberate one-segment stop; larger two-source sampled scene with mismatched brightness saturation
- Intentional omission of one emission observer, to ensure missing provenance cannot be inferred from `rayIndex`
- Two coincident planar interfaces: required authoring refusal before calling the engine

A provisional positive classification means **only** `bounded-observed-in-this-test`. It requires a clean official native execution, matching instrumented totals, no truncation, no undefined events, no warnings/errors, no unknown or duplicate ray objects, and no bounded test-event-buffer overflow. Otherwise the record stays **withheld**, with reason codes. Missing callbacks, stopped runs, weak-branch truncation and critical-angle path anomalies cannot be promoted.

## Evidence and limitations

Supported CI writes a fresh ignored `test-artifacts/llm-authoring/native-lineage-boundaries-v1/report.json`, even if an assertion fails (as long as Node executes). GitHub uploads `native-lineage-boundaries-v1-evidence` with `if: always()`. A red CI or surprising result must be recorded; do not loosen physical thresholds or reauthor input without documenting a new test revision. The proposed study is same-assistant test-only feasibility, not an independent scientific certification. Browser races, surface merging beyond invalid coincident media, finite curved/glass vertices, and all arbitrary scene configurations remain unqualified.

**Exit gate:** Inspect the raw GitHub artifact and the remaining 11 CI workflows; record which cases genuinely passed, failed, or withheld. Only then draft any bounded production interface and obtain independent R2 Chat B review through `physicsvigilante/review_sandbox`. Do not merge the disposable workflow experiment into `main`.
