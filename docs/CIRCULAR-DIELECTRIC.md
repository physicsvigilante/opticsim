# Circular dielectric — one finite native region, explicit optical facts

This increment implements issue #32's first geometry, reusing pinned PhyDemo
`CircleGlass` at `811f508d2b070898c241a568b0c167dcb8645251`. It is a finite 2D
homogeneous circular region, **not** an ideal thin lens, a spherical cap,
a general 3D sphere simulation, or an apparent-image detector. No upstream
core, Snell/Fresnel implementation or numerical cutoff is changed.

## Minimal authoring and isolated schema

Use the existing `lengthUnit`, `components` and optional named `runPolicy`
request. The new component has exactly six physical fields:

```json
{"id":"G1","type":"circular-dielectric","parameters":{
  "x":0,"y":0,"radius":10,
  "insideIndex":1.5,"outsideIndex":1,
  "partialReflection":false
}}
```

With `lengthUnit: "cm"`, this is a 10 cm radius circle. Both absolute material
indices are required numbers in [1,4]. The source must explicitly supply
position, relative brightness and single-ray direction. No source, medium,
radius, direction or reflected branch is inferred from a diagram.

Preparation selects **schema/adapter v7**, model `circular-dielectric-tracing`.
Old v4/v5/v6 validators and saves retain their existing scopes; a legacy scene
cannot gain a circular region by changing its component name. Canonical
coordinates are x-right/y-up in mm. IDs and provenance stay outside native
objects, as before.

Native `CircleGlass` receives the actual centre and one rim point, with
`refIndex = insideIndex / outsideIndex`. That common normalization represents
ray directions and relative Fresnel ratios in a uniform exterior; it does not
provide absolute propagation speed, optical path, phase or calibrated shading.
A lower-index circle in a higher-index uniform exterior is supported. This is
not a nested finite outer sphere plus embedded bubble.

## Bounded geometric scope

Exactly **one stationary circle**, **1–4 explicit single-ray sources**, and
**0–2 passive external detectors**. Sources may be inside or outside. Other
optics, overlapping/nested regions, moving optics, circle motion playback,
prisms and curved caps remain unavailable. The existing motion engine still
accepts only its previously validated mirror/lens families.

Radius must be positive and at least 2 mm; the full circle must lie inside
±10000 mm coordinates. Sources need 0.01 mm clearance from its boundary;
distinct sources retain the existing 0.01 mm separation. Detectors must be
entirely outside the circle with 0.01 mm clearance, and obey all existing
source/segment and detector-intersection checks. Initial forward ray lines
within 0.01 mm of circle tangency are conservatively unsupported. These are
software scope/precision guards, not assertions that excluded optics are
physically impossible. Invalid inputs are rejected, not clamped.

## Shared native observations

The existing bounded `observeInterfaceSet` now selects both planar interfaces
and circular regions. Only the geometric description of the local normal and
inside/outside medium differs. At each actual native `onRayIncident` callback,
it records incoming direction, delegates exactly once without changing the
arguments or return, and inspects only outgoing rays that native PhyDemo
actually produced. Aggregate counts plus the first event are retained; no
production ray-history or source-attribution feature is introduced.

The six existing interface result kinds are reusable for G1:
`interface-interactions`, `interface-tir-count`, `interface-incidence-angle`,
`interface-transmission-angle`, `interface-reflection-angle`, and
`interface-first-event`. Circle counts include all its boundary encounters,
not a named entrance face. First-event angles use the **local radial normal
at the native hit**, with actual y-up point/normal and explicit incident and
destination indices. With multiple sources, “first” is simulator-order
first, not a particular source or whole ray path. Detectors keep signed
relative native power and sampled crossing counts, not watts or images.

The same canonical hash and complete-run gate apply. Zero interactions is an
available count. Missing branches are unavailable, not zeros. Stale, failed,
stopped, truncated or undefined runs suppress accepted readings.

## Fresnel and total-internal-reflection qualification

`partialReflection:true` requests native Fresnel partial reflections. Native
weak-branch and depth limits can truncate that tree, even when the callback
is `simulationComplete`. Such evidence remains **incomplete** under the
unchanged Opticsim policy. Neither the adapter nor a retry lowers cutoffs,
boosts brightness, or labels incomplete results as complete.

`partialReflection:false` explicitly omits partial Fresnel reflection; TIR
remains native. The approximation is visible in requested results and
qualification. An inside source can be trapped in repeated TIR and exhaust
the depth budget; a source in the higher-index outside medium can instead
reflect once from a lower-index circle and escape in a complete run. The
adapter reports what actually happened, not an analytically prescribed route.

## Reused viewer, revisions and exports

The existing main viewer accepts v7 raw/qualified scenes. It reuses native
rendering, source direction/brightness fields, numeric parameter edits,
Fresnel toggle, Fit, save/reopen and native export. Fit includes all four
circular extrema. No player, camera, control panel or export format is added.
A labelled synthetic example is available in the existing scene menu. Raw
scene exports still omit provenance; qualified packages preserve assumptions
and later physical/numerical/presentation edits.

Run from a checkout of this candidate:

```sh
npm run setup
npm test
node scripts/circular-dielectric-acceptance.mjs
npm run build
node scripts/circular-dielectric-browser.mjs
npm start
```

Open `http://127.0.0.1:4173/?scene=circular-dielectric` for the data-only native
example. Open the acceptance output's `oblique/qualified-scene.json` to see
requested native measurements and preserved synthetic assumptions. Acceptance
output directories must be fresh; no prior evidence is overwritten.

## Evidence and deliberate limits

Sixteen new Node tests cover strict fields and schema isolation; exact native
entry and exit; independent signed local Snell/reflection invariants;
inside/outside, reverse direction, immersed and equal indices; misses,
near-critical native outcomes, TIR/Fresnel incompleteness, actual observer
delegation, source aggregation, units/rotation/translation/order invariance,
atomic revisions, full-circle camera fit and qualified round trips. The CLI
suite has 12 synthetic inputs and 3 immutable radius-sweep samples, including
an invalid sample that stays invalid. Browser acceptance checks actual light
canvas pixels, physical edits, save/reopen, incomplete-state suppression,
invalid edits, narrow view and reopening an old lens example.

These are **software and native-physics integration controls**, not a new
unseen-question or independent-LLM score. The sealed trials are unchanged.
Original P03/P06, lensmaker and microscope queries remain unsupported by the
registered dispatcher. Closed polygon prisms and separately qualified
paraxial spherical imaging are future increments, not silently substituted
answers in this one.

Source references (the pinned source, not the moving website documentation):
- `ricktu288/ray-optics`, pinned `src/core/sceneObjs/glass/CircleGlass.js`;
- pinned `src/core/sceneObjs/CircleObjMixin.js` and `BaseGlass.js`;
- Opticsim native feasibility PR #33 and numerical reliability issue #23.
