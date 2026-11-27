# Report B — Opticsim v40 Deep Adversarial Scientific and Engineering Error Audit

> **Publication Status:** Provisionally accepted by Repository Owner for independent examination by ChatGPT Adviser; published unabridged to GitHub and cross-referenced in Issue #273. Gate 1 hardening is **not yet authorized**.

## Audit Baseline & Verification Environment

- **Target Repository:** `https://github.com/physicsvigilante/opticsim`
- **Frozen Audit Commit / Tree:** `0c758d7817ac68dffd5936e25109520b7f99f720` / `d103cd993df5c74052309ec74f7cdacb925b58ef`
- **Pinned PhyDemo Upstream:** `811f508d2b070898c241a568b0c167dcb8645251` (`upstream-pin.json` blob `c371abf2169bba28b1c400d022b55caf78cb647c`)
- **Executable Bundle:** `dist/test-core.cjs` reproducibly built from frozen source in each isolated investigator worktree (`SHA-256 = f54ecaac2cdb6da7f7c43f0b035d6020c64feabaae68a8a675c424aa99caa122`, 1,198 modules, bit-for-bit identical across original checkout and all isolated worktrees)
- **Active Independent Investigators:** `neon-auditor` (`gemini-4-neon-high`, Phase 1 SHA-256 `cd51340c...`, 7 scripts `exp1`–`exp6`) and `neon-auditor-2` (`gemini-4-neon-medium`, Phase 1 SHA-256 `3f00ea7d...`, 5 scripts `exp1_audit`–`exp5_cross_verify`) — `same-model, separate participant` blind independence (zero unresolved dissent after Phase 2/3 cross-verification)
- **Cross-Reference:** GitHub Issue #273

---

## 1. Reconciled Findings Summary (Ordered by Severity)

**Zero `P0` (silent wrong physics or security compromise) defects were found.**  
All 13 reconciled findings (`4 P1`, `8 P2`, `1 P3`) were independently reproduced and cross-verified across both investigators:

| ID | Severity | Nature | Discovery & Verification | Summary |
| --- | --- | --- | --- | --- |
| **F1** | **P1** | Confirmed defect (Opticsim) | **SHARED** (found independently by both blind investigators; deepened in Phase 2) | Phantom generating-circle tangency false rejection at admission AND false runtime audit failure (`v40EndpointsVerified = false`) on `spherical-lens` and `circular-arc-mirror` (`src/native-bench-common.js:656-690, 889-896`). |
| **F2** | **P1** | Confirmed defect (Opticsim) | `neon-auditor` Phase 1; independently reproduced by `neon-auditor-2` (`exp5_cross_verify.mjs`) | Documented `rayDensity` override on `witness-optical-bench.mjs` / `v40` `prepareScene` unconditionally throws `UNSUPPORTED_FIELD` (`src/authoring.js:263-267` omits `'rayDensity'` from `v40Fields`). |
| **F3** | **P1** | Confirmed architectural limitation (Upstream PhyDemo + Opticsim gate) | **SHARED** (converged to P1 in Phase 2) | Pinned PhyDemo `BaseGlass.js:242-254` `0.01` brightness cutoff + strict `truncation > 0` withhold causes `partialReflection: true` to fail closed (`withheld-incomplete`) on routine two-face finite dielectrics even at max `brightness = 1.0`. |
| **F4** | **P1** | Evidence or validation gap | **SHARED** | Zero independent cold external-LLM trials and zero consenting teacher/student evaluations executed across all 68 `evaluation/` directories. |
| **F5** | **P2** | Confirmed defect / upstream ULP amplification | `neon-auditor` Phase 1; independently reproduced by `neon-auditor-2` (`29/85` angles) | Equal-index neutral dielectric bodies (`insideIndex === outsideIndex`) with `partialReflection: true` fail closed on 29/85 (34.1%) integer oblique angles due to `~10⁻³³..10⁻³²` 1-ULP noise in `BaseGlass.js`. |
| **F6** | **P2** | Confirmed defect (Opticsim) | `neon-auditor` Phase 1; cross-verified + SHA-pin constraint discovered by `neon-auditor-2` | `nativeComparisonReadouts` (`src/exploration.js:136-143`) omits `'beam-splitter-interactions'`; `src/exploration.js` is SHA-256 byte-frozen (`test/detector-hit-transfer.test.mjs:61`). |
| **F7a** | **P2** | Confirmed defect (Opticsim) | `neon-auditor` Phase 1; cross-verified by `neon-auditor-2` | `explorationContext` (`src/exploration.js:31-44`) dumps ~84 KB of legacy `v1`–`v39` capabilities (including `upgradeToSchemaVersion: 11`) on `v40` scenes vs ~7.8 KB for `focusedExplorationContext`. |
| **F7b** | **P2** | Confirmed architectural limitation | **SHARED** (split cleanly in Phase 2) | Severe `v1`–`v39` legacy sprawl (`132` `src/`, `130` `scripts/`, `123` `docs/`, `326` `test/`, `120.5 KB` legacy `capabilities`, 22-link `src/app.js` Git-blob-SHA1 chain). |
| **F8** | **P2** | Confirmed architectural limitation / doc gap (Upstream PhyDemo) | `neon-auditor` Phase 1; cross-verified by `neon-auditor-2` | `ideal-curved-mirror` (`IdealMirror.js:175-208`) is symmetrically two-sided with identical focal sign on front and back; undocumented in `bench-capabilities` / `SKILL.md` / browser UI. |
| **F9** | **P2** | Intentional & documented scope boundary with high JEE friction | `neon-auditor-2` Phase 1; stress-tested `10/10` + doc/test check by `neon-auditor` (`exp6`) | `ideal-curved-mirror` enforces an `apertureHeight/2` bounding disk (asserted in `test/v40-llm-front-door.test.mjs:651`), rejecting standard JEE `u < f` virtual-image setups (plus curved-mirror-pair bounding-disk residue at `src/native-optical-bench.js:158-160`). |
| **F10** | **P2** | Governance / contamination hygiene | `neon-auditor` Phase 1; cross-verified by `neon-auditor-2` | Tracked Git-root archives `01_problems.zip` (4.54 MB) and `08_Ray_Optics_Explanations.zip` (24.16 MB, containing `/Solutions/`). |
| **F11** | **P2** | Confirmed architectural limitation | **SHARED** (converged to defer post-pilot) | `reviseScene` cannot modify `physics.backgroundIndex` in `v40` (and browser UI shows it read-only). |
| **F12** | **P2** | Intentional scope boundary | `neon-auditor-2` Phase 1; parity-tested `275+56` rays by `neon-auditor` (`exp6`) | `spherical-lens` conservative AABB rejects sources/detectors/stops placed in the empty air pocket outside concave/meniscus faces. |
| **F13** | **P3** | Confirmed architectural limitation | `neon-auditor-2` Phase 1; concurred by `neon-auditor` | No chromatic dispersion (`simulateColors: false`), extended object primitives, or compound optical-instrument presets. |

---

## 2. Detailed Technical Findings, Derivations, Reproductions, and Cross-Verification

### F1 — Phantom Generating-Circle Tangency False Rejections & Runtime Audit Failures on `spherical-lens` and `circular-arc-mirror` (`P1`, Confirmed defect — Opticsim)
- **Code Anchors:** `src/native-bench-common.js:656-690` (`componentTangentCircles`, `rayNearTangentCircle`), `src/native-bench-common.js:816-830, 883-899` (`installBenchEndpointAudit`, specifically `onRayIncident` lines `889-896`), `src/native-optical-bench.js:287-291`.
- **Mathematical & Physical Root Cause:**
  - Tangency guards exist to fail closed when a ray grazes the *physical* circular/spherical/arc surface (where binary64 intersection/normal conditioning breaks down). PR #267 fixed this exact bug for `circular-cap-dielectric` (`tc.cap` check in `rayNearTangentCircle`), restricting tangency to the retained physical arc plus its `0.01 mm` clearance neighborhood.
  - However, `componentTangentCircles` (`src/native-bench-common.js:664-673`) still emits unbounded 360° generating circles `{center, radius}` with no physical-arc bounds for `spherical-lens` and `circular-arc-mirror`.
  - **Phase 2 deeper catch (`neon-auditor` `#13`):** In `onRayIncident` (`src/native-bench-common.js:889-896`), `spherical-lens` also loops over **both** front and back generating circles with `allowBehind = true` without skipping the non-struck face (unlike `tc.cap`'s flat-chord guard at line 891).
- **Minimal Executable Reproductions (Independently Reproduced by Both Investigators):**
  1. *Admission (`circular-arc-mirror`):* `M1` at `(100, 0), normalDeg = 180, R = 100, apertureHeight = 20` (physical mirror spans `y ∈ [-10, 10]`). Horizontal ray at `y = 100 mm` — **90 mm above the physical mirror** — is rejected with `AUTHORING_REJECTED: Initial forward ray is within 0.01 mm of tangency to a circular/spherical/arc surface (M1)` (`exp1_audit.mjs` `C1a`; also `R = 50, ap = 20`, ray 40 mm above in `exp1-physics-adversarial.mjs` `1a`).
  2. *Admission (`spherical-lens`):* `G1` at `(50, 0), apertureHeight = 20, centerThickness = 6, frontRadius = 50, backRadius = 50` (spans `y ∈ [-10, 10]`). Horizontal ray at `y = 50 mm` — **40 mm above the lens** — is rejected (`exp1_audit.mjs` `C1b`; also `R = 100, ap = 20`, ray 90 mm above in `exp1-physics-adversarial.mjs` `1b`).
  3. *Runtime (`v40EndpointsVerified = false`):* A valid scene where a plane mirror reflects a ray horizontally along `y = 50 mm` (40 mm above `G1`) or `y = 90 mm` above a lens / `40 mm` above an arc mirror **fails closed** with `status: "failed"`, `measurementState: "withheld-incomplete"`, and `observed native ray approaches within 0.01 mm of tangency to a circular/spherical/arc surface; measurements withheld` (`exp1_audit.mjs` `C1c`; `exp2-deep-probes.mjs` Probe `C2`; `exp3-more-audits.mjs` Test `2`).
- **Frozen-Test Constraint Discovered in Phase 2 (`neon-auditor-2` `#12`, checked by `neon-auditor` `#13`):** `test/native-general-refractive-bench.test.mjs:331-365` (`v38 P2-2`) and `test/native-general-optical-bench.test.mjs:423-435` (`v37`) test tangency at physical vertices (`x = -6.995` at apex `-7`; `x = -0.005` at vertex `0`). Even though both hit physical vertices, scoping the physical-arc tangency fix to `v40` (via opt-in flag) guarantees zero frozen `v37`–`v39` regression.
- **Recommended Fix:** Restrict `componentTangentCircles` / `rayNearTangentCircle` and `onRayIncident` (`889-896`) in `v40` to the retained physical arc plus `clearance` neighborhood for `circular-arc-mirror` (angular sector `angle <= halfAngle + clearance/radius` around `uVertex`) and `spherical-lens` (`pClosest.y ∈ [g.bottom - clearance, g.top + clearance]` on the retained side of each generating center, skipping the non-struck face in `onRayIncident`), with admission and runtime regression tests.

### F2 — `witness-optical-bench.mjs` / `v40` `prepareScene` Advertised `rayDensity` Override Unconditionally Throws `UNSUPPORTED_FIELD` (`P1`, Confirmed defect — Opticsim)
- **Code Anchors:** `src/optical-bench-witness.js:86, 339-340, 529`; `src/authoring.js:263-267, 450`.
- **Root Cause:** `opticalBenchNativeWitnessCapabilities()` advertises optional `rayDensity`, `buildOpticalBenchNativeWitness` forwards it to `prepareScene`, and `prepareScene:450` writes `request.rayDensity` — but `inspectAuthoringRequest` (`src/authoring.js:263-267`) allows `rayDensity` only on legacy `v29`/`v30`/`v36`, omitting `'rayDensity'` from `v40Fields`.
- **Minimal Reproductions:** `exp1-physics-adversarial.mjs` Test `2` and `exp5_cross_verify.mjs` (`buildOpticalBenchNativeWitness` with `rayDensity: 0.5` → throws `AUTHORING_REJECTED: $.rayDensity: This field is not in the authoring contract`).
- **Recommended Fix:** Admit `'rayDensity'` in `v40Fields` in `src/authoring.js:265` with finite numeric bounds `[SAMPLING_PRESETS.sparse, 1]` matching `contract.js:212`, expose it in `opticalBenchCapabilities().optionalRequestFields`, and add regression tests in `test/optical-bench-witness.test.mjs`.

### F3 — Universal Finite-Dielectric `partialReflection: true` Truncation Trap (`P1`, Confirmed architectural limitation — Upstream PhyDemo + Opticsim fail-closed gate)
- **Code Anchors:** `vendor/ray-optics/src/core/sceneObjs/BaseGlass.js:242-254`; `src/adapter.js:93, 317-320`; `src/native-optical-bench.js:563`; `docs/NATIVE-OPTICAL-BENCH.md:563`; `skills/sim-ro-problem/SKILL.md:21`.
- **Mathematical & Physical Root Cause:**
  - In pinned PhyDemo `BaseGlass.refract` (`colorMode === 'default'`), any spawned reflected/transmitted ray with `brightness <= 0.01` is dropped and added to `totalTruncation`.
  - For a standard finite glass slab in air (`n = 1.5`), normal Fresnel reflectance is $R = \left(\frac{n-1}{n+1}\right)^2 = 0.04$. Even at maximum allowed source `brightness = 1.0`, the second internal reflection carries $R^2 \approx 0.0016 < 0.01$, immediately triggering `totalTruncation > 0`.
  - Even for higher indices (`n = 2.0, 3.0, 4.0`), the geometric Fresnel series $R^k$ decays monotonically and inevitably crosses `0.01` or hits `maxRayDepth = 16`, so Opticsim's strict fail-closed gate (`truncation > 0` → `status: 'incomplete'`, `measurementState: 'withheld-incomplete'`) withholds **every** detector/counter reading.
- **Minimal Reproductions:**
  - `exp4-verify-more.mjs` Test `3`: single ray (`brightness = 1.0`) through a finite slab across `n ∈ {1.2, 1.5, 2.0, 3.0, 4.0}` with `partialReflection: true` → **5/5** returned `status: 'incomplete'`, `executionPassed: false`, `measurementState: 'withheld-incomplete'` (`truncation = 1.2e-3..1.6e-2`).
  - `exp1_audit.mjs` `C5_partial_reflection_true_simple_slab`: `n = 1.5, brightness = 0.5, θ = 10°` → `incomplete`, `truncation = 7.6977e-4`, `withheld-incomplete`.
  - *(Note: all 8 curated `v40` browser starters already set `partialReflection: false`!)*
- **Converged Mitigation:** Do **not** fork pinned PhyDemo and do **not** relax fail-closed `truncation > 0` gating. Instead, surface prominently in `bench-capabilities`, `SKILL.md`, `docs/NATIVE-OPTICAL-BENCH.md`, and the browser checkbox note that `partialReflection: true` on multi-face finite dielectrics almost always triggers PhyDemo's `0.01` cutoff (visual-only exploration) and **`partialReflection: false` is the required operational rule for qualified native measurements** (explicitly documenting transmitted-only + TIR physics).

### F4 — Complete Absence of Independent External-LLM and Human Classroom Validation (`P1`, Evidence or validation gap)
- **Anchors:** `README.md:93-112`, `evaluation/heldout-authoring-v1/README.md:10, 184`, `evaluation/focused-context-pair-v1/README.md:3, 76`, `evaluation/teaching-cross-family-v1/README.md:35`, `evaluation/optical-systems-atlas-v1/README.md:1-35`.
- **Observed Evidence State:** All `68` `evaluation/` directories represent same-assistant development runs, synthetic controls, or mock pipelines (`0` real cold external-LLM captures, `0` consenting teachers, `0` students). While Opticsim's own READMEs are commendably candid about this gap, the gap itself is the primary unresolved risk to the project's mission.

### F5 — Equal-Index Neutral Dielectric Bodies (`n_in === n_out`) with `partialReflection: true` Fail Closed on 34.1% of Oblique Angles (`P2`, Confirmed defect / upstream ULP amplification)
- **Code Anchors:** `vendor/ray-optics/src/core/sceneObjs/BaseGlass.js:207, 219, 222-223, 242-245`; `src/adapter.js:319`; `docs/NATIVE-OPTICAL-BENCH.md:22`.
- **Root Cause:** When `n1 = insideIndex / outsideIndex === 1`, mathematically $R_s = R_p = 0$. In binary64, `Math.sqrt(1 - (1 - cos1*cos1))` differs from `cos1` by 1 ULP on certain angles, producing nonzero `R ~ 10⁻³³..10⁻³²` which falls below `0.01` and adds `~10⁻³²` to `totalTruncation`, tripping strict `truncation > 0`.
- **Minimal Reproductions:** `exp5-edge-cases.mjs` Test `2` and `exp5_cross_verify.mjs` (sweep `1°..85°` on `n = 1.5 / 1.5` neutral slab with `partialReflection: true` → **29/85 (34.1%)** integer angles fail closed, e.g., `53°` → `truncation = 4.254e-33`; full-circle fan in `exp1-physics-adversarial.mjs` Test `4` → `truncation = 1.73e-32`).
- **Recommended Fix:** Explicitly document in `bench-capabilities` and `docs/NATIVE-OPTICAL-BENCH.md` that equal-index neutral bodies must use `partialReflection: false` (do not fork PhyDemo or relax `truncation > 0`).

### F6 — `nativeComparisonReadouts` Silently Drops `beam-splitter-interactions` (`P2`, Confirmed defect — Opticsim)
- **Code Anchors:** `src/exploration.js:136-143`, `src/observables.js:22`, `scenes/v40-beam-splitter-bench.json`, and **SHA-256 freeze constraint** at `test/detector-hit-transfer.test.mjs:61, 84`.
- **Reproductions:** `exp2-deep-probes.mjs` Probe `E` and `exp5_cross_verify.mjs` confirm `nativeComparisonReadouts` omits `BS1` on `scenes/v40-beam-splitter-bench.json`.
- **Phase 2 Architectural Constraint (`neon-auditor-2` `#12`, confirmed by `neon-auditor` `#13`):** Both `src/exploration.js` and `src/exploration-ui.js` are SHA-256 byte-frozen in `test/detector-hit-transfer.test.mjs:61, 84` (and `src/app.js` has a 22-link chained Git-blob-SHA1 trail in `test/native-thick-lens-aperture-v18.test.mjs:208-273`). Gate 1 fixes for `F6` and `F7a` must either live in a wrapper module or record a reviewed post-freeze manifest update cleanly.

### F7a — `explorationContext` Emits ~84 KB of Legacy `v1`–`v39` Dump on `v40` Scenes (`P2`, Confirmed defect — Opticsim)
- **Code Anchors:** `src/exploration.js:31-44` (`explorationContext` embeds the full `120,538`-byte legacy `capabilities()` and `v10→v11` upgrade instructions even when `parent.scene.schemaVersion === 40`).
- **Reproductions:** `exp3-more-audits.mjs` Test `6` (`83,979` B vs `7,816` B for `focusedExplorationContext`) and `exp5_cross_verify.mjs` (`84,100` B vs `7,784` B, containing `upgradeToSchemaVersion: 11`).
- **Recommended Fix:** Scope `v40` exploration context to `opticalBenchCapabilities()` + `v40` revision rules via wrapper module or reviewed post-freeze manifest update.

### F7b — Severe `v1`–`v39` Legacy Sprawl & 22-Link SHA-Pin Drag (`P2`, Confirmed architectural limitation)
- **Observed Metrics:** `132` `src/` files (~`21.3–21.9k` LOC), `130` `scripts/` files (`12.8k` LOC), `123` `docs/` files (`7.2k` LOC), `326` `test/` files (`45.5k` LOC), `68` `evaluation/` directories, `120.5 KB` legacy `capabilities`, `~25` legacy browser CI steps, and 22 chained Git-blob-SHA1 fixtures on `src/app.js`.
- **Recommended Disposition:** Keep frozen as compatibility ballast; defer teardown until after Gate 2 external/classroom pilot evidence.

### F8 — `ideal-curved-mirror` Acts Symmetrically Two-Sided with Identical Focal Sign (`P2`, Confirmed architectural limitation / doc gap — Upstream PhyDemo)
- **Code Anchors:** `vendor/ray-optics/src/core/sceneObjs/mirror/IdealMirror.js:175-208`; `src/native-optical-bench.js:504-505`; `src/app.js:287-288`.
- **Reproductions:** `exp1-physics-adversarial.mjs` Test `7` and `exp5_cross_verify.mjs`: an `ideal-curved-mirror` at `x = 100, normalDeg = 180, focalLength = +50` converges front rays from `x = 0` to `(50, 0)` **AND** converges back-side rays from `x = 200` to `(150, 0)` (unlike a physical spherical mirror shell where front/back curvatures have opposite signs).
- **Recommended Fix:** Explicitly document symmetric two-sided focal-sign behavior in `bench-capabilities`, `SKILL.md`, `docs/NATIVE-OPTICAL-BENCH.md`, and browser note, advising `circular-arc-mirror` whenever physical front/back curvature asymmetry matters.

### F9 — `ideal-curved-mirror` Bounding-Disk Rejection of Textbook `u < f` Virtual-Image Setups (`P2`, Intentional & documented scope boundary with high JEE friction)
- **Code Anchors:** `src/native-optical-bench.js:157-180, 200-207, 263-270`; `test/v40-llm-front-door.test.mjs:651` (explicitly asserts the `apertureHeight/2` disk documentation).
- **Minimal Reproductions (`exp4_audit.mjs` `C12a`/`C12b`, reproduced in `exp6-phase2-probes.mjs`):** A textbook concave mirror virtual-image setup (`u = 15 mm < f = 25 mm, apertureHeight = 40 mm`) is rejected on `ideal-curved-mirror` (`Point source must lie at least 0.01 mm outside curved aperture bounding disk (M1)`), whereas the identical setup on `circular-arc-mirror` (`R = 50 mm`) completes cleanly. Bonus residue found at `src/native-optical-bench.js:158-160`: even two `circular-arc-mirror`s (`x = 0` and `x = 30`, `ap = 40`, e.g., optical cavity) are rejected by `Curved aperture bounding disks must be separated by at least 0.01 mm`.
- **Phase 3 Adversarial Falsification (`exp6-phase2-probes.mjs`):** Direct PhyDemo `IdealMirror.js` stress test across **10 adversarial cases** (`u < f` on/off-axis, `u = 0.02 mm` at `89°` and `0°`, `u = f`, `u = 2f`, convex `f = -25` at `u = 10` and `0.02 mm`, near-plane `(99.98, 25)` at `-89.9°`, back-side `u = 15`) passed **10/10** against an independent exact ideal-mirror oracle with `dirErr <= 3.38e-15`, `yDetErr <= 5.18e-10 mm`, zero warnings, zero truncation.
- **Recommended Disposition:** Safe, clean **optional Gate 1 item** (replace `ideal-curved-mirror` bounding disk with exact finite-segment clearance against `[pts[0], pts[1]]`, updating `bench-capabilities` and `test/v40-llm-front-door.test.mjs:651`).

### F10 — Tracked Third-Party Problem/Solution Archives in Repository Root (`P2`, Governance / contamination hygiene)
- **Anchors:** `git ls-files "*.zip"` → `01_problems.zip` (`4,537,987` B) and `08_Ray_Optics_Explanations.zip` (`24,157,847` B, containing restricted `/Solutions/`); `AGENTS.md:104, 134`. (Neither archive was opened; `scripts/pack-demo.mjs` cleanly excludes both from the browser demo.)
- **Recommended Disposition:** Owner-authorized removal/separation before external sharing or external-LLM benchmarking.

### F11 — `reviseScene` Cannot Modify `physics.backgroundIndex` in `v40` (`P2`, Confirmed architectural limitation — defer post-pilot)
- **Anchors:** `src/authoring.js:475-533`, `src/native-optical-bench.js:114-115`, `src/app.js:366-368`.
- **Reproductions:** `exp2_audit.mjs` `E2`, `exp3-more-audits.mjs` Test `6`, `exp6-phase2-probes.mjs`. Changing ambient medium (air → water immersion) currently requires re-authoring the scene rather than targeted revision. Converged to **defer post-pilot** to keep Gate 1 strictly corrective.

### F12 — `spherical-lens` Conservative AABB Rejects Concave-Pocket Placement (`P2`, Intentional scope boundary — defer post-pilot)
- **Reproduction & Phase 3 Non-Convex Parity Stress Test (`exp6-phase2-probes.mjs`):** Confirmed `(44, 0)` (4 mm outside concave apex `x = 48`) is rejected. Stress-tested non-convex biconcave `spherical-lens` across **275 adversarial rays** (5 seeds × 11 heights up to `±19.5 mm` × 5 angles) plus **56 direct PhyDemo rays** fired from inside the concave pocket `(44, 0)` (8 seeds × 7 angles): **0 failures and 0 `Glass.getIncidentData` inside/outside parity flips**. Converged to **defer post-pilot**.

### F13 — No Chromatic Dispersion, Extended Objects, or Instrument Presets (`P3`, Confirmed architectural limitation — defer post-pilot)
- `simulateColors: false` is fixed across `v40`, and there are no extended-object primitives or compound instrument convenience presets. Defer until post-pilot teacher/student demand justifies them.

---

## 3. Opticsim Implementation vs. Pinned Upstream PhyDemo Separation

| Attribution | Findings |
| --- | --- |
| **Opticsim Implementation / Contract / Governance** | `F1` (`src/native-bench-common.js`), `F2` (`src/authoring.js`), `F4` (evaluation gap), `F6` & `F7a` (`src/exploration.js`), `F7b` (`v1`–`v39` sprawl), `F9` (`src/native-optical-bench.js` disk check), `F10` (root ZIPs), `F11` (`reviseScene`), `F12` (AABB), `F13` (`simulateColors` scope). |
| **Pinned Upstream PhyDemo (`811f508d`) Behavior (Do Not Fork)** | `F3` (`BaseGlass.js:242-254` `0.01` cutoff interacting with Opticsim `truncation > 0`), `F5` (`BaseGlass.js:207,219` 1-ULP `~10⁻³²` noise at `n1 = 1`), `F8` (`IdealMirror.js:175-208` two-sided identical focal sign). *(Note: `neon-auditor-2` also spotted a benign upstream JS quirk at `BaseGlass.js:246` `!this.scene.colorMode != 'default'`, confirmed masked/harmless.)* |

---

## 4. Explicitly Investigated Areas Where No Consequential Defect Was Found

1. **Exact 2D Refraction, Reflection, Thin-Lens, Spherical-Lens, Cap, Silvering & Beam-Splitter Physics:**
   - All 7–8 signed/flat `spherical-lens` shapes (`biconvex`, `plano-convex`, `convex-plano`, `plano-concave`, `biconcave`, `pos-meniscus`, `neg-meniscus`, `flat-flat`) matched independent ray-circle Snell oracles to `3.55e-15`–`8.86e-14 mm` and `0`–`1.71e-15` direction error (`exp2` D1; `exp2_audit` B5).
   - Slab lateral displacement (`3.55e-15 mm`), equilateral prism minimum deviation (`4.62e-14 deg`), 4-layer touching stack + flush mirror Snell invariant (`2.91e-13 mm`), tilted major `circular-cap-dielectric` + interior source + TIR + reciprocity (`2.39e-15` / `2.72e-13 mm`), general forward/back reciprocity (`0 mm`, `5.73e-14 deg`), decentered & steep-ray `ideal-lens` (`0` / `3.55e-17`), single-interface Brewster Fresnel (`errR = 0, errT = 0, R + T = 1`), 90° corner retroreflector (`1.24e-16`), Mach-Zehnder 2-splitter & single-splitter power conservation (`0` / `< 1e-12`), grazing flat non-dielectric segments at `0.00115°` (`1.2e-15`–`1.9e-13 mm`), cemented doublets/triplets (mixed `path` + `DR1R2`, `R = 10,000 mm`, mismatched apertures), curved/flat flush silvering (`mergesWithGlass`), and 3-body T-junctions.
2. **Long-Travel & Non-Convex `Glass.getIncidentData` `rng() * 1e-5` Parity Stability:** Zero parity flips across 60 seeds at `8,000 mm` travel (`0.02 mm` from prism corner) AND zero parity flips across 275 + 56 non-convex biconcave `spherical-lens` rays (`exp1`, `exp2`, `exp6`).
3. **Coaxial Paraxial Stack (`src/coaxial-paraxial-stack.js`) & `v40` Witness Corroboration:** Exact `BigInt` rational `det = 1`, `A = D` return symmetry, dimensional invariance across `mm`/`cm`/`m`/`scale-unit` (bit-for-bit `118.2051282051282 mm`), Galilean afocal & near-afocal indeterminacy refusal, water-immersed witness (`0.0278 mm`), curved-silvered cemented doublet witness (`4.46e-5 mm`), and mismatched-aperture bypass refusal (`stack-optics-not-encountered`).
4. **Fail-Closed Depth & Faint-Branch Accounting:** `maxRayDepth = 16` exhaustion (`C11`, acute 4° V-mirror `5a`), 3-mirror Y-junction vertex refusal (`5b`), `BeamSplitter` `<= 0.01` branch cutoff (`C8`, `5a`/`5b`), and all 8 curated `v40` browser starters (`completed`, `v40EndpointsVerified = true`, `truncation = 0`, `warnings = 0`).
5. **Structural Closure & Parameter Sweeps:** `reviseComponents` `3 → 0` dielectric deletion preserving `backgroundIndex` and `randomSeed`; `null`-start `frontRadius` parameter sweep; sole-target auto-binding for `beam-splitter-interactions`; `beam-splitter.transmissionRatio` targeted revision.
6. **Security, CSP, Prototype Pollution, Path Containment & Demo Packaging:** Zero DOM XSS/`eval` sinks, strict self-origin CSP, `__proto__` rejection, `../` traversal and symlink rejection in `authoring-evidence.mjs` (`wx` writes), `127.0.0.1`-only `serve.mjs`, explicit allowlist `pack-demo.mjs`, and manual-only `opticsim-pages.yml`.
7. **Browser Dropdown Structure:** `public/index.html:13` already places all 8 curated `v40` starters first in `<optgroup label="Unified Optical Bench (v40 JEE Starters)">` (no HTML edit needed in Gate 1).

---

## 5. Remaining Evidence Gaps

1. **Cold external-LLM authoring fidelity (`F4`):** Actual first-try admission rate, physical interpretation accuracy, and diagnostic recovery rate of non-builder external LLMs given only `bench-capabilities` + `workflow-capabilities` + `SKILL.md` on unseen optics problems remain **unmeasured**.
2. **Real teacher/student classroom usability (`F4`):** Real classroom comprehension, workflow friction, and pedagogical usefulness remain **unmeasured**.
3. **Cross-family auditor diversity:** Discontinuation of `opus-auditor` after its Phase 1 `429` quota limit meant Phase 2/3 peer cross-verification ran between `gemini-4-neon-high` and `gemini-4-neon-medium` (`same-model, separate participant`). *(Note: separately preserved Opus partial fuzz run `e01-fuzz.mjs` independently corroborated `0` mismatches across 700 randomized disjoint compositions up to `6.73e-10 mm`.)*
