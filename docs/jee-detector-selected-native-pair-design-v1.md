# D-02 R2 — JEE finite detector-selected native evidence, staged B1a/B1b

**State:** REVISED PROPOSED CONTRACT; design-only, not implemented, independently re-reviewed, merged or released.
**Date:** 2026-11-18.
**Baseline:** actual production `main` `d3509e82fb65d81aabe336666851f8f2962623f4`. No held feature branches are dependencies.
**Review ancestry:** [Chat B PR #137 R1 — CHANGES REQUESTED](https://github.com/physicsvigilante/review_sandbox/blob/main/projects/opticsim/pr-137/reviews/review-01-chat-b.md); [PR #135 R2 — independently cleared RESEARCH ONLY](https://github.com/physicsvigilante/review_sandbox/blob/main/projects/opticsim/pr-135/reviews/review-02-chat-b.md); [design issue #136](https://github.com/physicsvigilante/opticsim/issues/136).

## 1. Product decision: B1a first, B1b separately gated

**B1a (first candidate for source implementation):** return native measurements from **two distinct, independently executed** single-ray configurations selected by the **same authored finite detector segment**. Output actual sampled detector crossing counts, hit positions and unit directions, native first-interface encounter and the full qualification/provenance for each separate execution. **Every public derived backward-intersection coordinate is WITHHELD/NULL**, including the already demonstrated 5 mm reference case. Geometry is not a released B1a measurement or result. No post-native line intersection is necessary to produce B1a.

**B1b (future, not authorized):** a separate, opt-in, numerically gated *2D mathematical backward-line intersection*. Before any public coordinate is released, preregister a native numeric conditioning/stress matrix, independently validate an admitted domain and error/sensitivity policy, revise the output contract and obtain an exact-source design and implementation review. Its position may be *advisory* but the word advisory **alone is not a numerical admission criterion**.

Neither B1a nor B1b simulates a human eye, pupil, accommodation, retina, camera, physical image, a unique stigmatic image, simultaneous passage of two rays into a literal observer, physical backward light propagation, continuous irradiance, wave optics or a 3D scene. Two independent native runs crossing one geometrically identical finite detector are two **independent sampled observations**, never proof of two simultaneous rays at one actual eye. The original JEE question's interpretation and textbook answer completeness remain unassessed.

### Established evidence (research only, not product calibration)

[#135 R2](https://github.com/physicsvigilante/review_sandbox/blob/main/projects/opticsim/pr-135/reviews/review-02-chat-b.md) independently reconstructed actual PhyDemo measurements: a real 5 mm detector at (40,0) mm, source (-120,0) mm and ±0.5° separate source directions produces native y hits ±1.5708611274685678 mm for 1.5→1, and ±1.396298846521404 mm for 1→1 or 1.5→1.5. Research-only backextensions give ≈79.996192 mm and 120 mm respectively. Shifted/shortened finite detectors generate actual sampled misses; full-Fresnel and transmitted-only qualification, reverse/rotation/units, TIR and incomplete cases were tested. **Research cutoffs (line sine 1e-4, endpoint clearance 0.05 mm, 10× extension) and hypothetical perturbations were never verified native accuracy bounds.** B1a must not publish even the research pair's derived 2D coordinate.

## 2. Normative strict input for B1a (proposed, not live)

The independent two-run workflow is explicitly authored as **one existing minimal v5 apparatus plus one additional absolute source direction**, not as two arbitrary scenes or user-supplied ray observations.

```json
{
  "format": "opticsim-detector-selected-pair-request-v1",
  "apparatus": {
    "lengthUnit": "mm",
    "title": "Single plane and real finite detector",
    "runPolicy": "preview-v1",
    "components": [
      {
        "id": "S1", "type": "point-source",
        "parameters": {"x": -120, "y": 0, "brightness": 1},
        "emission": {"mode": "single-ray", "directionDeg": -0.5}
      },
      {
        "id": "I1", "type": "planar-interface",
        "parameters": {
          "x": 0, "y": 0, "normalDeg": 0,
          "negativeIndex": 1.5, "positiveIndex": 1,
          "partialReflection": true
        }
      },
      {
        "id": "D1", "type": "ray-detector",
        "parameters": {"x": 40, "y": 0, "orientationDeg": 90, "length": 5}
      }
    ]
  },
  "sourceId": "S1",
  "interfaceId": "I1",
  "detectorId": "D1",
  "secondDirectionDeg": 0.5,
  "requestedResult": "native-finite-window-hits-only"
}
```

**All seven top-level keys are mandatory; extras rejected.** `format` and `requestedResult` are exact string literals above; identifiers must be uniquely present and refer to the named existing component of the correct type. `apparatus` accepts **only** `lengthUnit`, `title`, `runPolicy` and `components`; require explicit `runPolicy` `preview-v1` or `dense-v1`, and strict nested allowlists consistent with the *existing* `inspectAuthoringRequest`/ `prepareScene` implementation. Only three components: one explicitly ID-labelled single-ray point-source (brightness, coordinates and first `directionDeg` stated), one planar-interface (normal, two indices, **explicit Fresnel boolean**), one genuinely finite ray-detector (centre, tangent orientation and length). No aperture, mirror, lens, beam, extra source/detector/plane, circle, prism, blocker or other optical model. No inferred source, media, stop, pupil or numerical mode. No `components` defaults or automatically assigned IDs. `prepareScene` may still set *presentation-only* view or inactive source-emission controls; those are not new active physics.

**Bounded numeric scope (B1a only):** `lengthUnit` explicitly mm/cm/m, all checks on **canonical mm**; all positions/endpoints within current [-10000,10000] mm coordinate bounds; native index values [1,4] and source brightness [.01,1]; source and detector must lie in **strictly opposite half-planes** of the one authored interface, and source / both detector endpoints must be at least **1 mm** in absolute signed-normal separation from that plane. Detector full finite length **2 to 10 mm inclusive** (rather than advertise the brittle 1 mm edge case before stress tests); it must have physical orientation parallel to the plane tangent. Parallelism means the unoriented detector-tangent axis `orientationDeg` and `normalDeg+90°` agree modulo **180°**, with angular difference at most **1e-9°** solely for represented floating-point cardinal/rotated angles. This angular tolerance is a *preflight orientation comparison*, not a native positional error budget. The detector must not touch/cross the plane; signed distances of **both endpoints** must have the receiving-side sign. All existing stricter geometry and finite detector endpoint checks remain authoritative; equality exactly on an unsupported endpoint is never a usable hit.

**Oriented sides:** compute plane unit normal using the existing `interfaceNormal`, and signed side `s=(p-planeCentre)·normal` via `signedSide`; `s<0` means `negativeIndex` material, `s>0` means `positiveIndex`. The source's sign selects the object-medium index and the detector's opposite sign selects the receiving-medium index, even if plane normal is rotated or reversed. No fixed-global-x signs or guessed direction of view.

**Directions:** both first and second `directionDeg` must be finite numeric degrees in the existing native [-180,180] range. The second is an **absolute authored heading**. Compare directions modulo 360° in a canonical wrapped interval (−180°,180°]; `-180°` and `+180°` are therefore **identical** and refused. Require wrapped angular distance **>1e-9°** solely to exclude indistinguishable encoded headings; this is an *identity/representation guard*, not a claim that very close rays will be geometrically distinct or intersect robustly. Rays aimed away, tangent to a plane, totally internally reflected or missing the finite detector **may be executed as ordinary native negative controls**: if the scene is valid and no actual selected transmitted hit appears, B1a reports measured zero/empty and selection unavailable, never silently changes the heading. A source on the plane, detector crossing the plane or invalid endpoint geometry is rejected at preflight before native work.

**Strict JSON parsing:** limit original input to 1 MiB. Reject duplicate JSON object member names at **any** nesting level **before** ordinary `JSON.parse` can discard them, with a bounded parser/token validator; until that check exists, B1a cannot claim strict conflict-free source declarations. Reject JSON malformed syntax, duplicate IDs, extra fields, NaN/nonfinite typed input (where representable) and any ambiguous string-valued numeric expression. Missing explicitly required fields => `needs-information` rather than guessed values. Wrong value types, forbidden fields and conflicting duplicate keys => `invalid-input`. A valid but unsupported optical family/geometry => `unavailable` / `UNSUPPORTED_B1A_SCOPE` with zero native calls. Do not call `prepareScene` to repair invalid input.

## 3. Required immutable scene-family and execution identity

1. Validate and snapshot **raw input bytes and SHA-256** before asynchronous work; first prepare one canonical complete **v5** document A with existing `prepareScene`. Demand `schemaVersion=adapterVersion=5`, `physics.model='planar-media-tracing'`, current pinned `upstreamCommit`, three authored component IDs/types and the preflight geometry above. No v20 migration or carried features from held branches.
2. Clone A to B and modify **only** the named source's `emission.directionDeg`, assigning the explicitly authored second heading. Validate B with existing native `validate`. Other canonical fields, including presentation defaults, sampling, run policy and native pin, remain unchanged. Never modify A or a caller's object. The different directions produce **distinct scene SHA-256s** under `sceneHash`/ `serializeSave`; reject equal hashes.
3. Mandatory **family identity**, not optional: before either native execution compute `familyKeyA` and `familyKeyB`. For each **complete validated document** (format, schemaVersion, adapterVersion, upstreamCommit, all physics, presentation and simulation), deep-clone, sort `physics.components` by unique ID using a deterministic lexical order, and remove **only** `emission.directionDeg` on the exact source ID. Do not normalize, round, delete or forgive any other physical, numerical, material, detector, presentation or source field. Compute the stable `canonicalJSON` representation and `SHA256` hash of that representation. Require exact canonical representations **and** family hashes equal. Include the family hash and each distinct full-scene SHA in the saved plan/report. A hash protects identity consistency; it is not a physics truth certificate.
4. Bind each run role (`run-A`, `run-B`), authored heading, immutable canonical scene bytes+SHA, input SHA, family hash, schema, native pin and its own **invocation-local execution snapshot**. For each run, independently verify `evaluateDocument` returned matching `summary.canonicalSha256` and expected native pin; `evaluateObservables` snapshots the corresponding document/summary and re-hashes. Never reuse the first result for the second, swap the run roles or infer a globally stable ray ID. Run-local parentage tokens, if separately captured, are **never cross-run ray identifiers**.
5. **Both execution records are mandatory for a completed two-run report.** Read out both separately (not zip native callbacks by array index). A retained failure or miss must preserve raw native warnings, readout warnings/reasons and scene associations from **every attempted** run, without inventing data for unattempted runs. Preflight error has **zero attempts and zero fabricated run evidence**.
6. For B1a request the following **four already-supported native observables for each scene**: `source-emissions` (source ID), `interface-first-event` (plane ID), `detector-crossings` (detector ID), and `detector-hit-events` (same detector ID). Keep an independently labelled status, value, method, reasonCode, reason and **warning list** for **each observable**, not one global inputReadoutStatus. Opt-in hit capture remains read-only; no native onRayIncident changes.

An actual selected transmitted hit requires exactly one observed source emission, exactly one first-interface encounter, a first-event `outcome:'transmission'`, incident/destination index values compatible with the oriented source/detector media, exactly **one** native transmitted branch and a native detector crossing count **1** with exactly one complete hit event. The detector hit's incoming unit direction must agree with native transmitted branch direction under an explicitly checked finite direction consistency tolerance. Any actual reflected Fresnel branch stays its own native event; a hit cannot be assigned to it or paired by callback order. The run's detector hit must be within the real authored finite segment and must not be tagged ambiguous/endpoint in the existing native hit-event contract. The bounded one-source/one-emission/one-interface/one-hit arrangement is the basis of this limited inference; no multi-source lineage or whole-path ledger is asserted.

## 4. B1a result state machine and versioned output

**B1a never publishes a derived intersection.** For **all** responses (including fully selected rays), include `geometry:{status:'withheld',value:null,reasonCode:'B1B_NUMERICAL_GATE_NOT_RELEASED'}` unless an earlier native selection/refusal makes a more specific null code appropriate. No `pointMm`, `normalDepthMm`, image coordinate, virtual ray extension or mathematical depth may appear in a B1a **public** result. A debug-only numerical scratch artifact, if ever used for later research, must be excluded from public report/manifest and clearly labelled test-only.

### Individual native run record (normative, proposed)

Each attempted run entry includes: `role` (`run-A` / `run-B`), original input SHA, scene SHA, family SHA, authored directionDeg, schemaVersion, upstream native pin, `attempted:true`, native `status`, `executionPassed`, `truncation`, `undefinedBehavior`, `rawNativeWarnings[]`, `rawNativeErrors[]`, plus an array `observableResults[4]`. Each observable record retains `id`, `kind`, `componentId`, actual `status`, `value` (including **measured zero** or **empty hit list**), `method`, `warnings[]`, `reasonCode` and `reason`. Actual native hit point, incoming unit vector and distance from segment P1 appear *only* inside the `detector-hit-events` observable's value. Do not turn an unavailable hit-event list into an empty list. An unattempted run has **no** execution/hit record (but may have a planned scene in the plan).

**Per-run qualification reduction (after fresh hash, native completion and scope verification):**
- `available` only when **all four required** native observables are `available`, native completion and actual transmission/hit count/branch checks passed, with no disqualifying warning.
- `qualified` if all four are individually `available` or `qualified` and **at least one** is `qualified`, with a known explicit transmitted-only `partialReflection:false` approximation; carry **every** source warning and per-observable caveat. No `qualified→available` promotion.
- `unavailable` when a native run completed but a source ray missed the interface, TIR/no transmitted branch occurred, finite detector actually missed (crossing count 0, hit list []), ambiguous endpoint prevented hit-event capture, event count inconsistent, or a required observable was unavailable. Preserve measured native counts/empty lists from completed runs; never convert these to an image, continuous darkness or a zero intersection.
- `suppressed` when native run was incomplete/stale, truncated/undefined, lacked qualified capture, or carried an unreviewed native warning. Keep whatever *real* native summary/errors/warnings exist but withhold unreliable requested hits. Native warning policy is fail-closed: deliberate Fresnel-off caveat may qualify, **unrecognized runtime warnings cannot authorize selection**.
- `infrastructure-error` when native setup/executor failed before trustworthy results. No pretend native result, no fallback calculation.

**Two-run selection aggregate:** `nativeSelection.status` is `available` if both run records are individually available; `qualified` if both eligible and any qualifies; `suppressed` if either is suppressed; otherwise `unavailable` (including one/multiple completed misses). On infrastructure error report `infrastructure-error` with actual attempt count, not a success. The only positive top-level state is `native-hits-reported` and means **sampled native detector evidence only**, NOT a derived point. For invalid/missing/unsupported preflight use `invalid-input`, `needs-information`, `unavailable` respectively with `nativeAttempted:0`. A completed-window miss gives top-level `native-selection-unavailable` with retained `0`/[] actual readings and `geometry.value:null`; incomplete/stale gives `native-suppressed`; setup failure gives `infrastructure-error`.

**Explicit execution counts:** `attemptedExecutions` increments only when an actual native executor attempt begins, `completedExecutions` counts only genuinely completed native executions. Invalid preflight = 0/0 and no run results; first run fails before second begins = 1 attempted, 0 completed (or 1 completed if first completed and second failed to start, with 2 attempted if invocation began). Never report `executions:2` unless two native attempts occurred, and never `completedExecutions:2` without two verified complete native runs. A run that never began must not have an execution summary.

**Illustrative shape — sample only, NOT an executed B1a implementation:**

```json
{
  "format": "opticsim-detector-selected-pair-report-v1",
  "status": "native-hits-reported",
  "inputSha256": "<original-request-sha256>",
  "nativeAttempted": 2,
  "nativeCompleted": 2,
  "nativeSelection": {"status": "available", "reasonCode": null},
  "runs": [
    {
      "role": "run-A", "sceneSha256": "<sha-A>", "familySha256": "<same-family-sha>",
      "authoredDirectionDeg": -0.5, "nativePin": "<upstream-sha>",
      "nativeStatus": "completed", "executionPassed": true,
      "rawNativeWarnings": [],
      "observableResults": [
        {"kind": "source-emissions", "status": "available", "value": 1, "warnings": []},
        {"kind": "interface-first-event", "status": "available", "value": {"outcome": "transmission"}, "warnings": []},
        {"kind": "detector-crossings", "status": "available", "value": 1, "warnings": []},
        {"kind": "detector-hit-events", "status": "available", "value": [{"pointMm": {"x": 40, "y": -1.5708611274685678}}], "warnings": []}
      ]
    },
    {
      "role": "run-B", "sceneSha256": "<sha-B>", "familySha256": "<same-family-sha>",
      "authoredDirectionDeg": 0.5, "nativePin": "<upstream-sha>",
      "nativeStatus": "completed", "executionPassed": true,
      "rawNativeWarnings": [],
      "observableResults": [
        {"kind": "source-emissions", "status": "available", "value": 1, "warnings": []},
        {"kind": "interface-first-event", "status": "available", "value": {"outcome": "transmission"}, "warnings": []},
        {"kind": "detector-crossings", "status": "available", "value": 1, "warnings": []},
        {"kind": "detector-hit-events", "status": "available", "value": [{"pointMm": {"x": 40, "y": 1.5708611274685678}}], "warnings": []}
      ]
    }
  ],
  "geometry": {"status": "withheld", "value": null, "reasonCode": "B1B_NUMERICAL_GATE_NOT_RELEASED"},
  "observerAssessment": "not-assessed",
  "imageAssessment": "not-assessed",
  "questionSupport": "not-assessed-by-engine"
}
```

**The illustrative records above are intentionally abbreviated:** an implementation MUST preserve the complete native first-event branches/directions, full hit unit vector and distanceFromP1, all four `id/componentId/method/reason` fields and run counters/normalization keys specified in the normative paragraphs. They are NOT permission to truncate native evidence or claim a computed image. Do not use booleans `nativeImageDetected:false` or `physicalImage:false` as if a physical absence had been observed. Neither visual image existence nor eye vision was tested.

## 5. B1a CLI, output artifacts, interruption and historical safety

Proposed standalone command: `node scripts/detector-selected-pair.mjs <request.json> --out test-artifacts/llm-authoring/<fresh-directory>`. It must remain separate from the byte-frozen `scripts/run-problem.mjs`, `scripts/author-scene.mjs` and the one-native-run `opticsim-problem-v1` dispatcher. No new saved `scene.schemaVersion`, v20 migration or alteration to pinned PhyDemo, native callbacks or old tests.

Reuse existing fresh-only guarded `reserveAuthoringOutput` (ordinary no-clobber/symlink defence, **not a hostile concurrent filesystem sandbox**). Files are exclusively written without overwrite and fully hash/integrity linked. Proposed versioned evidence manifest **`opticsim-detector-selected-pair-manifest-v1`** with: raw `input.json` and its exact SHA; validated `plan.json` including normalized family SHA, intended run roles/directions and explicit refusal decisions; `scene-A.ray-optics-2d.json` and `scene-B.ray-optics-2d.json` with each canonical byte SHA; one `native-A.json` or `native-B.json` **only when that invocation truly produced a native execution summary**; each actual run's readout status/position/direction/first-event branch and raw warnings; a final `report.json` with truthful attempt/completion counters and a **null geometry**; and a last-written `manifest.json` only for a completed, internally hash-consistent attempt. Every listed path has its own SHA-256 of the exact saved bytes. Invalid input may persist only raw input and a rejection report, **without invented scenes or native results**.

Persist plan and two validated scenes **before** attempting native execution; persist each run's real result immediately after it completes, then perform reduction when both snapshots are available. If B fails to start or is interrupted, preserve genuine completed A evidence and record actual attempted/completed counts and explicit `infrastructure-error`/partial state where possible. A hard process crash can leave a partial directory without final manifest; **absence of valid finalized manifest means the attempt is NOT a successful result**, and it may not be resumed by silently pairing stale files. A deliberately malformed or edited manifest/file is rejected on reload. Do not fabricate a second result to force a complete report. An API setup failure and a physically completed detector miss are never conflated.

## 6. B1b — separately reviewed numerical/physical feasibility gate

**No B1a public geometric coordinate.** After native-hit-only design/source review, separately preregister a test-only B1b numerical feasibility matrix **before** its runs. Required independent controls: n=1→1, 1.5→1, 1→1.5, 4→1 and near-equal indices; source-side reversals; normals 0,±90,±180,±37; mm/cm/m, component ordering, translations up to disclosed limits, detector widths 2/5/10 mm plus boundary-1 mm negative controls; axial and source distances, object near the plane, near-edge hits; different ray separation and near-(anti)parallel; TIR, near-critical/grazing, Fresnel true/false, truncated/undefined/warning runs, stale capture and native miss. Preserve all native hit positions/directions, hashes and warnings and compare post-execution Snell geometric reference only as an **oracle** (not a source of native rays).

The separate B1b model must **first** specify an exact local plane-normal/tangent coordinate algorithm, signed backward parameters (both strictly negative for an inferred backward intersection), finite vector norms, `|u1×u2|` with near-antiparallel handling, actual both-endpoint margins, a reproducible dimensionless scene scale derived from physical source/plane/detector distances, finite extension ratio, large-coordinate cancellation and roundoff sensitivity. It must preregister an admitted envelope, allowable invariance residuals and independently reviewed numerical withholding criteria **from actual evidence**, not copy an unexplained threshold. Native precision/uncertainty cannot be inferred from tiny algebraic line residuals or hypothetical perturbation alone. The previously proposed `0.01`, `0.5 mm` and `2×` display cutoffs are **withdrawn as B1a admissibility rules** and remain at most unverified candidates for B1b investigation. A broad requested source/detector/window domain must be narrowed until reliable. No arbitrary two-ray intersection is a unique eye image.

Only after independent numerical **feasibility and design review** may B1b add `geometry.status:'advisory'` with coordinates under a separate versioned opt-in contract and its own exact-source code review. If stable numeric bounds cannot be demonstrated, keep B1a native-hit-only and withhold B1b coordinates indefinitely.

## 7. Acceptance matrix and release sequence

| Test | B1a expected public behavior |
| --- | --- |
| Actual v5 5 mm, n=1.5→1, ±0.5°, two distinct native runs | Two sampled hits with full positions/directions/first-event data; geometry withheld/null |
| Actual equal n=1→1 or 1.5→1.5 | Native transmitted continuation, two real finite hits; NO 120 mm public derived location |
| Shift, shorten, move detector, source aimed away, TIR | Completed actual count 0 or [], `nativeSelection.unavailable`, null geometry, no inferred darkness |
| Fresnel true/false | Native `available` or `qualified` only as warranted, all warnings per run, null geometry |
| Native invalid/incomplete/warnings/stale/capture missing | `suppressed` or `unavailable`, no invented hit; raw executed warnings and roles retained |
| Missing/wrong IDs, mismatched sources, duplicate modulo-360° headings, extra optics | Typed preflight refusal, zero native attempts and null geometry |
| Reverse normals/source side, translation/units, component order | Same native physical checks, correct index/sign interpretation and distinct scene/family identity |
| Endpoint ambiguity, source/plane tangency, nearly identical directions | Explicit refusal or measured miss; no arbitrary geometric point |
| Async input mutation, scene/summary tamper, swapped/duplicate runs | Snapshot/hash/family validation fails closed; never reuses run identity |
| Preflight invalid, native setup error, second-run failure, hard crash | True 0/1/2 attempt/completion counts, partial files only if real; no forged finalized manifest |
| Existing CLI freeze, historical versions, Node24/Chrome | Original files/behavior byte-identical; all existing regressions pass |
| Original JEE question fidelity, observer/image interpretation | Not assessed; no physical image/eye/continuous irradiance assertion |

**Gates (none automatic):** this R2 **design-only** PR requires fresh independent exact-source review; B1a implementation would then require a *separate main-based draft source PR*, actual two-run native positive/negative tests, Node24/native/Chrome CI, raw evidence validation and independent source/physics review. A future B1b requires its own preregistered numerical feasibility, design and implementation reviews. All PRs remain draft/unmerged pending explicit owner decision and [main protection #123](https://github.com/physicsvigilante/opticsim/issues/123). Held #129 aperture safety and #133 candidate A remain unrelated dependencies. No completion of a B1a gate is a release of B1b or an observer/image engine.
