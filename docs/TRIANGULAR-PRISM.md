# Finite triangular prism: native refraction, shared authoring

Schema/adapter **v8**, model `triangular-prism-tracing`, introduces exactly one
stationary homogeneous `triangular-prism` in one uniform exterior medium, one
to four explicit native single-ray sources, and zero to two external detectors.
It does not broaden or migrate historical v4/v5/v6/v7 scene scopes.

## Minimal physical input

Use the existing `opticsim-problem-v1` and `prepareScene` request, supplying
three physical vertices in either clockwise or counterclockwise order:

```json
{"id":"P1","type":"triangular-prism","parameters":{
  "x1":0,"y1":-10,"x2":0,"y2":10,"x3":11.547005383792516,"y3":-10,
  "insideIndex":1.5,"outsideIndex":1,"partialReflection":false
}}
```

Coordinates use the request's explicit mm/cm/m unit. All six coordinates,
both absolute refractive indices [1,4], and the reflection-policy boolean
are required. Three vertices describe a general triangular cross section,
not an isosceles template, an infinite wedge or an unrestricted polygon DSL.
Face labels are `face-12`, `face-23`, `face-31`, following authored vertex
identity. Reversing winding changes those associations but not the physics.
No entry face, exit face, ray path, answer, source brightness, exterior air
index, or missing dimension is inferred.

The `examples/triangular-prism.json` configuration is **fully declared
synthetic data**, not a reconstruction of a selected textbook problem.
It uses a 30-degree angle between the first two faces and normal entrance.
The separately computed test expectation is an exit angle from its local
normal of asin(0.75) = 48.590377890729 degrees and an outgoing heading
30 - asin(0.75) = -18.590377890729 degrees. These formulas are **test oracles**;
production ray directions come from PhyDemo, never these equations.

## Native geometry and limits

The adapter compiles one closed native `Glass` path with three straight
edges (`arc:false`, `notDone:false`) and `refIndex=insideIndex/outsideIndex`.
It does NOT combine crossing `PlaneGlass` half-planes. The pinned,
unmodified PhyDemo commit is `811f508d2b070898c241a568b0c167dcb8645251`.
Relevant primary implementation: `src/core/sceneObjs/glass/Glass.js` and
`src/core/sceneObjs/BaseGlass.js` in ricktu288/ray-optics at that commit.
Native Glass owns finite intersections, refraction, reflection and TIR.

Vertices remain within +/-10000 mm. Every edge and altitude must be at
least 1 mm, rejecting collinear/repeated/needle-like triangles before native
execution. Sources need 0.01 mm clearance from finite edges, and an initial
forward ray within 0.01 mm of any vertex is conservatively unsupported.
This is an admission bound, not a claim such physical rays are impossible.
Detectors require a common separating face with 0.01 mm clearance, proving
the whole finite detector lies outside the triangle; safe layouts that fail
this conservative proof are also rejected. Existing source/source,
source/detector and detector/detector separation rules still apply.

At a real native hit, the observer identifies a unique finite face and its
outward normal. Hits within 0.01 mm of a vertex, ambiguous faces, or unresolved
incoming grazing normals invalidate measurement evidence. Native delegation
still occurs exactly once; no ray is redirected or repaired. This is important
because a refracted/reflected ray can reach a corner even if its original
emission direction passed initial validation.

There are no nested regions, additional lenses or mirrors, curved faces,
cut circular caps, arbitrary polygons, moving prism playback, optical-path
lengths, 3D imaging, or apparent-image inference in this increment.

## Bounded native measurements

All six existing `interface-*` measurements apply. Counts cover the entire
boundary, and first-event angles refer to the actual encountered face.
The new **`interface-face-events`** quantity returns exactly three records,
each containing total interaction count and at most one first event. Events
carry local normal, hit point, incident direction, inside/outside indices,
outcome, and actual outgoing directions and relative powers.

This is bounded O(3) evidence, not a ray-history graph. With multiple sources
or Fresnel branches, each face's first event is simulation-order dependent:
**do not connect them into an asserted source-specific ray path**. For zero
hits the count is an available zero, all three face records are empty, and
first-encounter angles are unavailable. Missing transmission under TIR is
null/unavailable, not an angle of zero. Detector quantities are sampled
crossings and signed native relative power, not watts or image detection.

Canonical hash and whole-run completeness gates remain unchanged. Native
`simulationComplete` does not override nonzero truncation or undefined
behavior. Full Fresnel, low budgets or trapped internal reflections may
remain incomplete and suppress every accepted measurement. Explicit
`partialReflection:false` omits Fresnel partial reflections, retains TIR,
and is carried as a qualification warning. It is never an automatic retry.

## Reuse and verification

This extension reuses the main viewer, ordinary numeric fields, source
controls, Fit, scene/qualified export, original assumptions, atomic edits,
immutable parameter sweeps, unified problem command and native execution.
There is no new camera, player, equation interpreter, answer shortcut,
external-model service or public deployment.

The prism tests include native local signed Snell/reflection invariants,
18 combinations of face angle and incident direction, normal entry/oblique
exit, inside and immersed rays, reverse propagation, both windings,
translations/rotations/unit conversions, internal TIR followed by another
face's exit, exterior TIR at lower index, native misses, full-Fresnel and
budget suppression, observer delegation, corner ambiguity, schema isolation,
multiple-source non-attribution and qualified save/reopen with tamper checks.
Browser acceptance checks actual light-canvas pixels, vertex/index/source
edits, per-face results, TIR, cleared incomplete measurements, invalid edits,
mobile resize, and returning to the merged circle scene.

```sh
npm run setup
npm test
npm run build
node scripts/triangular-prism-acceptance.mjs
node scripts/triangular-prism-browser.mjs
npm start
```

Select **Synthetic triangular prism**, or use `?scene=triangular-prism`.
For requested measurements open a qualified bundle produced by acceptance,
such as `test-artifacts/llm-authoring/triangular-prism/oblique/qualified-scene.json`.
The ordinary example menu loads raw scene data and therefore does not attach
unearned provenance or result requests.

The existing refraction CI job runs the prism checks beside planar and circle
checks, sharing setup/build. No extra permanent workflow is added. Earlier
sealed authoring attempts remain unchanged; native software controls are not
new unseen-problem or independently evaluated LLM successes.
