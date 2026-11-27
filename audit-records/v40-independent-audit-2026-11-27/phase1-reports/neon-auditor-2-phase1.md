# Independent Tier-2 Audit Report — Phase 1 (Blind Investigation)

- **Auditor:** `neon-auditor-2` (`gemini-4-neon-medium`)
- **Date:** 2026-11-28
- **Target Repository:** `https://github.com/physicsvigilante/opticsim`
- **Frozen Audit Commit:** `0c758d7817ac68dffd5936e25109520b7f99f720`
- **Frozen Audit Tree:** `d103cd993df5c74052309ec74f7cdacb925b58ef`
- **Pinned PhyDemo Upstream:** `811f508d2b070898c241a568b0c167dcb8645251` (`upstream-pin.json` blob `c371abf2169bba28b1c400d022b55caf78cb647c`, vendor tree `4e352c91dc445c471ee126ec5214bb9d2d3df0b7`)
- **Built `dist/test-core.cjs` SHA-256:** `f54ecaac2cdb6da7f7c43f0b035d6020c64feabaae68a8a675c424aa99caa122`
- **Workspace Provenance:** Isolated linked Git worktree `<WORKTREE_NEON_AUDITOR_2>`, `git-common-dir = <LOCAL_REPO_ROOT>/.git`, `git status --short` clean before and after all experiments, `reparse = 0`, zero tracked edits, zero protected `/Solutions/` or archive files accessed.

---

## Executive Summary

Opticsim at `v40` (`0c758d78`) is **scientifically sound at its physical core** and has genuinely achieved real physical composability in `schemaVersion: 40` (`native-optical-bench`) and its exact-rational `coaxial-paraxial-stack` + `optical-bench-witness` bridge. Across independent vector-optics and exact-Snell/reflection oracles, pinned PhyDemo tracing through `v40` achieves machine precision (`~1e-15` to `~1e-14 mm` / `rad`), optical reciprocity holds to `0 mm` / `5.7e-14 deg`, all 7 signed/flat `spherical-lens` shapes match independent ray-circle Snell tracing to `< 1e-13 mm`, and unfamiliar 6-primitive compositions (interior sources, tilted major caps, submerged stops/detectors, corner-touching mirrors, cemented doublets, curved-silvered faces, beam splitters) execute cleanly without bespoke routing.

However, the `v40` plateau is **NOT simply "mature and ready to freeze as-is"**. It represents **an apparently mature, physically accurate v40 engine encumbered by (1) two concrete, easily-reproducible geometry/audit bugs in `v40`, (2) a major upstream-inherited limitation on `partialReflection: true` that withholds nearly all Fresnel-enabled measurements, (3) massive historical schema/file bloat (`v1`–`v39`, 132 `src/` files / 21,923 LOC, 123 `docs/` files, 130 `scripts/` files, 326 `test/` files / 45,452 LOC, 68 `evaluation/` directories across 1,182 commits / 276 PRs), and (4) a complete absence of independent external-LLM and real teacher/student validation** (all evaluation evidence to date is same-assistant or mock-only).

**Strategic Verdict (Area J):** Execute a **short, bounded Targeted Corrective Hardening pass (Trajectory 3)** — fixing the two confirmed `v40` admission/audit defects (`F1`, `F2`) and optionally `backgroundIndex` revision support (`F4`) — **immediately followed by freezing `v40` and moving to independent external-model and real classroom/teacher evaluation (Trajectory 1)**. Do **NOT** expand engine capabilities further (Trajectory 5), do **NOT** spend months rewriting/deleting frozen `v1`–`v39` schemas before getting external evidence (Trajectory 4), and do **NOT** build another internal same-assistant JEE benchmark (Trajectory 2).

---

## Consequential Findings Ledger (Classified by Severity & Nature)

| ID | Severity | Nature | Summary |
|---|---|---|---|
| **F1** | **P1** | Confirmed defect | **Phantom generating-circle tangency false rejection & false runtime failure on `circular-arc-mirror` and `spherical-lens`.** `componentTangentCircles` checks tangency against the unbounded 360° generating circle instead of the retained physical arc, rejecting valid rays 40–90 mm away from the physical surface both at admission and in `v40EndpointsVerified`. |
| **F2** | **P2** | Confirmed defect | **`ideal-curved-mirror` retains a conservative `apertureHeight/2` bounding disk in `v40`, blocking standard JEE virtual-image setups ($u < f$) and close component placement**, even though `IdealMirror` is a flat line segment and `circular-arc-mirror` was already upgraded to exact arc clearance. |
| **F3** | **P2** | Confirmed architectural limitation | **`partialReflection: true` triggers PhyDemo's `0.01` brightness truncation threshold on routine glass-air scenes**, causing `status: "incomplete"` and `measurementState: "withheld-incomplete"` even for a single ray on a single standard `n = 1.5` glass slab. Qualified native measurements are effectively restricted to `partialReflection: false`. |
| **F4** | **P2** | Confirmed architectural limitation | **`reviseScene` cannot modify `physics.backgroundIndex` in `v40`**, preventing a teacher or LLM from performing one of the most common JEE what-if explorations ("immerse this lens/prism/bench in water") without re-authoring the entire scene from scratch. |
| **F5** | **P2** | Confirmed architectural limitation | **Severe historical schema/code/doc accumulation (`v1`–`v39`) creates cognitive, maintenance, and capability-surface drag:** 132 `src/` files (21,923 LOC), 123 `docs/`, 130 `scripts/`, 326 `test/` files (45,452 LOC), 68 `evaluation/` directories, and a 120.5 KB `capabilities` payload (vs 17.7 KB `bench-capabilities`), largely due to ~23 narrow single-arrangement schemas (`v14`–`v36`) built before `v37`–`v40` unified them. |
| **F6** | **P1** | Evidence or validation gap | **Zero independent external-LLM or human teacher/student validation has been executed.** All 68 `evaluation/` directories represent same-assistant development trials, synthetic controls, or mock pipelines; neither external LLM authoring accuracy nor classroom usefulness is empirically established. |
| **F7** | **P2** | Intentional and correctly enforced scope boundary (with practical friction) | **Conservative AABB clearance for `spherical-lens` and exterior-only restriction** rejects valid placement of sources, detectors, or stops in the empty air pocket outside concave/meniscus faces or inside thick lenses. |
| **F8** | **P3** | Confirmed architectural limitation | **Lack of chromatic dispersion (`simulateColors: false`), extended object primitives, and optical-instrument convenience readouts** leaves JEE Chapter 8 (aberrations/dispersion/eye/instruments) and dispersion-prism problems outside `v40` native simulation. |
| **F9** | **P3** | Evidence or validation gap | **Existing test suite (45,452 LOC) has high regression depth on curated positive/negative fixtures but missed cross-component phantom-circle tangency (`F1`) and `ideal-curved-mirror` virtual-image admission (`F2`).** |

---

### Detailed Finding Specifications

#### F1 — Phantom Generating-Circle Tangency False Rejection & Runtime Audit Failure (`P1`, Confirmed defect)
- **Baseline:** `0c758d7817ac68dffd5936e25109520b7f99f720`
- **Anchors:**
  - `src/native-bench-common.js:656-690` (`componentTangentCircles`, `rayNearTangentCircle`)
  - `src/native-optical-bench.js:287-291` (admission initial-ray tangency check)
  - `src/native-bench-common.js:816-830` & `883-899` (runtime `installBenchEndpointAudit` tangency check)
- **Expected Behavior & Justification:** Tangency guards exist to fail closed when a ray grazes an actual physical circular/spherical/arc surface (where floating-point intersection conditioning degrades). A ray passing tens of millimeters away from a physical `circular-arc-mirror` or `spherical-lens` aperture does not interact with that surface and must never be rejected or cause runtime measurements to be withheld. Note that PR #267 explicitly fixed this exact bug for `circular-cap-dielectric` (`tc.cap` check in `rayNearTangentCircle`), commenting: *"restricts tangency to the retained physical arc plus its clearance neighborhood so rays missing on the absent portion of the generating circle are never falsely flagged."*
- **Observed Behavior:** `componentTangentCircles` omits arc/aperture restriction for both `spherical-lens` and `circular-arc-mirror`, returning full 360° generating circles `{center, radius}`. Consequently:
  1. At admission (`C1a`), a horizontal ray at `y = 100 mm` — **90 mm above** a `circular-arc-mirror` (`x: 100, y: 0, normalDeg: 180, radius: 100, apertureHeight: 20`, spanning `y ∈ [-10, 10]`) — is rejected with `AUTHORING_REJECTED: Initial forward ray is within 0.01 mm of tangency to a circular/spherical/arc surface (M1)`.
  2. At admission (`C1b`), a horizontal ray at `y = 50 mm` — **40 mm above** a `spherical-lens` (`x: 50, y: 0, apertureHeight: 20, centerThickness: 6, frontRadius: 50, backRadius: 50`) — is rejected with the same error.
  3. At runtime (`C1c`), a valid scene where a plane mirror reflects a ray onto `y = 50 mm` (40 mm above the same `spherical-lens`) **fails closed** with `status: "failed"`, `measurementState: "withheld-incomplete"`, and error `G1: observed native ray approaches within 0.01 mm of tangency to a circular/spherical/arc surface; measurements withheld.`
- **Minimal Reproduction:** `exp1_audit.mjs` cases `C1a_arc_mirror_phantom_circle_admission`, `C1b_spherical_lens_phantom_circle_admission`, `C1c_spherical_lens_phantom_circle_runtime`.
- **Practical Significance:** High in multi-arm, multi-source, or wide-fan `v40` benches (e.g., beam-splitter benches, split-lens benches, or directional fans where non-interacting rays pass elsewhere in the workspace). Any ray whose infinite line happens to be tangent to the imaginary generating circle of a `spherical-lens` or `circular-arc-mirror` anywhere ahead of the ray aborts the entire simulation and withholds all detector measurements.
- **Verification Status:** Independently reproduced and verified in Node against `dist/test-core.cjs`.
- **Recommended Fix:** Restrict `rayNearTangentCircle` to the retained physical arc + `clearance` neighborhood for `circular-arc-mirror` (using angular sector `halfAngle + clearance/radius` around `uVertex`) and `spherical-lens` (using `y ∈ [bottom - clearance, top + clearance]` and the retained side of `frontCenter`/`backCenter`), matching the pattern already used for `circular-cap-dielectric`.
- **Remaining Uncertainty:** None on the defect itself; care is needed when fixing to ensure `v37`–`v39` frozen compatibility tests (if any rely on the old full-circle rejection) are preserved or scoped to `v40` if required by freeze policy.

#### F2 — `ideal-curved-mirror` Bounding-Disk Over-Rejection in `v40` (`P2`, Confirmed defect)
- **Baseline:** `0c758d7817ac68dffd5936e25109520b7f99f720`
- **Anchors:** `src/native-optical-bench.js:157-180`, `200-207`, `263-270`.
- **Expected Behavior & Justification:** PhyDemo's `IdealMirror` is geometrically a flat finite line segment `[pts[0], pts[1]]` of length `apertureHeight` centered at `(x, y)` (zero sag). In `v40`, `circular-arc-mirror` was upgraded to exact `>= 0.01 mm` arc clearance against emitters, segments, circle blockers, and dielectric bodies. `ideal-curved-mirror` should likewise admit any emitter/component at least `0.01 mm` clear of its finite segment.
- **Observed Behavior:** `v40` still enforces a conservative disk of radius `apertureHeight / 2` around `(x, y)` for `ideal-curved-mirror`. In experiment `C12a`, a textbook JEE concave-mirror virtual-image setup (`u = 15 mm < f = 25 mm`, `apertureHeight = 40 mm`) is **rejected** (`Point source must lie at least 0.01 mm outside curved aperture bounding disk (M1)`), whereas the identical setup with `circular-arc-mirror` (`R = 50 mm`, `C12b`) **succeeds** (`status: "completed"`).
- **Minimal Reproduction:** `exp4_audit.mjs` cases `C12a_ideal_curved_mirror_virtual_object_u15_f25_ap40` vs `C12b_circular_arc_mirror_virtual_object_u15_R50_ap40`.
- **Practical Significance:** Directly blocks a core JEE/intro-optics teaching scenario (object between pole and focus of a concave ideal mirror, or close lens/mirror combinations) whenever `u <= apertureHeight / 2`, creating an unintuitive inconsistency between `ideal-curved-mirror` and `circular-arc-mirror`.
- **Verification Status:** Independently reproduced and verified.
- **Recommended Fix:** Replace the `ideal-curved-mirror` bounding-disk clearance checks in `validateNativeOpticalBenchV40` with exact finite-segment clearance against `[pts[0], pts[1]]` (reusing `pointSegmentDistance`, `segmentsIntersect`, `separatedSegmentDistance`, and `segmentOutsideBodyExact`).
- **Remaining Uncertainty:** None.

#### F3 — `partialReflection: true` Triggers Upstream Brightness Truncation on Routine Glass-Air Scenes (`P2`, Confirmed architectural limitation)
- **Baseline:** `0c758d7817ac68dffd5936e25109520b7f99f720`
- **Anchors:**
  - `vendor/ray-optics/src/core/sceneObjs/BaseGlass.js:242-254` (hardcoded `0.01` brightness cutoff in `'default'` colorMode)
  - `src/adapter.js:317-320` (`classifyRun`: any `truncation > 0` => `'incomplete'`)
  - `src/native-optical-bench.js:563` (safeguard note)
- **Expected Behavior & Justification:** A user or LLM authoring a physical glass slab/lens/prism with `partialReflection: true` expects Fresnel reflections to be simulated and qualified measurements to be returned.
- **Observed Behavior:** In `C5_partial_reflection_true_simple_slab`, a single ray (`brightness: 0.5`) at 10° hitting a standard `n = 1.5` glass slab with `partialReflection: true` produces `status: "incomplete"`, `truncation: 0.00076977...`, `measurementState: "withheld-incomplete"`. Because `BaseGlass.refract` drops any reflected branch with `brightness <= 0.01` and adds it to `totalTruncation`, and at near-normal glass-air incidence $R \approx 0.04$, the second internal reflection ($R^2 \approx 0.0016 < 0.01$) is **always** truncated even at maximum source `brightness = 1.0`. Similarly, `C8_beam_splitter_faint_branch_truncation` confirms that `brightness = 0.05, transmissionRatio = 0.1` (`0.005 <= 0.01`) yields `withheld-incomplete`.
- **Minimal Reproduction:** `exp1_audit.mjs` case `C5_partial_reflection_true_simple_slab`; `exp2_audit.mjs` case `C8_beam_splitter_faint_branch_truncation`.
- **Practical Significance:** In practice, **almost no multi-face dielectric scene with `partialReflection: true` can produce qualified measurements** in Opticsim (all 8 curated `v40` starters set `partialReflection: false`!). Opticsim's fail-closed policy is honest (it never hides truncation), and the root cause is pinned upstream PhyDemo's `0.01` cutoff, not an Opticsim math bug — but teachers and LLMs must be clearly steered to `partialReflection: false` (explicitly qualified as transmitted-only + TIR) for quantitative measurements, and `partialReflection: true` should be understood as visual-only unless strong-reflection/high-angle single-interface regimes are used.
- **Verification Status:** Verified in both upstream source (`BaseGlass.js:242-245`) and executable experiment (`C5`, `C8`).
- **Recommended Fix:** Do **not** relax fail-closed truncation or fork upstream PhyDemo. Instead, surface this prominently in `bench-capabilities` and browser guidance as an explicit operational rule (when to use `partialReflection: false` vs `true`).
- **Remaining Uncertainty:** None.

#### F4 — `reviseScene` Cannot Revise `physics.backgroundIndex` in `v40` (`P2`, Confirmed architectural limitation)
- **Baseline:** `0c758d7817ac68dffd5936e25109520b7f99f720`
- **Anchors:** `src/authoring.js:475-533` (`reviseScene`), `src/native-optical-bench.js:114-115`.
- **Expected Behavior & Justification:** A core Opticsim mission requirement is letting a teacher/LLM perform targeted what-if revisions without re-authoring unchanged components. Changing the ambient medium (e.g., immersing a lens/prism/tank in water, $n_0 = 1 \to 1.33$) is a canonical JEE optics exploration.
- **Observed Behavior:** `reviseScene` only accepts component-level `changes` (`section: "parameters" | "emission"`). Attempting to update a dielectric body's `outsideIndex` fails because it no longer matches `doc.physics.backgroundIndex` (`E2_reviseScene_change_backgroundIndex_attempt`), and there is no targeted revision field for `physics.backgroundIndex` (nor atomic update of `backgroundIndex` + all bodies' `outsideIndex`).
- **Minimal Reproduction:** `exp2_audit.mjs` case `E2_reviseScene_change_backgroundIndex_attempt`.
- **Practical Significance:** Forces full scene re-authoring for ambient-medium immersion studies and breaks lineage continuity in qualified notebooks.
- **Verification Status:** Independently verified.
- **Recommended Fix:** In a targeted hardening pass (or post-evaluation), optionally allow an explicit top-level `backgroundIndex` field in `reviseScene` for `v40` (requiring matching `outsideIndex` updates on all dielectric bodies in the same atomic revision, or explicitly syncing them with recorded diff).
- **Remaining Uncertainty:** Low; straightforward schema/API extension if desired.

#### F5 — Severe Historical Schema & Codebase Bloat (`v1`–`v39`) (`P2`, Confirmed architectural limitation)
- **Baseline:** `0c758d7817ac68dffd5936e25109520b7f99f720`
- **Anchors:** `src/composition-profiles.js` (40 schema versions), `src/contract.js:1-385`, `src/adapter.js:1-128`, `src/authoring.js:1-252`.
- **Observed Metrics:**
  - `src/`: **132 files, 21,923 LOC**
  - `docs/`: **123 files, 7,179 LOC**
  - `scripts/`: **130 files, 12,751 LOC**
  - `test/`: **326 files, 45,452 LOC**
  - `evaluation/`: **174 files, 17,349 LOC** across **68 subdirectories**
  - Git history: **1,182 commits, 276 PRs**
  - `author-scene.mjs capabilities` outputs **120,538 characters** (~30K tokens), whereas `bench-capabilities` is **17,701 characters** (~4.5K tokens) and `workflow-capabilities` is **11,317 characters** (~2.8K tokens).
- **Root Cause & Assessment:** Between `v14` and `v36`, the project accumulated ~23 narrow, problem-shaped native schemas (e.g. `v20` decentered two-lens beam, `v21` semicircle beam, `v22` prism beam, `v23` circle beam, `v24` curved-entry observation, `v25`/`v33` GRIN, `v26`/`v27` beam+plane+mirror, `v28` post-lens aperture, `v29` refractive fan, `v30` curved-entry beam, `v31` slab-arc return, `v32` inside-cap, `v34` immersed-arc port, `v35` mirror box, `v36` guide fan) plus ~25 narrow standalone analytical query modules. `v37`–`v40` and `coaxial-paraxial-stack` successfully synthesized the unified composable layer, and PRs #269–#272 added slim `bench-capabilities` and `workflow-capabilities` front doors so external LLMs do not need to load the 120 KB legacy payload. However, the legacy sprawl remains wired into `contract.js`, `adapter.js`, `authoring.js`, `README.md` (lines 9–48 list ~30 legacy links right below the `v40` header!), and the browser dropdown (which mixes 8 `v40` starters with 31 legacy examples).
- **Practical Significance:** High maintenance burden for future contributors and risk of confusing external LLMs or teachers who hit `capabilities` or `README.md` instead of `bench-capabilities`. However, deleting/refactoring frozen `v1`–`v39` now carries regression risk without advancing external scientific/teaching evidence.
- **Recommended Decision:** Keep `v1`–`v39` frozen as compatibility ballast for now (do **not** do a risky big-bang consolidation before external evaluation); ensure all external-facing entry points steer strictly to `v40` (`bench-capabilities`) + `coaxial-paraxial-stack` + `witness-optical-bench`.

#### F6 — Complete Absence of Independent External-LLM and Human Classroom Evidence (`P1`, Evidence or validation gap)
- **Baseline:** `0c758d7817ac68dffd5936e25109520b7f99f720`
- **Anchors:** `README.md:93-112`, `evaluation/heldout-authoring-v1/README.md:1-35`, `evaluation/optical-systems-atlas-v1/README.md:1-35`.
- **Observed Behavior:** The project's own documentation is commendably honest:
  - `evaluation/heldout-authoring-v1`: *"We do not claim a model evaluation has occurred until a real capture and separately reviewed score exist."*
  - `evaluation/focused-context-pair-v1`: *"Current public checks use a MOCK model only; no actual external model inference or human-curated hidden cases are claimed."*
  - `evaluation/teaching-cross-family-v1`: *"no actual teacher or student effectiveness has yet been assessed."*
  - `evaluation/optical-systems-atlas-v1`: *"same-assistant capability discovery ... None of these 40 cases was executed or awarded a numeric answer."*
- **Practical Significance:** This is the single largest gap relative to Opticsim's foundational mission. After 1,182 commits and 276 PRs, the engine is deeply tested against itself and its own authors' assumptions, but has **zero empirical data** on whether a cold external LLM can reliably author `v40` scenes from unseen physics problems, or whether teachers/students actually find the browser + qualified-exploration workflow usable and pedagogically effective.
- **Recommended Decision:** Make independent external-model evaluation and small-scale teacher/student piloting the **immediate top priority** right after fixing `F1` and `F2`.

---

## Comprehensive Investigation Across All 10 Areas (A–J)

### Area A — Project Vision and Development Trajectory
- **Original Vision (`PROPOSAL.md`, `AGENTS.md`):** Build a reusable, source-backed, versioned 2D ray-optics teaching and physical-exploration bench over pinned PhyDemo (`v5.4.0`, `811f508d`), where an LLM authors physical components and targeted hypotheses, while the engine owns validation, native execution, conditional analytics, and honest fail-closed diagnostics.
- **Trajectory & Drift Assessment:**
  - *Milestones 1–6 (`v1`–`v4`):* Coherent, disciplined progression (thin lenses -> plane mirror -> return -> mixed -> detectors -> multi-source -> general tracing + authoring CLI + qualification).
  - *Middle Phase (`v5`–`v36`):* Substantial **catalogue drift** — driven by JEE problem discovery, the repo proliferated into ~23 single-apparatus native schemas (`v14`–`v36`) and ~25 single-formula analytical query modules. Each was carefully engineered and honestly qualified, but the trajectory drifted toward a per-problem catalogue rather than a composable bench.
  - *Consolidation Phase (`v37`–`v40` + `coaxial-paraxial-stack` + `witness-optical-bench`):* Strong **course correction back to genuine composability**. `v40` (`native-optical-bench`) genuinely unifies finite dielectrics (circles, oriented minor/hemisphere/major caps, prisms, convex quads, signed/flat spherical lenses, touching layers, cemented doublets/triplets), decentered thin lenses, plane/curved/silvered mirrors, beam splitters, exterior/submerged stops & detectors, and interior/ambient sources under one contract (`maxRayDepth = 16`).
  - *Engine vs Teaching Boundary:* Well-respected conceptually (no exam-specific answer solver, no hidden assumptions, explicit `nativeObservation` / `nativeImageDetected` / `questionSupport` flags), though the sheer volume of governance machinery (68 `evaluation/` dirs, 123 `docs/`) now vastly outweighs any real classroom validation.

### Area B — Deep Physical and Mathematical Correctness Audit
- **Verified Correct (No Consequential Defect Found):**
  1. **Snell's law & lateral displacement (`B1`):** `polygon-dielectric` slab (`n = 1.5, t = 20 mm, θ = 30°`) matches exact analytical displacement to `3.55e-15 mm` and direction to `1.14e-15`.
  2. **Prism minimum deviation (`B2`):** Equilateral `triangular-prism` (`A = 60°, n = 1.5`) at exact minimum-deviation incidence `i_1 = 48.59037789°` matches exact analytical exit angle to `4.62e-14 deg`.
  3. **All 7 `spherical-lens` signed/flat shapes (`B5`):** Biconvex, plano-convex, convex-plano, plano-concave, biconcave, meniscus-pos, meniscus-neg all match an independent exact ray-circle Snell tracer to `3.55e-15`–`7.28e-14 mm` and `2.29e-16`–`1.71e-15` direction error. Collinear `arc: true` flat-face compilation (`C4`) hits `y = 0` cleanly with zero error.
  4. **Tilted major `circular-cap-dielectric` (`h > R`) & TIR (`B6`):** Interior source at center of curvature (`normalDeg = 35°, R = 20, h = 30`) produces exact `45.00000000000001°` TIR on flat face and `45°` TIR on curved arc.
  5. **Beam-splitter energy accounting (`B3`):** `transmissionRatio = 0.37, B = 0.5` produces exact `pT = 0.185`, `pR = 0.315`, `sumErr = 0`.
  6. **Optical reciprocity / time-reversal (`B4`):** Forward-and-back trace through decentered `ideal-lens` + `polygon-dielectric` + `circular-arc-mirror` returns to `yStart = 5 mm` with `posErrMm = 0` and `angleErrDeg = 5.73e-14 deg`.
  7. **IdealLens off-axis law (`B8`):** Steep 30° ray from focal point `(-100, 0)` through `IdealLens(f=100)` emerges parallel `(1, 3.55e-17)` — exact Gaussian thin-lens mapping.
  8. **Coaxial paraxial stack & `optical-bench-witness` (`W1`, `W2`, `W3`, `B9`):** Exact `binary64-rational` unimodular ABCD propagation (`det = 1`, `A = D` on return) matches `v40` native rays on flush curved-silvered plano-convex lens (`W1`), immersed thin lens in `n = 1.5` (`W2`), and cemented crown+flint doublet (`W3`), with exact dimensional invariance across `mm`, `cm`, `m`, and `scale-unit` (`B9`).
  9. **Touching/merged/silvered interfaces (`C2`, `C3`, `C6`, `C7`, `C10`, `C14`):** Equal-index touching slabs (`C7`), 3-body T-junction (`C6`), mismatched-aperture cemented lenses (`C3`), sandwiched plane mirror (`C2`), curved-silvered concave lens face (`C10`), and overhanging flush plane mirror (`C14`) all execute accurately with correct `mergedWithId` and encounter counts.

### Area C — Numerical Robustness and Adversarial Error Investigation
- **Confirmed Defects Found:** `F1` (phantom generating-circle tangency on `spherical-lens` and `circular-arc-mirror`, `P1`) and `F2` (`ideal-curved-mirror` bounding-disk over-rejection, `P2`).
- **Confirmed Upstream/Architectural Limitation:** `F3` (`partialReflection: true` truncation at `0.01` brightness threshold in `BaseGlass.js:242-254`; also noted upstream quirk in `BaseGlass.js:246` `!this.scene.colorMode != 'default'` which is masked when `ray.gap === true` for `rayIndex === 0` and harmless for `rayIndex >= 1` because `k % Infinity === k`).
- **Verified Sound (No Defect Found):**
  - `maxRayDepth = 16` exhaustion (`C11`) cleanly increments `totalTruncation` (`Simulator.js:946-951`) and fails closed (`withheld-incomplete`, all observables `suppressed`); no silent ray dropping.
  - Near-grazing beam-splitter incidence (`C13`) is caught by finite-endpoint clearance guard.
  - `coaxial-paraxial-stack` uses exact BigInt `binary64-rational` arithmetic with positive-monomial cancellation bounds (`1e-10`) and round-trip binary64 verification on return self-conjugate roots — unusually strong numerical engineering.
  - All 8 curated `v40` browser starters (`V40_all_8_curated_starters`) pass `status: "completed"`, `v40EndpointsVerified: true`, `truncation: 0`, `warnings: 0`.

### Area D — Genuine Physical Composability
- **Verdict:** **Genuinely composable in `v40`.** Unfamiliar multi-primitive combinations not present in curated starters execute cleanly from data alone without bespoke routing or core edits:
  - `D1` (6 component types: interior source in `circular-cap-dielectric` -> `ideal-lens` -> `beam-splitter` -> `circular-arc-mirror` + `plane-mirror` -> 2 detectors): `completed`, `truncation: 0`, all observables `qualified`.
  - `D2` (`parallel-beam` -> `finite-aperture` -> `polygon-dielectric` containing submerged `circle-blocker` and submerged `ray-detector`): `completed`, exact ray accounting (`6 emitted = 2 aperture + 2 circle-blocker + 2 detector`).
  - `D4` (corner-touching 90° `plane-mirror` retroreflector): `completed`, exact `-1` return direction and `y = -8 mm` symmetry.
  - `E1` (`reviseComponents` deleting host dielectric body around interior source, submerged blocker, and submerged detector): preserves `backgroundIndex`, cleanly transitions components to ambient medium, executes `completed`.
- **Real Composability Friction Identified:** `F1` (phantom circle tangency in multi-arm scenes), `F2` (`ideal-curved-mirror` bounding disk), `F4` (cannot revise `backgroundIndex`), and `F7` (conservative AABB on `spherical-lens`).

### Area E — Architectural and Software Assessment
- **Strengths:** Clean separation between authoritative versioned JSON (`contract.js`), native compilation/observers (`adapter.js`), run-revision-guarded UI session (`session.js`), read-only observables (`observables.js`), and pure-math analytical stack (`coaxial-paraxial-stack.js`). Zero modifications to pinned PhyDemo core (`811f508d`). Strict fail-closed status semantics (`completed`, `completed-with-warnings`, `incomplete`, `stopped`, `failed`).
- **Weaknesses:** Historical accumulation (`F5`: 40 schemas, 132 `src/` files, 326 `test/` files) makes `contract.js`, `adapter.js`, and `authoring.js` dense with `v1`–`v39` dispatch branches. `v1`–`v39` freeze integrity is well-enforced via isolated profiles and explicit version checks, so legacy schemas do not leak into `v40`, and vice versa.

### Area F — Test Quality and Strength of Existing Evidence
- The 45,452-LOC test suite provides strong regression coverage for declared contracts, frozen historical profiles, and curated positive/negative fixtures.
- **Blind Spots Identified:** Because tests were largely written alongside features by the same assistant, adversarial cross-component interactions outside the authored fixtures were missed — specifically `F1` (a ray 40–90 mm away from a `spherical-lens` or `circular-arc-mirror` hitting its phantom generating circle) and `F2` (a concave `ideal-curved-mirror` with `u < f` inside its bounding disk). Additionally, software CI passing on synthetic fixtures is not scientific/classroom validation (`F6`).

### Area G — LLM Authorability
- **Front Door:** `node scripts/author-scene.mjs bench-capabilities` (17.7 KB) and `workflow-capabilities` (11.3 KB) are well-structured, self-contained, and actionable — a major improvement over legacy `capabilities` (120.5 KB). Error messages include JSON paths and codes (`AuthoringError`, `ValidationError`).
- **Residual Friction:** `README.md` still places ~30 legacy schema links directly below the `v40` intro; `reviseScene` cannot change `backgroundIndex` (`F4`); `partialReflection: true` causes unexpected `withheld-incomplete` (`F3`); `F1` and `F2` produce confusing rejections on physically valid scenes.
- **Boundary:** Because I inspected the repository directly, this assessment is a structural DX audit, **not** a cold external-model benchmark (which remains unexecuted, `F6`).

### Area H — JEE Relevance and Practical Teaching Value
- **Strong Coverage:** Plane mirrors & enclosures/kaleidoscopes, spherical/ideal curved mirrors, refraction at plane & curved surfaces, layered slabs, TIR & Snell's window, triangular prisms & convex glass blocks, thin lenses (coaxial & decentered/Billet split), thick spherical lenses (all 6 shapes), cemented doublets/triplets, silvered lenses/hemispheres/slabs, beam splitters, stops/apertures, and coaxial paraxial stacks.
- **Remaining Gaps vs Teaching Priority:**
  - *Chromatic dispersion (`simulateColors: false`), extended objects, and compound instrument presets (microscope/telescope/eye):* Genuine JEE Chapter 8 syllabus items, but lower priority than validating the existing `v40` engine with real teachers/students and external LLMs.
  - *Higher-value immediate teaching friction:* `F1`, `F2`, `F3` (guidance on `partialReflection`), `F4` (ambient medium revision), and browser UX simplicity (31 legacy scenes cluttering the dropdown alongside the 8 `v40` starters).

### Area I — Security and Trustworthiness
- **Inspected Surfaces:** `public/index.html`, `src/app.js`, `src/*.js`, `scripts/serve.mjs`, `scripts/pack-demo.mjs`, `scripts/authoring-evidence.mjs`, `src/qualification.js`, `src/contract.js`.
- **Findings (No P0/P1 Security Defects Found):**
  - Strict CSP in `public/index.html` (`default-src 'none'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'`).
  - Zero `innerHTML`, `outerHTML`, `eval`, or `new Function` sinks in `src/*.js`.
  - Prototype pollution (`__proto__`) cleanly rejected by strict key allowlists (`SEC1`).
  - `scripts/authoring-evidence.mjs` enforces lexical containment under `test-artifacts/llm-authoring/`, ancestor `lstatSync` symlink checks, fresh directory reservation, and `wx` exclusive writes (`SEC1`).
  - `scripts/serve.mjs` binds to `127.0.0.1` only and checks resolved path prefix containment.
  - `scripts/pack-demo.mjs` builds from an explicit allowlist and verifies absence of `test-core.cjs` and `.env`.
  - `src/qualification.js` enforces strict size/count bounds, SHA-256 integrity checks, and refuses to certify author interpretation.

### Area J — Strategic Phase-Gate Decision (Evaluation of All 5 Trajectories)

| Trajectory | Assessment | Tradeoffs & Risks |
|---|---|---|
| **1. Freeze `v40` & move to external-model / classroom evaluation** | **Strong second step (immediately after a small Trajectory 3 fix).** Directly addresses `F6` (the #1 mission gap). | Freezing *before* fixing `F1` and `F2` risks confounding external-LLM evaluations with false rejections on physically valid scenes (`circular-arc-mirror` / `spherical-lens` phantom tangency, `ideal-curved-mirror` virtual-image setups). |
| **2. Fresh unseen JEE benchmark before freeze** | **Reject as primary next step.** | Another internal benchmark without external models or teachers repeats the same-assistant validation loop and delays real-world feedback. An external-model held-out evaluation (Trajectory 1) already requires unseen questions! |
| **3. Targeted corrective hardening** | **RECOMMENDED IMMEDIATE GATE (bounded, 1–2 PRs max).** Fix `F1` (arc-restricted tangency for `spherical-lens` & `circular-arc-mirror`) and `F2` (`ideal-curved-mirror` exact segment clearance), plus clear `partialReflection: false` guidance (`F3`) and optionally `backgroundIndex` revision (`F4`). | Must be strictly time-boxed and scope-locked so it does not turn into open-ended engine tinkering. Reversal condition: if external evaluation reveals deeper `v40` admission/DX failures, re-open targeted hardening based on real external failure logs. |
| **4. Architectural consolidation / simplification** | **Defer until after external evaluation.** | Removing/refactoring `v1`–`v39` (132 `src/` files, 45K LOC tests) has high regression risk and zero immediate teaching/external-LLM payoff since `bench-capabilities` already isolates LLMs from legacy schemas. Revisit only if ongoing maintenance cost blocks post-pilot iteration. |
| **5. Narrowly targeted capability growth** | **Reject for now.** | Adding dispersion, extended objects, or new primitives before testing whether external LLMs and teachers can even use `v40` effectively violates evidence-driven engineering. Reversal condition: pursue only if external classroom/LLM pilots demonstrate a specific high-frequency blocker. |

**Recommended Concrete Plan:**
1. **Gate 1 (1–2 small PRs — Trajectory 3):** Fix `F1` and `F2` with adversarial regression tests; document `F3` (`partialReflection: false` quantitative rule) prominently in `bench-capabilities`; optionally add `backgroundIndex` revision in `reviseScene` (`F4`).
2. **Gate 2 (Immediately after Gate 1 — Trajectory 1):** Freeze `v40` engine development and execute (a) the private independent external-LLM held-out evaluation (`evaluation/heldout-authoring-v1` with unseen questions and a real external model) and (b) a small real-teacher/student classroom pilot using the static browser demo.

---

## Executable Experiment Inventory

All scripts saved privately under `<LOCAL_SCRATCH_NEON_AUDITOR_2>\` and executed via Node against `dist/test-core.cjs` (`f54ecaac2cdb6da7f7c43f0b035d6020c64feabaae68a8a675c424aa99caa122`).

| Script | Case | Expected | Observed | Verdict |
|---|---|---|---|---|
| `exp1_audit.mjs` | `B1_slab_lateral_displacement` | `yDet = 30.1650785794505` | `errMm = 3.55e-15`, `dirErr = 1.14e-15` | PASS |
| `exp1_audit.mjs` | `B2_prism_minimum_deviation` | `dirOut = -18.59037789°` | `angleErrDeg = 4.62e-14°` | PASS |
| `exp1_audit.mjs` | `B3_beam_splitter_energy` | `pT=0.185, pR=0.315` | `sumErr = 0`, `interactions = 1` | PASS |
| `exp1_audit.mjs` | `C1a_arc_mirror_phantom_circle_admission` | Admitted (ray 90 mm above mirror) | `AUTHORING_REJECTED` (phantom circle tangency) | **DEFECT (F1)** |
| `exp1_audit.mjs` | `C1b_spherical_lens_phantom_circle_admission` | Admitted (ray 40 mm above lens) | `AUTHORING_REJECTED` (phantom circle tangency) | **DEFECT (F1)** |
| `exp1_audit.mjs` | `C1c_spherical_lens_phantom_circle_runtime` | `completed` (reflected ray 40 mm above lens) | `status: "failed"`, `withheld-incomplete` | **DEFECT (F1)** |
| `exp1_audit.mjs` | `C3_cemented_lenses_mismatched_aperture_overhang` | `completed` | `completed`, `errors: []`, clean unmerged refraction | PASS |
| `exp1_audit.mjs` | `C4_flat_spherical_lens_midpoint_hit` | `completed` through `y=0` | `completed`, `y=0`, `front-arc=1, back-arc=1` | PASS |
| `exp1_audit.mjs` | `C5_partial_reflection_true_simple_slab` | Qualified or truncated | `incomplete`, `truncation=7.70e-4`, `withheld-incomplete` | **LIMIT (F3)** |
| `exp1_audit.mjs` | `C6_three_body_T_junction` | `completed` | `completed`, `errors: []` | PASS |
| `exp1_audit.mjs` | `C7_equal_index_touching_bodies` | `completed`, `mergedWithId: G2` | `completed`, `mergedWithId: "G2"`, `n_i=n_t=1.5` | PASS |
| `exp1_audit.mjs` | `D1_six_primitive_composition` | `completed` | `completed`, `truncation=0`, `D1=2, D2=1, BS1=2` | PASS |
| `exp1_audit.mjs` | `D2_submerged_stop_and_detector_with_beam_aperture` | `completed`, `6=2+2+2` | `completed`, `B1=6, A1=2, CB1=2, D1=2` | PASS |
| `exp2_audit.mjs` | `B4_fixed_optical_reciprocity` | Return to `y=5, dir=4°` | `posErrMm = 0`, `angleErrDeg = 5.73e-14°` | PASS |
| `exp2_audit.mjs` | `C2_fixed_sandwiched_mirror` | `completed`, `M1=1, G1=2, G2=0` | `completed`, `M1=1, G1=2, G2=0` | PASS |
| `exp2_audit.mjs` | `B5_all_six_spherical_lens_shapes_oracle` | Match exact Snell oracle | All 7 shapes `yErrMm <= 7.28e-14`, `dirErr <= 1.71e-15` | PASS |
| `exp2_audit.mjs` | `B6_tilted_major_cap_refraction_and_tir` | `45°` TIR on flat & arc | `completed`, `tirCount=5`, `45.00000000000001°` | PASS |
| `exp2_audit.mjs` | `D4_corner_retroreflector_plus_prism` | Return `y=-8, dir=(-1,0)` | `completed`, `M1=1, M2=1, y=-8, dir=(-1,0)` | PASS |
| `exp2_audit.mjs` | `E1_structural_delete_host_body` | Preserve `backgroundIndex=1`, run | `completed`, `backgroundIndexPreserved: 1` | PASS |
| `exp2_audit.mjs` | `E2_reviseScene_change_backgroundIndex_attempt` | Revise ambient index | `AUTHORING_REJECTED` (no `backgroundIndex` edit path) | **LIMIT (F4)** |
| `exp2_audit.mjs` | `C8_beam_splitter_faint_branch_truncation` | Fail closed at `<= 0.01` | `incomplete`, `truncation=0.005`, `withheld-incomplete` | PASS (honest) |
| `exp3_audit.mjs` | `W1_silvered_plano_convex` | Witness corroboration | `v40EndpointsVerified: true`, `observed-ray-geometry-compared` | PASS |
| `exp3_audit.mjs` | `W2_immersed_thin_lens` | Witness corroboration (`n=1.5`) | `completed`, `observed-ray-geometry-compared` | PASS |
| `exp3_audit.mjs` | `W3_cemented_doublet` | Witness corroboration | `completed`, `observed-ray-geometry-compared` | PASS |
| `exp3_audit.mjs` | `C10_curved_silvered_concave_lens_face` | `completed`, `M1=1` | `completed`, `reflections=1, hits=2` | PASS |
| `exp3_audit.mjs` | `V40_all_8_curated_starters` | All 8 `completed` & verified | All 8 `completed`, `v40Verified=true`, `warnings=0` | PASS |
| `exp3_audit.mjs` | `SEC1_proto_pollution_and_traversal` | Reject `__proto__` & `../` | Both blocked cleanly, zero pollution | PASS |
| `exp3_audit.mjs` | `B8_ideal_lens_steep_ray_law` | Exact collimation at 30° | `outDir = (1, 3.55e-17)` | PASS |
| `exp4_audit.mjs` | `C11_maxRayDepth_16_exhaustion` | Fail closed on depth > 16 | `incomplete`, `truncation=0.5`, all obs `suppressed` | PASS |
| `exp4_audit.mjs` | `C12a_ideal_curved_mirror_virtual_object_u15_f25_ap40` | Admitted (`u=15 < f=25`) | `AUTHORING_REJECTED` (bounding disk radius 20) | **DEFECT (F2)** |
| `exp4_audit.mjs` | `C12b_circular_arc_mirror_virtual_object_u15_R50_ap40` | Admitted | `completed` | PASS |
| `exp4_audit.mjs` | `B9_coaxial_stack_dimensional_invariance` | Identical across `mm/cm/m/scale-unit` | Bit-for-bit identical (`118.2051282051282 mm`) | PASS |
| `exp4_audit.mjs` | `C13_beam_splitter_grazing` | Refused near endpoint | `AUTHORING_REJECTED` (`< 0.01 mm` endpoint) | PASS |
| `exp4_audit.mjs` | `C14_overhanging_flush_mirror_on_spherical_lens` | `completed` | `completed`, `M1=1, D1=1` | PASS |

---

## Open Questions for Phase 2 Peer Debate

1. Does fixing `F1` (arc-restricted tangency for `spherical-lens` and `circular-arc-mirror`) require scoping to `v40` only, or should `v37`–`v39` remain byte-for-byte frozen?
2. Should `F4` (`reviseScene` support for `physics.backgroundIndex`) be included in the pre-freeze hardening pass, or deferred until external evaluation shows how often ambient-medium immersion edits are needed?
3. Should the browser dropdown (`public/index.html`) hide or collapse the 31 legacy `v1`–`v39` examples behind an opt-in disclosure before any classroom pilot?
4. What is the exact minimum viable protocol for external-LLM evaluation (number of unseen problems, external model choice, independent physics reviewer)?
