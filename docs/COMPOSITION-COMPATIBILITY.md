# Composition compatibility and shared validation

The shared-validation foundation preserves historical contracts. v11 admits
one or two external plane mirrors with one finite quadrilateral. The separately
versioned v12 contract admits exactly one triangle OR quadrilateral with the same
mirror limits, using shared composition and shape-specific region checks. See
`FINITE-SHAPE-COMPOSITION.md`; arbitrary mixtures remain unsupported.
The production PhyDemo pin remains `811f508d2b070898c241a568b0c167dcb8645251`.

## Existing compatibility matrix

Counts below are per scene. A row is a whole-system contract, not permission to
combine it with another row. A component's registration, native availability or
pairwise compatibility is insufficient to admit a complete apparatus.
`src/contract.js` and its family validators remain authoritative.

| Saved schema / model | Sources | Admitted optical components | Detectors |
| --- | --- | --- | --- |
| v1-v3 `ideal-thin-lens-geometric` | 1 | 1-2 coaxial ideal lenses | 0 |
| v3 `plane-mirror-geometric` | 1 | Exactly 1 finite plane mirror | 0 |
| v4 `ideal-thin-lens-geometric` | 1 | 1-4 coaxial ideal lenses | 0-2 |
| v4 `plane-mirror-geometric` | 1 | Exactly 1 finite plane mirror | 0-2 |
| v4 `lens-mirror-return-geometric` | 1 | Exactly 1 lens and 1 perpendicular mirror in the existing source-left return layout | 0-2 |
| v4 `mixed-lens-mirror-tracing` | 1-4 | 1-4 coaxial ideal lenses and 1-4 plane mirrors; no stops | 0-2 |
| v4 `general-component-tracing` | 1-4 | 0-4 lenses, 0-4 plane mirrors, 0-2 stops **combined** across line blockers, circular blockers and finite apertures | 0-2 |
| v5 `planar-media-tracing` | 1-4 | 1-4 parallel, consistently oriented interfaces with matching adjacent material indices; 0-4 finite plane mirrors confined to individual media | 0-2 |
| v6 `curved-mirror-tracing` | 1-4 | 1-2 curved reflectors **combined** across ideal and circular-arc mirrors; 0-2 plane mirrors | 0-2 |
| v7 `circular-dielectric-tracing` | 1-4 | Exactly 1 finite circular dielectric; no mirrors or other optics | 0-2 external |
| v8 `triangular-prism-tracing` | 1-4 | Exactly 1 finite triangular dielectric; no mirrors or other optics | 0-2 external |
| v9 `polygon-dielectric-tracing` | 1-4 | Exactly 1 strictly convex four-vertex dielectric; no mirrors or other optics | 0-2 external |
| v10 `finite-dielectric-composition` | 1-4 | Exactly 1 strictly convex four-vertex dielectric and exactly 1 external finite plane mirror | 0-2 external |
| v11 `finite-dielectric-composition` | 1-4 | Exactly 1 strictly convex four-vertex dielectric and 1-2 external finite plane mirrors | 0-2 external |
| v12 `finite-dielectric-composition` | 1-4 | Exactly 1 triangle OR strictly convex four-vertex dielectric, and 1-2 external finite plane mirrors | 0-2 external |

v1 has the historical source representation; migration preserves its brightness
and sampling values. v2-v4 support full-circle/directional point-source emission.
v6 additionally supports exact single rays; v5 and v7-v12 require explicitly
directed single rays. Older saved documents are validated before the existing
v1-to-v4 migration. v5-v12 stay in their declared families. New minimal requests
with a quadrilateral and two mirrors prepare v11; a triangle plus mirror(s)
prepares v12. Historical scenes never silently upgrade. The explicit qualified
v10-to-v11 operation remains available; no upgrade to v12 is added. Existing
v12 structural edits can replace the sole shape using a new ID and full geometry.

All geometry restrictions still apply, including finite aperture sizes, source
separation, supporting-line exclusions, bounds and nonintersections. A maximum
count does not mean every arrangement at that count is supported. Native counts
are sampled observations, not continuous illumination, source-labelled ray paths
or image detections. Conditional image formulas retain their narrower scopes.

## What is shared, and what remains deliberately separate

`src/composition-validation.js` supplies read-only helpers for already validated
finite components:

- `finiteSurfaceGeometry` constructs finite lens/mirror/blocker/detector segments
  and the two **opaque arms** of an aperture. The transparent opening is not an
  obstacle. Its whole-line endpoints are retained for existing bounds checks.
- `pointWithinSupportingLineClearance` preserves the source-to-supporting-line
  expression and strict comparison, with clearance supplied by the caller.
- `segmentsIntersect` preserves the original contract predicate verbatim, and
  `finiteSurfacesConflict` reuses it with the existing aperture-only distance
  band. These are admission guards, never native ray-intersection replacements.

Both mixed/general optical validation and the shared detector layer use these
helpers. Prism detector validation now also uses the unchanged
`segmentOutsideFiniteGlass` predicate already shared by polygon and v10
composition validation. It still requires a common outward separating face.

Family validators retain cardinality, materials, convexity, curve/circle
geometry and emission restrictions, and the caller retains validation order,
error paths, error codes and error messages. No component is removed from a
canonical scene or its native execution to make an arrangement fit a rule.

**Do not erase policy differences during further consolidation.** Ordinary v4
finite segments historically use intersection-only rejection; aperture arms
add a 0.01 mm distance guard. v10 imposes additional 0.01 mm mutual external
segment separation. Curved bounding disks, planar half-space membership and
finite dielectric separation require different checks. Making all of these use
one convenient threshold would change supported geometry, not merely refactor.

Physical geometry, model scope, conservative numerical guards and execution
budgets are distinct. For example, an unsupported near-corner configuration is
not proof of physical impossibility. Conversely, valid geometry does not promise
completed execution: the unchanged depth limit of eight native interactions
includes detector encounters. Full Fresnel branches, trapped rays or added
crossings can still truncate; accepted measurements must remain suppressed.

## Preservation evidence

The pre-refactor baseline is merge commit
`4e8d63927283ced8f17a42aaa7b8da36bec0eba8`, tree
`89414f2714298185d687ed925899ebb20f8a6446`. Before changing validation code, a
checkout with that exact source tree was built and its existing 588-test suite
was run. `test/fixtures/composition-compatibility-baseline.json` retains source
hashes and 51 frozen regression records captured from that build.

The cases cover all 26 committed `scenes/` JSON files, four historical v1-v3
saves, two existing stop examples, synthetic v5/v6 controls, and 17 mutations.
For accepted inputs, fingerprints cover canonical bytes, native exports and
actual execution/analysis reports. Rejections retain exact path, code and
message. The baseline contains 37 completed, two incomplete, one stopped and
11 rejected cases; these are not 51 successful physical simulations. Inputs
must remain unchanged. Legacy records exercise migration, not new capabilities.

`test/composition-validation.test.mjs` verifies those records and focused
crossing, endpoint, aperture-gap, clearance-boundary, rotation, winding and
separating-face cases. The rest of the existing native, qualified-revision and
browser suites remain applicable. No baseline is refreshed automatically in CI.
Deliberately changing a historical fixture or its behavior requires explicit
review of its fingerprint; a hash match is regression evidence, not proof of
physical correctness or independent interpretation fidelity.

The historical corpus membership is frozen; newer scenes are checked separately.
Run `npm test` for the shared and historical regressions. Existing workflows
build and exercise the browser without a new workflow or public deployment.
This foundation changes no native adapter, observer, source emission, optics law,
threshold, interaction budget, authoring API, UI control or PhyDemo pin.

The v11/v12 extensions are bounded uses of shared compatibility rules, not permission
for arbitrary mixtures. Further components still require separate physical
verification; PR #64's numerical candidate remains outside production.
