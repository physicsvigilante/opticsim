# Held-out v9 finite Glass numerical-conditioning trial (research only)

**DRAFT; DO NOT MERGE THE DISPOSABLE WORKFLOW.** Frozen initial source `main` `50dd0f4d9530d0a61bb4c7064c4326a8ac0ce518`; exact vendor pin `811f508d2b070898c241a568b0c167dcb8645251`. This follows independent Chat B R2 PR #93 research PASS and separate corrected PR #94 signed-zero reproduction. **Neither prior PASS is a review of the NEW experimental cases.**

## Prior-to-execution preregistration

The 20 exact synthetic case inputs were committed **before ANY held-out native execution** at immutable design-only commit `f5a2557f06f35896fc9003803a0a329d8d541db4`. The original `locked-design.json` Git blob SHA is `a3e48bd3efb02ebb263ae86066cb2e74290704a2`, explicitly checked by `run.mjs`. See [separate preregistered review_sandbox record](https://github.com/physicsvigilante/review_sandbox/blob/main/projects/opticsim/pr-95/PREREGISTRATION.md). No result-dependent modification or regeneration of these cases is permitted.

Cases: rectangle and trapezoid, each at two independent transformed placements; translations, rotations and scales yield four geometry families, each with five fixed incidence offsets `[-6, -0.05, 0, +0.05, +6]` degrees from `asin(1.3/1.6) = 54.34091230386124°`. The faces have authored **y-up** coordinates; PhyDemo emitted and incident rays use native **y-down**. All 20 were preflight-checked algebraically for convexity, coordinate bounds and initial finite top-face crossing; **no native outcomes were inspected at preregistration**. There are two balanced seed-randomized blocks per case; each block executes exactly one of each `ordinary-off`, `ordinary-on`, `single-owner-tap`. The fixed `seed=0x95a44e21` produces a 120-row immutable schedule. Separate fresh OS Node 24 process per run, same physical authored scene per profile.

### What the three profiles mean

- `ordinary-off`: **normal production-path optics** without the opt-in Stage-1 finite-hit diagnostic; native source/interface observers are still normally present. It is **not** completely bare upstream PhyDemo.
- `ordinary-on`: normal shipped opt-in Stage-1 finite-hit diagnostic. No additional research tap. Its advisory may be unknown or suppressed, never an oracle, and actual native statuses and original measurement qualifications remain unchanged.
- `single-owner-tap`: the same existing single owning Glass `onRayIncident` observer as ordinary ON, with one extra synchronous `finiteDiagnostic.beforeIncident` method tap to preserve actual native `ray.p1/p2` and reported `incident` scalar points **before mutation**. The original diagnostic and original native callback are delegated exactly once. The extra JavaScript work may perturb numerical behavior, so TAP is **NOT** equivalent to ordinary ON. TAP raw coordinates are unavailable for ordinary OFF/ON. Differences in outcomes are *descriptive*, not causal proof.

All statuses and failures are preserved: `completed`, `completed-with-warnings`, `failed`, `stopped`, truncation/undefined behavior, emitted and first-encounter counts, diagnostic cautions, exact source and scene hashes. The runner records setup/OS-process errors *separately* and fails CI if any planned trial is missing, without relabelling native failures as infrastructure faults or rewriting originals.

## Precommitted evidence/questions

1. **Observed actual native behavior:** Group status, first interaction and native fingerprint by 20 cases × 3 profiles × 2 blocks. Do not pool ON, OFF and TAP as if they share one observer/cause. First interactions at ±6° are limited ideal scalar control expectations (far below → transmission; far above → TIR); a differing/missing native outcome is recorded, never silently repaired. Near and exactly critical have **no prescribed correct numerical branch**.
2. **Actual TAP callbacks:** Independently authored test-only Python exact `Fraction.from_float` reference classifies represented binary64 ray/finite-edge t/u from original captured endpoints, with native face inferred only if exactly one authored y-up face (converted to y-down) lies within the existing **identification threshold** `1e-5 mm`. This face-proximity rule does NOT create a physically validated hit-position tolerance. Keep vertex/conditioning ambiguous and source-vs-represented-point differences **unknown**, not fully certified.
3. **Source-specific numerical arithmetic:** Recreate pinned native global determinant operation order on **float64-coerced** original JSON scalars to compare numeric reported callback point and native rounded-point dot/finite/cutoff predicates. Signed zero is a serialization-limited bit phenomenon (prior PR #93 N-01); numeric `+0===-0` is the appropriate point agreement. Do not extrapolate a universal error envelope or the true original in-memory zero sign.
4. **Generality not independent sample inflation:** Report **unique binary64 hit signatures and unique scenes**, repeated processes, cases and actual outcomes separately. Differences by translation/rotation/scale/angle are descriptions of THIS fixed sample, not a general law or observer-neutrality proof.

## Exact deterministic execution

On GitHub Actions this draft adds one **separate research-only disposable workflow**; the **eleven existing workflows** remain unchanged. It installs pinned native and builds the existing Node test core, checks the original locked manifest Git blob, executes `node evaluation/native-heldout-conditioning-v1/run.mjs` and then `python3 evaluation/native-heldout-conditioning-v1/analyze.py` against the unchanged emitted `inputs.json` and `report.json`. The research workflow archives the original input and derived analysis on success **and** on failure; a failure is not permission to modify an already executed scene or suppress a native failure.

Node 24 is required; Python 3.13 is scoped to the research-only offline analyzer, not to the Opticsim production runtime. A manual local study from a verified repository checkout uses fresh ignored output directories:

```sh
npm run setup
node scripts/build.mjs --test
node evaluation/native-heldout-conditioning-v1/run.mjs
python3 evaluation/native-heldout-conditioning-v1/analyze.py \
  test-artifacts/llm-authoring/native-heldout-conditioning-v1 \
  test-artifacts/llm-authoring/native-heldout-conditioning-v1/exact
```

**No production source, PhyDemo upstream code, material law, scene schema, optics thresholds, UI, detector power, mandatory measurement gate, scene interpretation or Stage-2 withholding is changed.** Any future production numerical fix needs its own design, held-out native and browser evidence, independent R2 implementation review and separate explicit owner merge authorization. **This PR is experimental and must remain draft/unmerged.**
