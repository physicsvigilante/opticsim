# Opticsim — native finite-hit capture inside the existing single owning Stage-1 observer

**Research-only. DO NOT MERGE temporary CI into production.** This investigation responds to the independently reviewed [PR #91 research](https://github.com/physicsvigilante/review_sandbox/blob/main/projects/opticsim/pr-91/reviews/review-01-chat-b.md). PR #91's first original ZIP and independent verdict remain unchanged, including the original nonblocking **misnamed pooled native-state aggregate** `genuineNativeStates`. This new study replaces no previous research evidence and makes **no production changes to `src/`, native PhyDemo, physical objects, schemas, numerical limits, canonical detector power or qualification**.

**Baseline:** Owner-approved [Stage-1 PR #89 merge](https://github.com/physicsvigilante/review_sandbox/blob/main/projects/opticsim/pr-89/MERGE-REPORT.md), main `50dd0f4d9530d0a61bb4c7064c4326a8ac0ce518`, pinned PhyDemo `811f508d2b070898c241a568b0c167dcb8645251`, Node v24.19.0. No original textbook images, source interpretation trials, optical images, analytical inverse answer or student evaluation involved.

## What changes from the prior instrumented SHADOW experiment

The PR #91 SHADOW profile attached **a second native-calling `Glass.onRayIncident` wrapper** around the already owning Stage-1 wrapper. Chat B independently recomputed ten **represented-line nonforward** records using original raw binary64 points, but this **extra native-calling wrapper could perturb critical numerical behavior**. Its native outcomes cannot be treated as normal Stage-1 ON runs or as evidence of observer neutrality.

This new research profile **does not install any additional native-calling `Glass.onRayIncident` wrapper**. It uses the **existing Stage-1 observer** as the only native-calling wrapper and attaches a separate bounded **`finiteDiagnostic.beforeIncident` method tap** before that method's original call. When the installed owning native observer calls `finiteDiagnostic.beforeIncident`, the tap copies the actual unmutated incoming native ray `p1/p2` and callback incident point to a private research-only array, then delegates the original diagnostic method **exactly once**; the existing owning observer still delegates the **original PhyDemo Glass exactly once**, with the same `this`, arguments, ray mutation, callbacks and returned object.

**However, this is STILL extra synchronous JavaScript instrumentation** on the native callback hot path. It may change near-critical execution behavior. It is therefore a **distinct experimental profile** called `single-owner-tap`, **not** a proven-neutral version of ordinary Stage-1 ON. It cannot determine whether the optional Stage-1 observer itself perturbs the PhyDemo engine, because both arms here use the already-shipped Stage-1 diagnostic. It also does not prove underlying optical physical truth.

## Frozen randomized trial design and reported boundaries

Five *explicitly synthetic* existing schema-v9 one convex quadrilateral Glass cases, with immutable document hashes:

- Normal Glass with one real SingleRay source and one passive detector, retaining signed **relative** native power (not Watts).
- High-index inside (n=1.6) to lower outside (n=1.3), native single source at computed critical incidence −5°.
- Computed critical incidence in **translated** geometry (`+245, -170 mm`).
- Computed critical incidence in **rigid 37°-rotated** geometry.
- Computed critical incidence +5°.

Each case preregisters **three randomized blocks of four trials**, exactly **two ordinary Stage-1 ON** and **two instrumented single-owner-tap** per block. Every run starts in a **fresh Node OS process**; fixed pseudorandom seed `0x9200a55`, full schedule, physical save JSON and SHA-256 are preserved in `inputs.json` **before any native trial**. Total planned: **60 actual native runs (30 ordinary ON, 30 single-owner-tap)**. All completed, failed, warning and incomplete native states are retained; a *completed runner* does **not** imply a completed PhyDemo optical trace.

**The counterfactual is not literally the same native ray object.** Randomization counterbalances order but cannot remove native exact-critical representation, JIT, process startup, memory/state or ray scheduling effects. Differences are descriptive, not causal proof of tap overhead or neutrality. Ordinary Stage-1 ON does **not** export raw hit coordinates; the extra-tap profile preserves original binary64 hit data for independent review, but **does not certify those exact contradictions in every untapped ON run**.

## Exact hit geometry and failure controls

- Per tap, capture at most **128** actual native Glass callbacks (the existing Stage-1 availability cap). The original owning callback count is independently *recorded from the same observer*, and count mismatches trigger a research failure. Original p1/p2 and native incident are saved in their actual native y-down coordinates *before* PhyDemo mutates rays; finite-face vertices and unchanged native cutoff are preserved. No user-facing result contains the raw capture.
- `run.mjs` records opt-in method verdicts, true terminal status, source/interface/detector meters, native errors and the original raw per-hit geometry, separately from the ordinary ON runs. The physical authored scene is reserialized and SHA-verified around every run; no retry repairs a failed native trial.
- `exact-check.py` uses Python `fractions.Fraction.from_float` to independently express **represented binary64 dyadic straight-ray/finite-segment intersections**, finite parameter `u`, forward `t>0`, squared step above unchanged native cutoff, the dimensionless near-parallel uncertainty rule and exact supplied-hit agreement. This is a **second Chat A-authored reference implementation, not independent Chat B science or a new native solver**. All original records and any mismatch are archived. It deliberately does not invent a numerical error envelope or classify mathematically exact critical-branch continuum optics.
- To prevent the PR #91 F-01 pooled-field mislabel, the new report contains **three explicitly named disjoint aggregates**: `ordinaryOnNativeStates`, `singleOwnerTapNativeStates`, `allNativeStates`, with assertions that profile subtotals equal the 60 original rows. There is **no** ambiguous `genuineNativeStates` field.
- Far-from-critical ±5° controls compare only the first actual native outcome against scalar Snell transmission or total internal reflection; there is no manufactured ray path, image or continuous flux.
- No source schema, PhyDemo native code, cutoffs, accepted measurement policy or default unrequested physical readout changes. This is a **temporary research workflow** with original failures retained via `if: always()` uploads.

## Reproduction, retained evidence, limits

On the test-only PR branch with native setup:

```sh
npm run setup
npm test
node evaluation/native-single-owner-hit-capture-v1/run.mjs
python3 evaluation/native-single-owner-hit-capture-v1/exact-check.py
```

The runner writes `test-artifacts/llm-authoring/native-single-owner-hit-capture-v1/inputs.json` and `report.json`; the Python test additionally writes `exact-reference.json`. **Output must be fresh and never overwrites an earlier attempt.** The CI artifacts have 14-day retention; important original ZIP bytes, metadata hashes and any native failures should be retained in a separate access-controlled archive before expiration.

**A research PASS establishes only bounded sample counts, genuine pinned-native execution and exact represented-geometry evidence for the explicitly tapped runs.** It cannot prove physical Snell/critical branching in general, right/wrong original JEE answers, numerical convergence, browser/teacher usefulness, Stage-1 observer neutrality, a validated reported-hit error envelope, or a reason to withhold canonical v9 measurements. An independent Chat B R2 research/evidence review is required before relying on these observations for any new policy. **Do not merge this disposable research workflow, enable Stage 2 mandatory withholding or change pinned optics.**
