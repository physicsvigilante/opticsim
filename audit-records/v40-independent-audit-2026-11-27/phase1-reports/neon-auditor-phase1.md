# Independent Tier-2 Audit Report — Phase 1 (Blind Investigation)

**Investigator:** `neon-auditor` (`gemini-4-neon-high`)  
**Date:** 2026-11-27  
**Governance:** Multi-agent collaboration playbook v0.2 (`dd091fed2c1efdc398ec1c8124283e374f029e55`), Phase 1 Blind Independence Protocol.  
**Protected Material Compliance:** Strictly read-only on repository; zero edits to tracked files, `vendor/ray-optics/`, or original checkout; zero access to `/Solutions/`, `01_problems.zip`, `08_Ray_Optics_Explanations.zip`, GitHub Issue #273, or peer investigator workspace/scratch.

---

## 0. Executive Summary & Strategic Verdict

**What the `v40` plateau truly represents:**  
Opticsim at `0c758d78` is **NOT** a fragile catalogue masquerading as a simulator, nor is it completely blemish-free and ready to freeze blindly. Rather, it is an **apparently mature, genuinely composable physical core (`v40: native-optical-bench` + exact `binary64-rational` `coaxial-paraxial-stack` + `v40` witness bridge) carrying two consequential P1 defects, several P2 friction/qualification traps, heavy historical `v1`–`v39` architectural accretion, and a decisive external-evidence vacuum (`0` cold external-model trials, `0` real teacher/student evaluations).**

- **Physical & Composability Strength:** Independent analytical ray-tracing oracles written from scratch during this audit confirm that `v40` achieves machine-precision physical accuracy (`10⁻¹⁶` to `10⁻¹³ mm`) across all six signed/flat `spherical-lens` shapes, 4-layer touching dielectric stacks, coaxial cemented doublets/triplets (including mixed `path` + `DR1R2` compilation), tilted major/minor/hemisphere `circular-cap-dielectric` bodies with interior sources, flat and curved flush silvered optics (`mergesWithGlass`), corner-touching plane-mirror enclosures, Mach-Zehnder 2-splitter power conservation, and unfamiliar 10-component mixed compositions with `3 → 0` structural deletion closure—all genuinely emerging from pinned PhyDemo `811f508d` without bespoke ray-routing hacks.
- **Confirmed Consequential Weaknesses Found by Adversarial Probing:**
  1. **F1 (P1, Confirmed defect):** Ghost generating-circle tangency false positives on `spherical-lens` and `circular-arc-mirror`—rays passing **40–90 mm away** from the physical optic are falsely rejected at admission and fail closed at runtime (`v40EndpointsVerified = false`) because `componentTangentCircles` (`src/native-bench-common.js:664-673`) omitted physical-arc bounds that were fixed only for `circular-cap-dielectric`.
  2. **F2 (P1, Confirmed defect):** Documented `rayDensity` override on `witness-optical-bench.mjs` / `v40` `prepareScene` (`src/optical-bench-witness.js:86,339,529`) unconditionally throws `UNSUPPORTED_FIELD` because `inspectAuthoringRequest` (`src/authoring.js:263-267`) omitted `'rayDensity'` from `v40Fields`.
  3. **F3 (P2, Confirmed defect / upstream ULP amplification):** Equal-index neutral dielectric bodies (`insideIndex === outsideIndex`, explicitly advertised in `v40`) with `partialReflection: true` fail closed (`status: 'incomplete'`, measurements withheld) on **29 of 85 (34.1%)** integer oblique angles due to `~10⁻³²` 1-ULP floating-point noise in `BaseGlass.js:207,219,245` tripping strict `truncation > 0`.
  4. **F4 (P1, Confirmed architectural limitation):** Because pinned PhyDemo (`BaseGlass.js:242-245`) hardcodes a `0.01` brightness truncation cutoff in `colorMode: 'default'` and Opticsim withholds all measurements whenever `truncation > 0`, **`partialReflection: true` fails closed (`withheld-incomplete`) on virtually every ordinary two-face finite dielectric (`n ∈ [1.2, 4.0]`) even at maximum `brightness = 1.0`**—forcing users/LLMs onto `partialReflection: false` (always `qualified` with warnings).
  5. **F5 (P2, Confirmed defect):** `nativeComparisonReadouts` (`src/exploration.js:136-143`) omits `'beam-splitter-interactions'`, silently dropping `beam-splitter` components from browser exploration comparisons on the curated `v40-beam-splitter-bench` starter.
  6. **F6 (P2, Confirmed architectural limitation / doc gap):** `ideal-curved-mirror` (`IdealMirror.js:175-208`) is symmetrically two-sided with the *same* focal sign on front and back (a concave mirror converges rays hitting its back face), undocumented in `v40` capabilities.
  7. **F7 (P1, Confirmed architectural limitation):** Massive legacy accretion (`132` `src/` files, `21,296` LOC, `130` scripts, `123` docs, `238` test files / `36,432` LOC, `28+` bespoke analytical query modules, `~25` legacy CI browser jobs) leaks into the LLM browser workflow (`explorationContext` ships **84 KB** including legacy `v10→v11` upgrade instructions on a `v40` baseline, and `author-scene.mjs capabilities` is **120.5 KB**).
  8. **F8 (P1, Evidence / validation gap):** Despite 68 `evaluation/` directories and exemplary epistemic honesty in READMEs, actual independent external-LLM trials (`0` captured) and real teacher/student pilots (`0` participants) remain unexecuted.
  9. **F9 (P2, Security / governance / contamination hygiene):** Two large third-party archives (`01_problems.zip`, 4.54 MB; `08_Ray_Optics_Explanations.zip`, 24.16 MB, containing restricted `/Solutions/` entries) remain tracked directly in Git root.
- **Strategic Recommendation (Area J):** **Trajectory 3 (Targeted, strictly bounded corrective hardening — 1–2 small PRs fixing F1, F2, F5, `v40` `explorationContext` scoping, F3/F4/F6 documentation clarity, and F9 archive hygiene) IMMEDIATELY FOLLOWED BY `v40` Engine Freeze and Trajectories 1 + 2 (real cold external-model evaluation on unseen problems + consenting teacher/student classroom pilot).** Do **not** pursue broad `v1`–`v39` teardown (Trajectory 4) or speculative new optical primitives (Trajectory 5) before real external-model and human classroom evidence exists.

---

## 1. Workspace & Dependency Provenance

| Artifact / Check | Verified Value |
| --- | --- |
| Isolated worktree `toplevel` | `<WORKTREE_NEON_AUDITOR>` |
| `git-common-dir` | `<LOCAL_REPO_ROOT>/.git` |
| Audit commit (`HEAD`) | `0c758d7817ac68dffd5936e25109520b7f99f720` |
| Audit tree (`HEAD^{tree}`) | `d103cd993df5c74052309ec74f7cdacb925b58ef` |
| `git status --short` | Clean (empty) at start and end of audit |
| Reparse points (`Get-ChildItem -Attributes ReparsePoint`) | `0` |
| `upstream-pin.json` blob SHA | `c371abf2169bba28b1c400d022b55caf78cb647c` |
| Pinned PhyDemo `vendor/ray-optics` | `811f508d2b070898c241a568b0c167dcb8645251` (tree `4e352c91dc445c471ee126ec5214bb9d2d3df0b7`, clean, reparse=0) |
| Built headless core `dist/test-core.cjs` SHA-256 | `f54ecaac2cdb6da7f7c43f0b035d6020c64feabaae68a8a675c424aa99caa122` |
| Local Node runtime observed | Node.js `v26.13.1` (`package.json` requires `>=24.19.0`) |

---

## 2. Detailed Investigation Across All 10 Required Areas (A–J)

### Area A — Project Vision and Development Trajectory

1. **Recovered Original Vision (`PROPOSAL.md`, `AGENTS.md`, git history `1,182` commits / `231` merged PRs):**
   - Started (2026-11-01, `PROPOSAL.md`) as a clean, minimalist, pinned-PhyDemo 2D geometric-optics sandbox: one authoritative versioned JSON document, strict validation, separation of physics vs presentation vs simulation limits, and independent analytical predictions clearly distinct from finite sampled rays.
   - Evolved in `AGENTS.md` into *"LLM-directed physical exploration"*: a reusable, source-backed, versioned physical model where the LLM proposes targeted physical/structural changes by stable ID while the engine owns validation, physical admissibility, execution, conditional analytics, and explicit fail-closed error reporting.
2. **Two Distinct Historical Eras (Catalogue Drift → Composable Consolidation):**
   - **Era 1 (PRs #1–#243, schemas `v1`–`v36`):** Steady drift toward **per-apparatus/per-JEE-archetype proliferation**. Each newly analyzed JEE problem class spawned either a bespoke frozen schema (`v19`–`v36`, e.g., `native-inside-cap-tracing@32`, `native-immersed-arc-plane-port@34`, `native-rectangular-mirror-box@35`, `native-finite-guide-fan-tracing@36`) or a bespoke analytical query module (`28+` modules registered in `src/problem-workflow.js`, such as `axial-mirror-oscillation.js`, `four-wall-mirror-directions.js`, `mirror-image-outline.js`, `slab-mirror-conjugate.js`, `offset-pair-focus.js`). While each individual PR maintained high local rigor, the cumulative system became a complex 36-schema catalogue hard for any cold LLM or human to navigate.
   - **Era 2 (PRs #244–#276, `coaxial-paraxial-stack` + `v37`–`v40`):** A decisive, well-executed **architectural course correction toward genuine physical composability**:
     - PR #244 unified coaxial paraxial calculations into one exact `binary64-rational` ABCD stack (`src/coaxial-paraxial-stack.js`).
     - PRs #246–#252 built progressive composable native benches (`v37` air-only → `v38` refractive → `v39` hybrid) with witness bridges.
     - PRs #260–#276 consolidated everything into **`v40: native-optical-bench`** (`src/native-optical-bench.js`, `src/native-bench-common.js`, `src/optical-bench-witness.js`) with explicit ambient `backgroundIndex`, deterministic `randomSeed`, interior emitters/stops/detectors, decentered lenses, signed/flat spherical lenses, oriented minor/hemisphere/major circular caps, 2–4 layer touching flat media, coaxial cemented doublets/triplets, corner-touching mirror enclosures, flat/curved silvered optics, exterior beam splitters, 8 curated JEE browser starters, and slim `bench-capabilities` / `workflow-capabilities` front doors.
3. **Coherence, Complexity vs Teaching Value, and Engine/Teaching Boundary:**
   - The `v40` core + `coaxial-paraxial-stack` + `optical-bench-witness` triad **genuinely fulfills the original composability mission**.
   - However, because `v1`–`v39` and all 28+ bespoke analytical modules remain frozen in place without retiring legacy entry points, total complexity (`132` `src/` files / `21.3k` LOC, `123` docs, `130` scripts, `238` tests / `36.4k` LOC) far exceeds what a teaching tool strictly needs.
   - The boundary between **engine** (validation, pinned ray tracing, fail-closed qualification, conditional ABCD math) and **teaching/interpretation** (human/LLM question reading, pedagogy) is unusually crisp and disciplined—arguably the project's strongest philosophical asset.

---

### Area B — Deep Physical and Mathematical Correctness Audit

We audited both pinned PhyDemo (`BaseGlass.js`, `Glass.js`, `SphericalLens.js`, `ArcMirror.js`, `IdealMirror.js`, `IdealLens.js`, `BeamSplitter.js`, `SingleRay.js`, `Simulator.js`) and Opticsim's geometry/compiler/observer/analytical layers (`native-optical-bench.js`, `native-bench-common.js`, `spherical-lens.js`, `finite-circular-cap.js`, `curved-mirrors.js`, `planar-media.js`, `adapter.js`, `coaxial-paraxial-stack.js`, `optical-bench-witness.js`) and cross-checked with **independent analytical ray-tracing and ABCD oracles** (Experiments `exp1`–`exp5b`).

1. **Verified Sound Optical Laws (Independent Oracle Matches):**
   - **Coordinate transform & sign conventions:** `x-right, y-up` mm maps cleanly to PhyDemo `y-down` (`y -> -y`) across emitters, lenses, mirrors, caps, prisms, polygons, beam splitters, and detectors. `spherical-lens` outward-convex convention (`+R` convex, `-R` concave, `null` flat) maps cleanly to textbook Cartesian `R1 = frontRadius, R2 = -backRadius` and PhyDemo `SphericalLens` `DR1R2` / 6-point `path` compilation.
   - **All 6+ `spherical-lens` geometries (`exp2` D1):** Independent exact ray-sphere intersection + vector Snell's law matched PhyDemo outputs to `0` – `8.86e-14 mm` position residual and `0` – `8.68e-16` direction error across `biconvex`, `plano-convex`, `convex-plano`, `plano-concave`, `biconcave`, `pos-meniscus`, `neg-meniscus`, and `flat-flat` in ambient `n_bg = 1.2` (`insideIndex = 1.62`).
   - **Touching layered media & Snell invariant (`exp5b` #6):** 4-layer touching stack (`n = 1.33, 1.47, 1.52, 1.72`) + flush mirror return conserved `n_k sin θ_k = const` through 9 optical encounters with `2.91e-13 mm` lateral-shift error and `1.01e-14` exit direction error. PhyDemo `BaseGlass.refract` (`BaseGlass.js:164-174`) correctly multiplies/divides `refIndex` ratios (`(nA/n0)/(nB/n0) = nA/nB`) for arbitrary `backgroundIndex ∈ [1, 4]`.
   - **Coaxial cemented doublets & triplets (`exp1` 5a–5d, `exp5b` #4):** Mixing flat-face (`path: [...]` branch) and curved-face (`DR1R2` branch) lenses merged cleanly via PhyDemo `surfaceMergingObjs` (`mergedWithId: 'L2'`, `incidentIndex: 1.5, destinationIndex: 1.7`), even at extreme `R = 10,000 mm, aperture = 4 mm`, mismatched apertures (`20 mm` vs `40 mm`), cemented triplets (`L1-L2-L3`), and curved-silvered cemented doublet witness (`maxPerpendicularMissMm = 4.46e-5 mm`).
   - **Tilted major `circular-cap-dielectric` + interior source + submerged detector (`exp1` #9):** `normalDeg = 37°, capHeight = 45 > R = 30`, `n_in = 1.6, n_bg = 1.2`: Snell error `2.39e-15`, time-reversal reciprocity miss `2.72e-13 mm`.
   - **Curved & flat silvering (`exp3` 4a–4b, `exp1` 6a–6b):** Curved-silvered tilted major cap, silvered concave back face of plano-concave lens, and flush plane mirror sandwiched between two touching slabs all merged cleanly through PhyDemo `mergesWithGlass = true` (`Simulator.js:686-716`) with exact reflection counts and zero dielectric bypass.
   - **Decentered `ideal-lens` (`exp2` D2):** Oblique ray (`25°`) through decentered `ideal-lens` (`y = 20, f = 80`) matched exact thin-lens deflection `tan θ' = tan θ - (y_hit - y_lens)/f` to `0.00e+0` floating-point error.
   - **90° corner-touching plane-mirror retroreflector (`exp5b` #7):** Antiparallel return vector error `1.24e-16`.
   - **Fresnel equations & Brewster's angle (`exp4` #2):** Single-interface entry at `θ_B = atan(1.5)` (absorbed internally by a submerged blocker to isolate one interface) matched exact unpolarized `R = 0.5(R_s + R_p)` and `T = 1 - R` to `errR = 0, errT = 0, R + T = 1`.
   - **BeamSplitter power & geometry (`exp1` #8):** 2-splitter Mach-Zehnder fold (`T1 = 0.35, T2 = 0.60, brightness = 0.8`) yielded exact detector powers `0.424` and `0.376` (`sum = 0.800`, error `< 1e-12`).
   - **Coaxial paraxial stack ABCD math (`exp3` #7, `exp4` #1):** Exact `BigInt` rational propagation (`det(M) = 1` identically, `A = D` identically for return stacks), positive-monomial cancellation bounds, Galilean afocal telescope (`m = 0.25, angularScale = 4`), near-afocal `d = 75 + 1e-11` indeterminacy refusal, thin silvered equiconvex self-conjugate (`f_eq = 25, selfConj = -50`), and water-immersed thick-lens + thin-lens + curved-mirror witness (`v40Verified = true, maxPerpMissMm = 0.0278 mm`) all verified sound.

2. **Physical / Modeling Deficiencies Identified:**
   - **F4 (P1):** Finite-dielectric `partialReflection: true` truncation trap (detailed in Section 3).
   - **F6 (P2):** `ideal-curved-mirror` (`IdealMirror.js:175-208`) converges on *both* front and back faces for `f > 0` (and diverges on both for `f < 0`), unlike a physical spherical shell where front/back curvatures have opposite signs. Verified in `exp1` Test 7: back-side ray from `x = 200` on a `normalDeg = 180, f = +50` mirror converged to `(150, 0)` instead of diverging.

---

### Area C — Numerical Robustness and Adversarial Error Investigation

We probed grazing incidence, near-critical incidence, ghost-circle tangency, equal-index ULP noise, `Glass.getIncidentData` `rng() * 1e-5` parity perturbation over 8,000 mm travel, `BeamSplitter` `0.01` brightness cutoffs, acute mirror cavities (`4°`, `>16` bounces), 3-mirror Y-junctions, and large-`R` narrow-aperture sagitta conditioning (`R = 10,000 mm, ap = 4 mm`).

1. **Critical Adversarial Failures Discovered:**
   - **F1 (P1):** Ghost generating-circle tangency false rejection at admission AND runtime `v40EndpointsVerified = false` on `spherical-lens` and `circular-arc-mirror` (`exp1` 1a/1b, `exp2` C2, `exp3` #2).
   - **F3 (P2):** Equal-index neutral body (`n_in === n_out`) with `partialReflection: true` triggers `~10⁻³³..10⁻³²` ULP truncation in `BaseGlass.js` on **29/85 (34.1%)** integer angles (`exp5` #2) and full-circle fans (`exp1` #4), falsely failing closed as `incomplete`.
   - **F4 (P1):** Every two-face finite dielectric (`n ∈ {1.2, 1.5, 2, 3, 4}`, `brightness = 1.0`) with `partialReflection: true` fails closed as `withheld-incomplete` due to PhyDemo's hardcoded `0.01` brightness cutoff (`exp4` #3).
2. **Adversarial Probes That Held Up Well (No Consequential Defect Found):**
   - **Long-travel `Glass.getIncidentData` `rng() * 1e-5` parity test (`exp1` #3, `exp2` Probe B):** Across 60 seeds over 8,000 mm travel (`0.02 mm` from a slanted 45° prism corner), zero parity flips occurred. Topologically, a perturbed straight line starting outside a strictly convex body crosses 0 or 2 faces (both even), and starting inside crosses 1 face (odd), unless hitting a vertex/seam to within `1e-6 mm`—which `v40`'s `0.01 mm` corner clearance + deterministic `randomSeed` protects well. *(Residual uncertainty: a non-convex biconcave `spherical-lens` or grazing ray near a corner over extreme 10,000 mm travel could theoretically still have a narrow seed-dependent window where `rng()*1e-5` nudges `ray2` across a vertex; `v40` does not independently check outgoing Snell residuals on every glass hit, unlike `v32`'s `capNativeAudit`.)*
   - **Extreme grazing on flat non-dielectric surfaces (`exp5b` 3a–3c):** `0.00115°` incidence on 10,000 mm `plane-mirror`, `beam-splitter`, and `ideal-lens` remained accurate to `1.2e-15 mm` / `1.9e-13 mm`.
   - **Acute 4° V-mirror cavity (`exp3` 5a):** Correctly stopped at `maxRayDepth = 16` (`refl = 16, trunc = 0.2`) and failed closed (`status: 'incomplete'`).
   - **3-mirror Y-junction aimed at vertex (`exp3` 5b):** Rejected cleanly at admission by endpoint clearance (`< 0.01 mm`).
   - **BeamSplitter `0.01` cutoff (`exp4` 5a–5b):** `brightness = 0.02, T = 0.5` (`0.01` not `> 0.01`) failed closed honestly (`status: 'incomplete', trunc = 0.02`), while `brightness = 0.03, T = 0.5` (`0.015 > 0.01`) completed cleanly (`trunc = 0`).
   - **Mismatched-aperture witness bypass (`exp5b` #5):** A ray traversing `L1` (`ap = 40`) at `y = 15` and bypassing `L2` (`ap = 20`) was cleanly refused corroboration (`status: 'stack-optics-not-encountered'`).
   - **Exact Euclidean clearance predicates (`segmentOutsideCircularArcMirror`, `segmentOutsideCapExact`, `capsDisjointExact`):** Mathematically verified sound against interior extrema, circle intersections, and chord/endpoint distances.

---

### Area D — Genuine Physical Composability

**Verdict:** `v40: native-optical-bench` demonstrates **genuine, rule-governed physical composability**, not a facade of special-case problem templates.
- **Executable proof (`exp2` Probe F):** We composed an unfamiliar 10-component bench in `backgroundIndex = 1.1` simultaneously combining: an interior point source inside a `circular-cap-dielectric`, a decentered `ideal-lens`, an exterior `beam-splitter`, a touching `polygon-dielectric` + `triangular-prism` pair, a submerged `circle-blocker`, a submerged `ray-detector`, a `circular-arc-mirror`, and an exterior `ray-detector`. All interactions (`3` splitter hits, `5` cap hits, `4` slab hits, `1` mirror reflection, `1` submerged detector crossing) emerged organically from pinned PhyDemo rules with `v40EndpointsVerified = true`. Subsequently removing all 3 dielectric bodies via `reviseComponents` (`3 → 0` closure) cleanly preserved `backgroundIndex = 1.1` and `randomSeed`, turning the interior source into an ambient emitter and completing cleanly.
- **Real Composability Friction vs Intentional Boundaries:**
  - *True composability defect:* **F1** (ghost generating-circle tangency breaks unrelated rays passing far from a `spherical-lens` or `circular-arc-mirror` on a shared bench).
  - *True contract defect:* **F2** (`rayDensity` crash on `v40` witness/authoring).
  - *Intentional, cleanly enforced scope boundaries:* `maxComponents = 16`, `maxRayDepth <= 16`, `spherical-lens`/`finite-aperture`/`beam-splitter` exterior-only, `point-source` OR `parallel-beam` (not both), conservative `hypot(h, sag)` bounding-disk clearance between two curved mirrors (blocks short Cassegrain/confocal cavities), vertical-only `ideal-lens` / horizontal-axis `spherical-lens`, no `planar-interface` or GRIN in `v40`, no `ideal-image` on `v40`, and `backgroundIndex` immutable via `reviseScene`/browser UI.

---

### Area E — Architectural and Software Assessment

1. **Strengths:**
   - **Clean authority & state separation:** Authoritative JSON document → strict `validate()` → derived native scene + external `idMap` → `Session` revision-guarded async execution → hash-bound `evaluateObservables()` & portable `qualification.js` bundles.
   - **Fail-closed discipline:** `hasEndpointEvidence`, `isAcceptedExecutionSummary`, `qualifyRunnerSummary`, and `classifyRun` systematically withhold measurements on truncation, undefined behavior, stops, stale SHAs, or audit faults.
   - **Shared common geometry (`src/native-bench-common.js`, `src/witness-common.js`):** Consolidation of `v37`–`v40` geometry/audits and witness helpers significantly improved maintainability over earlier duplicated code.
   - **Sound `v1`–`v39` freeze:** Historical schemas remain isolated; unmarked requests keep historical routing without silent migration.
2. **Weaknesses & Coupling:**
   - **Massive legacy surface (`F7`):** `132` `src/` modules, `28+` bespoke analytical query modules wired into `src/problem-workflow.js`, a 25-clause `choice(c.type, ...)` expression in `src/contract.js:122`, 14 version-specific endpoint audit branches in `src/adapter.js:106-126, 319`, ~200 lines of legacy conditional guidance in `src/app.js:221-435`, and ~25 legacy browser/acceptance CI steps in `.github/workflows/opticsim-ci.yml`.
   - **Incomplete `beam-splitter` wiring (`F5`):** Added to `contract.js`, `adapter.js`, `observables.js`, `native-optical-bench.js`, `app.js`, and `problem-workflow.js` (sole-target auto-binding verified in `exp5` #1), but missed in `src/exploration.js:137` (`nativeComparisonReadouts`).
   - **Contract drift (`F2`):** `src/optical-bench-witness.js` assumes `prepareScene` accepts `rayDensity` for `v40` (and `prepareScene:450` even writes it!), but `inspectAuthoringRequest` (`src/authoring.js:265`) rejects it.
   - **Dual `v40` browser/CLI context gap:** `explorationContext` (`src/exploration.js:41`) embeds the full 120 KB legacy `capabilities()` even for `v40` scenes, whereas `focusedExplorationContext` (`7.8 KB`) and `bench-capabilities` (`17.7 KB`) are properly slimmed.

---

### Area F — Test Quality and Strength of Existing Evidence

- **Scale:** `238` test files (`36,432` LOC), including `test/native-optical-bench.test.mjs` (`171.5 KB`), `test/optical-bench-witness.test.mjs` (`37.1 KB`), `test/v40-llm-front-door.test.mjs` (`37.6 KB`), `test/v40-arc-clearance-and-submerged-stops.test.mjs` (`33.8 KB`), `test/v40-beam-splitter.test.mjs` (`22.7 KB`), plus real headless Chrome CDP acceptance (`scripts/browser-acceptance.mjs`, 627 lines, verifying all 8 `v40` starters, keyboard `badInput` handling on nullable radii, beam-splitter readout regression, and hosted subpath smoke).
- **Strengths:** Unlike superficial snapshot suites, the `v40` and witness tests genuinely write independent 2D Snell/reflection/ABCD mathematical oracles and check exact geometric residuals, negative controls, and real Chrome DOM/canvas rendering.
- **Blind Spots Exposed by This Audit:**
  - Tests were written alongside features by the same development loop and therefore share author mental models—missing **F1** (tested `cap` absent-arc tangency after review, never tested `spherical-lens` or `circular-arc-mirror` absent-arc tangency), **F2** (tested `witness-optical-bench` without ever passing the documented `rayDensity` field), **F3** (tested index-matched neutral slab only with `partialReflection: false` or normal incidence), and **F5** (verified `v40-beam-splitter-bench` in Chrome without calling `nativeComparisonReadouts`).
  - **Crucial evidence distinction (`F8`):** All `238` unit tests and `68` `evaluation/` folders constitute **software & same-assistant developmental verification only**—NOT independent external-LLM accuracy or classroom educational effectiveness.

---

### Area G — LLM Authorability

*(Note: Because this auditor studied the repository source directly, this is a structural/front-door assessment, strictly distinct from a genuinely cold external-model trial.)*
- **What works well:**
  - `node scripts/author-scene.mjs bench-capabilities` (`17,701` bytes) and `workflow-capabilities` (`11,317` bytes) are crisp, self-contained, and eliminate the need to inspect `v1`–`v39` schemas.
  - Explicit nesting rules (`parameters: {...}`, sibling `emission: {mode, ...}`), explicit `lengthUnit`, structured error paths (`AuthoringError`), SHA-guarded `revise` / `revise-components`, and `focusedExplorationContext` (`7,816` bytes) give clear error recovery loops.
  - `skills/sim-ro-problem/SKILL.md` honestly documents when to use `v40` vs `coaxial-paraxial-stack` vs legacy profiles (`ideal-image`, `planar-interface`, GRIN).
- **Remaining LLM Authorability Friction:**
  - **Discovery trap:** `author-scene.mjs capabilities` (`120.5 KB`) and `run-problem.mjs capabilities` (`~180 KB`) and browser `explorationContext` (`84 KB` on `v40`) still ship massive legacy `v1`–`v39` dumps; a cold LLM handed `explorationContext` for a `v40` structural edit gets drowned in irrelevant `v10→v11` / `v25` / `v35` details.
  - **Silent `partialReflection: true` failure loop (`F4`):** A physics-literate cold LLM authoring a realistic glass prism or lens will naturally set `partialReflection: true` (standard textbook optics!) and be baffled when every run returns `withheld-incomplete` with `truncation: 0.0015`, even though `bench-capabilities` only warns about *"low-contrast multi-layer stacks or closed spheres"*.
  - **Ghost-circle false rejections (`F1`) & `witness` `rayDensity` crash (`F2`)** will directly punish valid cold-LLM attempts.
  - **`ideal-image` unavailability on `v40`:** A cold LLM that follows the default recommendation (`model: "native-optical-bench"`) for a simple 1-lens problem and requests `ideal-image` gets `status: 'unavailable'`, requiring it to know to omit `model` (legacy `v4`) or switch to `coaxial-paraxial-stack`—documented in `SKILL.md`, yet a predictable cold-model friction point.

---

### Area H — JEE Relevance and Practical Teaching Value

- **JEE Main / Advanced Coverage:** `v40` + `coaxial-paraxial-stack` covers the **core 85–90% of 2D JEE geometric ray optics** through general primitives rather than exam hacks: plane/curved mirrors & mirror enclosures (kaleidoscopes, corner reflectors, boxes), thin & decentered/split lenses (Billet split-lens), thick spherical lenses (all 6 shapes) + spherical aberration vs paraxial witness, prisms/slabs/circles/oriented circular caps (Snell's window, paperweights, hemispheres, internal bubbles), 2–4 layer touching media, cemented doublets/triplets, flat & curved silvered optics, broadband beam splitters, opaque stops (ambient & submerged), and passive detectors.
- **High-Value Classroom / JEE Gaps vs Low-Value Academic Edge Cases:**
  - *High practical classroom value:*
    1. Fixing **F1/F2/F5** so multi-element classroom setups don't fail inexplicably.
    2. Interactive **`backgroundIndex` editing** in the browser UI / `reviseScene` (comparing a lens/prism in air vs water is one of the highest-value JEE/classroom demonstrations; currently requires hand-editing JSON and updating every body's `outsideIndex`!).
    3. Clearer **`partialReflection: true` UX** (currently toggling Fresnel on in the browser makes all measurements vanish into `incomplete` on every finite glass starter).
  - *Moderate future value (defer until after external pilot):* Chromatic dispersion (`simulateColors` + `cauchyB`, already in pinned PhyDemo) for prism spectrum & achromatic doublet teaching; tilted `ideal-lens` / `spherical-lens`.
  - *Low value / academic edge cases (do NOT prioritize):* GRIN in `v40`, arbitrary N-gon non-convex glass, short-cavity curved-mirror pairs, 3D optics, wave diffraction.
- **Priority Judgment:** Right now, **classroom usability and external validation far outweigh adding more physics primitives.**

---

### Area I — Security and Trustworthiness

- **Verified Strong Controls:**
  - Zero `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval(`, `new Function`, or `document.write` sinks across `src/*.js`.
  - Strict CSP in `public/index.html` (`default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'`).
  - `scripts/serve.mjs` binds strictly to `127.0.0.1`, validates `OPTICSIM_BASE_PATH`, resolves paths under `root + sep`, and disables caching.
  - `scripts/authoring-evidence.mjs` validates all ancestor directories against symlinks and uses exclusive `wx` writes confined to `test-artifacts/llm-authoring/`.
  - `scripts/pack-demo.mjs` constructs `test-artifacts/demo-site/` from an explicit allowlist, validates every bundled scene, verifies license notices, and excludes `test-core.cjs`, `.env`, `vendor/`, and repo archives.
  - `.github/workflows/opticsim-pages.yml` has zero automatic triggers (`workflow_dispatch` only, requiring explicit `public-site-approved`).
  - `scripts/setup.mjs` verifies exact upstream commit SHA and clean `git diff` on `vendor/ray-optics` with frozen `npm ci --omit=optional`.
  - `qualification.js` enforces 1 MB bundle caps, bounded arrays/text lengths, strict schema validation, and SHA-256 tamper detection (honestly labeled as mismatch detection, not cryptographic authenticity).
- **Identified Trustworthiness / Hygiene Concern:**
  - **F9 (P2):** `01_problems.zip` (4.54 MB) and `08_Ray_Optics_Explanations.zip` (24.16 MB) are tracked in Git root (`git ls-files "*.zip"`). This introduces potential benchmark-contamination and third-party copyright/licensing exposure if the repository is ever shared or made public.

---

### Area J — Strategic Phase-Gate Decision

| Trajectory | Assessment | Key Tradeoffs |
| --- | --- | --- |
| **1. Immediate freeze of `v40` → external-model & classroom evaluation** | **Close, but premature by 1–2 small PRs** | Solves the #1 evidence gap (F8), but freezes two reproducible P1 defects (F1 ghost-circle tangency, F2 `witness` `rayDensity` crash) + F5 + 84 KB `v40` `explorationContext` bloat that will cause avoidable false failures during external trials. |
| **2. Fresh unseen JEE benchmark before freeze** | **Useful as Phase B of evaluation, not before hardening** | Measures cold-LLM fidelity, but hits F1/F2/F4 traps if run before targeted fixes, and still leaves classroom usability (`teacherParticipants = 0`) untested. |
| **3. Targeted corrective hardening → freeze → external pilot (RECOMMENDED)** | **Optimal phase-gate path** | **1–2 tightly scoped PRs** fix F1, F2, F5, `v40` `explorationContext` scoping, honest F3/F4/F6 docs, and F9 archive hygiene (zero new optical primitives, zero core edits). Immediately freeze `v40` and execute both a cold external-model held-out trial (Trajectory 2) and a real consenting teacher/student pilot (Trajectory 1). |
| **4. Broad architectural consolidation / `v1`–`v39` simplification** | **Defer** | High regression/churn cost on frozen backward-compatibility contracts with low near-term leverage for external evaluation. Keep `v1`–`v39` strictly frozen; revisit CI/legacy pruning only after external pilot validates `v40` adoption. |
| **5. Narrowly targeted capability growth (e.g., dispersion, tilted lenses, GRIN)** | **Reject at this gate** | `v40` already covers ~85–90% of core 2D JEE/classroom ray optics cleanly. Adding capabilities before any external-model or teacher feedback risks building speculative features instead of fixing real adoption bottlenecks. |

**Reversal Conditions:**
- Re-open targeted capability growth (Trajectory 5) **only if** real cold-LLM trials or consenting teacher/student pilots show recurring high-value failure modes that `v40` cannot express (e.g., strong teacher demand for editable ambient `backgroundIndex` in the browser UI, or chromatic dispersion for prism/achromat teaching).
- Re-open CI/legacy consolidation (Trajectory 4) if CI runtime or maintenance cost of the ~25 legacy `v18`–`v36` browser scripts blocks rapid iteration on external-pilot fixes.

---

## 3. Structured Findings Register (Full Provenance)

### Finding F1 — Ghost Generating-Circle Tangency False Positives on `spherical-lens` and `circular-arc-mirror`
- **Classification:** `P1` | `Confirmed defect`
- **Baseline:** `0c758d7817ac68dffd5936e25109520b7f99f720` (tree `d103cd993df5c74052309ec74f7cdacb925b58ef`)
- **Anchors:** `src/native-bench-common.js:656-690` (`componentTangentCircles`, `rayNearTangentCircle`); `src/native-optical-bench.js:287-291`; `src/native-bench-common.js:816-830, 883-899`; policy anchor `AGENTS.md:187`.
- **Expected behavior & justification:** Tangency guards exist solely to reject rays grazing the *physical* curved surface (where binary64 intersection/normal conditioning breaks down). Absent portions of a generating circle outside the physical lens aperture or mirror arc have no optical interaction and must never trigger tangency failures—the exact invariant already fixed for `circular-cap-dielectric` (`tc.cap`).
- **Observed behavior:** Both admission (`prepareScene`) and runtime (`installBenchEndpointAudit` → `v40EndpointsVerified = false`, `status = 'failed'`) reject rays passing **40 mm above** a `circular-arc-mirror` (`R = 50, ap = 20`) and **90 mm above** a `spherical-lens` (`R = 100, ap = 20`) because their straight-line extensions are tangent to the absent ghost generating circle.
- **Minimal reproduction:** `exp1-physics-adversarial.mjs` (Tests `1a`, `1b`), `exp2-deep-probes.mjs` (`Probe C` `C2`), `exp3-more-audits.mjs` (`Test 2`).
- **Practical significance:** High. Any multi-element `v40` bench or wide fan containing a moderate/large-radius `spherical-lens` or `circular-arc-mirror` can spuriously fail validation or withhold all measurements on completely unrelated rays traversing empty space.
- **Verification status:** Verified executably at both admission and runtime for both component types.
- **Recommended fix:** Add physical-arc predicates to `componentTangentCircles` / `rayNearTangentCircle` for `circular-arc-mirror` (center-referenced angular inclusion `angle <= halfAngle + clearance/radius`, matching `pointOnFlushMirror`) and `spherical-lens` (`pClosest.y ∈ [g.bottom - clearance, g.top + clearance]` and correct side of center), plus regression tests at admission and runtime.
- **Remaining uncertainty:** None on the defect itself; verify `v37`/`v38`/`v39` stay intentionally frozen or evaluate whether `native-bench-common.js` fix should be scoped to `v40` only to preserve frozen `v37`–`v39` behavior.

### Finding F2 — Documented `rayDensity` Override on `v40` Witness Bridge & `prepareScene` Throws `UNSUPPORTED_FIELD`
- **Classification:** `P1` | `Confirmed defect`
- **Baseline:** `0c758d7817ac68dffd5936e25109520b7f99f720`
- **Anchors:** `src/optical-bench-witness.js:86, 339-340, 529`; `src/authoring.js:263-267, 450`.
- **Expected behavior & justification:** `opticalBenchNativeWitnessCapabilities()` advertises `rayDensity` as an optional explicit override passed to `v40` `prepareScene`, and `prepareScene:450` already applies `request.rayDensity`. Supplying a valid `rayDensity` (e.g., `0.5`) should build a valid `v40` witness plan.
- **Observed behavior:** Throws `AuthoringError: $.rayDensity: This field is not in the authoring contract` because `inspectAuthoringRequest` (`src/authoring.js:263-267`) allows `rayDensity` only for legacy `v29`/`v30`/`v36`, not `v40`.
- **Minimal reproduction:** `exp1-physics-adversarial.mjs` (Test `2`).
- **Practical significance:** High for witness callers and LLMs tuning directional-fan or parallel-beam density per the published capability contract.
- **Verification status:** Verified executably.
- **Recommended fix:** Add `'rayDensity'` to `v40Fields` in `src/authoring.js:265` with finite bounds check `[SAMPLING_PRESETS.sparse, 1]` (matching `contract.js:212`) and expose it in `opticalBenchCapabilities().optionalRequestFields`, plus unit tests in `test/optical-bench-witness.test.mjs`.
- **Remaining uncertainty:** None.

### Finding F3 — Equal-Index Neutral Dielectric Bodies with `partialReflection: true` Fail Closed on 34% of Oblique Angles Due to `~10⁻³²` ULP Noise
- **Classification:** `P2` | `Confirmed defect` (upstream ULP noise amplified by strict `truncation > 0` gate)
- **Baseline:** `0c758d7817ac68dffd5936e25109520b7f99f720`
- **Anchors:** `vendor/ray-optics/src/core/sceneObjs/BaseGlass.js:207, 219, 222-223, 242-245`; `src/adapter.js:319`; `docs/NATIVE-OPTICAL-BENCH.md:22`.
- **Expected behavior & justification:** For an explicitly admitted equal-index neutral body (`insideIndex === outsideIndex`, `n1 = 1`), Fresnel reflectance is mathematically identically zero (`R_s = R_p = 0`), so no reflection or brightness truncation should occur.
- **Observed behavior:** `Math.sqrt(1 - (1 - cos1*cos1))` differs from `cos1` by 1 ULP on **29 of 85 (34.1%)** integer incidence angles (`exp5` #2: e.g., `53°` gives `truncation = 4.25e-33`) and on full-circle fans (`exp1` #4: `truncation = 1.73e-32`), tripping `data.truncation > 0` and withholding all measurements as `incomplete`.
- **Minimal reproduction:** `exp1-physics-adversarial.mjs` (Test `4`), `exp5-edge-cases.mjs` (Test `2`).
- **Practical significance:** Moderate; breaks index-matching fluid / vanishing-glass demonstrations whenever `partialReflection: true` is left enabled.
- **Verification status:** Verified executably across 85 angles and 4 emitter modes.
- **Recommended fix:** Because pinned PhyDemo cannot be modified without separate approval, explicitly document in `bench-capabilities` and `docs/NATIVE-OPTICAL-BENCH.md` that equal-index neutral bodies require `partialReflection: false` (or evaluate an exact `refIndex === 1` guard only if upstream changes are ever authorized—do NOT relax real `truncation > 0` gating!).
- **Remaining uncertainty:** Also affects touching equal-index pairs (`nA === nB`) at their shared face if outer faces didn't already truncate.

### Finding F4 — Universal Finite-Dielectric `partialReflection: true` Truncation Trap
- **Classification:** `P1` | `Confirmed architectural limitation` (pinned PhyDemo `0.01` brightness cutoff + Opticsim fail-closed `truncation > 0` policy)
- **Baseline:** `0c758d7817ac68dffd5936e25109520b7f99f720`
- **Anchors:** `vendor/ray-optics/src/core/sceneObjs/BaseGlass.js:242-254`; `src/adapter.js:93, 319`; `docs/NATIVE-OPTICAL-BENCH.md:563`; `skills/sim-ro-problem/SKILL.md:21`.
- **Expected behavior & justification:** Users/LLMs expect `partialReflection: true` to be usable on standard finite glass optics (or to be plainly warned that it almost never yields accepted measurements on closed finite bodies).
- **Observed behavior:** Verified in `exp4` Test `3` across `n ∈ {1.2, 1.5, 2.0, 3.0, 4.0}` at maximum `brightness = 1.0`: every single finite-slab ray trace with `partialReflection: true` returns `status: 'incomplete'`, `executionPassed: false`, `measurementState: 'withheld-incomplete'` (`truncation = 1.2e-3..1.6e-2`). Current docs understate this as occurring *"on low-contrast multi-layer stacks or closed spheres"*.
- **Minimal reproduction:** `exp4-verify-more.mjs` (Test `3`).
- **Practical significance:** High for both cold LLMs (who naturally set `partialReflection: true` for textbook glass and get stuck on `withheld-incomplete`) and classroom teachers (toggling the Fresnel checkbox in the browser wipes out all detector readouts).
- **Verification status:** Verified executably and mathematically (geometric decay `R^k` must cross `0.01` or `maxRayDepth = 16`).
- **Recommended fix:** Update `bench-capabilities`, `SKILL.md`, `docs/NATIVE-OPTICAL-BENCH.md`, and the browser checkbox note (`src/app.js:256`) to state bluntly that `partialReflection: true` on multi-face finite dielectrics almost always triggers PhyDemo's `0.01` brightness truncation cutoff (withholding measurements for visual-only exploration), and recommend `partialReflection: false` for qualified native measurements.
- **Remaining uncertainty:** Whether a future non-`default` PhyDemo `colorMode` (`1e-6` cutoff) would help—no, `R^k` still hits `1e-6` or `maxRayDepth = 16`! This is fundamental to exact infinite-bounce Fresnel series under any finite cutoff + strict `truncation === 0` qualification.

### Finding F5 — `nativeComparisonReadouts` Silently Drops `beam-splitter-interactions`
- **Classification:** `P2` | `Confirmed defect`
- **Baseline:** `0c758d7817ac68dffd5936e25109520b7f99f720`
- **Anchors:** `src/exploration.js:136-143`; `src/observables.js:22`; `scenes/v40-beam-splitter-bench.json`.
- **Expected behavior & justification:** Automatic comparison readouts in browser exploration should include all native component counter observables, including `beam-splitter-interactions` for `beam-splitter` components.
- **Observed behavior:** `nativeComparisonReadouts` on `scenes/v40-beam-splitter-bench.json` omits `BS1` (`exp2` Probe E: `hasBS=true, bsInCompReadouts=false`).
- **Minimal reproduction:** `exp2-deep-probes.mjs` (`Probe E`).
- **Practical significance:** Moderate; degrades browser scenario-comparison UX on the newest curated `v40` starter.
- **Verification status:** Verified executably.
- **Recommended fix:** Add `'beam-splitter-interactions'` to `kinds` in `src/exploration.js:137` and add a unit test in `test/v40-beam-splitter.test.mjs`.
- **Remaining uncertainty:** None.

### Finding F6 — `ideal-curved-mirror` Acts Symmetrically Two-Sided with Identical Focal Sign
- **Classification:** `P2` | `Confirmed architectural limitation` (pinned PhyDemo `IdealMirror` behavior + documentation gap)
- **Baseline:** `0c758d7817ac68dffd5936e25109520b7f99f720`
- **Anchors:** `vendor/ray-optics/src/core/sceneObjs/mirror/IdealMirror.js:175-208`; `src/native-optical-bench.js:504-505`; `src/app.js:287-288`.
- **Expected behavior & justification:** Either back-side incidence should match physical spherical curvature reversal (which `circular-arc-mirror` does) or `ideal-curved-mirror` documentation must explicitly warn that both sides act concave for `f > 0` and both sides act convex for `f < 0`.
- **Observed behavior:** `exp1` Test `7` confirmed a `normalDeg: 180, focalLength: +50` `ideal-curved-mirror` converges rays from `x = 0` to `(50, 0)` AND converges rays from the back (`x = 200`) to `(150, 0)`.
- **Minimal reproduction:** `exp1-physics-adversarial.mjs` (Test `7`).
- **Practical significance:** Moderate; can mislead students or LLMs on multi-element benches where stray/returned rays strike the rear of an `ideal-curved-mirror`.
- **Verification status:** Verified executably and via `IdealMirror.js` source.
- **Recommended fix:** Explicitly document symmetric two-sided focal-sign behavior in `bench-capabilities` (`src/native-optical-bench.js:505`), `docs/NATIVE-OPTICAL-BENCH.md`, and `src/app.js:288`, recommending `circular-arc-mirror` whenever physical front/back curvature asymmetry matters.
- **Remaining uncertainty:** None.

### Finding F7 — Legacy `v1`–`v39` Accretion & Oversized `explorationContext` Payload on `v40` Baselines
- **Classification:** `P1` | `Confirmed architectural limitation`
- **Baseline:** `0c758d7817ac68dffd5936e25109520b7f99f720`
- **Anchors:** `src/exploration.js:31-44` (`explorationContext` embeds full `120,538`-byte `capabilities()` and legacy `v10→v11` instructions); `src/contract.js:122`; `src/adapter.js:106-126, 319`; `src/problem-workflow.js:48-199`; `src/app.js:221-435`; `.github/workflows/opticsim-ci.yml:39-121`.
- **Expected behavior & justification:** Full structural LLM context exported from a `v40` browser scene should expose the clean `v40` contract (~18 KB) without burying the LLM in 100 KB of frozen `v1`–`v39` apparatus schemas and legacy `v10→v11` upgrade text.
- **Observed behavior:** `explorationContext` on `v40-beam-splitter-bench.json` emits **83,979 bytes** (`exp3` #6) vs `7,816` bytes for `focusedExplorationContext`, and `author-scene.mjs capabilities` emits **120,538 bytes**.
- **Minimal reproduction:** `exp3-more-audits.mjs` (Test `6`) and `node scripts/author-scene.mjs capabilities`.
- **Practical significance:** High for LLM-assisted structural exploration from the browser on `v40` scenes, and moderate ongoing CI/maintenance drag.
- **Verification status:** Verified executably.
- **Recommended fix:** Scope `explorationContext` when `parent.scene.schemaVersion === 40` to emit `opticalBenchCapabilities()` + `v40`-relevant revision instructions (dropping legacy `v1`–`v39` catalog and `v10→v11` upgrade text); leave historical `v1`–`v39` code frozen rather than attempting risky repo-wide deletion at this gate.
- **Remaining uncertainty:** Check whether any existing test in `test/` asserts exact legacy `capabilities()` keys inside `explorationContext` for `v40` scenes before changing.

### Finding F8 — Zero Independent External-Model Trials and Zero Real Teacher/Student Evidence
- **Classification:** `P1` | `Evidence or validation gap`
- **Baseline:** `0c758d7817ac68dffd5936e25109520b7f99f720`
- **Anchors:** `evaluation/heldout-authoring-v1/README.md:10, 184`; `evaluation/focused-context-pair-v1/README.md:3, 76`; `evaluation/teaching-cross-family-v1/README.md:35`.
- **Expected behavior & justification:** Mission success ("LLM-authorable physics simulation engine ... practical teaching applications downstream") cannot be certified by software CI or same-assistant tests alone (`AGENTS.md:13`).
- **Observed behavior:** Across 68 `evaluation/` directories and 231 merged PRs, external cold-model captures = `0`, consenting teacher participants = `0`, student participants = `0`.
- **Practical significance:** Highest strategic risk—further engine development without real external-model and teacher feedback risks optimizing internal engineering elegance instead of real classroom/LLM bottlenecks.
- **Verification status:** Confirmed directly from repo evaluation records.
- **Recommended fix:** Execute targeted hardening (F1, F2, F5, F7-context, F3/F4/F6 docs, F9), freeze `v40`, and prioritize a real cold external-model held-out trial + real teacher pilot as the next milestone.
- **Remaining uncertainty:** Actual cold-LLM first-attempt pass rate and teacher comprehension rate on `v40` remain completely unknown until measured.

### Finding F9 — Tracked 28.7 MB External JEE Problem/Solution Archives in Repository Root
- **Classification:** `P2` | `Evidence or validation gap` / Governance & Security Hygiene
- **Baseline:** `0c758d7817ac68dffd5936e25109520b7f99f720`
- **Anchors:** `git ls-files "*.zip"` → `01_problems.zip` (`4,537,987` bytes), `08_Ray_Optics_Explanations.zip` (`24,157,847` bytes); `AGENTS.md:104, 134`.
- **Expected behavior & justification:** Protected source/solution archives should live outside the tracked source tree (or in an isolated ignored path) to prevent inadvertent benchmark contamination by AI agents/tools and avoid third-party copyright risk if the repository is ever shared/opened.
- **Observed behavior:** Both ZIP archives are tracked directly at the repository root (verified via `git ls-files` only; contents strictly untouched). Note: `scripts/pack-demo.mjs` cleanly excludes them from the static browser demo.
- **Practical significance:** Moderate contamination and licensing risk; zero impact on browser demo bundle security.
- **Verification status:** Verified via `git ls-files` and `Get-ChildItem`.
- **Recommended fix:** Keep them out of any public release/demo (already enforced), and decide with the human owner whether to remove/untrack them from future main commits or document explicit private-repo-only retention.
- **Remaining uncertainty:** Exact copyright/redistribution terms of the two ZIP archives were not inspected (archives intentionally unopened).

### Finding F10 — `v40` Ambient `backgroundIndex` Immutability in Browser UI & `reviseScene`
- **Classification:** `P3` | `Optional improvement` (Intentional current scope boundary)
- **Baseline:** `0c758d7817ac68dffd5936e25109520b7f99f720`
- **Anchors:** `src/app.js:366-368`; `src/authoring.js:485-491`; `docs/NATIVE-OPTICAL-BENCH.md:79`.
- **Observed behavior:** `backgroundIndex` is read-only in the browser sidebar (shown only inside the collapsed `<details>` guidance block) and cannot be changed via `reviseScene` (`exp3` #6: `No component has that stable ID`). Changing a lens/prism's ambient medium from air (`1.0`) to water (`1.33`) requires manually editing raw JSON (`physics.backgroundIndex` AND every dielectric body's `outsideIndex`).
- **Practical significance:** Minor engineering gap, high potential classroom delight for immersion experiments—worth evaluating after teacher pilot feedback.

---

## 4. Explicitly Investigated Areas Where No Consequential Defect Was Found

1. **Exact 2D Refraction/Reflection/Thin-Lens/BeamSplitter Physics in `v40`:** All 6+ signed/flat `spherical-lens` shapes (`err <= 8.9e-14 mm`), 4-layer touching stack + flush mirror (`2.9e-13 mm`), tilted major `circular-cap-dielectric` + interior source + reciprocity (`2.7e-13 mm`), single-interface Brewster Fresnel (`err = 0`), decentered `ideal-lens` (`err = 0`), 90° corner reflector (`1.2e-16`), Mach-Zehnder 2-splitter power conservation (`err < 1e-12`), grazing non-dielectric segments (`<= 1.9e-13 mm`).
2. **Coaxial Paraxial Stack (`src/coaxial-paraxial-stack.js`) & `v40` Witness Corroboration (`src/optical-bench-witness.js`):** Exact unimodular rational ABCD propagation, positive-monomial cancellation guards, water-immersed witness, curved-silvered cemented doublet witness, and mismatched-aperture bypass rejection all behaved strictly as specified (aside from F2 `rayDensity`).
3. **`v40` Curated Browser Starters (`scenes/v40-*.json` & `scenes/native-optical-bench.json`):** All 8 starters executed cleanly (`executionPassed = true, status = 'completed', truncation = 0, warnings = 0`).
4. **Structural Deletion Closure (`4 → … → 0`) & Flat-Baseline Parameter Sweeps (`exp2` Probe F, `exp3` #6):** `reviseComponents` cleanly preserved `backgroundIndex` and `randomSeed`; `runParameterSweep` cleanly swept `spherical-lens.frontRadius` starting from `null` (flat) at `maxRayDepth = 16`.
5. **Sole-Target Auto-Binding for `beam-splitter-interactions` (`exp5` #1):** `planProblem` cleanly bound omitted `componentId` to `BS1`.
6. **DOM Injection / CSP / Static Server / Evidence Storage / Demo Packaging Security (`src/*.js`, `public/index.html`, `scripts/serve.mjs`, `scripts/authoring-evidence.mjs`, `scripts/pack-demo.mjs`, `opticsim-pages.yml`):** Zero XSS/eval sinks, strict self-origin CSP, localhost-only path-safe server, symlink-safe `wx` evidence writer, strict demo allowlist, manual-only Pages deployment.
7. **Long-Travel `Glass.getIncidentData` `rng() * 1e-5` Parity Stability on Convex Bodies (`exp1` #3, `exp2` Probe B):** Zero parity flips across 60 seeds at `8,000 mm` travel (`0.02 mm` from corner).

---

## 5. Exact Executable Experiment Inventory

All disposable scripts are saved privately in `<LOCAL_SCRATCH_NEON_AUDITOR>\` and executed against `dist/test-core.cjs` (`SHA-256 = f54ecaac2cdb6da7f7c43f0b035d6020c64feabaae68a8a675c424aa99caa122`).

| Script | Command | Tests Executed | Key Expected vs Observed |
| --- | --- | --- | --- |
| `exp1-physics-adversarial.mjs` | `node "...\scratch\exp1-physics-adversarial.mjs"` | 1a–1d ghost-circle tangency; 2 witness `rayDensity`; 3 long-travel `rng()` flip; 4/4b equal-index neutral body; 5a–5d cemented doublets/triplets (mixed `path`+`DR1R2`, `R=10000`, mismatched ap); 6a–6b sandwiched flush mirror; 7 `IdealMirror` back-side; 8 Mach-Zehnder 2-splitter; 9 tilted major cap + reciprocity; 10 water-immersed witness | **Findings:** 1a/1b rejected ray 40/90mm away from optic (F1); 2 threw `UNSUPPORTED_FIELD` on `rayDensity` (F2); 4 failed closed with `trunc=1.73e-32` (F3); 7 confirmed back-side concave convergence (F6). **Passes:** 5a–5d, 6a–6b, 8 (`0.424+0.376=0.800`), 9 (`snellErr=2.4e-15, recipMiss=2.7e-13`). (Test 10 had harness return bug, fixed & passed in `exp4`.) |
| `exp2-deep-probes.mjs` | `node "...\scratch\exp2-deep-probes.mjs"` | Probe A witness diag; Probe B inside→outside `rng()` flip (40 seeds); Probe C runtime ghost-circle tangency; Probe D independent oracles (8 `spherical-lens` shapes + decentered `ideal-lens` + corner reflector); Probe E all 8 `v40` starters + `nativeComparisonReadouts`; Probe F 10-component unfamiliar bench + `3→0` deletion closure | **Findings:** Probe C2 failed runtime `v40EndpointsVerified=false` 90mm above `spherical-lens` (F1); Probe E confirmed `bsInCompReadouts=false` on `v40-beam-splitter-bench` (F5). **Passes:** All 8 `spherical-lens` shapes (`err <= 8.9e-14 mm`), decentered lens (`0`), all 8 starters (`completed`), 10-comp bench & `3→0` closure. |
| `exp3-more-audits.mjs` | `node "...\scratch\exp3-more-audits.mjs"` | 1 Probe A diag; 2 runtime ghost-circle tangency on `circular-arc-mirror`; 3 Brewster Fresnel; 4a–4b curved silvering on tilted major cap & concave lens; 5a–5b acute 4° V-mirror & 3-mirror Y-junction; 6 `focusedExplorationContext` vs `explorationContext` sizes & `null`-start `frontRadius` sweep; 7 coaxial paraxial stack adversarial checks | **Findings:** #2 failed runtime `v40EndpointsVerified=false` 40mm above `circular-arc-mirror` (F1); #3 truncated at `9.32e-3` on 3rd internal bounce (F4); #6 `explorationContext` = `83,979` B vs `focused` = `7,816` B (F7). **Passes:** 4a–4b curved silvering, 5a truncation fail-closed, 5b vertex refusal, `null`-start sweep (`3/3`), Galilean/near-afocal/silvered ABCD checks. |
| `exp4-verify-more.mjs` | `node "...\scratch\exp4-verify-more.mjs"` | 1 water-immersed witness (fixed harness); 2 single-interface Brewster Fresnel (with submerged blocker); 3 finite slab `partialReflection=true` across `n ∈ {1.2, 1.5, 2, 3, 4}`; 4 equal-index neutral bodies at 7°; 5a–5b `BeamSplitter` `0.01` cutoff | **Findings:** #3 ALL 5 indices failed closed (`withheld-incomplete`, `trunc = 1.2e-3..1.6e-2`) at max `brightness=1.0` (F4). **Passes:** #1 water-immersed witness (`v40Verified=true, maxPerpMissMm=0.0278`), #2 Brewster exact (`errR=0, errT=0, sumRT=1`), #5a–5b `BeamSplitter` cutoff. |
| `exp5-edge-cases.mjs` & `exp5b-edge-cases.mjs` | `node "...\scratch\exp5-edge-cases.mjs"` & `exp5b-edge-cases.mjs` | 1 `planProblem` sole-target binding for `beam-splitter-interactions`; 2 integer-angle sweep `1°..85°` on equal-index neutral slab (`partialReflection=true`); 3a–3c grazing (`0.00115°`) plane-mirror, beam-splitter, ideal-lens; 4 curved-silvered cemented doublet witness; 5 mismatched-aperture doublet bypass witness; 6 4-layer touching stack + flush mirror Snell invariant; 7 90° corner reflector | **Findings:** #2 **29/85 (34.1%)** integer angles failed closed with `trunc ~ 1e-33..1e-32` (F3). **Passes:** #1 sole-target bound to `BS1`, #3a–3c grazing (`1.2e-15..1.9e-13 mm`), #4 witness (`4.46e-5 mm`), #5 bypass refused, #6 4-layer Snell invariant (`2.91e-13 mm`), #7 corner reflector (`1.24e-16`). |

---

## 6. Open Questions

1. **Scope of F1 fix:** Should the physical-arc tangency restriction in `src/native-bench-common.js` apply to `v40` only (preserving frozen `v37`–`v39` rejection behavior byte-for-byte) or across shared `v37`–`v40`? *(Prefer `v40`-scoped option flag if strict `v37`–`v39` freeze is paramount, or verify no `v37`–`v39` negative control relies on ghost-circle rejection.)*
2. **Scope of F2 fix:** Should `rayDensity` be admitted as an optional top-level `v40` authoring field in `prepareScene` (matching `optical-bench-witness.js:86` and `prepareScene:450`) or removed from `optical-bench-witness.js`? *(Admitting it cleanly in `v40Fields` with `[0.048, 1]` bounds is strictly more useful and consistent.)*
3. **Browser UX for `v40` `backgroundIndex` (F10):** Should `backgroundIndex` remain fixed per scene until after teacher feedback, or is an interactive ambient-medium control (updating `backgroundIndex` + synced `outsideIndex` on bodies) valuable enough to include before classroom trials?
4. **Repository hygiene for tracked ZIPs (F9):** Does the human owner intend to keep `01_problems.zip` and `08_Ray_Optics_Explanations.zip` tracked in the private repo, or relocate them outside tracked Git before running external-model benchmarks or sharing the repository?
5. **Cold external-model & teacher trial design (F8):** Which unseen question set (outside `01_problems.zip`/`08_Ray_Optics_Explanations.zip`) and which authorized external model + consenting teachers will be used for the post-freeze pilot?
