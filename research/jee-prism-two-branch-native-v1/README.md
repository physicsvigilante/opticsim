# JEE J13/J14: finite-prism two-branch native feasibility (research only)

**NOT a production optical model, reviewed physical capability, source-JEE solution, or public authoring extension.** Frozen baseline is production `main` at `bcf0151c004c94e179adb5ccc47e8d5f9851f23f`, after the independently reviewed J17 inverse merge. The pinned PhyDemo commit remains `811f508d2b070898c241a568b0c167dcb8645251`. The 10-case `protocol.json` was committed **before** the test implementation at `b7db4ee0edf4b40098c0e4e44786baa178ccefbb`; any final results must identify the test's exact later source commit.

## Why this investigation

The original frozen JEE J13 asks for a prism route with actual internal reflection, while J14 specifies normal first-face entry, a second face that *partly transmits and reflects*, a transmitted deviation of 1 degree and a returning deviation of 4 degrees. Those questions are distinct: J13's *slightly above critical* must not be replaced by equality, and J14's partial reflection is not total internal reflection. The current authorable v22 native finite Beam + triangular Glass deliberately requires `partialReflection:false` (transmitted-only Fresnel approximation), retaining native TIR. Its existing analytical direct-transmission inverse likewise does not model the J14 return branch.

The source does **not** supply physical triangle dimensions, indices for a native numerical fixture, a beam width, brightness, detector planes, or a numerical tolerance. This study uses a declared 140-mm-tall, near-1-degree finite triangle, an explicitly chosen inside index 2 and exterior index 1, finite native Beam sampling, and two passive native detectors. **All are synthetic teaching/research choices, not facts from a textbook picture.** No Solutions files are read.

## What actually runs

The test first validates and compiles an unchanged, **publicly admitted** v22 Fresnel-off Beam + Glass + downstream Detector seed. It clones only the resulting pinned-native scene for **unqualified RAW research** and, per frozen case, enables native `Glass.partialReflect`, optionally changes beam/density/index/depth, and installs a second genuine passive native Detector behind the beam. Public authoring remains unchanged and explicitly **rejects** both a Fresnel-on v22 prism and the additional backward detector.

The native `Beam.onSimulationStart`, `Glass.onRayIncident` and `Detector.onRayIncident` callbacks are wrapped locally. Each wrapper delegates to the original pinned method and *observes* emitted native directions, actual Glass faces, returned and child rays, relative brightness, and detector hit coordinates. There is no fake light path, forced reflection/transmission event, assigned source attribution, solver replacement, or external detector event.

Signed direction and local-normal observations may be checked against the **necessary** Snell tangential invariant and specular reflection invariant, but geometric consistency is not proof that all native Fresnel branches were exhaustively propagated. A native `simulationComplete` that also reports truncation, undefined behavior, errors or uncertain encounters remains unqualified. Native `simulationStop`, numerical-depth limits, bright/weak branch loss, near-vertex events, and finite misses are recorded, not recast as no light.

The frozen matrix comprises Fresnel-off baseline/miss/translation, Fresnel-on baseline/index/density/translation/miss, zero-depth, and processed-ray-stop. Each raw input and report is written with a SHA-256 to `test-artifacts/llm-authoring/jee-prism-two-branch-native-v1/attempt-*/` for existing optical CI artifact collection. Green test assertions prove *recording and preservation*, not two-branch authorability or J14 solution correctness.

## Decision gate

Inspect exact-head CI logs **and the archived raw events**. A future production candidate is justified only if genuine forward *and* return native branches can be distinguished from incidental entrance-face Fresnel reflection, all relevant required complete-run and near-critical/vertex guards can be enforced **without guessing paths**, and realistic numeric budgets do not lose valid branches silently. Otherwise report the unsupported scope and consider a separate transparent conditional analytical J14 inverse without modifying public native v22. The final implemented optical extension, if any, requires **one focused independent physics/integration review** on its exact tested tree. This test-only research PR remains draft and unmerged.
