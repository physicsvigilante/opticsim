# Cross-family near-critical native ray reliability — research-only

**Status:** Evidence-generation experiment, **not production physics code, a new scene capability, a source-backed interpretation score, or a proposed numerical repair.** Base is owner-verified Opticsim `main` `fa158fc78da7a35b6a02eaed58c0cdbd4b699220`, Node 24.19.0, with **unchanged pinned PhyDemo** `811f508d2b070898c241a568b0c167dcb8645251`.

## Why now

The existing [numerical reliability report](../../docs/NUMERICAL-RAY-RELIABILITY.md) and [exact-line audit](../../docs/GRAZING-INTERSECTION-AUDIT.md) demonstrate a native near-critical self-rehit and truncation in a **two-planar-interface** scene. Those diagnostics neither establish that every finite glass shape has the same issue nor justify modifying upstream PhyDemo or making a blanket cutoff adjustment. The new question is whether **existing independently validated refractive families** behave physically and numerically near their critical boundary under the exact same index ratio and coordinate changes.

## Actual experiment

The test-only `run.mjs` constructs exactly **80 deliberately synthetic and fully specified physical inputs** by crossing:

- **Four already supported authoring families:** one half-plane planar interface (schema v5), one homogeneous triangular Glass (v8), one rectangular four-vertex Glass (v9), and one CircleGlass (v7). These remain **distinct existing scene schemas**. No new component or cross-family composition is introduced.
- **Five analytic incidence regimes** at an inside index of **1.6** and outside index **1.3**: `critical - 5°`, `critical - 0.001°`, exactly computed binary64 `asin(1.3/1.6)`, `critical + 0.001°`, `critical + 5°`. The computed critical angle has no claim to exact real-number representation.
- **Four transformations:** ordinary baseline, 0.1× uniform spatial scaling, uniform translation and 37° rigid rotation. The circular chords use physically specified impact parameters `R sin(theta)` to yield the intended local radial incidence; their source positions therefore change with incidence. Other families use a point source inside a finite region incident on a horizontal face, rotated/scaled together.

Each synthetic scene has **one** SingleRay with relative native brightness 1 and one explicit refractive component. `partialReflection:false` is a declared **transmitted-only approximation** (not the full Fresnel model); TIR remains an actual native outcome. All existing validator restrictions, ray budgets, index ranges, fixed radius/edge clearance and schema rules are used without relaxation.

For each validated input the probe executes **two genuine native simulations** using the same pinned core:

1. A separate read-only per-instance callback layer observes the existing original interface observer **without changing a single native ray, algorithm, return object, position or routing decision**. It retains up to 24 actual incident callbacks and their real JavaScript ray object references via run-local weak IDs. Counts beyond 24 are recorded but not fabricated.
2. The **ordinary canonical** `evaluateDocument` pipeline executes the exact untouched document separately. Status, processed segments, truncation, undefined behavior, emission meters, interface counts and first encounter must agree with the test-only run. No accepted values are stolen from an incomplete run.

An independent **scalar Snell/TIR** reference evaluates the *first actual boundary interaction*: expected incidence, low-index refracted angle when below critical, or no transmission when above. The far-from-critical `±5°` controls are acceptance checks. The near-critical and exactly computed angle cases report observed native outcomes and residuals **without assuming they should be stable or complete**. A fast second actual hit on the **same object** within 0.01 mm is a *diagnostic risk flag*, not by itself mathematical proof of an upstream bug; a separate independent exact-line reference would be needed for any source patch.

The entire authored input list is retained with its SHA-256, each native status, first event, bounded pre/post-incident ray coordinates, same-object proximity flags and explicit independent reference. The report is written **before** assertions that could fail. Invalid or incomplete runs are **evidence**, not success after changing their source parameters.

## Interpretation

Do not confuse **finished PhyDemo ray processing** with validity of critical-angle physical inference or an optically detected image. Native completion/truncation, numerical discrepancies, source interpretation fidelity, measurement applicability and teaching usefulness are separate dimensions. The trial involves no actual original question PNG, no Solutions files, no external model call, no textbook-answer grading and no teacher/student participants.

This research is intended to inform a later small project decision: whether the next improvement should be *only an explicit numerical-risk diagnostic / available-unavailable qualification*, a controlled upstream PhyDemo issue proposal that needs separate owner approval, or a new physical capability unrelated to near-critical behavior. **No automatic production fix is authorized by this study.**

## Run and retained evidence

After normal setup (on the **research branch**, not the released main):

```bash
npm run setup
npm test
node evaluation/cross-family-critical-native-v1/run.mjs
```

The script writes to a fresh, non-overwriting output directory `test-artifacts/llm-authoring/cross-family-critical-native-v1/`, or to a separate fresh path explicitly supplied under `test-artifacts/llm-authoring/`. It refuses a modified or incorrectly pinned vendored engine. The draft research PR temporarily adds a `unified-workflow.yml` step and uploads its raw evidence even on failure; this CI step is **disposable and should not be merged into production**. The PR intentionally remains draft/unmerged unless the owner explicitly changes its purpose.

A successful run means **80 scene preparations, 160 actual pinned-native executions, callback neutrality and the far-from-critical scalar controls** satisfied their declared checks. It does **not** mean that all 80 native rays completed or that exact-critical physics was numerically correct. Report any observed numerical noncompletion/disagreement by family and transform.
