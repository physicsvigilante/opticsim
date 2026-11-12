# Two original refraction problems: what the merged engine establishes

This is a same-assistant development application of merged PR #19, not a blind
trial, an independent accuracy score, or a claim that a green CI job means the
original questions were solved by native simulation. B05 and B06 were already
viewed in the broader capability review. No Solutions images were opened.

**Production engine unchanged:** baseline
`1b961a51259feea88c7ad0b8635ba4567bb54144`, pinned native core
`811f508d2b070898c241a568b0c167dcb8645251`.

Initial interpretation was committed at `037f2e54c91d1b393487076ae10cd7ed7a0c2e50`.
Initial requests were sealed before execution at
`5d61090cb500a87ff4e3e36590e8432d5b501104`, blob
`6507989a0074b68ac0e465c0982335e88fe4767f`. The original two PNG paths and SHA-256s
are in `first-attempt.json`. Later supplied angles and approximation policies
are saved under different attempt names, never substituted into the first file.

## B05: the critical-incidence inverse problem

The original image gives three parallel regions with indices 1.60, 1.80 and
1.30. The ray starts in medium 1, crosses medium 2, and reaches the 2/3 boundary
at critical incidence. It asks for initial theta and whether decreasing theta
allows transmission into medium 3.

### Mathematical answer (separate external reasoning)

For parallel interfaces, Snell's relation gives

`n1 sin(theta) = n2 sin(i23)`.

At critical incidence, `n2 sin(ic) = n3`, hence

`theta = asin(1.30 / 1.60) = 54.3409123039 degrees`.

The corresponding angle at the second boundary is
`ic = asin(1.30 / 1.80) = 46.2382573073 degrees`.

**Yes**, decreasing theta below this value allows a propagating transmitted ray
into medium 3: `n1 sin(theta) < n3`. This reasoning assumes positive incidence
between zero and 90 degrees and homogeneous isotropic media. The unspecified
thickness is not needed for these angular relations. The problem is
mathematically determinate; it does not need another given input angle.

### What native execution actually did

- **B05-first:** source direction is deliberately unresolved. Preparation
  returns `needs-information`; no native run, scene or package is produced.
  This exposes the current forward API's missing inverse operation, **not a
  defect or missing datum in the original mathematical question**.
- **B05-derived-full:** the external derivation supplies the input direction;
  full Fresnel tracing is incomplete, with native truncation about
  `0.0002074537378287`. Requested measurements are suppressed. It is not an
  engine-derived inverse answer.
- **B05-angular-only:** omitting partial Fresnel reflections is an explicit
  separate angular approximation, not a repair. At the calculated critical
  input the native first diagnostic gives nearly tangent transmission
  (about `89.9999979977 degrees`), but repeated aggregate interface encounters
  follow and the depth limit truncates the run. Its requested results remain
  suppressed. The numerical root cause has **not** been isolated; the first
  diagnostic is not promoted to a reliable exact-critical result.
- **B05-critical-bracket:** a five-sample forward sweep is centred on the
  externally calculated input. Four off-critical samples complete. Increasing
  theta by 0.001 or 1 degree gives native TIR at I23; decreasing theta by
  0.001 or 1 degree gives qualified transmitted angles about 89.71326049 and
  80.86815714 degrees. The exact sample stays incomplete. This corroborates
  the transition on either side; it does not prove an exact root or the entire
  continuous statement from a finite grid. The inverse observable remains
  `unavailable` at every sample.

The plotted input is source direction from +x, so `theta = 90 - direction`.
The sweep report includes this conversion. Partial-reflection omission means
its branch powers are not a complete dielectric-power prediction.

## B06: two branches, and a physically important weak reflection

The figure shows one incoming ray in index 1.3 at 30 degrees to the normal.
The downward transmitted branch crosses indices 1.4 and 1.32 into 1.45; theta4
is its final normal angle. The branch reflected at the 1.3/1.4 boundary goes
upward and refracts into air; theta5 is its outgoing normal angle. No bottom
mirror or additional emitter is introduced. The prose is less clear than the
diagram, so this branch interpretation is recorded explicitly.

### Mathematical answers (separate external reasoning)

With `n_air = 1` explicitly assumed,

`theta4 = asin((1.3 / 1.45) sin(30 degrees)) = 26.6331187492 degrees`.

Specular reflection preserves the normal angle, so

`theta5 = asin((1.3 / 1) sin(30 degrees)) = 40.5416018735 degrees`.

These are analytical answers under the stated interpretation; theta5 has **not**
been observed by the current native experiment. Air's exact numeric index,
source power and layer thicknesses were not measured from the picture.

### What native execution actually did

- **B06-first:** the geometry validates and the native engine emits one ray.
  It records the three downward refractions but discards all three weak reflected
  secondary branches. The required first reflection has relative brightness
  about `0.0014970155097346`; the pinned default-color cutoff is `0.01`.
  I1A (air boundary) therefore has zero encounters. Overall native truncation
  is about `0.0048077300619604`; all requested measurements are suppressed.
- **B06-retain-split:** a labelled comparison keeps Fresnel reflection at I12
  and omits partial reflections elsewhere. The needed branch is still below
  the unchanged cutoff, so the run remains incomplete and air is never reached.
  Removing unrelated secondary reflections does not solve this problem.
- **B06-downward-only:** all partial reflections are explicitly omitted. This
  partial subexperiment completes and reports qualified theta4 about
  `26.6331187492 degrees`. Theta5 is `unavailable`, not zero. This deliberately
  removes the original upward branch and **cannot answer the full problem**.

The relevant cutoff is visible in pinned
`src/core/sceneObjs/BaseGlass.js` around lines 235-264. It is native numerical
behavior, not a physical assertion that weak reflection does not exist.
No brightness was raised, threshold lowered, return flag repaired, extra emitter
inserted, or result-suppression rule weakened to make the original cases pass.

## Evidence and regression checks

Run after the project's normal setup:

```sh
npm test
node scripts/original-refraction-pair.mjs
```

An optional argument chooses a fresh directory beneath
`test-artifacts/llm-authoring/`. Existing evidence is never overwritten.
The runner verifies the archive and exactly the two Problems PNGs, preserves
submitted input bytes and process reports, writes `first-outcomes.json` before
any companion derivations, then retains every follow-up separately. It reads
no Solutions entry and calls no model service.

The artifact contains:
- `first-attempt.json`, `interpretation.md`, and the two verified Problems PNGs;
- `B05-first/` and `B06-first/` with unmodified initial requests and reports;
- `analytical-review.json`, clearly external reasoning rather than native answers;
- separately named full-Fresnel, approximate and partial subexperiments;
- `B05-critical-bracket/comparison.html`, its report, and each qualified sample;
- `report.json` combining results without an accuracy fraction.

The six focused regressions preserve the original records, B05's unresolved
inverse input, B06's discarded branch and suppression, near-critical vs exact
failure, the limited downward-only result, and drawing-scale invariance away
from the numerical pole. Some assertions lock observed pinned limitations; they
are **not physical correctness oracles for those limitations**. Future numerical
fixes should update those regressions with explicit new evidence, not bypass them.

## Recommended direction before another optical component

1. Audit **native numerical reliability for requested branches**: this image
   needs a reflection that the current numerical policy drops. Investigate
   supported native settings and budgets with explicit, tested policies; do not
   silently change physics or substitute a second source.
2. Isolate exact/near-critical **grazing behavior**, including region membership,
   intersection precision, coordinate transformations and budgets. Retain
   suppressed results until a justified policy is verified; do not tune an input
   until it looks like the picture.
3. Only then consider a bounded inverse-result operation for questions like B05.
   A forward sweep or a hand-supplied solved angle is not that operation. Likewise,
   any per-observable completeness policy must be justified, not a blanket
   permission to publish partial measurements.

No new component, production solver, schema, upstream change, external API or
public deployment is introduced by this trial. The two questions are now more
informative evidence for the next change than another synthetic success case.
