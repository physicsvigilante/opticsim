# Shared external opaque surfaces with finite dielectric regions

## Scope and architecture

The prospective v13 `finite-dielectric-composition` contract admits exactly one
existing triangular prism OR strictly convex four-vertex dielectric, 1–4 exact
single-ray sources, 0–1 external opaque `line-blocker`, 0–1 external plane mirror,
and 0–2 external passive line detectors. This is the same composition family,
component representation, native compiler and observation pipeline; it is not a
new prism–blocker or quadrilateral–blocker controller.

The zero-blocker and zero-mirror cases permit ordinary structural removal within
v13 without changing the model or silently reassigning old requests. A new minimal
request selects v13 only when it contains both a supported finite region and a
line blocker. Existing minimal requests without that combination keep their
historical selections. Mixed circular regions, additional media, nesting, lenses,
curved mirrors, circular blockers, finite apertures, extra blockers or a second
mirror are not admitted by this qualification increment.

`src/composition-profiles.js` owns counts, exclusive-region rules and selection.
`src/finite-dielectric-composition.js` applies the SAME external-surface tests to
both supported region shapes. The shape registry supplies existing faces and
shape-specific validation; there is no shape-specific absorber solver. Existing
`Glass`, `Blocker` with `filter:false`, `Mirror`, `SingleRay` and `Detector` objects
perform every actual optical interaction. The production adapter and observers
are unchanged. No donor-scene assembly, patched intersection method, prescribed
route or test-only bypass is used by the public v13 execution path.

The pinned PhyDemo commit remains `811f508d2b070898c241a568b0c167dcb8645251`.
No light-tracing law, numerical threshold, brightness or interaction budget is
changed. An eight-interaction maximum includes detector crossings.

## Shared qualification rule

Each external mirror or blocker must lie wholly outside the finite dielectric,
at least 0.01 mm beyond one common outward supporting face. Existing shape checks
apply the same exterior proof to detectors. Every pair of external mirror,
blocker and detector segments also needs 0.01 mm mutual clearance.

The usual source-to-supporting-line checks, finite bounds, convexity, vertex and
edge exclusions remain in force. These are conservative admission conditions,
not necessary and sufficient conditions for all physically possible arrangements.

In particular, a long segment to the right of a prism can be geometrically
external while failing the common-face proof. The original experimental prism
blocker at x=45 mm, length160 mm remains a retained refusal. The demonstrator uses
the explicitly recorded length80 mm amendment, not a weakened predicate or a
hidden geometric repair. Close-face controls preserve rejection at 0.009 mm and
acceptance at 0.011 mm; they do not establish arbitrary grazing robustness.

The same shared geometry code admits either first interception before the glass,
absorption after transmission, absorption after a reflected return, or a finite
miss. These are outcomes of native tracing, not route conditions in the validator.

## Historical meaning and qualified editing

Saved v1–v12 retain their reviewed rules. The new scope has its own prospective
contract/version because adding it to an old immutable profile would silently
change what historical saves mean. No automatic migration or upgrade-to-v13
operation is introduced; the separately reviewed explicit v10-to-v11 operation
is unchanged. Fresh v13 assembly and old-model-to-v13 editing are different claims.

Within v13, existing property changes and atomic structural add/remove operations
retain source assumptions, numerical settings, unrelated objects, parent hashes
and edit history. Removing B1 leaves its observation unavailable; adding Bnew does
not satisfy B1's request. A retired identity cannot be reused. A modified scene
requires fresh execution; parent results cannot qualify it.

The existing browser example selector adds **Finite glass + external opaque
blocker**. The ordinary controls, copy/paste exploration, qualified export/reopen,
Fit and measurement panels are used. There is no new editing frontend or transport.

## Synthetic examples and limits

`examples/external-blocker-composition.json` describes oblique transmission through
a triangular prism followed by an external absorber. Its ordinary compiled run
has two glass encounters, one absorption and no downstream crossing. Moving the
finite absorber out of the beam yields zero absorptions and a detector crossing.

`examples/external-blocker-return.json` describes transmission through rectangular
glass, reflection, re-entry through the SAME native glass and absorption on the
return side. The ordinary compiled run has four glass encounters, one reflection,
one absorption and no downstream detector crossing. No new scene implementation
is needed for this second apparatus.

These values describe explicitly synthetic apparatuses, not textbook-derived
facts. Both examples explicitly omit Fresnel partial reflections and retain TIR.
Enabling full Fresnel branching can remain incomplete; over-budget, stopped,
ambiguous and stale runs must not publish accepted native measurements. Native
absorption and detector counts are sampled observations, not proof of continuous
shadows, irradiance, image formation or source-attributed detector throughput.

## Reserved transfer and evidence provenance

The retained R1 numeric task uses two opposing external sources, a nonrectangular
quadrilateral, one blocker and two detectors, with no mirror. The implementation
and physical-checking helper were frozen before this turn's first inspection and
execution of that task. It was previously exposed to the same assistant and is
NOT an independent hidden evaluation.

Its first authoring JSON used the unsupported `policy` key and was rejected before
native execution. A separately retained correction changed that key to `runPolicy`
with the same `preview-v1` value. No physical value, production module or checker
was changed. The corrected original and blocker-height revision completed: the
original has two absorptions and two glass encounters; the miss revision has zero
absorptions and four glass encounters. Aggregate detector counts are not promoted
to source-labelled paths. Independent-of-tracer Snell/finite-segment/absorption
checks passed at every observed complete-run encounter.

`test/fixtures/external-blocker-transfer.json` and its tests retain that corrected
case as regression evidence. The first rejection, correction, original reservation
hashes and source freeze belong to the accompanying implementation evidence, not
a retrospectively clean first-attempt claim. This is bounded transfer with zero
additional arrangement-specific production changes, not arbitrary composability.

## Reproduction and acceptance gates

```sh
npm run setup
npm test
npm run build
node scripts/external-blocker-composition-acceptance.mjs
node scripts/external-blocker-composition-browser.mjs
npm run demo:package
```

Acceptance output must be fresh; existing evidence is never overwritten. The
browser script creates a fresh attempt directory. The existing read-only
refraction workflow gains these commands and artifact paths, not a new workflow
or public deployment. The ordinary repository suite includes historical contract
checks, the new native-law checks and the retained transfer regression.

Local implementation evidence: 628 available Node tests passed, including fifteen
new groups; the complete latest repository test corpus was not all available in
this restored workspace. Nineteen end-to-end cases retained nine completed native
runs (one requested TIR transmission unavailable), two incomplete runs and eight
not-run rejections. Two additional qualified structural branches were verified.
Headless/browser builds and the 27-example static package passed.

Local Chromium refused the localhost page because of its environment policy;
zero feature browser checks completed, and no browser-runtime pass is claimed.
The connected GitHub actions were read-only, so no feature branch, PR or CI run
was published. **Keep this patch unmerged pending complete current-suite CI and
real-browser acceptance on its exact published source.** Historical CI is not
substitute evidence for this implementation.
