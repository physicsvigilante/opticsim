# Convex quadrilateral glass — a bounded native finite-region model

## Why this capability

The JEE Optical Systems Atlas found repeated need for finite nontriangular
refracting regions. This is the first small **reusable** geometry increment:
**one strictly convex four-sided glass cross-section** represented by a single
unchanged native PhyDemo `Glass`, not four infinite `PlaneGlass` half-planes,
a custom ray tracer, a 3D glass block, a symbolic polygon-expression language,
or an apparatus synthesized from a textbook answer. It introduces isolated
**schema/adapter v9**, model `polygon-glass-tracing`; old v4–v8 scenes retain
their existing optical scopes.

## Physical facts required from the LLM

```json
{"id":"G1","type":"glass-polygon","parameters":{
  "x1":0,"y1":-8,"x2":0,"y2":8,
  "x3":12,"y3":8,"x4":12,"y4":-8,
  "insideIndex":1.5,"outsideIndex":1,
  "partialReflection":false
}}
```

The four physical vertices must be given **in boundary order**, either
clockwise or anticlockwise, in the request's explicit `mm`, `cm` or `m`.
They need not form a rectangle, trapezoid, parallelogram, or any preassigned
shape. Every coordinate, both absolute material indices and the Fresnel
policy boolean are required. `insideIndex`/`outsideIndex` are in [1,4].
There is no default source, glass thickness, index, incident direction,
entry/exit face, refractive path or inferred measurement value.

The one homogeneous polygon is surrounded by one uniform exterior medium.
The exterior is **not assumed to be air**: its explicitly supplied
`outsideIndex` remains an independent absolute physical input. Changing that
index is a physical revision, not a camera or sampling preference.
Native `refIndex=insideIndex/outsideIndex` is the same common normalization
used for our triangle and full circle. The native shape is a single `Glass`
path of four straight edges, `notDone:false` and explicit `partialReflect`.
Native PhyDemo, not Opticsim, chooses hits, outgoing branches, Fresnel
reflection and total internal reflection.

## Conservative supported geometry

- **Exactly one stationary convex quadrilateral** with all four vertices
  within ±10,000 mm. Each finite edge is at least 1 mm, and the local
  corner altitude is at least 1 mm. Consistent nonzero oriented turns
  exclude concave, collinear, self-crossing and needle-like polygons.
- **One to four independently specified point-source single rays** beginning
  inside or outside the shape. Every ray must explicitly specify position,
  relative brightness and direction. At least 0.01 mm from every finite
  face; initial forward ray lines within 0.01 mm of a vertex are rejected.
- **Zero to two external passive detectors**. A supporting face must strictly
  separate both endpoints from the glass, with 0.01 mm clearance. This is a
  sufficient, conservative test; some physically safe outside segments will
  be rejected rather than accepted on unproved geometry.
- No additional prism, circle, plane glass, lens, mirror, nested or touching
  refractive region. No arbitrary N-gon or curved cap, source cone, beam,
  moving dielectric, dispersion, phase, wavelength-dependent refraction or
  full 3D image/observer model in this increment.

The strict scope is intentional; we can later expand composition when a
verified medium-ownership model, intersection rules and native reliability
support that generality. This v9 component is **not** an automatic migration
of existing v8 triangles or earlier scene formats.

## Shared native measurements

All six existing `interface-*` quantities work without changing the result
contract. The existing `interface-face-events` also supports v9, returning
**exactly four bounded summaries** labelled `face-12`, `face-23`, `face-34`
and `face-41`. Each record holds a native event count and its first event;
first events include actual native hit coordinate (x-right/y-up), local
outward normal, incident/destination indices, incident direction, native
transmission/reflection directions and relative powers.

Face IDs refer to the **authored vertex order**, not a canonical top/right/
left/bottom and not a source-specific ray history. With more than one
emitter or with a reflected Fresnel branch, first events can belong to
different rays; do not connect them into a claimed entrance→exit route.
A zero-hit face is an available zero and a null first event. No transmitted
branch (for example TIR) means that transmission angle is unavailable, not
zero. Detectors count sampled crossings and report **relative signed power**,
not watts, detected images or continuous geometric throughput.

Native observer wrappers delegate `onRayIncident` exactly once with the same
arguments, mutated rays and return object. They mark non-finite or ambiguous
runtime corner contacts as invalid evidence rather than guessing a face. The
existing canonical SHA-256, session revision and native-completion gates
suppress stale, failed, stopped, depth-limited, brightness-truncated or
undefined interactions. **Full Fresnel can remain incomplete** on the pinned
engine because weak repeated branches are truncated; no upstream numerical
threshold is changed. `partialReflection:false` explicitly omits *partial*
Fresnel reflection while **retaining native TIR**, so accepted results are
labelled as this approximation.

## One viewer, one authoring pipeline

`prepareScene`, `run-problem`, atomic vertex/index revisions, immutable
parameter sweeps, qualified bundles and provenance, physical edit history,
Fit, and existing exports apply unchanged. The viewer provides four x/y
vertex pairs, both refractive indices, the Fresnel checkbox, exact source
control and the same native canvas. An existing triangular-prism scene
continues to compile and observe its original three faces.

The fully specified `examples/glass-polygon.json` is synthetic *software
control* data; `scenes/glass-polygon.json` is its ordinary canonical starting
scene. In a fresh project checkout, after `npm run setup`:

```sh
npm test
npm run build
node scripts/polygon-glass-acceptance.mjs
node scripts/polygon-glass-browser.mjs
npm start
```

Choose **Synthetic: convex glass polygon** in the normal viewer. Use **Open
scene / qualified package** for
`test-artifacts/llm-authoring/polygon-glass/oblique/qualified-scene.json`.
The native integration checks entry and exit with independent signed Snell
invariants, inside/outside rays, index reversal/equality, TIR followed by
exit through a different face, Fresnel incompleteness, misses, source order,
rotation/translation, unit invariance, invalid convexity, detector geometry,
qualified edits, sweeps and strict legacy isolation. Real-Chrome checks
inspect actual native ray pixels, editable face coordinates/indices, exports,
TIR, suppressed incomplete results and a narrow viewport.

**Limits of the milestone:** These are native-physics/software controls, not
claims that an original JEE question is solved or that an independent LLM
interprets the original problem faithfully. The 2D quadrilateral is not an
arbitrary glass cap, a true thick 3D optical material, or a physically
calibrated image/visibility detector. No source questions or Solutions were
read by implementation tests.
