# Finite dielectric composition — bounded native glass and external mirror

Schema/adapter **v10**, model `finite-dielectric-composition`, composes existing
PhyDemo `Glass`, `Mirror`, `SingleRay` and `Detector` objects. It adds geometry
admission rules, not new components, optical laws, a ray solver, a route
controller, an LLM provider, or an analytical image model.

## Explicit scope

- Exactly one stationary, strictly convex four-vertex `polygon-dielectric`.
- Exactly one finite, external `plane-mirror` with explicit centre, tangent
  orientation and length. It can be on any side, tilted, or missed.
- 1–4 independently positioned `point-source` components with explicit
  `single-ray` directions and brightness; sources may be inside or outside.
- 0–2 external passive line detectors. No lens, blocker, additional mirror,
  second region, curved/circular glass, nested/overlapping medium, motion,
  dispersion or 3D geometry is admitted in this pilot.

The same minimal authoring request now selects v10 when it contains a polygon
and a plane mirror. All essential physical fields remain required. Preparation
converts units, preserves stable IDs and supplies mechanical canonical fields;
it does not choose a ray path, infer material indices or invent dimensions.

**Older formats retain their meanings.** A v9 qualified polygon cannot silently
acquire a mirror via structural revision. To author this new arrangement, submit
its full explicit physical component list to the normal preparation workflow.
Once in v10, existing field edits and permitted source/detector add/remove
operations work normally. Removing its sole glass or mirror is rejected rather
than silently changing model families. No historical attempt is reinterpreted.

## Shared geometry checks

The unchanged polygon validator supplies convexity/winding, 1 mm edge/altitude,
vertex bounds, source/edge separation and initial corner-ray checks. A shared
`segmentOutsideFiniteGlass` predicate checks the complete detector or mirror
segment against a common outward separating face with at least **0.01 mm**
clearance. Existing v9 detector admission uses the identical predicate.

The composition validator additionally requires **0.01 mm mutual separation**
between external mirror/detector segments. The ordinary shared source/mirror
and detector validators still reject crossings, supporting-line degeneracies,
coincident sources and out-of-bounds endpoints. Some nonintersecting arrangements
without a common separating-face proof are intentionally unsupported. These
are conservative software/numerical scope guards, not physical impossibility.

A reflected ray may subsequently hit a vertex. The existing native finite-face
observer then marks ambiguous evidence invalid, and accepted readings are
suppressed. The simulator does not snap a hit, nudge an angle, remove a surface,
or fabricate a nearby well-defined ray.

## Native execution and trustworthy observations

The production adapter and pinned PhyDemo commit remain unchanged:
`811f508d2b070898c241a568b0c167dcb8645251`. One native glass instance is retained
on return; one native mirror handles reflection. Native intersection choice,
refraction, reflection, TIR and finite misses are authoritative. The separate
PR #64 numerical experiment is **not** imported or enabled.

Existing stable-ID emission, interface, face, mirror and detector observations
are reused. Per-face summaries are counts and first events, not a source-labelled
path graph. Reflection counts do not establish an image or prove that every
source traversed the glass. No component is stripped out to obtain a conditional
mirror-only image prediction. Zero encounters remain valid zero measurements.

`partialReflection:false` is an **explicit approximation** omitting Fresnel
partial reflections while retaining native TIR; it is not full-Fresnel physics.
Full Fresnel can truncate and must then withhold all accepted readings. Saved
qualification retains the original assumption and subsequent edits separately.
Signed detector power uses native relative units, not watts. Equal forward and
backward crossings can cancel to zero signed power without implying no light.

### Unchanged numerical budget matters

The existing depth limit is **8 native object interactions per ray**, including
passive detector encounters. The normal example has four glass encounters, one
mirror reflection and two crossings of one detector (seven interactions).
Adding a second detector on the other side of the glass puts nine interactions
on that return path. That valid apparatus remains **incomplete** at the existing
budget; its measurements are suppressed. This pilot does not raise the limit,
ignore detector encounters, exempt observations or silently retry a run.

## Example and verification

`examples/finite-dielectric-composition.json` is a fully declared synthetic
unified request; `scenes/finite-dielectric-composition.json` is its canonical
scene. The existing viewer menu includes **Finite glass + external mirror**.
The source starts at (-40,0) mm, the glass spans x=0..20 and y=-30..30 mm,
the mirror is centred at (60,0) mm and the detector at (40,0) mm. Glass/exterior
indices are 1.5/1, with Fresnel partial reflections explicitly omitted.

```sh
npm run setup
npm test
npm run build
node scripts/finite-composition-acceptance.mjs
node scripts/finite-composition-browser.mjs
npm run demo:package
```

The synthetic Node checks cover every observed refraction/reflection in 24
rotated/scaled/translated/material variants, plus tilted mirrors and a
nonrectangular quadrilateral, misses, TIR, internal sources, reverse illumination,
corner ambiguity, invalid geometry, historical scope, multiple sources, units,
stale/truncated evidence, qualified roundtrip and immutable sweeps.

The unified acceptance runner exercises 15 physical/missing/invalid cases and
three immutable sweep samples. Browser acceptance uses the same viewer for
actual canvas rendering, physical edits, misses, material changes, qualified
export/reopen, TIR, failed/incomplete evidence suppression, narrow-screen Fit
and the old polygon example. Generated outputs stay in fresh per-run evidence
destinations. CI logs and artifacts, not this description, establish which
checks actually ran. These are same-assistant engineering checks, not independent
LLM interpretation or classroom evidence, nor textbook-answer completeness.
