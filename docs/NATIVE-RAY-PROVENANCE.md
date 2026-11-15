# Opt-in native detector ray provenance — bounded v5 implementation

**Release state:** Draft PR #83, not merged. This is a source-and-evidence-semantics R2 feature and requires a **new independent Chat B implementation/code review** before a separate owner-approved merge. The original [R2 design proposal PR #81](https://github.com/physicsvigilante/opticsim/pull/81) passed independent design review only; neither research PR #79/#80 is a production dependency.

## Purpose

The additional explicitly requested `detector-ray-provenance` observable reports **observed native JavaScript ray object identity** from an actual source start, across directly returned native `newRays` children, to an actual detector callback. It does **not** solve for light paths, retime propagation, construct images, certify an original problem interpretation, create rays, or change PhyDemo physics. Other detectors, native signed relative power and sampled crossings remain ordinary PhyDemo readings and are not source-specific without this explicit qualified request.

The authoritative simulator remains pinned PhyDemo at `811f508d2b070898c241a568b0c167dcb8645251`. `rayIndex` is only a native scheduling/array index and **never** a semantic source ID.

## Strict scope

Only an already supported **schema-v5** `planar-media-tracing` scene with **exactly one** `planar-interface`, **1–2** explicit authored `point-source/single-ray` objects, **1–2** passive `ray-detector` objects, and **zero other component types**. All existing geometry, numeric budgets, source separation, interface-index, and detector guards remain unchanged. In particular, no automatic mirror/lens/sampled-fan/curved/finite-shape support is implied.

The normal existing `opticsim-observables-v1` companion request syntax is:

```json
{"id":"reflected-ray-parentage","kind":"detector-ray-provenance","componentId":"ReflectedDetector"}
```

On completed accepted source/detector callbacks, a result's `value` consists of a bounded `nodes` array of the **transitive observed ancestor closure of rays crossing only this requested detector**, and a `crossings` array in actual native callback order referencing those tokens. A sample *shape* (not a measured result):

```json
{
  "nodes":[
    {"token":"r1","origin":"native-emission","sourceId":"S1","parentToken":null,"spawnComponentId":null},
    {"token":"r3","origin":"native-spawn","sourceId":"S1","parentToken":"r1","spawnComponentId":"AirWater"}
  ],
  "crossings":[{"rayToken":"r3"}]
}
```

Tokens are **ephemeral within one simulation run**; a new source edit, browser rerun, same-hash A→B→A, reimport or process restart generates a new object registry, regardless of whether token strings repeat. A native transmitted primary, TIR-in-place reflection, or detector mutation does **not** create another graph node. An absent child edge does not mean an absent interaction. No geometric path, image, irradiance, photon identity, interference, physical refraction qualification, time-of-flight or continuous visibility is inferred. The separate `detector-hit-events` position list is not silently paired to this list using coincidental array order.

## Observation and qualification policy

One native-per-instance callback owner is used for each admitted source, interface and detector, with **exactly one original native method call** and the same input/return object references. `src/native-ray-parentage.js` only observes existing wrappers, storing an internal run-local `WeakMap`; it cannot route, emit or alter rays. All authored sources **must** have a registered native handler before execution, exactly one observed `SingleRay.onSimulationStart` callback, exactly one actual distinct, non-null emitted ray in `newRays`, and a real identity registration before any zero-hit result is accepted. Do not treat the ordinary sum of source observer counters as an independent verification of those same counters.

Both selected and nonselected detectors and the interface are watched. Registered native method ownership and the actual observed detector/interface interaction counts must agree with existing native meters. A missing, nonrecording or replaced source/interface/detector observer, an unknown parent, a child equal to its parent, duplicated/cyclic object reference or any counter mismatch causes **unavailable** provenance, including when a selected detector otherwise appears to record zero hits. This is evidence about an actual sampled run, not verification of source text accuracy.

- **Suppressed:** current scene hash/Session revision is stale, or native run is not completed, is stopped/failed, truncated or undefined. Raw graph/parent tokens remain private; no partial accepted projection appears in checker diagnostics, qualified results, CLI report, UI or saved package.
- **Unavailable:** completed run with unsupported scope, native warnings, missing identity/handler/registration, malformed source-start, unknown parent, detector/interface count mismatch, or bounded capture overflow. Machine-readable `reasonCode` distinguishes refusal. No partial list is returned.
- **Qualified:** otherwise clean completed native run with an **explicitly authored transmitted-only** `partialReflection:false` approximation; the limitation remains visible even when no ray hit occurs.
- **Available:** otherwise clean completed full native Fresnel run. A genuinely empty result is `{"nodes":[],"crossings":[]}` only after *every* source start and handler has been positively observed and all other gates pass.

At most **64 unique actual native ray objects across this run** and **32 crossings per selected detector** are captured. The global object-cap overflow invalidates all selected provenance. A detector hit-list overflow invalidates that detector's requested graph only; an unrelated nonselected detector's hit count alone does not invalidate a selected graph. The first-release source family normally emits at most two primary and two secondary objects; 64/65 and 32/33 cap boundaries are therefore **test-only injected callback controls**, not a claim that these are ordinary reachable physical scenes. Ordinary native detector totals are not capped.

Native warnings and a declared model-only omission of Fresnel partial reflection are distinct; a runtime warning is never promoted to successful qualified provenance merely because a transmitted-only approximation was authored.

## Public paths and tests

Native capture is enabled **only** when `detector-ray-provenance` is explicitly requested in the usual `scripts/author-scene.mjs`, `scripts/run-problem.mjs`, or qualified browser workflow. Existing source-document schema, default core/summary output keys and no-opt-in source/detector readouts remain backward compatible. The qualified package carries the *request and assumptions*, not an accepted old run's ray tokens; the raw scene import clears source qualifications and result requests. In the browser, the current `Session.revision` guard and `QualifiedUI` result sequence prevent a late old-A callback from republishing in a newer A after A→B→A, even with equal canonical scene hashes.

`test/native-ray-parentage.test.mjs` covers actual pinned two-source Fresnel children/detectors, zero-hit versus silently omitted source registration, a selected detector failing to record an actual crossing, a nonselected detector recording failure, interface callback failure, identity self/duplicate and cap fault injection, sampled full-model versus transmitted-only status, native stops/truncation, stale hash and delayed A→B→A Session callbacks. The official public problem workflow and real Chrome viewer tests live in `scripts/native-ray-parentage-acceptance.mjs` and `scripts/native-ray-parentage-browser.mjs`; the unified Node 24.19.0 workflow uploads both raw test reports, retained qualified packages and browser screenshots.

Historical source-backed textbook attempts and original preexecution fingerprints remain unchanged; the prior detector-hit transfer SHA fixture is historical evidence rather than a prohibition on later versioned production feature changes. Its existing transfer behaviors are rerun as exposed regression checks, not relabeled as new blind performance. No new independent LLM evaluation or classroom study is included.

**Independent implementation review and owner merge approval are separate release gates.**
