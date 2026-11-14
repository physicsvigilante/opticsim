# Shared finite-shape composition: prism or quadrilateral with external mirrors

Schema/adapter **v12** uses the existing `finite-dielectric-composition` model.
It admits exactly one existing `triangular-prism` OR `polygon-dielectric`,
1–2 external finite plane mirrors, 1–4 explicit single-ray sources and 0–2
external passive line detectors. A polygon remains a strictly convex four-vertex
region, not an arbitrary polygon. No second region, circle, lens, blocker, third
mirror, nested medium, motion or new emission mode is added.

## Shared rules, distinct shapes

A small read-only region registry supplies each shape's existing validator,
faces and clearance. Whole-system cardinalities include an exclusive group:
exactly one region across the two supported types. The defensive capability
copy exposes the same counts and group to authoring clients. Registering a type
alone never permits a mixture or certifies an execution.

The existing triangle/quadrilateral validators retain all source, edge, vertex,
material, convexity and coordinate restrictions. Every external mirror must
have a common outward separating face with 0.01 mm clearance. All external
mirror/detector pairs retain 0.01 mm mutual clearance. These conservative guards
are software admission conditions, not claims of physical impossibility.

The original component remains in the canonical scene and compiles unchanged
to native Glass. Mirror and Detector also remain their existing native objects.
PhyDemo chooses intersections, refraction, reflection, TIR and misses. No route,
ray intersection override, analytical image, or second optical solver is added.
The pinned core is `811f508d2b070898c241a568b0c167dcb8645251`.

## Historical contracts and explicit structural changes

Saved v8 prisms remain mirror-free; v9 quadrilaterals remain mirror-free. v10
retains exactly one mirror, and v11 retains one or two mirrors with a
quadrilateral. Existing minimal polygon requests still prepare v10/v11. A new
minimal prism-plus-mirror request prepares v12; a prism alone still prepares v8.
Old saves are never silently reinterpreted as v12.

The v12 contract also validates an explicitly authored quadrilateral apparatus.
Within an existing qualified v12 model, the normal atomic add/remove operation
can remove P1 and add a fully stated G1 quadrilateral with a NEW identity. This
is a physical hypothetical, not migration or renaming. All surviving components,
original qualification and previous edit history are retained; one edit records
the replacement. Requests for removed P1 remain unavailable, while new requests
can explicitly target G1. Retired IDs cannot be resurrected. The baseline is
immutable and no prior execution result qualifies the new shape.

No new qualified contract-upgrade path is added. The reviewed explicit v10-to-v11
upgrade remains separate; `upgradeToSchemaVersion:12` is unsupported. To start
from an older standalone prism, explicitly author the expanded physical system.

## Fully stated synthetic demonstration

`examples/prism-mirror-composition.json` is the unified authoring request;
`scenes/prism-mirror-composition.json` is its canonical v12 scene. The existing
viewer menu includes **Prism + external mirror**.

S1=(-40,10) mm emits along +x with relative brightness 1. P1 has vertices
(0,-50), (0,50), (20,0) mm, with inside/exterior indices 1.5/1. M1 is centred at
(60,0) mm, tangent 90 degrees and length 60 mm. D1 is centred at (-20,-10) mm,
tangent 90 degrees and length 20 mm. All values are synthetic choices, not
inferred textbook facts. `partialReflection:false` explicitly omits partial
Fresnel reflections while retaining native TIR.

The native example has four glass encounters, one mirror reflection and one
detector crossing. It enters face-12, exits face-23, reflects externally, returns
through face-31 and exits face-12. The detector hit is approximately
(-20,-8.6772685) mm. Moving M1 to y=100 mm yields two glass encounters and zero
mirror/detector encounters. These sequences are observed outcomes, never runtime
instructions. Test-only independent Snell and line geometry verify the fixed
normal apparatus; they never supply rays to the simulator.

An explicit shape-replacement branch uses G1 vertices (0,-50), (0,50), (20,50),
(20,-50) mm and the same optical indices/policy. Unchanged source and mirror
produce four glass encounters, one mirror reflection and zero detector crossings.
The changed physical shape can change observations; a match is not imposed.

## Numerical and interpretation boundaries

Maximum depth remains eight object interactions, including detector crossings.
The normal prism example uses six. An additional detector crossed twice fits
eight; another crossing can require nine and remains incomplete. Processed-ray
counts and object-interaction depth are different quantities.

Full Fresnel, insufficient budgets and a reflected corner can give incomplete
or failed runs. All accepted native measurements must then be suppressed/null;
no threshold, brightness, angle or budget is adjusted to make the case pass.
TIR has no transmitted ray: unavailable transmission is not a zero-degree ray.
Signed detector power uses native relative units, not watts, absolute irradiance
or source-attributed throughput. Face summaries remain counts/first events, not
per-source ray histories or detected images.

## Reproduction and evidence

```sh
npm test
npm run build
node scripts/finite-shape-composition-acceptance.mjs
node scripts/finite-shape-composition-browser.mjs
npm run demo:package
```

The acceptance command accepts an optional fresh output directory under
`test-artifacts/llm-authoring/`; the browser command accepts its report path.
Browser evidence is written to a fresh attempt directory. Nothing is deployed.

Thirteen new Node test groups cover both shapes, exclusive-region rules,
legacy version isolation, native geometry, qualified replacement and retired
IDs, missing facts, invalid geometry, stale/failed/incomplete evidence, units,
winding/order, multiple sources and immutable sweeps. Test-only native observers
check Snell/reflection at actual encounters across 108 shape/angle/material/
rotation/scale configurations without feeding anything back into tracing.

Twenty end-to-end controls retain eleven native-completed cases (one with an
unavailable requested TIR transmission), two incomplete, one failed and six not
run. These are expected outcomes, not twenty completed simulations. Three sweep
samples retain one invalid sample. The browser script checks actual rendering,
physical/material/direction edits, qualified export/reopen, both shape families,
TIR, invalid/incomplete suppression, narrow-screen Fit and historical examples.

CI logs and artifacts establish which checks ran. Regression fingerprints are
not refreshed. These are same-assistant engineering checks, not independent LLM
interpretation, classroom evidence, or textbook-answer completeness.
