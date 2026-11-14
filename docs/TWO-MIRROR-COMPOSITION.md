# Finite glass with one or two external mirrors

Schema/adapter **v11** extends the existing `finite-dielectric-composition`
family through a bounded component-count policy and the shared geometry checks.
There is no new model name for a particular ray route, second ray tracer,
intersection override, optical law, numerical policy or PhyDemo version.

## Whole-system contract

Exactly one strictly convex four-vertex `polygon-dielectric`, **one or two**
external finite `plane-mirror` components, 1–4 explicit single-ray point sources,
and 0–2 external line detectors. Source positions may be inside or outside.
All geometry, indices, brightness, directions and `partialReflection` values
remain explicit. No lenses, blockers, extra regions, third mirror, nested media,
curved glass, new emission mode or motion are admitted by this extension.

`extendedFiniteCompositionPolicy()` supplies a defensive copy of the same
cardinality data used by validation. `compositionCardinalitiesMatch()` checks
whole-system counts; it does NOT certify geometry or execution. Every mirror
must separately satisfy the existing 0.01 mm common-separating-face proof outside
the glass. Every external segment pair, including mirror–mirror, needs 0.01 mm
clearance. Existing source supporting-line, convexity, bounds, corner and
finite-surface checks remain active. These are conservative admission rules,
not assertions that every rejected arrangement is physically impossible.

Both mirrors are ordinary independent native Mirror instances with stable IDs.
PhyDemo chooses which one is encountered first, whether either is missed, and
whether the ray later meets the glass again. Aggregate reflection counts cannot
be promoted into source-labelled ray paths or detected images.

## Version preservation and structural edits

The new saved version is necessary to keep the reviewed v10 contract immutable;
**v10 still requires exactly one mirror**. v9 remains polygon-only. All older
saved scenes keep their validation, native exports and execution behavior.
No automatic migration or assumption change is introduced.

Minimal requests containing a polygon and one mirror still prepare v10; those
containing two mirrors prepare v11 through the existing authoring interface.
Unsupported counts are rejected, not clamped. A v10 structural revision cannot
silently acquire a second mirror. Explicitly author the expanded system, or use
[the opt-in qualified v10-to-v11 upgrade](COMPOSITION-CONTRACT-UPGRADE.md) to add
the stated mirror while preserving the existing baseline and its history.

Once in v11, existing atomic structural revisions may add/remove a mirror within
its 1–2 range without changing schema or model. Removing the final mirror or
sole glass is rejected. Removing M2 leaves a request targeting M2 unavailable;
adding a new M3 does not rename or satisfy that old request. Qualified lineage
continues to reject retired-ID reuse. Physical edits, sweeps and qualified
save/reopen use the existing shared operations and hash guards.

## Synthetic demonstration, not a prescribed ray route

`examples/finite-glass-two-mirrors.json` contains the fully declared unified
request; `scenes/finite-glass-two-mirrors.json` is its canonical scene. The viewer
menu includes **Finite glass + two external mirrors**.

Source S1 is at (-40,0) mm, directed along +x. G1 occupies x=0..20 and y=-30..30
mm with inside/exterior indices 1.5/1. M1 is centred at (60,0) mm, tangent 45°;
M2 at (60,20) mm, tangent 135°. Both have length 16 mm. D1 is a vertical 20 mm
segment at (-20,20) mm. Fresnel partial reflections are explicitly omitted in
this synthetic approximation; native total internal reflection is retained.

The verified normal path has four glass encounters, one encounter with each
mirror and one detector crossing, at (-20,20) mm. Moving M2 to x=100 mm retains
M1's reflection but yields zero M2 reflections and no return detector crossing.
Moving M1 out of the beam can miss both mirrors. Reversing the illumination
height can encounter M2 before M1. These are consequences of the declared
geometry, not sequences supplied to the runtime engine.

## Numerical boundaries remain visible

The default mode, native cutoffs, processed-ray limit and maximum depth of eight
object interactions are unchanged. The demonstration uses seven interactions.
A single detector crossed twice instead can fit exactly eight; adding another
crossed detector can require nine and truncate. Do not confuse processed ray
segments with object-interaction depth.

Full Fresnel reflections, trapped loops and depth-limited runs remain incomplete
and withhold all accepted native readings. A reflected corner encounter can
produce failed/ambiguous evidence and is also withheld. No retry, angle nudge,
brightness adjustment, new tolerance or silent reflection omission is used.
Two oppositely directed crossings may yield zero *signed relative* detector
power; this does not establish zero illumination or watts.

## Verification and reproduction

```
npm test
npm run build
node scripts/two-mirror-composition-acceptance.mjs
node scripts/two-mirror-composition-browser.mjs
npm run demo:package
```

The acceptance command also accepts a fresh output directory under
`test-artifacts/llm-authoring/`. Existing evidence is never overwritten. The
browser command accepts the resulting report path and creates a fresh attempt
folder under `test-artifacts/browser-two-mirror-composition/`.

Tests check actual per-encounter Snell and reflection invariants in 36 rotated,
scaled, translated, angle/material variants, plus independently tilted mirrors,
a nonrectangular quadrilateral, reversed and internal sources, finite misses,
TIR, equal indices, units, winding, input order and multiple sources. Fixed
normal-incidence hit coordinates provide a separate geometric check. Test-only
observers delegate once and retain bounded evidence, never feed computed rays
back into native tracing. Historical 51-case fingerprints are unchanged; their
membership is frozen so new scenes have separate tests rather than silently
refreshing prior expected results.

Eighteen end-to-end cases include completed, incomplete, failed, unsupported,
missing-input and invalid-input outcomes. Three sweep samples retain one invalid
sample. Browser checks cover both mirror IDs, physical edits, qualified export
and structural-branch reopen, old-target unavailability, TIR, invalid/incomplete
suppression, narrow-screen Fit and the unchanged v10 example. Logs and artifacts
establish which checks actually ran. Engineering checks are not independent LLM
interpretation or classroom evidence, nor textbook-answer completeness.
