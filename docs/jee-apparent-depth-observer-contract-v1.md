# Design D-01: JEE planar apparent depth and qualified observer geometry

**State:** PROPOSED REVISION R2 (after Chat B's R1 **CHANGES REQUESTED**), design-only, not implemented or released; new independent exact-source review required.
**Date:** 2026-11-18
**Starting point:** production `main` commit `d3509e82fb65d81aabe336666851f8f2962623f4`; independent of the held v14–v19 source lines.
**Motivation:** [#130](https://github.com/physicsvigilante/opticsim/issues/130) and the exact-source [independent research review of #131](https://github.com/physicsvigilante/review_sandbox/blob/main/projects/opticsim/pr-131/reviews/review-01-chat-b.md).

## Decision and terminology

**Propose two separately released capabilities.** The first candidate, **A**, is a reduced-facts, conditional *paraxial depth estimate*. It needs no native apparatus, can teach the standard JEE near-normal relation, and makes **no claim of an observed image**. The distinct future candidate, **B**, is an explicitly selected finite native detector-window *ray-pair backward intersection*. B is a geometric inference from two independently completed runs, **not** a physical image, eye, or guaranteed observation. This document fixes scope and test requirements; it does not approve either implementation.

Do not call a detector crossing an image, a virtual extension a native ray, a two-line intersection a unique image, or a detector segment a human eye. Use the terms **real object normal depth**, **conditional paraxial depth estimate**, **native detector hit**, **derived backward-line intersection**, **finite detector window**, and **not determined**. JEE answer-format completeness is secondary to accurate physical interpretation.

The research used one pinned PhyDemo `PlaneGlass` with complete full-Fresnel paths and actual opt-in detector-hit coordinates/directions. At real depth 120 mm, object-side index 1.5 and receiving-side index 1, the ±0.1°, ±1°, ±5° and ±30° *separate native-run* pairs back-intersect at 79.9998477, 79.9847646, 79.6163668 and 61.1010093 mm. The paraxial limit is 80 mm; nearby nonsymmetric oblique rays are nonconcurrent. **These are evidence for a conditional geometric model, not verified pupil vision or general stigmatic imaging.**

## A. First proposed releasable contract: conditional paraxial depth

### Explicit input (reduced facts, no saved scene and no native execution)

```json
{
  "format": "opticsim-planar-apparent-depth-facts-v1",
  "lengthUnit": "mm",
  "object": {"id": "O1", "normalDepth": 120},
  "media": {"objectIndex": 1.5, "observerIndex": 1},
  "viewing": {
    "model": "paraxial",
    "maxIncidentAngleDeg": 5
  }
}
```

**Allowed fields only.** `lengthUnit` is explicitly `mm`, `cm`, or `m`; all dimensional output uses millimetres. `normalDepth` is a strictly positive, finite **normal distance** to one ideal infinite plane, not source x, a global image coordinate, detector distance, slab thickness, or a ray length. Bounds are checked **after explicit unit conversion**; no implicit scene coordinate or position is created. Both positive, finite indices must be in the existing [1,4] interval. **Normative numerical domain:** converted normal depth must be in **[0.01, 10,000] mm**, and the paraxial estimate and any admitted symmetric-ray endpoints must be finite, strictly positive and at most **50,000 mm**. Depth below 0.01 mm (including subnormals), zero, overflow, or an output outside the bounded envelope is invalid-input or unavailable, never silently rounded to zero. `object.id` uses the existing stable-ID grammar, but is **not a native source ID**. `observerIndex` means the **receiving medium (conventionally observer side)** only; there is no observer position, eye or pupil input. `viewing.model` must explicitly equal `paraxial`. Its presence is the user's **assumed viewing regime**, never an inference from a diagram or a numerical ray count.

**Normative near-normal admission for A (first release):** `maxIncidentAngleDeg` is optional. If supplied, it is the user's stated maximum **object-medium** incidence angle to the normal. Admit only a finite **0° < i_max ≤ 5°** AND at most **1% relative separation** between the paraxial depth and the extreme symmetric-pair construction: `abs(d_s(i_max)-d_paraxial)/d_paraxial ≤ 0.01`. These are explicit **conservative educational model-admission choices**, not universal physical laws or certified error bounds. A 30° declared cone fails; an otherwise ≤5° cone with high index contrast can also fail the relative-discrepancy check. No automatic downgrade to a wide-angle diagnostic or invented viewing direction is permitted. The user can explicitly request a *separate future* finite-angle method, but A will withhold its entire numeric result when the declared cone is outside this first-draft regime.

If `i_max` is absent, the explicitly supplied `viewing.model:'paraxial'` assumption alone permits a **conditional** formula, but the result MUST state `symmetricAngleEnvelope:null` and that **no quantitative angular regime or finite-angle accuracy bound was established**. If an angle is provided, do not infer it from eye position or native source count: it is not an emitted ray, pupil size, observer location, or proof that native rays propagate. Compute transmission eligibility and the conditional symmetric limit only as part of the A scope check. With indices in [1,4] and `i_max≤5°`, `r sin(i_max)≤4sin(5°)<0.349` and `cos(i_max)≥cos(5°)>0.996`; admitted A cones are **uniformly separated from both critical and grazing incidence**, without reusing the research harness's `1e-6` heuristics or a guessed numerical Snell tolerance. If a submitted cone is at/above critical, near critical, grazing, or wider than 5°, refuse with a typed physical-scope code; do not evaluate a critical-tangent depth or assert an optical image. Enforce the 1% symmetric-construction discrepancy even below 5°. No endpoint is a native accuracy/observer uncertainty bound. Missing assumption, invalid index, zero/negative depth, unknown fields or impossible angles must be diagnosed distinctly, never repaired.

**Out of scope for A:** finite slab, curved face, image magnification, object height, finite pupil, off-axis apparent-point coordinates, exact oblique image locations, ray tracing, Fresnel throughput, source brightness, continuous illumination, visual accommodation, a guaranteed JEE textbook answer, and automatically promoting a problem's original stated facts to a physical scene. This contract does not admit an optical `scene.schemaVersion`; there is **no new v20** or migration of existing v1–v19 scenes.

### Mathematics and testable meaning

For `d>0`, `n_o = objectIndex`, `n_v = observerIndex`:

```text
r = n_o / n_v
d_paraxial = d / r = d * n_v / n_o
```

The model describes near-normal virtual *apparent depth measured perpendicular to the plane*, on the object side. It is not a native detector observation or a measured unique virtual image. For an explicitly declared finite object-side incidence angle `i` with transmission, a **different** conditional 2D construction using symmetric ±i rays yields:

```text
t = asin(r * sin(i))
d_symmetric_pair(i) = d * tan(i) / tan(t)
                    = d_paraxial * sqrt(1 - (r sin(i))^2) / cos(i)
```

Use the continuous limit at `i→0`; never divide two near-zero tangents in the implementation. For noncritical `0≤i≤i_max`, the expression is monotone in `sin²(i)`: `d_symmetric_pair²/d_paraxial² = (1-r² sin² i)/(1-sin² i)`. Thus, if a **safe declared `i_max`** exists, the two endpoint values give a *conditional symmetric-ray angle envelope*, not a native-error bar or a bound on arbitrary eye perception. If `r=1`, both depths equal `d`. If `r>1`, the finite-angle symmetric depth decreases; if `r<1`, it increases. No single depth represents all oblique rays: explicitly selected nonsymmetric triples generally fail concurrence.

Do **not** confuse `maxIncidentAngleDeg` with the observer-medium angle, and do not call the `i_max` envelope an estimate of solver numerical accuracy. A's conservative ≤5° restriction and [1,4] indices exclude near-critical and near-grazing `i_max` from *admitted* evaluations; near-critical/grazing requests are withheld, not extrapolated. Equality `n_o=n_v` uses the exact `d_s=d` branch to avoid unnecessary floating-point cancellation.

### Proposed result shape and evidence labels (not live API)

```json
{
  "format": "opticsim-planar-apparent-depth-result-v1",
  "kind": "paraxial-apparent-depth",
  "status": "conditional",
  "method": "conditional-analytical-paraxial",
  "value": {
    "realNormalDepthMm": 120,
    "estimatedNormalDepthMm": 80,
    "depthFactor": 0.6666666666666666,
    "symmetricAngleEnvelope": {
      "maxObjectIncidenceDeg": 5,
      "rangeMm": [79.6163668477505, 80],
      "maxDifferenceFromParaxialMm": 0.3836331522495
    }
  },
  "qualification": {
    "basis": "assumption-dependent",
    "warnings": [
      "Paraxial apparent depth is conditional; not a native image or an eye observation.",
      "The angle envelope describes a symmetric two-ray construction, not numerical uncertainty or arbitrary viewer position."
    ]
  },
  "native": {"status": "not-run", "observations": null},
  "nativeObservation": false,
  "nativeImageDetected": false,
  "interpretation": "not-assessed-by-engine",
  "questionSupport": "not-assessed-by-engine"
}
```

When no `maxIncidentAngleDeg` was given, `symmetricAngleEnvelope` must be `null` and the result must explicitly say **no quantitative finite-angle/model-validity bound was supplied**. The normative scalar status is **`conditional` in BOTH standalone calculation and problem result**, never unconditionally `available`: it means only that a declared approximation can be calculated, not that an image or observer was measured. Persist `method`, `assumptions`, `limitations`, `qualification`, `native.status:'not-run'`, non-native classification, and unverified original-question interpretation through the plan, preflight, saved report and any future UI; do not rely on clients preserving optional metadata to downgrade an unsafe `available` status. The `maxDifferenceFromParaxialMm` field is **strictly the separation between two stipulated conditional symmetric-ray constructions**, not a general depth error bar, pupil/viewer uncertainty, or certification.

**Refusal taxonomy follows the existing planner:** absent `physical`, missing required `viewing.model`, missing/omitted essential fields → `needs-information` / `MISSING_FACTS` (null value). Wrong primitive types, negative/zero or below-clearance depth, indices outside [1,4], invalid unit, unknown/extra JSON fields → `invalid-input` / `INVALID_FACTS` (null value). A correctly shaped but different viewing model, `i_max>5°`, cone above/near critical or grazing, >1% model discrepancy, or unsupported geometry → `unavailable` with precise `UNSUPPORTED_VIEWING_MODEL`, `OUTSIDE_PARAXIAL_DOMAIN`, `NONTRANSMITTING_CONE` or `PARAXIAL_CONSTRUCTION_DISCREPANCY` reason code (null value). A mathematically ill-conditioned intermediate or nonfinite output → `numerically-indeterminate` / `UNSTABLE_PARAXIAL_RESULT`, not a fabricated finite number. Unknown fields take invalid-input precedence over missing values. In all categories, **zero native calls** and no implicit scene; do not turn an out-of-regime cone into a plausible-looking scalar. No output may claim that an eye actually sees a unique point.

**Implementation location proposed, subject to separate source review:** pure `src/planar-apparent-depth-queries.js`, with exact-kind capability registration in `src/problem-workflow.js` using the **existing** `scripts/preflight-problem.mjs` and `scripts/run-problem.mjs` (no new standalone executable). The result format stays `opticsim-planar-apparent-depth-result-v1`; add no new v20 scene, native observation kind, machine-generated observer or catch-all natural-language method routing.

### Normative public problem request and dispatch integration — A only

```json
{
  "format": "opticsim-problem-v1",
  "physical": {
    "format": "opticsim-planar-apparent-depth-facts-v1",
    "lengthUnit": "mm",
    "object": {"id": "O1", "normalDepth": 120},
    "media": {"objectIndex": 1.5, "observerIndex": 1},
    "viewing": {"model": "paraxial", "maxIncidentAngleDeg": 5}
  },
  "requests": [{"id": "depth", "kind": "paraxial-apparent-depth"}],
  "verifyNative": false
}
```

**Exact registry contract:** `APPARENT_DEPTH_FACTS_FORMAT='opticsim-planar-apparent-depth-facts-v1'`, `APPARENT_DEPTH_QUERY_FORMAT='opticsim-planar-apparent-depth-query-v1'`, `APPARENT_DEPTH_RESULT_FORMAT='opticsim-planar-apparent-depth-result-v1'`, and single exact kind `'paraxial-apparent-depth'`. The query built by the dispatcher removes the request `id` and is `{"format":"opticsim-planar-apparent-depth-query-v1","kind":"paraxial-apparent-depth"}`. The request accepts **only `id` and `kind`**, no componentId, angle guess, scene body or target alias. The physical object accepts only the above reduced-facts shape. Expose it via `problemWorkflowCapabilities().requestKinds` with `route:'conditional-analytical'`, `contract:APPARENT_DEPTH_QUERY_FORMAT`, a `factContracts[APPARENT_DEPTH_QUERY_FORMAT]=[APPARENT_DEPTH_FACTS_FORMAT]` mapping, and a defensive `apparentDepth` capability description. Include this kind in the **existing max-four analytical calculations** limit. The pure solver performs strict request/facts validation; `planProblem` maps typed `MISSING_FACTS` → `needs-information`, malformed `INVALID_FACTS` → `invalid-input`, unsupported physical scope → `unavailable`, and tested numerical instability → `numerically-indeterminate`. Preserve reason codes, assumptions, limitations, qualification and `nativeObservation:false` when constructing `plan.calculations` and `plan.results`.

**Do not call `resolveProblemRequest` for `APPARENT_DEPTH_FACTS_FORMAT`**; leave `scene:null`, `preparation:null`, `targetBindings:[]`, `nativeRequests:[]`. A-only `verifyNative:false`/omitted requests have `native.required:false`, `canRun:false`, `calls:0`, report `native.status:'not-run'`. The method-suitability entry must identify a **form-compatible**, `conditional-result` known kind, *not* `native-ready` or an unregistered fallback. Existing `resultCoverage` may count `conditional` as coverage of an exact authored request; it **must not** be interpreted as native evidence or original JEE question accuracy.

**`verifyNative:true` on A-only reduced facts:** retains a conditional analytical result but requests native verification that the fact shape cannot supply; report `native.required:true`, `canRun:false`, `calls:0`, `native.status:'not-run'` with `NATIVE_SCENE_REQUIRED` reason, and **preflight.status:'blocked' / run-report.status:'blocked-native-verification' / run exitCode:2**. The `coverage` field may still say the separately authored *mathematical* request was calculated, but the overall report MUST NOT claim that requested native verification succeeded. This is a narrowly gated report-status rule for the new reduced A family, not a change to older fact-model results. Never fabricate a source, lens, detector, apparatus or qualified scene. A separately requested native observable is likewise blocked with a null result. Do not quietly mark the overall request fully verified.

**CLI/persistence:** `scripts/preflight-problem.mjs <input.json>` remains a zero-native/no-write preflight, returning `no-native-required` for valid A-only input. `scripts/run-problem.mjs <input.json> --out <fresh-directory>` uses `runProblemEvidence` and writes original `input` bytes, `plan.json`, `analytical-results.json`, and `report.json`, each tagged with the **raw input SHA-256** where currently supported. `plan.calculations[].query` records the exact typed A query and `result` with its `conditional` label and warnings; **no source-scene SHA-256 exists for reduced facts**. `nativeCalls:0`, `portable.status:'not-created'`, `native.status:'not-run'` and no `qualified-scene.json` or `native-evidence.json` may appear for an A-only run. An invalid physical form or unknown field is recorded as a refusal, never rewritten into valid JSON. `scripts/author-scene.mjs` is not a reduced-facts entry point and must not be used to manufacture a scene.

Re-use strict JSON validation, approved length-unit scale, stable-ID grammar and [1,4] native material-index limits, without adding an optical component or modifying existing code paths for older kinds. The first A implementation requires full Node24 native/browser **regressions only**, independent high-precision scalar checks and source review; a passing historical native/Chrome suite is not validation of the new A calculation. A separate owner release decision is still required.

## B. Later separately gated native detector-window construction

This part is **not** authorized by approval of A, by #131, or by this proposed document. Define it now to keep the design from accidentally treating the old test helper as a production observer model.

**Geometry:** one canonically authored v5 `point-source` with native `single-ray`, one native `planar-interface`, and one **finite `ray-detector`** wholly on the receiving side, far enough from the plane/source for the existing validation and endpoint clearances. Two *independent* source-direction runs must preserve the same source position, plane, indices, observer detector geometry, numerical controls and native pin, differing only in explicitly authored emission direction. Each must report exactly one source emission, one boundary interaction with unambiguous native transmitted branch, and one complete qualified detector hit; its measured direction must agree with native transmission. Full Fresnel remains the primary test. An explicit transmitted-only approximation is permissible only **with its original warning propagated**. Native crossings are selection evidence; the detector window is **not** an eyeball, retinal image or a proof both rays enter a common actual pupil.

To demonstrate a finite window, do not reuse the research fixture's 2,000 mm detector as a supposed pupil. New preregistered tests should position a physically specified short window on the receiving side so *both* selected native rays actually hit within its endpoints and clearance, including reverse/rotated controls, misses, and a window translated until one ray no longer qualifies. This is not automatically a human visibility result. A single native `detector-hit-events` list has neither source nor path ID; no callback-order pairing or reflection ancestry is to be invented.

**Provenance:** bind and freshly verify `(schemaVersion, canonical scene hash, native pin, source ID, interface ID, detector ID, emission direction, run invocation identity)` for *each* execution. The scene hashes of two intentionally different source-direction scenes will legitimately differ; admit **only** a narrowly verified equality of the complete apparatus and numerical policy after removing the one explicitly allowed direction field. Do not use titles/labels/ordering to match, recycle any stale execution, or treat two unrelated scenes as one experiment. Run-local identities are not global persistent ray IDs. Store two independently verified native-result statuses, warnings, emitted counts, first native interface evidence and exact measured hit coordinates/directions. Persist no fabricated native ray extension.

**Qualification lattice (review requirement P1-A):** native `suppressed` or incomplete always gives derived `suppressed` and `value:null`; an unavailable/missing/ambiguous input gives derived `unavailable`. After all geometric validity gates, if **any** accepted native input is `qualified`, the derived geometric result remains `qualified` with **every source warning and source-run association preserved**; only all genuinely `available` native evidence can produce geometrically `available` status. Even that value must retain `method:'derived-native-detector-line-intersection'` and an explicit **not a physical image** limitation. Do not map `qualified → available` or discard warnings through serialization/UI.

**Geometric result:** for native detector hit `p_k` and unit incoming direction `u_k`, solve `p_1+s_1 u_1 = p_2+s_2 u_2`. Require two distinguishable directions, a finite 2D solution, both `s_k<0` (true *backward* extensions), intersection on the source side of the plane, consistency with the authored source/medium orientation, detector-hit endpoint/residual validity, and exact native completion. This point is **derived geometry**, not a propagated ray. One native ray never suffices. If 3+ rays become supported in future, nonconcurrent pairwise lines must **not** be reduced to a unique image by unlabelled averaging; establish a separately reviewed definition of ray-bundle spread and result availability.

**Numerics (review P2-A):** two-line self-consistency residual is almost tautologically tiny and cannot certify correctness. Record `|u_1 × u_2|`, separation/condition number, extension distances relative to scene scale, coordinate magnitude and actual detector distances. Withhold ill-conditioned pairs, near-parallel **and** near-antiparallel configurations, huge extrapolations and invalid vectors. Do **not** promote the test's `1e-6` line-sine and `1e-6 mm` residual cutoffs into product policy. Before release, independently validate sensitivity under bounded perturbations to native *input coordinates/directions* and transformations, including large translated coordinates, grazing, near-critical outputs and equal/near-equal indices. Perturbation envelopes are **engineering sensitivity diagnostics**, not certified native error estimates. Choose and review explicit numerical validity and maximum-extrapolation budgets; label unavailable when not established.

**Hard scope refusals:** no beam/multi-source attribution, no branch pairing by callback order, no second interface or slab, no finite/curved glass, lenses, mirrors, blockers, aperture after refraction, arbitrary detector arrangement, continuous irradiance, wave effects, 3D, general eye/accommodation, calculated real image or arbitrary mixed apparatus. Do not depend on held v14–v19 features. If changing these limitations, preregister new native feasibility and obtain separate exact-source review.

## Verification matrix required before implementation is promoted

| Set | Required controls | Expected qualification or result |
| --- | --- | --- |
| A1 | 120 mm, 1.5→1, declared paraxial | 80 mm **conditional**, native **not-run** |
| A2 | With and without explicit 5° object-medium cone | Optional symmetric angle envelope; **no invented bound** if omitted |
| A3 | 1→1.5 and equal indices | Correct reversed/equal scaling, no presumed eye |
| A4 | mm/cm/m, extreme allowed depth/index, immutability | Same converted depth, strict validity |
| A5 | missing assumption/facts, bad/zero/below-0.01mm depth/index, unknown fields | `needs-information` vs `invalid-input` vs `unavailable`; zero native calls |
| A6 | cone >5° (including 30°), at/near critical or grazing, high index contrast <=5° but >1% discrepancy | `unavailable` with typed refusal, no scalar value or fake tolerance |
| A7 | exact `opticsim-problem-v1` kind/physical format and both existing CLIs, `verifyNative:true` | Conditional A with no native calls; explicit native verification blocked, existing contracts unchanged |
| A8 | scalar output above bound, equal indices, no cone, model-valid 5°; max-four kinds | Finite, conditional or typed refusal; `null` cone envelope when not supplied |
| B1 | two complete native rays actually inside same finite detector window | Derived **pairwise line point only** |
| B2 | move/shorten window, endpoints, TIR, real miss, incomplete native | Unavailable/suppressed, no fabricated intersection |
| B3 | full Fresnel vs explicit transmitted-only | Preserve each warning and `qualified` status |
| B4 | source/medium/detector mismatch, stale hash, branch ancestry | Refuse pairing before derivation |
| B5 | near-parallel, antiparallel, near-critical, very distant backintersection | Conservative numerical withholding |
| B6 | reverse/rotate/translate/unit reorder, and small perturbations | Condition/sensitivity evidence retained |
| B7 | 20°/21°/22° nonconcurrent native output | No unique image returned |
| B8 | capture ON/OFF | Native source, interface, detector counts and canonical scene unchanged |

## Gates and dependency policy

1. **This PR R2:** obtain a fresh independent exact-tree review of the corrected **design-only** source following Chat B R1's *CHANGES REQUESTED* verdict. The earlier R1 report stays immutable. Audit the newly fixed status, cone admission and dispatcher/CLI mapping, as well as the prior sign/geometry and B separation. No new optical code, API or CI assertion is claimed by merely merging a document.
2. **Next candidate A:** implement minimal standalone reduced-facts calculation on a fresh draft source branch, with exact-tree Node24 CI, model fidelity/refusal tests, and independent optics/code review. No effect on PhyDemo, saved historical scenes, old native observations or held v19 Beam.
3. **Next research B:** before any B production admission, preregister real finite-window native experiments and conditioning sensitivity on a separate test-only tree; obtain independent review. A and B must not be conflated in one release verdict.
4. **Release:** only a separate owner decision after integration rehearsal, exact-source checks and [main branch safety #123](https://github.com/physicsvigilante/opticsim/issues/123). No existing draft research or physics PR is auto-merged. [#129's downstream aperture correction](https://github.com/physicsvigilante/opticsim/pull/129) has a **separate** review/release gate.

**This design does not certify the original JEE corpus, a physical image, numerical native precision, an observer-eye model, or general composability.**
