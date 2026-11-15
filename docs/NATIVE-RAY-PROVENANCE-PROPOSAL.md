# Proposed opt-in native detector ray provenance (R2 design only)

**Status:** PRE-IMPLEMENTATION DESIGN FOR INDEPENDENT R2 CRITIQUE. No production API, code implementation, numerical requalification or new scene capability is included in this branch. A favorable design review **will not** constitute R2 approval of subsequent code. Source production baseline is Opticsim `main` at `00e6211d6d40c0db8c62910f9e57b910b6aeb6f5` (Node 24.19.0; pinned PhyDemo `811f508d2b070898c241a568b0c167dcb8645251`).

## Problem and existing evidence

Today `detector-crossings` and `detector-signed-power` measure actual native sampled callbacks but **cannot identify their originating source**. The opt-in `detector-hit-events` contains bounded positions/directions, **not ray identity or source attribution**. No detector reading is continuous irradiance or a detected optical image.

Evidence informing but **not proving** this design:

- [Research-only PR #79](https://github.com/physicsvigilante/opticsim/pull/79), corrected head `ab0285940878eb30625605754e7a90847d574286`: a pinned PhyDemo native ray object remained the same across four mirror interactions; two separate actual Fresnel `newRays` children retained their observed object identity up to distinct detectors. Separate frozen transfer trial still had **0/5** complete unfamiliar source-backed tasks.
- [Research-only PR #80](https://github.com/physicsvigilante/opticsim/pull/80), head `a40994a41f54ca45ac8fd8c3d7e6dcae17b736fb`: supported Node 24.19.0 [GitHub CI run 43729455968](https://github.com/physicsvigilante/opticsim/actions/runs/43729455968), **11/11 workflows passed**, 12 native test scenarios. Eight had narrowly observed identity with no run-invalidating condition. Four were withheld: two Fresnel truncations (`0.0002794032026852372` and `0.0035124410423037`), one stopped run, and one intentionally missing source observer (two untracked interactions). A thirteenth coincident-interface authoring attempt was refused before native execution. [Raw artifact 14166949457](https://github.com/physicsvigilante/opticsim/actions/runs/43729455968/artifacts/14166949457), GitHub artifact ZIP SHA-256 `539e6bf53e898a79d76337cbe6ed3d3a74e27c67d5b8d010958a9353d48a7837`.
- **Limit:** those experiments were created/run by Chat A. Tests and prior Node CI are not an independent physics audit, independent Chat B review, real-browser verification of a new feature, or a full critical-angle numerical certification. Exact-critical behavior completed **in one particular apparatus**; existing near-critical numerical path issues remain a separate concern.

## Decision to be reviewed

Introduce **one new explicitly requested detector observable**, rather than a general ray-history engine or new scene schema. It reports a minimal **direct ancestry graph for rays that really crossed one selected authored native detector** during a single qualified run. The graph is built only from observed object identity, actual source `onSimulationStart` returns and actual `onRayIncident` `newRays` returns. No geometric ray linking, rayIndex inference, path solving, source-to-image inference, or guessed branch is permitted.

### Proposed first-release physical scope

Only an **already supported v5 `planar-media-tracing` document** that contains:

- **One** `planar-interface`, using its existing native material indices/normal/`partialReflection`; no optics other than this single planar boundary.
- **One or two** already supported authored `point-source` components, each with explicit `single-ray` emission and stable source ID. (No sampled directional fans in v1.)
- **One or two** authored passive `ray-detector` segments wholly within their media, with existing geometry clearance and native endpoint restrictions. The observable targets exactly one detector ID.
- Existing strict geometry, sampling, depth, processed-ray limit, source clearance and run policies are unchanged. Unsupported optical arrangements are *unavailable*, not auto-converted or partially dropped.

This restriction targets an observed native Fresnel branch with a real detector, not a textbook-specific solver. The four-bounce mirror test supports feasibility but **does not** qualify v4 mirror/fan scenes in this first release. Multiple interfaces, curved/finite media, prisms, polygons, grazing/corner amalgamation, sampled beams, blockers, lenses and overlapping media remain out of scope pending their own native and R2 qualification. Near-critical cases must be qualified for **observed identity only**, never numerical ray-direction accuracy merely because a native run completed.

### Proposed request (not yet accepted by production)

The same `opticsim-observables-v1` request shape and quota are reused:

```json
{
  "id": "reflected-provenance",
  "kind": "detector-ray-provenance",
  "componentId": "ReflectedDetector"
}
```

This is **an opt-in companion observation**, not an apparatus command. No saved-scene version, physical authoring default, source provenance record or native object is changed.

### Proposed result value (conceptual example, NOT measured data)

```json
{
  "nodes": [
    {
      "token": "r1",
      "origin": "native-emission",
      "sourceId": "SunRay",
      "parentToken": null,
      "spawnComponentId": null
    },
    {
      "token": "r3",
      "origin": "native-spawn",
      "sourceId": "SunRay",
      "parentToken": "r1",
      "spawnComponentId": "AirWater"
    }
  ],
  "crossings": [
    { "rayToken": "r3" }
  ]
}
```

**Semantic rules** (intended normative requirements):

1. Each `token` is an ephemeral identifier for one **actual JavaScript native ray object within this one execution**. It is **not** PhyDemo's native path ID, a persistent ID, a timestamp, a ray-array index, or a key that can be compared across revisions/replays. Tokens share a namespace across requested detectors in the **same** native execution only.
2. `origin: native-emission` means that **that exact ray object** appeared in the real `newRays` returned by one observed authored source's real `onSimulationStart`. Its `sourceId` is the associated authored component ID. `parentToken: null` is valid **only** for such a directly observed emission. It **never means unknown**.
3. `origin: native-spawn` requires that **that exact distinct child object** appeared in a native `newRays` array returned by an actual observed incident on `spawnComponentId`, with the *same* observed parent ray object supplied to the callback. Its immediate `parentToken` and inherited `sourceId` are from that actual parent. No inference from order, normals, brightness, geometry, `rayIndex` or desired path.
4. Ray mutation in place (including ordinary transmission, mirror-like reflection or native TIR where no new child object appears) **does not create a new token**. A child is recorded only when the engine actually returns a distinct new object; its token need not equal an anticipated Fresnel branch type. A second-level parent is represented only if observed. Identical child/parent objects, duplicate emitted/spawned references or cyclic/ambiguous identities cause unavailability; they are not coerced into a graph.
5. `crossings` preserves **real selected detector callback order**. Each `rayToken` must resolve to exactly one node. Repeat crossings by the same object may repeat the token. The returned `nodes` are the complete *transitive observed ancestors of those selected detector crossings*, not every ray produced in the scene. No graph edge is added because a beam “ought” to have gone somewhere.
6. If native tracing completes with an unambiguous actual detector miss, the available value is `{"nodes":[],"crossings":[]}`. It means **no sampled native crossings at the selected detector in that run**, not no possible light/continuous shadow.
7. Neither output includes optical ray coordinates, a route event list, detector intensity, phase, path length, propagation time, ray index, detected image or source authenticity claim. `detector-hit-events` remains the separate positional observable. Two result arrays must **not** be joined by guessed ordering; pairing needs a separate, reviewed contract based on the *same callback*.
8. Source IDs are labels from the authored scene, **not certification that its interpretation of a textbook/source image was correct**. A raw native export cannot acquire a qualified authoring history from this observer.

### Fail-closed release gates

All checks apply to the requested result; default legacy readouts stay as before.

| Situation | Proposed requested-result state / machine reason | No invented fallback |
|---|---|---|
| No opt-in request | No observer capture and no additional public data; existing reports byte/shape compatible | Cannot retrofit provenance after the run |
| Unsupported scene, missing/wrong detector | `unavailable / UNSUPPORTED_PROVENANCE_SCOPE` | No scene repair, replacement, or partial attributed subset |
| Stale canonical hash, pending/failed/stopped/incomplete native, nonzero truncation or undefined behavior | `suppressed / NATIVE_INCOMPLETE_OR_STALE` | Withhold **all** nodes/crossings, including raw diagnostics |
| Complete native but warnings/errors relevant to identity/measurement or any native warning in v1 | `unavailable / NATIVE_PROVENANCE_UNQUALIFIED` | No partial graph promoted to complete |
| Any source observer absent, per-source emission counts disagree with native, unknown incident ray, absent direct parent, duplicate/cyclic identity, untracked detector ray, or detector callbacks disagree with ordinary crossings | `unavailable / PROVENANCE_UNKNOWN_OR_INCONSISTENT` | Never guess from `rayIndex` or intersect computed lines |
| More than **64 unique ray identities in the whole run**, more than **32 actual hits on the requested detector**, or any bounded graph closure cannot fit | `unavailable / PROVENANCE_LIMIT_EXCEEDED` | Withhold entire value, not the first N nodes/events |
| Fresh clean native with exact observed labels, complete selected callbacks, all bounds respected | `available` (or `qualified` for existing, explicitly declared transmitted-only approximation warnings) | Retain sampled-measurement and assumption limitations |

The exact reason-code wording is **proposed** and may be challenged before implementation, but *unavailable vs suppressed vs clean* must remain unambiguous. These are result-level reasons, **not** proof that the native ray trace was wrong. Missing callback is never represented as a root node with `parentToken:null`. Absolute irradiance and image claims stay prohibited.

**Buffer rule:** process native callbacks using bounded counters and weak identity references, never an unbounded public event history. If a cap is passed, mark requested provenance unavailable and continue native physical propagation without modification. The observer may retain at most the authorized event/token metadata; it must never silently stop instrumenting in a way that could fabricate completeness. The full native source and detector counts remain independently measurable. For the first single-interface/single-ray scope, a global 64-object cap is a conservative release limit; a reviewer should test whether source callback identity accounting stays complete even when the cap is exceeded.

## Proposed implementation boundaries (future, not included)

- Compose **per-instance read-only observers** with existing `observeSourceSet`, `observeInterfaceSet` and `observeDetectorSet` in `src/adapter.js`, preserving native callback input and result objects, **exactly one** original invocation and current native order. Instrument **all** authored sources and incident-capable optics/detectors in the supported scene, not solely the selected detector.
- Extend capture configuration in the existing public checker `skills/sim-ro-image-to-scene/scripts/check-scene.mjs`, `scripts/author-scene.mjs`, and optional native snapshot in `src/native-observations.js` **only when** `detector-ray-provenance` is requested. Preserve legacy no-opt-in report structure, all native physics, sample settings and PhyDemo pin.
- Add one strictly gated kind to `src/observables.js`, using its existing scene-hash and asynchronous execution guards. Keep accepted raw observations **out of diagnostics on incomplete/invalid runs**, even if internal callbacks accumulated before a stop. A stale old session callback may not update the current scene's provenance.
- If the existing qualified/browser viewer displays the new result, real-Chrome acceptance must show suppression, scene edits, export/reopen and cleared provenance on raw import. No custom ray overlay or path visualization in v1.
- Do not modify the underlying PhyDemo source, native refraction, numeric tolerances, max ray depth, source clipping/sampling, schema versions, legacy observable shapes, continuous illumination logic, model inference or textbook-answer scoring.

## Acceptance criteria and adversarial tests BEFORE a production merge

1. One fully specified air/water synthetic scene: transmitted primary and actual reflected child reach separate detectors; two source identities remain distinct; parent links match **actual native object references**, never rayIndex. Compare raw native unwrapped versus wrapped completed segments, truncation, undefined events, emitted counts, all detector counts/power and object callbacks.
2. No reflection variant: `partialReflection:false` yields no fictitious child; the native surviving primary retains one token; existing approximation caveat remains qualified.
3. High-to-low index TIR below/above/near/exact critical: compare independently calculated Snell/critical geometry where applicable; explicitly separate ancestry observation from numerical physical correctness. Never turn no transmitted branch into zero-angle.
4. Actual valid zero-hit detector; repeated callbacks (if natively possible within scope), a reversed detector orientation and finite endpoint ambiguity; no generic shadow or continuity claim.
5. Missing source callback both with and without any downstream interaction, missing/duplicate `newRays`, duplicate object and missing parent: inject **test-only observers**, never patch production native optics. Assert `unavailable` and no partial value even for apparently attributable selected crossings.
6. Fresnel weak-branch truncation, forced stop/limit, native undefined/error, source brightness/sampling warnings: request suppressed or unavailable as specified; legacy counts/qualified statuses must not be silently upgraded or corrupted.
7. 32/33 detector crossing boundary, 64/65 object boundary, two detectors where one exceeds its per-detector hit cap, and a graph with parent token outside retained closure: withhold correct subset and never clip/forge an otherwise “complete” graph.
8. Source/component ordering changes and test-only parent-child relationship counterexamples; run-level ephemeral tokens must not be treated as cross-run stable IDs.
9. Explicit opt-in vs absent opt-in: **legacy canonical source bytes**, source/detector readouts and default native summary shape match unchanged production `main`; old test fixtures/frozen first attempts and historical schema parse/round-trip remain unchanged.
10. Qualified scene physical edit, stale hash, delayed older browser/session callback, raw import and export/reopen. A prior accepted token graph cannot be relabeled current.
11. Real browser smoke/regression (if shown), focused native regression suites, all 11 full GitHub workflows on exact implementation head, plus a **new independent R2 Chat B review of the implementation head**, not a recycled design review.

Use full input/report SHA hashes, pinned toolchain version, native exact values, logged failures and comparator runs. Accepted output must never depend on an extra bespoke ray solver. Existing source-backed transfer performance and educational effectiveness are **not** changed by this feature.

## Explicit questions for the independent design reviewer

- Is **per-detector native ancestry**, with no general ray history, the smallest scientifically honest first feature? Would a simpler source-only observed label avoid meaningful risk, or would it lose necessary direct-child proof?
- Can a ray reference in `onSimulationStart` / `newRays` safely support the proposed distinction between *root*, *direct child* and *same-object in-place mutation* under the pinned native callbacks? Identify adversarial cases and code paths that could break it.
- Is requiring a complete native run, matching emission/detector counts and no unknown incident ray sufficient for the observed identity claim? What non-observable loss/branch cases should be withheld, and should near/exact critical-angle cases be out of the first release?
- Is the **64-object / 32-hit / one-interface / single-ray / ≤2-source** contract internally coherent and implementable without unbounded buffering or changing physics? Is the supported scene definition exact enough?
- Could composing this observer with existing `observeDetectorSet`/`observeInterfaceSet` silently change ray mutation order, first-event evidence or signed detector power? Demand one original delegation and negative/cross-observer tests.
- Does a complete `nodes` closure risk implying *observed full path* or spatial continuity? Propose unambiguous naming/limitations and the right reason-code semantics.
- What is the **smallest set of genuine new** pinned-native counterexamples and numerical references that implementation must pass before R2 code review?

The reviewer should write a **design-only** `pass / changes-requested / insufficient-evidence` with concrete counterexamples and unknowns; not claim to have reviewed nonexistent production code, sign off physics of arbitrary scenes, or merge anything.

## Release decision

**No code change authorized by this proposal alone.** After independent Chat B design critique is recorded in the central review hub, Chat A can triage findings. Any later implementation requires a separate owner milestone approval, its own exact-head CI/focused native/browser tests and R2 code review. This document is an option for future development, not a claim that source-backed original tasks have been solved.