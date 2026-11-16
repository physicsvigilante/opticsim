# One physical model, two hypotheses: finite-prism teaching exploration

**Scope:** This is a bounded software-and-teaching *affordance* regression using the **already exposed synthetic triangular-prism example**, not a new source-question interpretation, a fresh held-out LLM evaluation or a claim of measured learning improvement. No new optical solver, native ray path, schema, LLM provider, physics primitive, source-generated answer or simulation heuristic is introduced.

The source is the **existing** `examples/triangular-prism.json` / `scenes/triangular-prism.json` arrangement. One stationary homogeneous three-vertex prism, one exact single ray, one passive detector, known material indices and explicitly `partialReflection:false`. Source/inside/outside indices, units, geometry and all original run-policy choices are retained. The native PhyDemo engine remains pinned at `811f508d2b070898c241a568b0c167dcb8645251`.

## Teacher scenario with the existing LLM exploration loop

1. Load the **Synthetic triangular prism** example, start **Explore this model with an LLM**, and download its context if desired. A raw example has **unknown source provenance**; the program does not claim to have interpreted an unfamiliar problem.
2. Request a passive **`interface-face-events`** readout for `P1`. This observes actual native first events and finite face counts without changing geometry or the emitted ray. A face label is an authored finite edge (12, 23 or 31), **not** a guaranteed source-specific path.
3. Propose a **hypothetical material change only**: `P1.parameters.insideIndex: 1.5 → 1.6`, leaving `outsideIndex=1`, the triangle, emitter, detector and sampling unchanged. Preview the one exact field change **before** native execution. Run native PhyDemo, then inspect per-face native events. No image or textbook answer is required.
4. Observe the actual exit face's transmitted angle. A separately expressed Snell-control calculation for the defined planar interface checks that it changes from `asin(1.5 sin(30°)) ≈ 48.5903779°` to `asin(1.6 sin(30°)) ≈ 53.1301024°` **under this explicitly authored model**; this equation is a test oracle, never a ray instruction to the engine. Native face events are bounded simulation-order evidence, not a tracked complete ray history.
5. Compare saved baseline and material hypothesis. Both runs preserve the native **Fresnel-off / TIR-on approximation warning**, so an automatic unqualified scalar delta is *not* published. The browser still shows the two actual native observation records individually. A new face readout has no baseline counterpart unless it was already requested. These are legitimate **not-comparable** results, not failures to run the physics.
6. Export the qualified hypothetical: the original raw example's provenance remains **unknown**, while the one physical material edit and added passive observable are retained with stable IDs. An invalid proposed index such as zero must fail preview rather than changing the running apparatus.

## Readable comparison evidence (narrow presentation fix)

The first real Chrome regression showed a concrete pedagogical problem: the saved-scenario comparison displayed nested finite-face events as a dense one-line `JSON.stringify` object even though the ordinary qualified-results panel already supplied readable native first-face descriptions. This is a **presentation defect**, not an optical solver error.

The exploration comparison now **reuses the existing** `formatRequestedResult` for structured values such as `interface-face-events`, while retaining simple numeric readouts, explicit missing-baseline requests, each comparison eligibility reason, and the existing complete **Download comparison evidence** JSON unmodified. The ordinary formatter labels native sampling, approximation warnings, and simulation-order per-face evidence without inventing a paired source-specific ray path. All text is assigned using `textContent` rather than interpreted HTML.

If either saved comparison side fails the existing hash, native-completeness or results-recomputation gates, the visible comparison **withholds all stored readout values** rather than printing potentially stale/tampered JSON. The authoritative structured comparison result and qualified packages are unchanged. Node regression and real Chrome check assert readable `face-23` output, omission of raw nested face JSON, correct missing-baseline qualifier, and fail-closed reporting.

This is a bounded R1 evidence-presentation change. Its tests establish that structured evidence is displayed accessibly, **not** actual teacher comprehension; no user-visible ray geometry, measurement, numerical policy, source provenance, physics or exported evidence formats are changed.

## What is verified and what remains unassessed

The headless regression validates native completion, scene/source immutability, native face events and detector sample, separate Snell calculations, update-by-ID, new readout without physical modification, proper qualified comparison withholding, stale proposal refusal and missing/invalid material rejection. The **existing real Chrome exploration script**, now extended prospectively to the triangular-prism family, verifies the same local browser context/preview/apply/capture/compare/export path, a readable face event, unchanged source/detector fields, and preservation of a usable completed scene after an invalid hypothetical.

Evaluation dimensions remain separate:

| Dimension | What this regression establishes | What it does not |
|---|---|---|
| Interpretation fidelity | Exact already-exposed source fields; no unrequested material reconstruction | Unfamiliar language/image question interpretation |
| Physical/numerical correctness | Executed pinned native face observations and independently expressed local Snell control for this explicit fixture | Full native path correctness, unique optical images, universal numerical stability |
| Simulation coverage | Refractive prism face exit, passive detector, index edit and bounded negative/refusal checks | Arbitrary solids, stacked media, 3D prisms, generic inverse optics |
| Educational usefulness | A learner can inspect contrasting scenarios, qualifiers, source history and refused changes using existing UI | Demonstrated teacher/student comprehension or learning effectiveness |
| Textbook-answer completeness | Not requested | Any JEE answer score |

**Teacher and student participants: zero; external model calls: zero.** A same-assistant proposal and automated browser checks do not count as an independent model authoring or human usability benchmark.

## How to reproduce

```sh
npm run setup
npm test
npm run build
node scripts/exploration-browser.mjs
```

Run with Node 24.19.0 and a real installed Chrome/Chromium binary. Keep any CI browser-host absence a *failure to verify*, not a passing browser task. The existing unified workflow already executes the Node suite, native checks and real browser exploration; this milestone adds no mandatory permanent workflow. Existing historical first-attempt questions, original Problem images, Solutions files and all numerical research PR #92–#99 archives remain unchanged.

This is a **teaching-focused regression**, not authorization to add missing prism physics, change `partialReflection`, invent Fresnel branches, modify native numerical cutoffs, or impose Stage-2 withholding. Results may inform later user-facing presentation or new supported apparatus work only when that need is separately established.
