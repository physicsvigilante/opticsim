# J19 follow-up: native decentered two-lens Beam feasibility

Research only. This adds no production schema, authoring, compiler, observer,
observable, browser, upstream or workflow changes. It does not merge PR #165,
change its first attempts, or upgrade its coverage counts. The current public
API must continue rejecting nonzero ideal-lens transverse centres and two-lens
parallel beams. This is same-builder evidence, not independent review.

## Source and frozen inputs

`protocol.json` identifies the exact prior source audit at
`6a72bd67e58e9a3fd94a6bf33d88d1f20295b4c2`, J19 / chapter `07_Lens_Formula` /
problem `027`, and the original archive hash. The source description is taken
from that committed direct visual inspection. This follow-up does not claim a
new inspection or access any Solutions entry. The prior audit remains the
source-image binding authority, not this research fixture.

The problem states equal positive focal lengths f, axial separation 3f, a
second lens offset d much less than f, and parallel input from the left.
It does not specify numeric f/d, source width, apertures, brightness, density
or detectors. Those are explicitly added research apparatus, not original
facts. The baseline uses f=200 mm, d=2 mm, width=20 mm, 80 mm lens segments,
brightness .08, density .4, and passive detector planes at 4f and 6f. Sign,
translation, scale, reverse, density, missing-lens, finite-miss and stopped-run
controls are hypotheticals; especially d=100 mm is an adversarial miss control,
not an instance of the source's d much less than f approximation.

The protocol and expected scalar relations are frozen before native execution.
Do not tune them to native output. Preserve any failure as evidence and explain
any later test-harness correction in a separate commit.

## Independent scalar reference

Use y-up, local travel coordinate t=sign*(x-x0), and initial height a=y-y0.
For a ray that actually intercepts both ideal thin lenses:

- First lens changes slope from zero to -a/f.
- Propagation by 3f gives second-lens height -2a relative to y0.
- Second lens, centred at d, changes slope to (a+d)/f.
- Propagation by another 2f gives y-y0=2d independently of a.

Thus the conditional reference intersection is
`(x0 + sign*5f, y0 + 2d)`. For the original axes this is `(5f, 2d)`.
The scalar reference is separate from the native execution: it never emits,
modifies, aims or routes a native ray. No detector is placed at the predicted
focus in the baseline: the two fixed planes bracket it. A line-concurrence fit
uses only actual detector positions/directions, without receiving the expected
focus. Fitting sampled outgoing rays is NOT physical image reconstruction,
wave-optical validation, continuous irradiance or a new public observable.

## Execution and evidence

The test builds native JSON directly using the existing pinned PhyDemo Beam,
IdealLens, Detector and Simulator. Each native input has its own SHA-256.
No substituted native JSON is qualified under an unrelated canonical hash.
Native emission and incident methods are delegated once; snapshots are bounded,
never silently clipped. A WeakMap tracks only actual emitted native objects;
unknown/branched objects fail rather than receive invented lineage.

The 15 frozen cases include 14 expected complete traces and one intentionally
stopped trace. Dense sampling expects 16 rays; other cases expect 8. Finite
second-lens misses are not absorption: the narrow-lens control expects three
actual two-lens paths and five one-lens bypass paths. All eight detector paths
are checked. Mixed paths cannot be presented as one common two-lens focus.
The total-miss and missing-lens controls cannot qualify a two-lens fit.

Per-run observation must preserve native event, processed count, truncation,
undefined behavior, errors, warnings and detector powers against unobserved
replays for baseline and partial-interception controls. Baseline replay must
retain identical emitted samples and incident snapshots. Incomplete native
runs retain raw research diagnostics but have no accepted research fit.

Run from a fresh evidence workspace on supported Node 24.19.0:

```sh
npm run setup
npm test
```

For a focused replay after building the test bundle:

```sh
node scripts/build.mjs --test
node --test test/jee-decentered-beam-research.test.mjs
```

The fixed output directory must not already contain a prior run. Exclusive
writes deliberately refuse overwrite. Preserve/move old evidence before a new
local replay. Existing CI uses fresh checkouts and archives the directory via
its existing `llm-authoring-evidence` upload, without workflow changes:

`test-artifacts/llm-authoring/jee-decentered-beam-research-v1/`

It contains frozen protocol bytes, raw native inputs/emissions/events per case,
summary report with protocol/input hashes and execution identity, or a failure
record. An intentional stop passing its suppression assertion is not completed
optical simulation. Read actual CI artifacts before claiming a successful run.

## Not yet supported / next gate

Even a successful probe establishes only this bounded native feasibility.
Before production admission, separately implement and review explicit lens
transverse centres with y-up/y-down conversion, bounded multi-lens Beam
composition, historical-centre defaults and round-trip compatibility, safe
finite-segment/endpoint checks after refraction, revision/sweep validation,
qualified export provenance, and real browser edit/reopen evidence.

Do not extend a coaxial analytical query to displaced lenses by deleting the
offset. Keep arbitrary tilt, thick/material lenses, general mixed optics,
unbounded lens counts and automatic image detection outside this proposal.
Use one coherent integration review once the bounded implementation and
adversarial evidence are ready, rather than requesting separate reviews for
this data-only feasibility step and every preparatory test.
