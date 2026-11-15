# Proposed opt-in native detector ray provenance (R2 design only)

**Status:** REVISED PRE-IMPLEMENTATION DESIGN (v2, responding to Chat B review-01 `changes-requested` on immutable v1 head `df783a3c2f5e51ad5edbacd35f6d82f1a02cfea7`); **targeted independent re-review pending**. No implementation is authorized by this design-only revision. No production API, code implementation, numerical requalification or new scene capability is included in this branch. A favorable design review **will not** constitute R2 approval of subsequent code. Source production baseline is Opticsim `main` at `00e6211d6d40c0db8c62910f9e57b910b6aeb6f5` (Node 24.19.0; pinned PhyDemo `811f508d2b070898c241a568b0c167dcb8645251`).

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
- **Zero other component types.** Exactly one planar interface, 1–2 authored explicit single-ray point sources and 1–2 passive ray detectors are the entire allowed component list; their order remains freely authored. Multiple separate `detector-ray-provenance` requests may target either or both accepted detectors in the same execution, sharing one run-local token registry.
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

**Semantic rules** (normative for any future implementation):

1. Each `token` is an ephemeral identifier for one **actual JavaScript native ray object within this one execution**. It is **not** PhyDemo's native path ID, a persistent ID, a timestamp, a ray-array index, or a key that can be compared across revisions/replays. Tokens share one namespace across all selected detectors in the **same** native execution only. An independent run instance/epoch is mandatory internally, even if a later scene has the same SHA after an A → B → A edit; external token strings can repeat but are never cross-run referents.
2. `origin: native-emission` means that **that exact ray object** appeared in the real `newRays` returned by one observed authored source's real `onSimulationStart`. Its `sourceId` is the associated authored component ID. `parentToken: null` is valid **only** for such a directly observed emission. It **never means unknown**.
3. `origin: native-spawn` requires that **that exact distinct child object** appeared in a native `newRays` array returned by an actual observed incident on `spawnComponentId`, with the *same* observed parent ray object supplied to the callback. Its immediate `parentToken` and inherited `sourceId` are from that actual parent. No inference from order, normals, brightness, geometry, `rayIndex` or desired path.
4. Ray mutation in place (including ordinary transmission, mirror-like reflection or native TIR where no new child object appears) **does not create a new token**. A child is recorded only when the engine actually returns a distinct new object; its token need not equal an anticipated Fresnel branch type. A second-level parent is represented only if observed. Identical child/parent objects, duplicate emitted/spawned references or cyclic/ambiguous identities cause unavailability; they are not coerced into a graph.
5. `crossings` preserves **real selected detector callback order**. Each `rayToken` must resolve to exactly one node. Repeat crossings by the same object may repeat the token. The returned `nodes` are the complete *transitive observed ancestors of those selected detector crossings*, not every ray produced in the scene. No graph edge is added because a beam “ought” to have gone somewhere.
6. Only **after positive evidence that every required source started once and returned exactly one uniquely registered native ray**, and after every other full-run/result qualification gate, may a clean actual detector miss produce `{"nodes":[],"crossings":[]}`. An apparently clean no-hit run with a missed, malformed or unrecorded source start is `unavailable`, never an available empty graph. The valid empty value means **no sampled native crossings at that detector in this run**, not no possible light/continuous shadow.
7. Neither output includes optical ray coordinates, a route event list, detector intensity, phase, path length, propagation time, ray index, detected image or source authenticity claim. `detector-hit-events` remains the separate positional observable. Two result arrays must **not** be joined by guessed ordering; pairing needs a separate, reviewed contract based on the *same callback*.
8. Source IDs are labels from the authored scene, **not certification that its interpretation of a textbook/source image was correct**. A raw native export cannot acquire a qualified authoring history from this observer.

### Mandatory all-source registration and run-epoch invariants (Chat B F-01/F-03)

- **Before** calling the simulator, enumerate every source from the exact validated document and its native `idMap`; install **one** per-instance source registration/observer per authored native source. The expected set must exactly equal the installed observer registry. A missing observer, extra observer, duplicate native mapping or source start that is not captured fails the requested provenance result, regardless of any detector hits.
- In this v5 **SingleRay** scope each required native `onSimulationStart` must be invoked **exactly once** in the current run and return an actual `newRays` array of **exactly one** distinct, non-null, valid ray object. Associate its identity with that specific stable authored source ID **before** the run can be deemed eligible for provenance. Zero starts, two starts, malformed/zero/multiple `newRays`, reused source objects or failure to insert the returned object into the run-local registry are `PROVENANCE_UNKNOWN_OR_INCONSISTENT`—not a legitimate emitted-zero, absent-ray or detector miss.
- A per-run ledger checks source-ID coverage, start invocation counts, actual `newRays` references and successful `WeakMap` registration; it must **not** use the current `observeSourceSet` sum of its own `meter.emitted` readings as independent emission corroboration. Existing source counters remain cross-checked against this separate identity ledger and any independently available simulator enqueue counters, but **do not claim independent enqueue evidence if the engine exposes none**.
- At terminal completion, demand full source coverage **before** checking a zero crossing count or returning the empty graph. If source observation is intentionally disabled in a negative control and the native ray misses every component, the start/registry coverage mismatch must still withhold provenance; relying solely on unknown downstream incident rays is forbidden.
- A run instance/epoch identifier, distinct from the canonical scene SHA and private to the execution/session, fences every observer ledger, result and asynchronous publication. A new run starts with a new registry and a new epoch **even if its scene hash matches an earlier run**. A → B → A with delayed first-A callback must never republish first-A provenance into the fresh A run.

### Fail-closed release gates

All checks apply to the requested result; default legacy readouts stay as before.

| Situation | Proposed requested-result state / machine reason | No invented fallback |
|---|---|---|
| No opt-in request | No observer capture and no additional public data; existing reports byte/shape compatible | Cannot retrofit provenance after the run |
| Unsupported scene, missing/wrong detector | `unavailable / UNSUPPORTED_PROVENANCE_SCOPE` | No scene repair, replacement, or partial attributed subset |
| Stale canonical hash or stale run epoch/revision | `suppressed / STALE_PROVENANCE_EXECUTION` | Reject delayed old callback even if A → B → A restores the old SHA |
| Pending/failed/stopped/incomplete native, nonzero truncation or undefined behavior | `suppressed / NATIVE_PROVENANCE_INCOMPLETE` | Withhold **all** nodes/crossings, including raw diagnostics |
| Completed native with **any actual native warning**, observer failure or measurement inconsistency | `unavailable / NATIVE_PROVENANCE_UNQUALIFIED` (or `PROVENANCE_UNKNOWN_OR_INCONSISTENT` for explicit identity faults) | No native warning may become a `qualified` success merely because a model approximation is documented |
| Any source observer absent/not invoked exactly once, malformed or missing native SingleRay emission, `newRays` not registered exactly once, missing/duplicate/cyclic ray identity or direct parent, unknown incident ray (including nonselected detector), or any detector callbacks/count mismatch | `unavailable / PROVENANCE_UNKNOWN_OR_INCONSISTENT` | Withhold even on zero hit; never guess source from `rayIndex` or intersect computed lines |
| More than **64 distinct native ray objects across the entire run**, more than **32 actual hits on this requested detector**, or any transitive observed ancestor closure that cannot fit the bounded identity registry | `unavailable / PROVENANCE_LIMIT_EXCEEDED` for affected result (global ray-identity overflow invalidates all selected detectors) | Withhold entire graph, not the first N nodes/events; keep counting native interactions |
| Fresh clean native, complete all-source root ledger, exact callback/object evidence, complete selected detector counts and all bounds respected | `available` in a full Fresnel model; `qualified` only when the otherwise-clean run uses authored `partialReflection:false` with its declared transmitted-only model caveat | Retain sampled-measurement and interpretation limitations; do not turn the caveat into native warning |

The exact reason-code wording is **proposed** and may be challenged before implementation, but *unavailable vs suppressed vs clean* must remain unambiguous. These are result-level reasons, **not** proof that the native ray trace was wrong. Missing callback is never represented as a root node with `parentToken:null`. Absolute irradiance and image claims stay prohibited.

**Status precedence (normative):** first `suppressed` for stale run/hash or incomplete/failed/stopped native; then `unavailable` for unsupported scope, any native-run warning, root/identity/observer fault, detector mismatch or a breached cap; only otherwise return `qualified` for an explicitly declared **model-only** transmitted-only approximation, or `available` for a clean fully modeled Fresnel run. Publish `reasonCode` separately from human `reason` when suppressed/unavailable; no raw graph values. No implicit success on native warnings. A documented approximation is **not** itself a native execution warning.

**Buffer and detector-isolation rule:** process native callbacks using bounded counters and weak object identity references, never an unbounded public event history. A **global 64-identity overflow** fails every requested provenance result. Each **requested detector** independently uses a 32-crossing cap and count-consistency check; overflow at a **nonselected** detector cannot poison the selected detector's graph *by hit count alone*, although an unknown ray/failed source/global cap does invalidate all provenance. Two selected detectors share one run-epoch ledger and identical token namespace; their caps are independent. A global/per-detector cap breach invalidates the entire affected result, never a clipped accepted list; native physics and normal total detector counts proceed unchanged. These 64/65 and 32/33 boundaries are **defensive fault-injection guard tests**, not expected physically reachable ordinary scenes in this one-interface 1–2 SingleRay domain (ordinarily at most four ray objects). Retain only bounded identity/ancestor and crossing metadata; continue counting after overflow without claiming observation completeness.

## Proposed implementation boundaries (future, not included)

- **One atomic instrumentation pipeline per native scene instance.** Before any source start, install **exactly one owning callback wrapper per `onSimulationStart` or `onRayIncident` method** on each admitted source, interface and detector. The opt-in path must integrate existing per-source, interface and detector meters in this single owner/chain with explicitly ordered before/after observation hooks; **no independent competing or nested native-calling wrappers**. The no-opt-in pipeline remains byte/shape-equivalent to current production. Instrument **all** authored sources, the interface and **both** detectors if present, not solely the selected target.
- For every callback: hold the actual incoming **ray reference** and all callback arguments before native mutation; invoke the pinned original **exactly once**, with `this` and arguments unchanged; observe its exact returned object and direct child references **after** native delegation; return that same native return object, with no ordering/array/physics changes. The native `Detector` mutates rays and signed power in place, and the native `PlaneGlass` mutates a primary in place, so identity tracking must retain the same pre-mutation reference. Never call `newRays` a branch if the return has none; never rerun propagation or manipulate `pendingRays`. Reject duplicate/cyclic child references and unknown parents globally.
- For **every** supported detector, selected or not, preserve ordinary hit count and signed relative power; for interfaces preserve first-event and actual branch observations; for opt-in `detector-hit-events` preserve existing position/incoming-direction callback capture. Compare each full physical scene separately against uninstrumented native: callback counts, array/reference/return identity, source emissions, processed segments, truncation/undefined behavior, both detector counts and signed power, and interface first event. Reversing component order is a separate new run, not a demand that native event order remain unchanged across different scenes.
- Extend capture configuration in the existing public checker `skills/sim-ro-image-to-scene/scripts/check-scene.mjs`, `scripts/author-scene.mjs`, and optional native snapshot in `src/native-observations.js` **only when** `detector-ray-provenance` is requested. Preserve legacy no-opt-in report structure, all native physics, sample settings and PhyDemo pin.
- Add one strictly gated kind to `src/observables.js`, using its existing scene-hash and asynchronous execution guards **plus run epoch identity**. Keep the root/parent registry and all crossing metadata **private to the executing instance** until a terminal native event and **every** root, identity, source-count, detector-count, scope and overflow qualification has succeeded. No raw graph/parent/token maps appear in `report.native.diagnostics`, `summary.observations`, CLI JSON, browser/debug/session state or qualified exports during any pending/stale/failed/stopped/truncated/undefined/warned/unavailable attempt. After clean qualification, project only the explicit opt-in bounded result; unrequested output remains as before. A stale old session callback may not update the current scene's provenance, even if both runs have equal canonical SHA.
- If the existing qualified/browser viewer displays the new result, real-Chrome acceptance must show suppression, physical edits, A → B → A delayed old-A callback exclusion, independent fresh-A registry, export/reopen and cleared provenance on raw import. No custom ray overlay or path visualization in v1. Public results use `method: "native-observed-object-parentage"` and a machine-readable scope/limitation: **direct observed native object parenthood only; same-object optical interactions are not graph edges, no complete physical path, image, material inference, continuous illumination, or source-image interpretation is certified**. Never join this result with `detector-hit-events` by guessed callback order; future pairing requires a separate atomic-callback contract.
- Do not modify the underlying PhyDemo source, native refraction, numeric tolerances, max ray depth, source clipping/sampling, schema versions, legacy observable shapes, continuous illumination logic, model inference or textbook-answer scoring.

## Acceptance criteria and adversarial tests BEFORE a production merge

1. One fully specified air/water synthetic scene: transmitted primary and actual reflected child reach separate detectors; two source identities remain distinct; parent links match **actual native object references**, never rayIndex. Compare raw native unwrapped versus wrapped completed segments, truncation, undefined events, emitted counts, all detector counts/power and object callbacks.
2. No reflection variant: `partialReflection:false` yields no fictitious child; the native surviving primary retains one token; existing approximation caveat remains qualified.
3. High-to-low index TIR below/above/near/exact critical: compare independently calculated Snell/critical geometry where applicable; explicitly separate ancestry observation from numerical physical correctness. Never turn no transmitted branch into zero-angle.
4. **Two distinct valid zero-hit scenes:** (a) fully observed SingleRay start whose ray genuinely misses all surfaces/detectors → available empty graph; (b) identical scene with test-only nonrecording/missing source identity ledger and **zero downstream incident callbacks** → unavailable. Include source-start 0/2 invocations, malformed/empty `newRays`, duplicated ray references; a self-summed emission meter alone never establishes source coverage. Also challenge reversed detector orientation and finite endpoint ambiguity; no generic shadow or continuity claim.
5. Test-only callback fault injections for missing source/start registration, missing/duplicate `newRays`, child object identical to parent, duplicated child, orphan ancestry and missing incident parent. Assert `unavailable` with machine reason, **no parentless synthetic root**, and zero raw token/graph leakage in **all public surfaces**. Never patch native optics in production.
6. Fresnel weak-branch truncation, forced stop/limit, native undefined/error, source brightness/sampling warnings: request suppressed or unavailable as specified; legacy counts/qualified statuses must not be silently upgraded or corrupted.
7. 32/33 requested-detector hits, 64/65 distinct object references, duplicate/cyclic graph and unretained ancestor closure via **test-only injected observer callback streams** (not an impossible ordinary one-interface SingleRay physical scene). Test one detector overflowing while another requested detector remains within its own cap; the latter remains eligible if the global ray ledger and other gates are clean. An overflow at an unrequested detector must not alone poison the requested one; no clipped or orphaned graph.
8. Source/component ordering changes and test-only parent-child relationship counterexamples; run-level ephemeral tokens must not be treated as cross-run stable IDs.
9. Explicit opt-in vs absent opt-in: **legacy canonical source bytes**, source/detector readouts and default native summary shape match unchanged production `main`; old test fixtures/frozen first attempts and historical schema parse/round-trip remain unchanged.
10. Qualified scene physical edit, stale hash, **A → B → A** with a delayed first-A browser/session callback, same-hash independent new run, raw import and export/reopen. Check the complete checker diagnostics, CLI report, browser/debug state and export for **absence of raw graph/parent data** on every failure/stop/truncation/unknown; a prior accepted token graph cannot be relabeled current.
11. Real browser smoke/regression (if shown), focused native regression suites, all 11 full GitHub workflows on exact implementation head, plus a **new independent R2 Chat B review of the implementation head**, not a recycled design review. Reviewer numerical references include high→low index 1.5→1 critical `asin(2/3)=41.8103148957786°`, transmission at 30° `48.5903778907291°`, TIR at 50°, and low→high 1→1.5 at 30° `19.4712206344907°`. These are analytical cross-checks; at/near critical, native observed object ancestry **must not** be described as a physics-qualified transmitted direction or destination.

Use full input/report SHA hashes, pinned toolchain version, native exact values, logged failures and comparator runs. Accepted output must never depend on an extra bespoke ray solver. Existing source-backed transfer performance and educational effectiveness are **not** changed by this feature.

## Response to independent design-review findings (v1 → v2)

The independent-context Chat B [review-01](https://github.com/physicsvigilante/review_sandbox/blob/main/projects/opticsim/pr-81/reviews/review-01-chat-b.md) reported **CHANGES-REQUESTED** for the immutable v1 proposal head `df783a3c2f5e51ad5edbacd35f6d82f1a02cfea7`. The response belongs to **this newly revised proposal head**, not retroactively to that prior SHA.

- **F-01 (major):** all-source registration/start/captured-reference ledger; exact v5 one-ray return contract; zero-hit/no-downstream negative control; no reliance on self-summed meters.
- **F-02 (major):** single per-instance atomic owning callback pipeline; original call exactly once and reference/return identity retained; selected and nonselected meters and native before/after comparisons.
- **F-03 (major):** private until fully qualified; all-public-surface raw suppression; session epoch on top of scene hash, including A → B → A.
- **F-04:** explicit status priority and separate native warnings from authored model caveats; machine reason codes.
- **F-05:** zero-other-component allowlist, shared per-run namespace, per-selected-detector caps, injected-only 64/65 and 32/33 guard tests.
- **F-06:** critical-angle calculations and ancestry-vs-physical-correctness distinction; no teacher-facing near-critical directional physics inference.
- **F-07:** explicit `native-observed-object-parentage` method and machine-readable limitation; tokens ephemeral and no ray path/image/continuous illumination.

**Review status:** Proposed corrections authored by Chat A; **not yet independently accepted**. A targeted separate Chat B check of these changes is requested. No implementation or release permission follows from this write-up.

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