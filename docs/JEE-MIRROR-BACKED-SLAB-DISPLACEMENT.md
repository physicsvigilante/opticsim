# JEE J08 — Mirror-backed plane-parallel slab, conditional displacement

**New analytical model and separate genuine native witness. Not a new refraction engine, full original textbook answer, or inferred apparatus.** JEE-first Opticsim retains the unchanged pinned PhyDemo core, public v5 planar-media and finite-mirror authoring, old schemas and native evidence qualification.

## Source facts, missing exterior index and why it matters

The original frozen JEE J08 *Problems* source (`08_Ray_Optics_Explanations/03_General_Refraction/Problems/006.png`) states a plane-parallel plate of refractive index **1.8** and thickness **6 cm** resting on a plane mirror, illuminated at **60°** from the upper normal, and asks for the separation between entry and eventual exit.

The original source audit identifies **no numerical refractive index of the surrounding medium**, finite plate/mirror extents, source coordinates/brightness or detector geometry. This new model never assumes ambient air. Its literal source-only query therefore returns `status:'needs-information'`, `reasonCode:'MISSING_OUTSIDE_INDEX'`, `value:null`, and `native.status:'not-run'`. It preserves the source's numerical facts and retains an explanatory Snell/displacement formula without producing an unjustified number.

The source facts and seven cases were frozen first in `evaluation/jee-j08-mirror-backed-slab-v1/frozen-protocol.json` at commit `20f0a67a348c554c4d5ede4cc6aa882e05469e6c`, before the new analytical and native test implementation.

## Reusable geometrical calculation

Admitted model: an isotropic homogeneous slab of stated thickness `t`, one planar entrance/front surface, and a true plane ideal specular mirror **in contact with the rear slab face**. A single ray enters the slab, reflects at that rear mirror, returns through the front surface and exits into the original exterior medium.

In a local coordinate system with front-face normal along +x toward the rear mirror, the incident ray rises with positive y, with incidence `i` from that normal. Let `n0` be the **explicit exterior** index, `n1` the plate's absolute index, and `r` the transmitted angle inside the plate. Snell gives

```
n0*sin(i) = n1*sin(r)
r = asin((n0/n1)*sin(i))
front-face entrance-to-exit separation D = 2*t*tan(r)
= 2*t*n0*sin(i)/sqrt(n1^2 - n0^2*sin(i)^2)
```

The two in-plate traversals each contribute `t*tan(r)` in the same signed lateral direction. The returned exterior ray travels at local heading `180°−i` relative to +x, not the original forward heading. These are **conditional analytical geometrical relations**, not native callback points or a prescribed optical route.

At `t=6 cm`, `n1=1.8`, `i=60°`, the **extra, clearly declared hypothetical** `n0=1` yields

```
r = 28.75891800395°
D = 6.58585559938142 cm
```

The numerical answer is therefore **not** labelled a complete original J08 result unless the exterior medium is actually specified by a legitimate source or the added assumption is explicitly requested.

## Strict standalone model and input

Original source-only request: `examples/jee-j08-mirror-backed-slab-source-only-v1.json`.

```json
{
  "format": "opticsim-mirror-backed-slab-displacement-v1",
  "kind": "slab-return-surface-separation",
  "model": "homogeneous-parallel-slab-ideal-backing-mirror",
  "branchConvention": "entry-refraction-mirror-return-exit-refraction",
  "coordinateConvention": "normal-into-plate-positive-x-upward-incident",
  "lengthUnit": "cm",
  "thickness": 6,
  "insideIndex": 1.8,
  "incidentAngleDeg": 60
}
```

Only `outsideIndex` is optional. Without it, the query admits missing-information status, not guessed material. A **separate** example `examples/jee-j08-mirror-backed-slab-synthetic-air-v1.json` supplies `outsideIndex:1` as an openly added illustration, never reinterpreted as original source data.

The model supports `mm`, `cm`, `m` with real slab thickness 1–10,000 mm, absolute indices 1–4, incidence 0–89° and explicit positive Snell propagation. Entry TIR returns `unavailable` with no claimed exit, and within `1e−7` of the critical/grazing sine ratio is `numerically-indeterminate`. A finite separation above the conservative report cap or an inconsistent round-trip Snell residual is withheld. The limits are **engineering numerical admission policies**, not measurements or guarantees for all light.

```sh
node scripts/mirror-backed-slab-query.mjs capabilities
node scripts/mirror-backed-slab-query.mjs examples/jee-j08-mirror-backed-slab-source-only-v1.json --out test-artifacts/llm-authoring/j08-source-attempt-01
node scripts/mirror-backed-slab-query.mjs examples/jee-j08-mirror-backed-slab-synthetic-air-v1.json --out test-artifacts/llm-authoring/j08-illustration-attempt-01
```

Each attempt exclusively reserves a new output path beneath `test-artifacts/llm-authoring/`, preserves the raw input bytes and their SHA-256, and writes a separate analytical result or refusal report. It **never** creates a native scene or falsely marks a result as native. It inherits the existing shared helper's concurrent hostile-filesystem race limitation and standard `JSON.parse` duplicate-key behavior. This is a standalone query, not a new automatically selected unified problem family or browser UI.

## Real pinned-native PhyDemo witness: distinct evidence

`test/jee-j08-slab-native-witness.test.mjs` independently authors an actual public v5 scene with a **native SingleRay**, one **native PlaneGlass half-plane**, one **native finite vertical Mirror** inside that glass at the stated 60-mm depth, and one **real passive finite Detector** outside the glass. It uses explicitly chosen source coordinates/direction/brightness, a 420-mm Mirror and Detector, exterior index `1`, and `partialReflection:false` (omitting partial Fresnel reflections intentionally, retaining native TIR). Those source/mirror/detector dimensions and policies are **additional synthetic teaching controls**, not the original JEE apparatus.

The test records unmodified native `onRayIncident` callbacks and the actual entry, mirror and exit positions, plus the physical detector's incoming/returning crossings; it tests the actual signed displacement against the **independent reduced analytical** formula. Neither the math nor the test forces a ray route. A missing backing Mirror must no longer give a return. Translations, thickness, outside index and zero incidence change actual native events. Depth-zero, stopped, undefined or Fresnel-truncated runs cannot qualify partial measurements.

The complete native illustrated system may be physically useful to teach the source problem while remaining distinct from the underspecified original question. A detector crossing is not an optical image reconstruction or radiometrically calibrated light power.

## Public v5 native authoring and qualified observables

In addition to the raw test-only wrapper, the fully declared **native** example `examples/jee-j08-mirror-backed-slab-native-v1.json` uses the existing public `opticsim-problem-v1` authoring request and six explicit sampled observables (`source-emissions`, `interface-interactions`, `interface-first-event`, `mirror-reflections`, `detector-crossings`, and `detector-hit-events`). Its canonical v5 scene contains an actual `SingleRay`, `PlaneGlass`, `Mirror` and `Detector`, with all physical and numerical choices authored.

`test/jee-j08-slab-public-native.test.mjs` checks ordinary `prepareScene`, pinned-native `evaluateDocument` and `evaluateObservables`, completed native status, qualified sampled observations, round-trip counts, save/reopen, invalid omitted medium, absent mirror and stale-hash suppression. Importantly, an external detector 10 mm in front of the slab is crossed **twice** (on the incoming and outgoing legs). The difference between those **detector** y coordinates is `D+20*tan(i)`, **not** the front-surface separation `D`. Only the direct independent real glass-interface callback witness checks the actual two front-face crossing coordinates. Neither two detector crossings nor their count are a native image reconstruction.

This example verifies existing public authorability and measurement reuse; it does not license a new schema version, source-complete J08 scene, generalized return-path identity or automatic image detector.

## J02 reviewer follow-up, consolidated with J08 release review

Chat B’s cleared PR #191 review recommended numerical tests at the exact centroid/on the median and almost symmetric object positions in the three-mirror reflection orbit. The new **test-only** `test/jee-j02-centroid-median-review-followup.test.mjs` checks those cases through the *unchanged reviewed J02 source*, without changing its result contract or performing another full review. Its mathematical formal unbounded orbit still makes no physical visible-image claim.

## Verification and release gate

The candidate adds a frozen protocol, two JSON examples, source-only analytical implementation, byte-bound CLI, analytical/CLI test, test-only real native witness, J02 reviewer-suggested regression and this documentation. No existing shared engine, PhyDemo pin, schemas, renderer, old tests, historical original JEE attempt or existing native optics code is changed.

Require **11/11 exact-head CI workflows**, all tests (including actual native and real Chrome regressions), strict source/tested merge tree equality, read-backed builder evidence, then **one focused independent Chat B physics/code/evidence review** of the new mirror-backed slab displacement/witness and the additional J02 symmetry tests. Do not re-review unchanged v5 or v3 mirror tracing, and do not merge before exact-review clearance and standing owner release gate.
