# Teacher task worksheet — three native optical families

**Status:** Prepared for real teachers; **no teacher or student has participated**. This is a source-exposed developmental usability exercise, **not** a blind LLM authoring benchmark or physics textbook answer test.

## How to use
Open each case's `baseline/qualified-scene.json` in the existing Opticsim viewer via **Open scene / qualified package**. Notice the physical units, stable component IDs, source provenance and requested results. Inspect the actual native rays and use **Fit apparatus and requested results**. Then open `what-if/qualified-scene.json`, the independently validated teacher hypothetical. Compare only quantities with the same scope and numerical sampling policy. Do not treat exported raw native JSON as preserving qualification.

For each task record **completed unaided**, **completed with guidance**, **not completed**, or **not assessed**. Note what was confusing, what physics was claimed, and any unavailable result. Preserve a reader's misunderstanding as a finding, not as a silent simulator success.

## Case A — Ideal lens and passive detector
1. Locate the source, finite ideal thin lens and detector, coordinate convention and assumed ideal-lens model.
2. Find the conditional analytical image. Is it explicitly distinguished from a **native detector hit** or optical image detection? Are crossings described as sampled and signed relative power as **not watts**?
3. Open the teacher hypothetical (focal length **100 → 150 mm**). Compare conditional image and actual sampled native observations. Use Fit. Does a similar crossing count prove no geometric change? **No.**
4. Export/reopen the qualified package. Does the edit remain recorded as **physics**, not as an original source fact?

## Case B — Plane mirror and passive detector
1. Find the two-sided finite mirror, directional source and detector.
2. Locate sampled reflection events and detector crossings. A virtual image predicted for the **supporting line** is conditional on rays hitting the actual finite segment; it is **not a native detected image**.
3. Open the teacher hypothetical (**source-1.y 30 → 40 mm**). Explain which original facts are preserved. Do not infer an individual full ray path from aggregate counts.

## Case C — Finite convex glass and passive detector
1. Identify the explicit four vertices, inside/outside indices, source direction and **partialReflection: false** transmitted-only approximation. Native TIR still exists.
2. Distinguish a **first native face event** and per-face counts from a complete ray history or an observed physical image.
3. The opt-in finite-hit diagnostic may return `checked`, `unknown`, or `inconsistent` only as *bounded, noncertifying advisory* evidence; do not use it to certify a complete optical path or impose a new withholding rule.
4. Confirm an unsupported `ideal-image` request for this glass arrangement is marked unavailable, not calculated by an invented mirror/lens.
5. Open the teacher hypothetical (**S1.directionDeg 0° → 5°**). Only the physical source emission direction changes; numerical sampling policy stays fixed.

## Shared evidence/learning rubric (record separately per task)
| Dimension | Observable evaluation and limitation |
| --- | --- |
| Source fidelity | Pinned exposed fixture fields/ID/units retained; NOT an unfamiliar-text fidelity score |
| Native correctness | Current completed qualified simulation and observed methods; NOT an all-path/real-world guarantee |
| Simulation coverage | Whether the existing contract admits the apparatus/readout, including explicit unavailable outcomes |
| Evidence comprehension | Can the teacher distinguish source-given, intervention, conditional analysis, native samples, numerical caution and unsupported results? |
| Teacher-perceived usefulness | **NOT ASSESSED** until genuine teacher answers are collected |
| Textbook-answer completeness | Not requested for these fixture-based exploration tasks |

Record **source/scene setup errors, Chrome availability, stale readout/import, clipped Fit, provenance ambiguity and confused source claims** as separate failure classes. No physics, educational or independent-model claim is implied by a passed automated check.

### Private response worksheet (do not commit filled participant sheets)
For each of **lens / mirror / glass**, record task status; whether support was needed; one direct observation of confusion or useful clarity; one mistaken evidence/physics inference (if present); whether the participant could find the source/variant distinction; and notes on which exact displayed labels/screenshots caused the issue. Do not store names, email addresses, personal data or private source material in public Actions reports. Teachers participate voluntarily and their actual responses are not implied by this blank worksheet.
