# Frozen protocol: held-out v9 Glass numerical profiles, experiment v1

**Research only / PR #95 candidate.** The following test selection and pass/refusal criteria were fixed in source control **before the held-out native runs**. This pre-registration is not evidence of execution or numerical success.

## Baseline and provenance

- Production `main`: `50dd0f4d9530d0a61bb4c7064c4326a8ac0ce518`; Node 24.19.0, pinned unmodified PhyDemo `811f508d2b070898c241a568b0c167dcb8645251`.
- Reuse existing schema-v9 convex quadrilateral Glass construction, stable v9 source and native execution. No change to production `src/`, PhyDemo, cutoff, emitters, detector power, Stage-1 advisory, source facts, or Stage-2 qualification.
- Input shape: an authored 6000-mm-wide 1000-mm-high rectangle with inside index 1.6 and outside index 1.3, and one single ray from 100 mm below upper face, `partialReflection:false`. For transformed cases use identical rigid transformations of vertices, source, and ray direction. This is a synthetic mathematical sensitivity experiment, not JEE interpretation or accepted real-world branch certification.

## Six held-out geometries, not the PR #92 five cases

Compute `critical=asin(1.3/1.6) * 180/pi` in JavaScript at scene construction (no hand-adjustment based on outcome). All cases deliberately differ from PR #92's original translation +245,-170, rotation +37 or far ±5 degree geometry.

| ID | Incidence relative to calculated critical | Rotation | Translation (mm) |
|---|---:|---:|---|
| subcritical-tilt-m23 | critical - 7° | -23° | (-350, +220) |
| supercritical-tilt-p61 | critical + 7° | +61° | (+130, +80) |
| critical-shift-neg | critical | 0° | (-380, +260) |
| critical-tilt-m23 | critical | -23° | (0, 0) |
| critical-tilt-p61-shift | critical | +61° | (+120, -220) |
| critical-tilt-p14-shift | critical | +14° | (-170, +330) |

These are held out from the 5 original PR #92 configurations but **not a randomized population sample** of all optical systems; the 6 cases share one synthetic geometry family. Geometry is prepared and validated identically across modes. Keep all original JSON input bytes and scene hashes once generated, do not selectively replace a case after observing failures.

## Precommitted profiles and schedule

Each of the six frozen cases has **two randomized balanced blocks**. Each block runs one of each of exactly three profiles in shuffled order using deterministic seed `0x9500A55` (six runs per case, **36 total native process trials**).

- `ordinary-off`: usual `evaluateDocument` with **no finite-hit advisory request**. No Stage-1 finite diagnostic capture; ordinary native simulation still uses existing ordinary source/interface instruments required by the normal application.
- `ordinary-on`: existing shipped opt-in Stage-1 numerical advisory enabled through normal `evaluateDocument`; **no extra test-only TAP**.
- `single-owner-tap`: existing Stage-1 with an **additional synchronous research-only beforeIncident method tap**, still one actual native-calling Glass observer. It does not trace new rays or alter native geometry, but **might affect near-critical execution**. Only this profile records incoming p1/p2 and reported incident coordinates.

One fresh Node OS process for each trial. Record source scene hash, profile, randomized schedule, elapsed time, exact native status/error/complete/warnings, first interaction information where actually available, native fingerprint, source emission/meter counts, observer/tap invariants, suppressed status and advisory status separately. **Never pool ordinary and tapped outcomes under a name implying observer neutrality**. Native failures remain failures even if a callback was captured. No native-path identity or causal observer inference from aggregate frequency.

## Hypotheses, checks and refusals

1. Confirm new held-out scenes are valid and remain byte-for-byte unchanged across each execution; all 36 scheduled process trials must yield an original record or fail research setup, and all records must retain real native failures and warnings. Source hashes are checked against pre-registration.
2. Check all real callback samples collected only through separate TAP with an independently expressed Python exact rational reference over the represented IEEE754 inputs. Every TAP per-hit classification must be retained as `checked`, `inconsistent`, or `unknown`, with true reason codes; do not invent bounds or reclassify failed runs as accepted physical results.
3. Use subcritical/supercritical cases only for independently supported coarse scalar Snell/TIR first-contact controls **when a first native contact is available**; missing contact remains missing, not a fabricated pass. At exact calculated critical incidence, there is **no predeclared mathematical branch verdict**.
4. Compare per-case ordinary-off / ordinary-on / TAP outcome distributions and native fingerprints descriptively. Differences cannot establish whether the observer caused variation: profiles execute in separate processes with timing differences and no validated counterfactual. Matching results cannot prove neutrality.
5. Explicitly tabulate distinct binary64 hit signatures, not just callbacks, and report vertex/face ambiguity and conditioning-unknowns. Never extrapolate a safe spatial tolerance, PhyDemo numerical fix, optical power, image detection, or full ray paths from this study.
6. A workflow may PASS its **research execution/integrity** checks even if some native trials legitimately FAIL, provided every failure is retained as a genuine status and all preregistered process/result integrity conditions hold. No claim of universal physical correctness from green CI.

**Immutable evidence discipline:** workflow produces fresh `inputs.json`, `report.json`, `exact-reference.json` and retains all on success/failure through `if: always()`, 14-day Action retention. Save hashes/links. Any first failed CI remains in history and must not be rewritten. Do not merge disposable workflow or PR. Require new independent Chat B R2 **research/evidence** review of exact successful head before using the new evidence for any physics or policy decision. Further changes to native optics or Stage-2 require a separate explicit owner release decision and full validation.
