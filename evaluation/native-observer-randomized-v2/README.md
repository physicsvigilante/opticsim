# Numerical reliability R2 research — randomized fresh-process native control and separate per-hit geometry evidence

**Research-only and deliberately NOT merged into `main`.** Builds on the separately audited [PR #90 study](https://github.com/physicsvigilante/opticsim/pull/90), whose original 180-run ZIP is preserved byte-for-byte in the [persistent ChatGPT original evidence archive](https://chatgpt.com/space/page_db9aec3a4c2c81918469ee0526298bc2) (verified ZIP SHA256 `622c799e7df05c2d33664bbc787ac5456b8c56694e4398c3aafbc2e9f0642426`), rather than relying solely on its 14-day GitHub artifact. This is a **new experiment, not a repaired or silently replaced first attempt**.

Production base is `50dd0f4d9530d0a61bb4c7064c4326a8ac0ce518` (Stage-1 optional, noncertifying diagnostic PR #89 merged and 11/11 post-merge verified); pinned original PhyDemo `811f508d2b070898c241a568b0c167dcb8645251`; Node 24.19.0. No new optical shape, source interpretation, user controls, material law, numerical cutoff, native solver patch, detector calculation, UI/CLI measurement qualification or Stage-2 mandatory withholding.

## Two experiments with strictly separate claims

**A. Randomized independent-process ON/OFF observation.** Five new prospectively authored, frozen, explicitly synthetic v9 Glass scenes: (1) existing normal glass with one actual source and detector; (2) high-to-low (n=1.6\to1.3), computed-critical incidence −5°; (3) the PR90-style translated computed-critical configuration; (4) the 37°-rotated computed-critical case; and (5) computed critical +5°. The **same exact serialized document bytes/hash** are preserved within each scene across runs. For each case, the fixed RNG seed `0x90a112` independently shuffles **six balanced four-run blocks** with exactly two `OFF` and two `ON` executions. Every one of these **120 native executions** starts a **fresh OS Node process**. The executed schedule is written to the immutable raw report. `OFF` uses the exact production no-opt-in native path; `ON` uses the exact current Stage-1 opt-in diagnostic. Native terminal outcomes, warnings, source/detector/interface meter readings, first event, fingerprints, processing counts and advisory reason code are retained. The original material, angles, ray budgets and native core are never changed to force success.

**B. Different auxiliary raw-coordinate SHADOW profile.** For each of three selected scenes (normal, translated critical, rotated critical), run **four additional native executions**, each in an independent fresh OS Node process, with a deliberately **extra research-only native-calling `Glass.onRayIncident` wrapper** installed *before* the existing Stage-1 owning observer. It snapshots actual incoming ray `p1/p2` and the callback native incident point **as original binary64 numeric scalar JSON**, before native mutates the ray, up to the existing 128-event diagnostic cap. The wrapper calls its original exactly once, but **it introduces an additional observer frame** and could affect exact-critical behavior. These **12 SHADOW runs are never pooled with, or treated as equivalent to, the genuine ON/OFF trials**. Their purpose is to retain **original per-hit geometry** in a bounded raw research ZIP so Chat B can independently reconstruct exact dyadic `t/u`, native finite face and the `P* vs P_native` mismatch. The runner also records classifications produced by existing `auditRecordedFiniteHit`, clearly **not** an independent reference. It does NOT claim that extra wrapper is neutral. Do not use its outcomes to estimate ordinary observer effect.

The intended total is **132 actually executed pinned-native trials** (120 randomized genuine ON/OFF +12 separate extra-geometry SHADOW). These are neither 132 physically completed traces nor a sample of original textbook problems. Eight native failures in PR90 remain historical, unaffected by this new code.

## Necessary controls and critical caveats

- Freeze and sha256 every fully authored scene and validate it as existing schema-v9 geometry before execution. Each trial's `sceneSha256` and native data fingerprint are matched against its frozen parent. All starts use the existing pinned `core.Session` and PhyDemo `Simulator`—never a custom numerical ray solver or analytical replacement.
- Keep `OFF` truly without the optional finite-hit observer output and `ON` explicitly annotated `nativeMeasurementQualificationUnchanged:true`. Do not accept any `suppressed` advisory or failed native run as completed just because the research runner itself succeeds.
- Independently check only **first native Snell/TIR branch controls** at ±5° in actual observed far-angle cases. No branch identity is prescribed for a mathematically exact critical ideal limit.
- Native signed relative detector power is measured only where a detector is physically present, never described as Watts or continuous irradiance.
- A randomized block schedule reduces *one* source of confounding and fresh process resets some persistent state. Neither equal distributions nor different distributions can **prove causal observer neutrality or interference**: the native runs remain separate, and machine/JIT/geometry representation effects are not controlled as exact counterfactuals. This study does not prove a universal numerical error bound, native geometric root cause or teacher-facing usefulness.
- The extra SHADOW capture must not leak raw ray points into **any production CLI or browser result**. It is research-only and intentionally preserves bounded potentially unreliable raw geometry for independent review. The user-authored source geometries and scene inputs are synthetic and do not include private textbook images or personal information.
- The mandatory Stage-2 withholding proposal remains unauthorized. Any physics/canonical measurement policy change needs a **new owner decision and distinct Chat B R2 review**.

## Reproduction and data integrity

On the isolated **draft research PR only**, after ordinary pinned setup, run:

```sh
npm run setup
npm test
node evaluation/native-observer-randomized-v2/run.mjs
```

The runner creates a fresh non-overwriting `test-artifacts/llm-authoring/native-observer-randomized-v2/` directory with immutable `inputs.json` and `report.json`, containing schedule, all native statuses, originals of SHADOW ray/incident coordinate snapshots, explicit differentiation of experimental profiles, and any failures. A disposable CI step uploads the bytes **even on failure**. The researcher must not change optical source parameters until a pass is obtained; any first failed CI remains historical. GitHub Actions retention is 14 days, so pin ZIP hashes and preserve important raw evidence durably, separately from production, before expiration.

**Acceptance means complete prospective execution and truthful original observations, not all native rays physically complete, no observer effect, or trusted geometrical correctness.** If CI finds a research error, correct the test separately while keeping the failed head, logs and any existing raw records.
