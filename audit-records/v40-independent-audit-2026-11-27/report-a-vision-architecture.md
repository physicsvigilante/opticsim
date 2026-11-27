# Report A — Opticsim v40 Project Vision, Trajectory, and Architectural Assessment

> **Publication Status:** Provisionally accepted by Repository Owner for independent examination by ChatGPT Adviser; published unabridged to GitHub and cross-referenced in Issue #273. Gate 1 hardening is **not yet authorized**.

## Audit Provenance & Independence Disclosure

| Field | Verified Value |
| --- | --- |
| **Target Repository** | `https://github.com/physicsvigilante/opticsim` |
| **Frozen Audit Commit** | `0c758d7817ac68dffd5936e25109520b7f99f720` (through PR #276, 1,182 commits) |
| **Frozen Audit Tree** | `d103cd993df5c74052309ec74f7cdacb925b58ef` |
| **Pinned PhyDemo Upstream** | `811f508d2b070898c241a568b0c167dcb8645251` (`upstream-pin.json` blob `c371abf2169bba28b1c400d022b55caf78cb647c`; tree `4e352c91dc445c471ee126ec5214bb9d2d3df0b7`) |
| **Built Core Verification** | `dist/test-core.cjs` reproducibly built independently in every isolated worktree (`SHA-256 = f54ecaac2cdb6da7f7c43f0b035d6020c64feabaae68a8a675c424aa99caa122`, bit-for-bit identical to original checkout) |
| **Governance Framework** | `https://github.com/physicsvigilante/multiagent` v0.2 @ `dd091fed2c1efdc398ec1c8124283e374f029e55` |
| **Active Independent Investigators** | `neon-auditor` (`gemini-4-neon-high`, blind Phase 1 SHA-256 `cd51340c2ccbe46ee2afee835bb8a2ff53cf59c934cf715d9fcd40e27d3edab3`) and `neon-auditor-2` (`gemini-4-neon-medium`, blind Phase 1 SHA-256 `3f00ea7dee300f5f6a700c5da460f67d46d448db0a419d4e687abefea1eeabca`) |
| **Independence Classification** | `non-author`, `brief-only fresh session`, **`same-model, separate participant`** (cross-family model diversity was lost after `opus-auditor` [`claude-opus-5-5-medium`] hit third-party quota `RESOURCE_EXHAUSTED (429)` during Phase 1 and was discontinued by Owner Mandate Amendment; its partial notes remain preserved separately and were strictly withheld from active investigators) |
| **Procedural Coordinator Disclosure** | `coordinator` (`gemini-4-neon-high`) possesses builder-context exposure from prior PRs #260–#276 and acted strictly as a procedural coordinator (withholding Issue #273 and prior assessments during Phase 1 and exercising zero scientific verdict authority) |
| **Cross-Reference** | GitHub Issue #273 (strategic checkpoint) |

---

## 1. Executive Verdict

**What the `v40` plateau truly represents:**  
Both blind independent investigators converged cleanly—and confirmed through cross-falsification experiments in Phase 2/3—that Opticsim at `0c758d78` is **not** a fragile collection of single-problem templates masquerading as an engine, **nor** is it ready to freeze untouched as-is. Rather, the `v40` plateau represents:

> **A physically sound, genuinely composable `v40` ray-optics core (`native-optical-bench` + exact-rational `coaxial-paraxial-stack` + `optical-bench-witness`) that is ready for feature freeze *immediately after* a small, strictly bounded corrective hardening pass (1–2 PRs max) — and is now bottlenecked primarily by a complete absence of independent external-LLM and real teacher/student evaluation rather than missing optical primitives.**

Specifically:
1. **Mission fulfillment (Core Engine):** Achieved in `v40`. Independent from-scratch optical oracles verified machine-precision physics (`~10⁻¹⁶` to `10⁻¹³ mm`), reciprocity, and organic multi-primitive composition on unfamiliar 6–10 component benches without bespoke ray routing or upstream PhyDemo modifications.
2. **Hidden consequential weaknesses found:** Two reproducible `P1` Opticsim implementation defects (`F1` phantom generating-circle tangency on `spherical-lens` and `circular-arc-mirror`; `F2` `rayDensity` `UNSUPPORTED_FIELD` crash in `witness-optical-bench.mjs`), one `P1` upstream-inherited operational trap (`F3` universal `partialReflection: true` truncation withhold on finite dielectrics), two `P2` `v40` workflow omissions (`F6` `nativeComparisonReadouts` dropping `beam-splitter-interactions`; `F7a` 84 KB legacy `explorationContext` dump on `v40` scenes), and one documented high-friction scope boundary (`F9` `ideal-curved-mirror` bounding disk blocking `u < f` virtual-image setups).
3. **Decisive strategic gap (`F4`, `P1`):** Across `1,182` commits, `276` PRs, `326` test files, and `68` `evaluation/` directories, **zero** cold external-LLM authoring trials and **zero** consenting teacher/student classroom evaluations have been executed. Further engine capability growth before closing this external-evidence gap would violate evidence-driven engineering.

---

## 2. Project Vision, Historical Trajectory, and Architectural Evolution

Reconstructing Opticsim's trajectory across `PROPOSAL.md`, `AGENTS.md`, `1,182` commits, and `276` PRs reveals **three distinct phases**:

1. **Foundational Discipline (`v1`–`v4`, Milestones 1–6):**
   - Established the core design invariants that remain Opticsim's greatest strength: one authoritative versioned JSON document, derived native PhyDemo compilation without modifying pinned upstream `811f508d`, explicit separation of physical parameters vs numerical sampling vs presentation, strict fail-closed execution gating, independent conditional analytical math never conflated with sampled rays, and SHA-guarded portable qualification bundles.
2. **Catalogue Accretion & Problem-Shaped Drift (`v5`–`v36`, PRs through ~#243):**
   - Guided by JEE problem discovery (including the 40-problem `optical-systems-atlas-v1`), the project accumulated **~23 narrow, single-arrangement native schemas (`v14`–`v36`)** (such as `v20` decentered two-lens beam, `v24` curved-entry observation, `v29` refractive fan, `v32` inside-cap tracing, `v34` immersed-arc port, `v35` rectangular mirror box, `v36` finite guide fan) plus **~25–28 single-purpose analytical query modules** wired into `src/problem-workflow.js`.
   - Each individual PR maintained high local rigor and epistemic honesty, but cumulatively the repository drifted toward a **per-archetype catalogue** carrying heavy governance and test ballast (`132` `src/` files / ~`21.3–21.9k` LOC, `130` `scripts/` files, `123` `docs/` files, `326` `test/` files / `45.5k` LOC, `120.5 KB` full legacy `capabilities` payload, and a **22-link chained Git-blob-SHA1 integration fixture trail** on `src/app.js`).
3. **Composable Unification & Front-Door Course Correction (`v37`–`v40`, PRs #244–#276):**
   - **PR #244** replaced ad-hoc coaxial formulas with one unified exact `BigInt` `binary64-rational` ABCD matrix solver (`src/coaxial-paraxial-stack.js`).
   - **PRs #246–#252** built progressive composable native benches (`v37` air-only → `v38` refractive → `v39` hybrid) with witness bridges.
   - **PRs #260–#276** synthesized the unified **`v40: native-optical-bench`** (`src/native-optical-bench.js`, `src/native-bench-common.js`, `src/optical-bench-witness.js`) supporting ambient `backgroundIndex`, deterministic `randomSeed`, interior emitters/stops/detectors, decentered thin lenses, all 6 signed/flat `spherical-lens` shapes, oriented minor/hemisphere/major circular caps, 2–4 layer touching flat media, coaxial cemented doublets/triplets, corner-touching mirror enclosures, flat/curved flush silvered optics (`mergesWithGlass`), exterior `beam-splitter`s, 8 curated JEE browser starters, and slim LLM front doors (`bench-capabilities` `17.7 KB`, `workflow-capabilities` `11.3 KB`, `focusedExplorationContext` `7.8 KB`).

**Assessment of the engine-vs-teaching boundary:**  
Opticsim maintains an unusually crisp, principled boundary between **engine** (validation, pinned ray tracing, fail-closed qualification, conditional ABCD math) and **teaching/interpretation** (human/LLM question reading, pedagogy, inverse reasoning). It resists exam-answer shortcuts, refuses to claim native image detection from conditional equations, and labels unverified assumptions cleanly. The only imbalance is that internal engineering and governance artifacts (`68` `evaluation/` directories, `123` `docs/` files) now dramatically outweigh empirical teaching or external-LLM evidence (`0` real users).

---

## 3. Established Architectural Strengths

Both investigators independently verified the following core architectural strengths:

1. **Authoritative Document & Derived Native State (`src/contract.js`, `src/adapter.js`, `src/session.js`):**
   - Strictly validates versioned JSON before compiling to pinned PhyDemo objects (`idMap` kept strictly external). Asynchronous browser runs are revision-guarded against stale callbacks.
2. **Fail-Closed Execution & Measurement Qualification (`src/adapter.js`, `src/observables.js`, `src/qualification.js`):**
   - Any truncation (`truncation > 0`), undefined behavior, stop, endpoint-audit failure (`v40EndpointsVerified === false`), or document/execution SHA mismatch withholds measurements (`withheld-incomplete` / `suppressed`). No silent ray dropping was observed even under `maxRayDepth = 16` exhaustion or faint beam-splitter branches (`<= 0.01`).
3. **Exact-Rational Coaxial Paraxial Stack (`src/coaxial-paraxial-stack.js`) & Native Witness Bridge (`src/optical-bench-witness.js`):**
   - Uses exact `BigInt` rational propagation (`det(M) = 1` identically; `A = D` identically on return stacks), positive-monomial cancellation bounds (`1e-10`), dimensional invariance across `mm`/`cm`/`m`/`scale-unit`, and honest native geometry corroboration (refusing rays that bypass a narrow-aperture element via `stack-optics-not-encountered`).
4. **Shared Geometry & Historical Freeze Isolation (`src/native-bench-common.js`, `src/witness-common.js`, `src/composition-profiles.js`):**
   - `v1`–`v39` schemas remain strictly isolated from `v40` with zero silent upgrades; unmarked legacy requests preserve historical routing.
5. **Security & Static-Distribution Hygiene (`public/index.html`, `scripts/serve.mjs`, `scripts/pack-demo.mjs`, `scripts/authoring-evidence.mjs`):**
   - Zero `innerHTML`/`outerHTML`/`eval`/`new Function` sinks across `src/*.js`; strict self-origin CSP; localhost-only path-contained dev server; symlink-checked `wx` evidence writes confined to `test-artifacts/llm-authoring/`; explicit allowlist static demo packager excluding `test-core.cjs` and `.env`; manual-only GitHub Pages workflow (`workflow_dispatch`).

---

## 4. Evidence-Supported Architectural Limitations & Structural Friction

| Category | Finding ID(s) | Summary & Architectural Root Cause |
| --- | --- | --- |
| **Incomplete `v40` Migration of Shared Guards & Contracts** | `F1` (`P1`), `F2` (`P1`), `F6` (`P2`), `F7a` (`P2`) | (1) `componentTangentCircles` / `onRayIncident` in `src/native-bench-common.js` fixed phantom-circle tangency for `circular-cap-dielectric` (PR #267) but missed `spherical-lens` and `circular-arc-mirror`. (2) `optical-bench-witness.js` advertises `rayDensity` and `prepareScene:450` writes it, but `inspectAuthoringRequest` omitted `'rayDensity'` from `v40Fields`. (3) `beam-splitter-interactions` was wired everywhere except `nativeComparisonReadouts` (`src/exploration.js:137`). (4) `explorationContext` (`src/exploration.js:41`) still embeds the full `120.5 KB` legacy `capabilities()` on `v40` scenes (`~84 KB` output including `v10→v11` text). |
| **Pinned Upstream PhyDemo Constraints** | `F3` (`P1`), `F5` (`P2`), `F8` (`P2`) | (1) `BaseGlass.js:242-254` hardcodes a `0.01` brightness truncation cutoff in `'default'` colorMode; combined with Opticsim's strict `truncation > 0` gate, `partialReflection: true` fails closed (`withheld-incomplete`) on routine two-face finite dielectrics even at max `brightness = 1.0`. (2) Equal-index neutral bodies (`n_in === n_out`) with `partialReflection: true` trigger `~10⁻³³..10⁻³²` 1-ULP noise on 29/85 integer oblique angles. (3) `IdealMirror.js:175-208` is symmetrically two-sided with identical focal sign on front and back. |
| **Legacy `v1`–`v39` Ballast & Hash-Pin Maintenance Drag** | `F7b` (`P2`) | `132` `src/` files, `130` `scripts/`, `123` `docs/`, `326` `test/` files, `~25` legacy browser CI steps, `src/exploration.js` & `src/exploration-ui.js` SHA-256 byte-freezes (`test/detector-hit-transfer.test.mjs:61,84`), and a **22-link chained Git-blob-SHA1 fixture trail** on `src/app.js` (`test/native-thick-lens-aperture-v18.test.mjs:208-273`). Even trivial `v40` fixes to `exploration.js`/`app.js` require wrapper modules or explicit post-freeze manifest links. |
| **Intentional `v40` Scope Boundaries with Practical JEE Friction** | `F9` (`P2`), `F11` (`P2`), `F12` (`P2`), `F13` (`P3`) | `ideal-curved-mirror` retains an `apertureHeight/2` bounding disk (asserted in `test/v40-llm-front-door.test.mjs:651`, blocking textbook `u < f` virtual-image setups, plus curved-mirror-pair disk check at `src/native-optical-bench.js:158-160`); `reviseScene` cannot edit `physics.backgroundIndex`; `spherical-lens` conservative AABB blocks concave-pocket placement; no chromatic dispersion (`simulateColors: false`), extended objects, or optical-instrument presets. |
| **Governance & Repository Hygiene** | `F10` (`P2`) | Two third-party archives (`01_problems.zip`, 4.54 MB; `08_Ray_Optics_Explanations.zip`, 24.16 MB, containing `/Solutions/`) are tracked in Git root, posing benchmark-contamination and licensing risk if the repository is shared or opened. |

---

## 5. Genuine Physical Composability Assessment

**Verdict: Confirmed genuine in `v40`.**  
Both investigators constructed novel, unfamiliar multi-primitive compositions not present in any curated starter or test fixture and verified them against independent analytical oracles:

- **10-component mixed bench (`exp2-deep-probes.mjs` Probe F):** Interior source inside tilted `circular-cap-dielectric`, decentered `ideal-lens`, exterior `beam-splitter`, touching `polygon-dielectric` + `triangular-prism`, submerged `circle-blocker`, submerged `ray-detector`, `circular-arc-mirror`, and exterior `ray-detector` in ambient `backgroundIndex = 1.1` → `completed`, `v40EndpointsVerified = true`, all interactions emerging organically from PhyDemo; subsequent `reviseComponents` deletion of all 3 dielectric bodies (`3 → 0` closure) preserved `backgroundIndex = 1.1` and `randomSeed` cleanly.
- **6-primitive cross-bench (`exp1_audit.mjs` D1 & D2):** Interior source in `circular-cap-dielectric` → `ideal-lens` → `beam-splitter` → `circular-arc-mirror` + `plane-mirror` → 2 detectors (`completed`, `truncation = 0`); `parallel-beam` → `finite-aperture` → `polygon-dielectric` containing submerged `circle-blocker` + submerged `ray-detector` (exact `6 emitted = 2 aperture + 2 blocker + 2 detector`).
- **Touching/merged/silvered interfaces (`exp1`–`exp5b`, `exp1_audit`–`exp4_audit`):** 4-layer touching stack + flush mirror return (`2.91e-13 mm` error), cemented doublets/triplets mixing flat `path` and curved `DR1R2` lenses, mismatched-aperture overhang, curved silvering on tilted major caps and concave lens faces, 90° corner-touching retroreflectors (`1.24e-16` error), and 3-body T-junctions.
- **True composability defects vs intentional limits:** Only **`F1`** (phantom generating-circle tangency breaking unrelated rays on a shared bench) and **`F2`** (`witness` `rayDensity` crash) are true composability/contract defects. All remaining boundaries (`maxComponents = 16`, `maxRayDepth = 16`, `spherical-lens` exterior-only AABB, single emitter family per scene, `backgroundIndex` immutability) are cleanly enforced and honestly surfaced.

---

## 6. LLM Authorability, JEE Relevance, and Practical Teaching Value

> **Evidence Boundary Note:** Because both active investigators inspected repository source files directly, the following is a **structural developer-experience and capability-surface assessment**, strictly separate from cold external-LLM accuracy and classroom effectiveness (both currently **`0` empirical observations**, `F4`).

- **LLM Front Door Strengths:** `bench-capabilities` (`17.7 KB`), `workflow-capabilities` (`11.3 KB`), `focusedExplorationContext` (`7.8 KB`), `skills/sim-ro-problem/SKILL.md`, structured `AuthoringError` JSON paths, and SHA-guarded `revise` / `revise-components` provide a clean, bounded authoring surface without requiring inspection of `v1`–`v39`.
- **LLM Friction Points Identified:**
  1. `F3` (`partialReflection: true` truncation trap) will repeatedly baffle physics-literate cold LLMs unless stated prominently as an operational rule (`partialReflection: false` for quantitative runs).
  2. `F1` (phantom circle tangency), `F2` (`witness` `rayDensity`), and `F9` (`ideal-curved-mirror` `u < f` bounding disk) will cause avoidable false rejections on physically valid JEE setups.
  3. `F7a` (`explorationContext` 84 KB dump on `v40`) and `README.md` (listing ~30 legacy links near the top) risk pulling cold LLMs back into legacy `v1`–`v39` schemas.
- **JEE & Classroom Coverage:** `v40` + `coaxial-paraxial-stack` covers roughly **85–90% of core 2D JEE geometric ray optics** via general primitives rather than exam hacks (mirrors, enclosures, spherical/ideal mirrors, layered slabs, TIR/Snell's window, prisms, thin & split lenses, all 6 thick spherical-lens shapes, cemented doublets/triplets, silvered optics, beam splitters, stops, detectors). `public/index.html:13` already groups all 8 curated `v40` starters first under `<optgroup label="Unified Optical Bench (v40 JEE Starters)">` (with `single-lens` selected by default).
- **Deferred Teaching Enhancements (Post-Pilot Only):** Interactive `backgroundIndex` revision/UI (`F11`), chromatic dispersion (`simulateColors` + `cauchyB`, `F13`), extended objects, and optical-instrument convenience presets should wait until real teacher/student pilots confirm which gaps actually matter in classrooms.

---

## 7. Competing Architectural Trajectories & Converged Recommendation

Both investigators independently evaluated all five strategic options and converged with **zero unresolved dissent**:

| Trajectory | Converged Assessment | Rationale |
| --- | --- | --- |
| **1. Immediate freeze of `v40` → external-model & classroom pilot** | **Close, but premature by 1–2 small PRs** | Freezing *before* fixing `F1`, `F2`, `F6`/`F7a`, and `F3`/`F5`/`F8` operational docs would pollute external evaluations with known, easily fixed false failures. |
| **2. Fresh unseen JEE benchmark before freeze** | **Merge into Gate 2 as external-model evaluation only** | Another same-assistant internal benchmark repeats the internal validation loop; unseen problems must be executed cold by external non-builder LLMs after Gate 1. |
| **3. Targeted corrective hardening → freeze → external pilot (RECOMMENDED)** | **Optimal two-gate path** | **Gate 1 (1–2 PRs max):** Fix `F1`, `F2`, `F6`+`F7a` (via wrapper or reviewed post-freeze manifest), `F3`/`F5`/`F8` operational docs, Owner-authorized `F10` ZIP hygiene, and optional `F9` (`ideal-curved-mirror` exact finite-segment clearance). **Gate 2 (immediately after):** Freeze `v40` and execute both cold external-LLM evaluation (15–20 unseen problems, >=2 non-builder models) and a consenting teacher/student static-demo pilot (3–5 teachers, 15–30 students). |
| **4. Broad architectural consolidation / `v1`–`v39` teardown** | **Defer until post-pilot** | High regression risk across `326` test files and 22-link SHA-pin chains with low immediate payoff for external validation since `bench-capabilities` already isolates LLMs from legacy schemas. |
| **5. Narrowly targeted capability growth (dispersion, GRIN, tilted lenses)** | **Reject at this gate** | `v40` already covers core 2D geometric optics cleanly; adding new primitives without external-LLM or classroom evidence risks solving hypothetical rather than real adoption bottlenecks. |
