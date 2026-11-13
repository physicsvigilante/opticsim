# Convex four-vertex dielectric — bounded native Glass composition

This milestone adds a second finite polygon geometry to Opticsim's **existing** LLM-authorable, deterministic preparation and native observer system. It does **not** add a new ray tracer, move/rewrite PhyDemo, claim to solve JEE problems, or broaden old v4–v8 scene meanings.

## Exact supported system

Schema/adapter **v9**, physical model `polygon-dielectric-tracing`, has:

- **Exactly one stationary, strictly convex quadrilateral** with four explicit vertices in clockwise or counterclockwise order; the polygon is filled with one homogeneous refractive index.
- **1–4 individually authored single-ray point-source emitters** starting inside or outside, each with explicit position, brightness and direction; no automatically generated ray bundles or unknown source positions.
- **0–2 passive, external line detectors**. The complete detector segment must lie beyond a common separating polygon face. Lenses, curved mirrors, other refractive objects, nested/overlapping glass, arbitrary-vertex polygons, dispersion and motion are **not** in v9.
- Physical fields `x1,y1,x2,y2,x3,y3,x4,y4,insideIndex,outsideIndex,partialReflection`; coordinates are in declared `mm`, `cm` or `m` and compile to canonical mm. Indices are explicit absolute numbers in [1,4], and `partialReflection` is a required boolean. No air-index assumption.

Minimal physical component:

```json
{
  "id":"G1",
  "type":"polygon-dielectric",
  "parameters":{
    "x1":0,"y1":-10,"x2":0,"y2":10,
    "x3":15,"y3":10,"x4":15,"y4":-10,
    "insideIndex":1.5,"outsideIndex":1,
    "partialReflection":false
  }
}
```

With `lengthUnit:"cm"`, this is a **fully specified 15×20 cm rectangular glass block**, not an estimate from a diagram. Its four face identifiers follow authored edge order: `face-12`, `face-23`, `face-34`, `face-41`. Reversing the winding changes labels but not the geometry/physics. An arbitrary polygon, concave slab, spherical cap or 3D glass box is not secretly substituted.

See [the synthetic unified problem](../examples/polygon-dielectric.json) and [the same viewer's canonical scene](../scenes/polygon-dielectric.json). Both are explicitly synthetic; the JEE Atlas A17 helped identify the missing capability but its original lengths, emission, and requested answer have not been invented.

## Deterministic geometry bounds

- All four vertices finite and inside ±10,000 mm coordinate bounds.
- Every edge and the altitudes to both nonincident vertices at least **1 mm**.
- All four signed consecutive turns must be strictly of one sign, excluding concave, self-crossing, collinear, collapsed or repeated-vertex loops.
- Each source separated from finite faces by at least **0.01 mm**, and distinct sources retain the shared 0.01 mm separation. Initial forward rays passing within 0.01 mm of any vertex are rejected.
- Detectors must be strictly outside the convex region and at least 0.01 mm beyond one common separating face, in addition to the standard detector/source/surface checks. This is conservative; some nonintersecting but unproved layouts are intentionally unsupported.

These limits are software scope and numerical-precision guards, **not** claims about physical impossibility. No authored geometry is clamped, reordered, convexified, or replaced.

## Real native tracing and qualified measurements

The adapter maps exactly four vertices to one closed native **`Glass`** polygon, with `refIndex = insideIndex/outsideIndex`, four `arc:false` edges, `notDone:false`, and the explicitly declared native `partialReflect` policy. All incident intersections, outgoing rays, Fresnel branches and TIR decisions belong to pinned PhyDemo **v5.4.0**, commit `811f508d2b070898c241a568b0c167dcb8645251`. No infinite `PlaneGlass` approximation, local Snell ray propagation, numeric cutoff tuning or upstream edits.

The shared read-only native `observeInterfaceSet` delegates each `Glass.onRayIncident` **exactly once** and stores bounded observations. Existing `interface-interactions`, `interface-incidence-angle`, `interface-transmission-angle`, `interface-reflection-angle`, `interface-tir-count`, and `interface-first-event` kinds now support the polygon. The `interface-face-events` result returns one count and first real event for each of its four edges, using the outward local surface normal and indices at actual native hits.

These face summaries do **not** form a per-source ray-history graph, inverse prism proof, detected image, physical watts, continuous angular measurement or unique entrance-to-exit route. A native miss yields zero interactions and empty face records; a nonexistent transmitted branch remains unavailable, not a fictional zero-degree transmission.

If a ray encounters a vertex or ambiguous face within the conservatively bounded 0.01 mm region, a nonfinite/grazing normal is recorded as invalid **measurement evidence**, without changing the native call or rays. Stopped, failed, undefined, depth/truncation-limited and stale-hash runs **suppress** all accepted native readings, even if PhyDemo reports `simulationComplete` to its host.

`partialReflection:false` explicitly **omits Fresnel partial reflections** but retains native total internal reflection. Full Fresnel can produce weak-branch native truncation and must remain incomplete. The approximation is tagged in qualified results; it is not retroactively treated as full physics.

## Shared workflow and verification

This extension reuses `prepareScene`, source stable-ID assignment, existing numeric/units checks, `run-problem`, preflight unique-target binding, immutable parameter sweeps, qualified packages, atomic physical revisions, the same main viewer, native rendering, Fit, and exported canonical/native scenes.

The synthetic acceptance is **not an independent LLM benchmark**:
- `npm run setup && npm test && npm run build` on the unchanged pinned PhyDemo.
- `node scripts/polygon-dielectric-acceptance.mjs`: 12 synthetic unified-command controls (normal refraction with detector, inside source, immersed indices, equal indices, miss, TIR from inside/outside, Fresnel incompleteness, missing/invalid physics and invalid convex geometry) and a 3-sample immutable sweep retaining the invalid geometry.
- `node scripts/polygon-dielectric-browser.mjs`: real Chrome canvas pixels, four face records, vertex/material/direction edits, qualified export/reopen, TIR, Fresnel suppression, invalid edits, mobile Fit, and preexisting prism viewer regression.
- `npm run demo:package`: 22 allowlisted local examples with CSP and license notices unchanged.

New checks are placed in the **existing refraction workflow**, sharing setup and build with planar, circular and triangular-prism controls. No new permanent workflow or public Pages deployment is needed. No earlier sealed first attempts or JEE source images were modified.

## Next constraints

General **N-vertex** polygons, mixed finite polygon + mirror/lens scenes, arbitrary curved caps, repeated internal branches with unique source provenance, and physical wave/phase/dispersion remain future increments. Incremental composition should factor a region/face validator across prism and polygon families **without** silently broadening old v8 admissibility. The owner deferred multi-ray refraction sources; this milestone does not re-enable them.
