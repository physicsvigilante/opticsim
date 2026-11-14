# Milestone 31 — teaching-fidelity pilot

This bounded development experiment tests **faithful physical authoring, verified simulation and useful inspection**, not reproduction of a textbook answer. It uses the existing engine, minimal authoring interface, qualification, observation and browser systems. No production physics, scene schema, renderer or engine pin is changed.

## Source and exposure

The source is the **already exposed repository fixture** `scenes/single-lens-detector.json` at main commit `740b847d977e557c31e43139987a589341424d18`, Git blob `3dcdb0e8c01d1c950ee9bdbe2583b1892f6fc651`. This is not a new textbook problem, a blind interpretation test, an independent model evaluation or an independently reviewed laboratory specification. Selecting a fully specified source avoids inventing detector geometry, illumination or apertures just to force execution.

The plan and initial minimal request were frozen before this pilot's execution at `92ca2132148bc965622f36f3dda22fbeea548e6c`; `plan.json` Git blob is `17814c4b17134fa73f35ed153481b383a2576376`. The request copies every active physical field from the source. The engine supplies only its existing inactive full-circle defaults, canonical bookkeeping, numerical policy and camera preparation. A test checks exact component and numerical-policy agreement with the pinned source.

| Source-defined quantity | Value |
| --- | --- |
| Source position | (-300, 10) mm |
| Source emission | Full circle, relative native brightness 0.5 |
| Ideal lens | x=0 mm, f=100 mm, aperture height=180 mm |
| Passive detector | Centre (170,0) mm, tangent 90 degrees, length=160 mm |
| Numerical settings | Ray density=1, maximum depth=8, processed-ray limit=10,000 |

No solved image coordinate is included in the authored physical input. The fixture specifies an **ideal** lens; a material refractive index or real lens geometry cannot be recovered from it.

## Frozen experiment distinctions

1. **Scene only:** execute without an answer target or dummy observable. This checks that physics exploration is not contingent on producing a textbook number.
2. **Readouts:** inspect the same unchanged physical scene with conditional image predictions, source emissions, detector crossings and relative signed power. These outputs have different evidence meanings.
3. **Physical classroom intervention:** change only focal length from 100 to 150 mm. This is a proposed experiment, not an original source fact. Ray geometry and conditional image position should respond; a detector's aggregate count may stay unchanged.
4. **Numerical intervention:** change only ray density from 1 to 0.25. Geometry and the ideal analytical relation must not change. Finite counts can change. In the browser, import this custom-density package and use the existing Dense selector to restore density 1.
5. **Optional unsupported quantity:** request material refractive index alongside the valid readouts without changing the apparatus. Its unavailable value must remain visible; the physical simulation and other results remain usable. It is not counted as answered.
6. **Missing essential information:** delete focal length, with illustration disabled. Preserve the missing fact; create no replacement scene and make no native call.

## Verification and reproducibility

After the established repository setup:

```sh
npm test
npm run build
node evaluation/teaching-fidelity-v1/run.mjs
node evaluation/teaching-fidelity-v1/browser.mjs
```

Outputs use a fresh directory under `test-artifacts/llm-authoring/teaching-fidelity-v1/`. Existing evidence must not be overwritten. The runner retains the exact source and plan, authored request, source hashes, canonical scene, execution reports, requested results and qualified portable packages. Each revision uses existing validation and retains physical versus numerical edit provenance.

Physical checking has two distinct parts. A separate scalar check evaluates conjugate and height residuals without calling the production image-prediction function. A **test-only read-only** incident logger delegates to native lens and detector methods exactly once and observes actual ray slopes and detector intersection points; it does not manufacture rays, choose routes or become a new public measurement API. Its native runs are counted separately from canonical execution. These are mathematical implementation checks, **not independent human review** or proof of the physical adequacy of an ideal lens for every real lens.

The real-Chrome check exercises import, no-answer tracing, readout labels, Fit, a focal-length field edit, qualified export/reopen, numerical sampling change, an unavailable optional result, and suppression after an invalid physical edit. Every import must advance the visible revision before it can pass. Screenshots use the unmodified native renderer, not generated illustrations.

## Five-dimensional review

| Dimension | Evidence and qualification |
| --- | --- |
| Interpretation fidelity | Exact source-field preservation in a previously exposed numerical fixture. Does not establish unfamiliar text/image understanding. |
| Physical and numerical correctness | Actual completed native runs, finite-ray slope/intersection checks and independent scalar residuals, within the source's ideal geometric model. |
| Simulation coverage | Three supported components and declared interventions; missing-fact and optional-unavailable outcomes retained. Real-lens materials, waves and continuous illumination are outside scope. |
| Educational usefulness | Automated task affordances and actual visual evidence may be inspected. **Teacher/student effectiveness remains not assessed.** Same-assistant visual review is provisional. |
| Textbook-answer completeness | Not requested by this laboratory-style source. Unsupported optional quantities must still be reported as unavailable, not answered. |

There is **no combined success/accuracy score**. Native completion, source fidelity, analytical agreement, visual clarity and educational usefulness are separate claims. A passing CI job verifies its declared checks, not learning outcomes.

## Teacher task worksheet (review not yet performed)

Open the produced `scene-only/qualified-scene.json` in the existing viewer. Identify the three components, units, coordinate frame and model assumption. Then open `baseline/qualified-scene.json`: identify which displayed values are actual sampled observations and which are conditional predictions. Is that distinction easy to communicate without reading implementation code?

Change `lens-1` focal length to 150 mm. Explain what changed physically and what did not. Compare the ray pattern and conditional image position. Does an unchanged detector crossing count imply that nothing changed? Export the qualified package and reopen it; locate the source/assumption and physical-edit history.

Open `coarse-sampling/qualified-scene.json`, then select **Dense**. Identify why counts and the apparent number of rays change without a change of apparatus. Does the view risk implying that an unsampled region is physically dark?

Open `optional-unavailable/qualified-scene.json`. Explain why the material request cannot be answered by an ideal-lens model, while the valid simulation can still be inspected. Finally set focal length to zero: can a learner distinguish the last rendered apparatus from a current valid result after the error?

Record each task as completed independently, completed with help, not completed, or not assessed. Record confusing labels, clutter, provenance gaps and misconceptions separately from software errors. No teacher or student has yet completed this worksheet in this pilot.

## Acceptance and stop conditions

Accept the **software experiment** only when source values are preserved, no-answer execution works, edits remain qualified, the actual tested rays satisfy the separate checks, missing information is not repaired and actual browser state agrees with recorded native results. Retain unmet criteria and infrastructure errors. Do not patch physical source values to make a check pass.

This pilot cannot establish a need for a new authoring adapter if the existing interface already handles these tasks. It cannot establish educational effectiveness without actual task participants. Repeated mechanical authoring or presentation burdens can motivate a small later change; a universal solver, new optics primitive or examination-answer feature is outside this milestone.

PR #53's separate answer-known analytical follow-up is not a dependency and is not merged by this experiment. Historical evidence remains unchanged.
