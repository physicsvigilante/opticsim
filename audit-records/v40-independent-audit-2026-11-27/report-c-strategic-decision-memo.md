# Report C — Opticsim v40 Strategic Decision Memorandum

> **Publication Status:** Provisionally accepted by Repository Owner for independent examination by ChatGPT Adviser; published unabridged to GitHub and cross-referenced in Issue #273. Gate 1 hardening is **not yet authorized**.

## Executive Decision Summary

| Decision Question | Converged Audit Recommendation (Zero Unresolved Dissent) |
| --- | --- |
| **Is `v40` ready for feature freeze right now?** | **Nearly — after 1–2 small corrective PRs (Gate 1), YES.** Do not freeze *before* fixing `F1`, `F2`, `F6`/`F7a`, and `F3`/`F5`/`F8` operational docs; do not expand `v40` scope during Gate 1. |
| **Are further optical primitives justified now?** | **NO.** Reject Trajectory 5 (dispersion, GRIN in `v40`, tilted lenses, extended objects, instrument presets) until real external-LLM and classroom pilots prove a recurring blocker. |
| **Should we clean up / delete `v1`–`v39` legacy now?** | **NO — DEFER.** Keep `v1`–`v39` strictly frozen as compatibility ballast (defer Trajectory 4 until post-pilot). |
| **What is the #1 strategic priority after Gate 1?** | **Freeze `v40` and execute Gate 2:** (a) independent cold external-LLM benchmark on 15–20 genuinely unseen problems (`>= 2` non-builder models) + (b) small consenting teacher/student classroom pilot on the static browser demo. |

- **Baseline:** `0c758d7817ac68dffd5936e25109520b7f99f720` (Tree `d103cd993df5c74052309ec74f7cdacb925b58ef`, PhyDemo `811f508d`)
- **Cross-Reference:** GitHub Issue #273

---

## 1. Defects & Friction Blocking External Evaluation Right Now

Freezing `v40` untouched at `0c758d78` would expose external LLMs and teachers to five avoidable, already-diagnosed traps:

1. **`F1` (`P1`, Defect — Blocker):** Phantom generating-circle tangency rejects valid rays passing 40–90 mm away from `spherical-lens` or `circular-arc-mirror` both at admission and runtime (`v40EndpointsVerified = false`), and `onRayIncident` checks both lens faces without skipping the non-struck face (`src/native-bench-common.js:656-690, 889-896`). In multi-arm or wide-fan benches, this produces inexplicable false failures.
2. **`F2` (`P1`, Defect — Blocker):** `witness-optical-bench.mjs` advertises optional `rayDensity`, but `inspectAuthoringRequest` (`src/authoring.js:263-267`) throws `UNSUPPORTED_FIELD` whenever it is supplied.
3. **`F3` (`P1`, Architectural Limitation — Doc/UX Blocker) + `F5` (`P2`) + `F8` (`P2`):** Cold physics-literate LLMs naturally author glass optics with `partialReflection: true` and hit `withheld-incomplete` on routine two-face slabs/lenses/prisms (`BaseGlass.js` `0.01` cutoff) and on 34.1% of oblique angles for neutral equal-index bodies (`F5`). Similarly, `ideal-curved-mirror`'s symmetric two-sided focal sign (`F8`) is undocumented. Prominent operational rules prevent avoidable cold-LLM retry loops without touching pinned PhyDemo or relaxing `truncation > 0`.
4. **`F6` + `F7a` (`P2`, Defects — Browser/LLM Workflow):** `nativeComparisonReadouts` silently drops `beam-splitter-interactions` on the curated `v40-beam-splitter-bench` starter, and `explorationContext` emits ~84 KB of legacy `v1`–`v39` capabilities (including `v10→v11` text) on `v40` scenes.
5. **`F10` (`P2`, Contamination / Governance Hygiene):** Tracked Git-root archives `01_problems.zip` (4.54 MB) and `08_Ray_Optics_Explanations.zip` (24.16 MB, containing `/Solutions/`) should be addressed with explicit Owner direction before external sharing or external-LLM trials.

---

## 2. Recommended Strictly Bounded Two-Gate Roadmap

### Gate 1 — Targeted Corrective Hardening (1–2 PRs Max; Zero New Optical Primitives, Zero Core Edits)

| Priority | Item | Scope & Engineering Guardrail |
| --- | --- | --- |
| **Mandatory 1** | **Fix `F1`** (Physical-arc tangency on `spherical-lens` & `circular-arc-mirror` + `onRayIncident` non-struck-face check) | Scope to `v40` (opt-in flag in `src/native-bench-common.js`) to guarantee zero regression on frozen `v37`/`v38` tangency tests (`test/native-general-optical-bench.test.mjs:423`, `test/native-general-refractive-bench.test.mjs:331`). Add admission and runtime regression tests. |
| **Mandatory 2** | **Fix `F2`** (`rayDensity` in `v40Fields`) | Add `'rayDensity'` with finite bounds `[0.048, 1]` to `v40Fields` in `src/authoring.js:265`, expose in `opticalBenchCapabilities().optionalRequestFields`, and test via `witness-optical-bench.mjs`. |
| **Mandatory 3** | **Fix `F6` + `F7a`** (`beam-splitter-interactions` in comparison readouts + `v40`-scoped exploration context) | Respect the confirmed SHA-256 byte-freeze on `src/exploration.js` (`test/detector-hit-transfer.test.mjs:61`) and `src/exploration-ui.js` (`line 84`) and the 22-link Git-blob chain on `src/app.js` — implement via clean wrapper module or explicitly reviewed post-freeze manifest update. |
| **Mandatory 4** | **Operational Docs for `F3`, `F5`, `F8`** | Update `bench-capabilities`, `skills/sim-ro-problem/SKILL.md`, `docs/NATIVE-OPTICAL-BENCH.md`, and browser note to state bluntly: (a) use `partialReflection: false` for qualified native measurements on finite dielectrics & equal-index neutral bodies (`partialReflection: true` is visual-only under PhyDemo's `0.01` cutoff); (b) `ideal-curved-mirror` is symmetrically two-sided with identical focal sign on both faces (use `circular-arc-mirror` when physical front/back asymmetry matters). |
| **Mandatory 5** | **Owner Decision on `F10`** (Root tracked ZIP archives) | Decide whether to untrack/relocate `01_problems.zip` and `08_Ray_Optics_Explanations.zip` before external sharing or external-LLM benchmarking (no history rewrite without separate Owner approval). |
| **Optional (Recommended)** | **`F9`** (`ideal-curved-mirror` exact finite-segment clearance) | `exp6-phase2-probes.mjs` verified **10/10** adversarial `IdealMirror.js` cases down to `u = 0.02 mm` (`dirErr <= 3.38e-15`, zero warnings/truncation). Replacing the `apertureHeight/2` bounding disk with exact finite-segment clearance unblocks textbook JEE concave virtual-image (`u < f`) setups cleanly; requires updating `bench-capabilities` and `test/v40-llm-front-door.test.mjs:651`. *(Also evaluate curved-mirror-pair disk residue at `src/native-optical-bench.js:158-160` only if cleanly bounded.)* |

*Note:* No change to `public/index.html` is required in Gate 1 (`public/index.html:13` already groups all 8 curated `v40` starters first in `<optgroup label="Unified Optical Bench (v40 JEE Starters)">`).

### Gate 2 — Engine Freeze & External Evaluation (Immediate Next Milestone After Gate 1)

Freeze `v40` engine schema/primitives upon merging Gate 1 and execute **both** external-validation tracks:

1. **Track 2A — Cold External-LLM Held-Out Authoring Evaluation:**
   - **Problem set:** `15–20` genuinely unseen 2D JEE / intro-optics problems drawn from **outside** `01_problems.zip` / `08_Ray_Optics_Explanations.zip` (covering single/multi-lens, curved/plane mirrors, prisms/slabs/TIR, caps, silvered optics, beam splitters, and `coaxial-paraxial-stack` witnesses).
   - **Models:** `>= 2` non-builder external LLMs (strictly separate from the development assistant).
   - **Strict context budget:** Provide **only** `bench-capabilities` (`17.7 KB`) + `workflow-capabilities` (`11.3 KB`) + `skills/sim-ro-problem/SKILL.md` (no repo source access, no `/Solutions/`).
   - **Separated scoring rubric (`AGENTS.md` compliant):** Score **interpretation fidelity** (independent physics reviewer), **first-try admission & native execution pass rate**, **diagnostic error-recovery rate** (<= 2 automated revision turns), and **conditional-vs-native epistemic accuracy** separately.
2. **Track 2B — Real Classroom / Teacher Static-Demo Pilot:**
   - **Participants:** `3–5` consenting physics teachers and `~15–30` students using the reviewed static browser distribution (`scripts/pack-demo.mjs` output).
   - **Tasks:** `2–3` structured physical what-if explorations (e.g., lens focal-length/object-distance exploration, TIR/prism angle sweep, beam-splitter ratio exploration).
   - **Metrics:** Time-to-first-meaningful-edit, comprehension of native rays vs conditional predictions, confusion rate on `partialReflection` / `IdealMirror` / read-only `backgroundIndex`, and qualitative teacher utility feedback.

---

## 3. Capabilities to Keep Frozen or Defer (Do Not Build Now)

| Capability / Workstream | Decision | Explicit Reversal Condition |
| --- | --- | --- |
| **`v1`–`v39` legacy schemas, 326 test files, ~25 legacy browser CI jobs (`F7b`)** | **Keep strictly frozen as ballast (Defer Trajectory 4)** | Re-open consolidation only if post-pilot CI latency or 22-link SHA-pin maintenance directly blocks rapid iteration on verified pilot fixes. |
| **`reviseScene` support for `physics.backgroundIndex` (`F11`)** | **Defer post-pilot** | Add immediately after Gate 2 if teachers or external LLMs repeatedly hit friction doing air-vs-water immersion comparisons. |
| **`spherical-lens` concave-pocket AABB relaxation (`F12`)** | **Defer post-pilot** | Re-open only if external-LLM trials show frequent failures placing sources/detectors inside concave lens pockets (`exp6` already showed 0 parity flips on 275 + 56 rays). |
| **Chromatic dispersion (`simulateColors` + `cauchyB`), extended objects, instrument presets (`F13`)** | **Reject for now (Defer Trajectory 5)** | Re-open only if Gate 2 teacher pilots identify prism dispersion or compound-instrument presets as a top classroom adoption blocker. |
| **PhyDemo upstream modifications (`vendor/ray-optics`)** | **Keep strictly frozen (`811f508d`)** | No justification found; `F3`/`F5`/`F8` are cleanly handled via operational guidance without forking upstream. |

---

## 4. Major Uncertainties & Explicit Decisions Required from the Human Owner

1. **Audit Package Acceptance:** Confirm acceptance of Reports A, B, C and the Supporting Records (including the documented shift from cross-model to `same-model, separate participant` after Opus's 429 quota discontinuation).
2. **GitHub Publication Authorization:** Authorize whether to publish Reports A, B, and C to dedicated GitHub Issues on `physicsvigilante/opticsim` and post a concise cross-reference update on GitHub Issue #273. *(Nothing has been published to GitHub.)*
3. **Gate 1 Hardening Scope Authorization:** Approve Gate 1 (Mandatory items 1–4) and decide specifically on:
   - Whether to include **optional `F9`** (`ideal-curved-mirror` exact finite-segment clearance) in Gate 1 or defer it to post-pilot.
   - How to handle **`F10`** (`01_problems.zip` and `08_Ray_Optics_Explanations.zip` tracked in Git root) — e.g., untrack from `main` in a clean commit, move to an ignored local path, or keep private-repo-only with an explicit policy note.
4. **Disposable Swarm Worktree Cleanup Authorization:** All 3 isolated Swarm worktrees (`swarm-neon-auditor-ddf8fd72`, `swarm-neon-auditor-2-62b5979c`, `swarm-opus-auditor-015391b9`) remain clean and untouched on disk, and all durable evidence has been copied outside them. Authorize separately when ready to remove/kill the Swarm workers and clean up those temporary worktrees.
