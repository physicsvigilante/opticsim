# Forward ideal-lens analysis from reduced physical facts

This conditional analytical operation reuses the existing lens-train calculation.
It does not prepare a native scene, supply an illumination model, trace rays, or
claim that an image was detected. The existing `ideal-image` request and its
complete, fresh native-execution gate are unchanged.

## Scope and physical meaning

Supply a finite real object's axial position and one to four separated,
stationary, coaxial ideal thin lenses in a uniform medium. Propagation is toward
increasing x. Each lens has an explicit stable ID, x position and signed focal
length; positive focal length converges. The list is sorted on a copy by x.
Intermediate real/virtual objects and collimated segments are supported by the
same forward calculation. No route is inferred for a mixed optical apparatus.

The explicit `coaxial-ideal-thin-lenses` model is a paraxial approximation,
conditional on a transmitted pencil meeting every stated lens. It does not
establish finite-aperture illumination, throughput, aberration or a physical
image detector. Brightness, emission and apertures are deliberately absent from
these facts; their absence is not permission to invent them for native tracing.

Lengths use one declared `mm`, `cm` or `m` unit. The calculation normalizes to mm
and reports lengths in the declared unit. The initial object precedes all lenses;
object/lens positions and supplied height lie within +/-10000 mm, focal-length
magnitude is 1..10000 mm, and successive object/lens planes require 0.01 mm
separation. These bounds preserve a narrow qualified domain; they are not claims
that every other physical configuration is impossible. Contact lenses, a virtual
initial object, an object at infinity, reverse propagation, mirrors, refractive
surfaces, thick/material lenses and instrument/inverse calculations are not
admitted by this interface.

## One ordinary problem request

Use the existing `opticsim-problem-v1` envelope and CLI, not native PhyDemo JSON:

```json
{
  "format": "opticsim-problem-v1",
  "physical": {
    "format": "opticsim-lens-train-facts-v1",
    "model": "coaxial-ideal-thin-lenses",
    "signConvention": "x-increasing",
    "lengthUnit": "cm",
    "objectX": -30,
    "lenses": [
      {"id": "L1", "x": 0, "focalLength": 20},
      {"id": "L2", "x": 30, "focalLength": 10}
    ]
  },
  "requests": [{"id": "image", "kind": "lens-train-image"}]
}
```

For these explicitly stated ideal facts, the conditional output is a real image
at x=37.5 cm, distance +7.5 cm from L2, with transverse magnification -0.5. Changing
only L2's focal length to 15 cm gives distance +10 cm from L2. Neither calculation
needs an object height or a luminous source. The example is supplied in
`examples/lens-train-facts.json` with interpretation notes; it is not an input to
the browser's native-scene importer.

`lens-train-image` reports `imageKind`, `imageX`, signed `imageDistance`,
`magnification`, `referenceLensId` and `lengthUnit`. It never reports an invented
`imageHeight`, even when a height was supplied for a different request.

To request transverse position, supply optional `physical.objectHeight` and use
`lens-train-image-height`. Height is measured along one fixed transverse axis;
its sign is preserved. An axial result can remain conditional while a separate
height request reports `needs-information`. A supplied malformed value is still
invalid, even if its corresponding result was not requested. Infinite images
have no finite image-height output.

## Existing entry points and retained evidence

```sh
node scripts/preflight-problem.mjs capabilities
node scripts/preflight-problem.mjs examples/lens-train-facts.json
node scripts/run-problem.mjs examples/lens-train-facts.json \
  --out test-artifacts/llm-authoring/my-lens-facts-attempt
```

The output directory must be fresh. The ordinary workflow retains exact input
bytes and hash, a plan, `analytical-results.json` and the complete report. It does
not create `qualified-scene.json`, inherit execution evidence, or certify the
source interpretation. Reduced-facts-only analytical requests run without a
PhyDemo checkout or build; an explicit native request remains unresolved until
an independently complete, valid native scene exists. `verifyNative:true` is not
satisfied by analytical success: it retains `native.status: not-run` and a
non-success exit for unresolved native verification.

For direct JavaScript use, `analyzeLensTrainQuery(facts, query)` in
`src/lens-train-queries.js` accepts
`{format:'opticsim-lens-train-query-v1',kind:'lens-train-image'}` (or the height
kind). `lensTrainCapabilities()` and the ordinary workflow capabilities publish
required fields, bounds, conventions and limitations. Unknown fields and methods
are refused, not repaired or aliased. Full native scenes are not reduced by
silently deleting unrecognized components.

## Shared mathematics and numerical qualification

`src/lens-train-matrix.js` contains the extracted calculation previously inside
`analysis.js`: free-space transfer followed by each ideal-lens matrix, with the
same arithmetic order, mm normalization assumptions and historical tolerances.
The old scene-based predictor and new reduced-facts service call that one kernel.
There is no second production lens formula or question-specific branch.

The new service labels successful outputs `conditional` and always records
`nativeImageDetected:false`. Missing facts, unsupported scope, malformed input,
undefined height and numerically unreliable outputs retain distinct statuses.

The historical kernel's near-infinity policy is preserved for historical scene
predictions. The new public query is more conservative: nonzero D within that
existing band returns `numerically-indeterminate`, not a precise finite image or
an assertion of exact infinity. A computed zero D is reported as `at-infinity`
only when -B*C also agrees with the unit determinant within the existing 1e-7
consistency tolerance. This remains a floating-point ideal-model classification,
not a symbolic proof. Existing finite magnification/cancellation checks apply.
No tolerance, native brightness cutoff or ray-interaction budget was relaxed.

A development stress case demonstrated why the additional zero-D check matters:
object x=-9000 mm; lenses (x,f)=(0,1),(150,1),(300,148.99324323817004) mm. The
computed D is zero, but -B*C differs from 1 by approximately 1.7e-6. The new query
refuses this apparent infinity. The historical predictor's behavior is retained,
not silently corrected by this feature.

## Verification and bounded transfer

The new tests use 164 pre-extraction historical prediction records without
refreshing their expected outputs. They separately compare 72 one-to-four-lens
arrangements against test-only exact-rational Gaussian conjugates, and compare
four fully declared native examples after actual tracing. Native sample checks
do not feed rays or intersections into PhyDemo and do not establish continuous
illumination or an independently detected image.

Tests cover real/virtual/infinite and near-singular images, intermediate virtual
objects and collimation, optional height isolation, units, translations, input
order, missing/invalid values, unsupported optics, immutable evidence, zero native
calls through both existing CLIs, and preservation of stale/incomplete gates.
`scripts/lens-train-acceptance.mjs` records 16 expected outcomes; some are refusals
or partial request coverage, not sixteen fully answered investigations.

The preselected four-lens mixed converging/diverging case first passed after a
production/helper freeze without additional production code or an input repair.
It was already known to the same assistant and was never an independent hidden
test. A later unrelated cancellation stress case prompted the generic zero-D
refusal above. Its final replay is therefore an exposed regression, not untouched
held-out evidence for the final candidate. The input, first freeze, correction
history and final replay must remain separately reported. No arrangement-specific
production handling was added for the reserved case.

Run `npm test` for the full repository suite. The existing unified workflow adds
one headless acceptance step and artifact path. This feature adds no browser
controls, saved-scene schema version, migration, native optical component, backend
pin update, provider connection or deployment. Fresh analytical requests and
qualified native-scene editing are distinct capabilities; this change does not
introduce an analytical-model revision-package API.
