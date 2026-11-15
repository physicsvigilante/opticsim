# Native v9 finite-forward intersection qualification — shadow research only

**Draft scope:** This research follows [PR #87](https://github.com/physicsvigilante/opticsim/pull/87) and accompanies the pre-implementation [safeguard design](../../docs/NATIVE-FINITE-FORWARD-QUALIFICATION-PROPOSAL.md). Neither the current shadow script nor this branch changes the production qualification system or PhyDemo rays.

**Production baseline:** Opticsim main fa158fc78da7a35b6a02eaed58c0cdbd4b699220, 750 passing Node tests, pinned ray-optics 811f508d2b070898c241a568b0c167dcb8645251.

## Input and methods

Twenty already exposed v9 synthetic critical-angle configurations and four additional normal-incidence controls are generated from fully specified v9 polygons, 1 source, n1=1.6 and n2=1.3, transmitted-only partial-reflection policy false, four transforms and known source directions. Nothing is inferred from an original question. The shadow captures *native actual* incoming ray segments and incident points at each Glass callback, calls the original handler once, then checks the represented binary64 forward intersection and exact finite edge membership using standalone rational geometry. Normal source and far-from-critical samples are acceptance controls, not an image or path oracle.

The *ordinary production* evaluateDocument runs a distinct native execution on the same exact authored document. The script records counts/status and parity differences, but **does not pretend two separately traced critical rays must have identical trajectories**. It additionally alternates four canonical and four read-only-instrumented executions of each of the two critical configurations, retaining every status and interface count. Exactly-once callback delegation and within-run original interface counter equality remain required. The counterfactual numerical gate applies only to the incident stream captured within that specific instrumented run; it is **not published** by the canonical CLI or browser.

## Retained first failed attempts

- The original research CI [43752308258](https://github.com/physicsvigilante/opticsim/actions/runs/43752308258) **FAILED**: one original critical run returned mismatching ordinary/instrumented terminal status. The first artifact 14177015738 retains all captured inputs/records. It was not retrospectively changed to pass.
- Follow-up [43752585277](https://github.com/physicsvigilante/opticsim/actions/runs/43752585277) **FAILED** under unchanged strict parity, now retaining native event snapshots. The two independent executions had four versus six interface encounters in a rotated critical case.
- Follow-up [43752839859](https://github.com/physicsvigilante/opticsim/actions/runs/43752839859) **FAILED** under the same strict parity assertion, but added **sixteen separate alternating runs** showing the canonical native engine itself varied at unchanged exact-critical input. In the translated case, four canonical attempts alternated between 3-hit completed and 4-hit failed; rotated canonical attempts had 5 or 6 hits despite completion. [Raw artifact 14176908008](https://github.com/physicsvigilante/opticsim/actions/runs/43752839859/artifacts/14176908008), whose reported ZIP SHA-256 was independently confirmed in the diagnostic session. These failures are not evidence of a solved bug.
- The subsequent acceptance checks only valid **same-run** native callback registration/delegation and actual represented forward-hit contradictions. The independent-rerun parity for critical rays is explicitly a *reported risk*, not a pass requirement. If a new true native anomaly is not witnessed in a given batch, do not patch a source angle or change a cutoff to manufacture one; keep the result as insufficient research evidence.

## Run in GitHub or locally

After normal setup, on this **unmerged research branch**:

~~~sh
npm run setup
npm test
node evaluation/finite-hit-forward-qualification-v1/shadow.mjs
~~~

The script writes a fresh input.json and report.json to test-artifacts/llm-authoring/finite-hit-forward-qualification-v1 (or an explicitly provided fresh path below test-artifacts/llm-authoring). Both remain retained if the final assertion fails. The temporary unified CI step uploads the raw artifact with if:always.

A successful later research run means the bounded exact finite-segment check recorded actual native events, far/normal controls and callback-counter invariants passed, and no production physics was modified. It does **not** prove generalized physical correctness, observer neutrality under critical sensitivity, full Fresnel behavior, numerical determinism, classroom learning or a safe production release. **Keep this draft unmerged pending separate design review and owner authorization.**
