# Paraxial Stack ↔ Native `v37` Verification Bridge

`src/coaxial-stack-native-witness.js` connects Opticsim's composable analytical [coaxial paraxial stack](COAXIAL-PARAXIAL-STACK.md) (`opticsim-coaxial-paraxial-stack-facts-v1` or verified `opticsim-coaxial-stack-package-v1`) directly to pinned PhyDemo via the [schema-v37 composable native optical bench](NATIVE-GENERAL-OPTICAL-BENCH.md).

## Explicit-input bridge contract

The bridge **never invents** apertures, ray angles, beam widths, mirror models, or detector placements. Callers supply an explicit `opticsim-coaxial-stack-native-witness-v1` specification alongside a validated stack in `mm` with `incidentIndex === 1`, composed of `0–4 thin-lens` elements and/or one optional `terminal-mirror` (plane or spherical; `refracting-surface` elements are refused because `v37` is homogeneous unit-index air):

- **`aperturesById`**: explicit finite aperture/length in `[1, 10000]` mm for every element ID in the stack.
- **`mirrorModel`** *(required iff the stack has a spherical `terminal-mirror`)*:
  - `"ideal-curved-mirror"` — Gaussian ideal curved mirror with `focalLength = -signedRadius / 2` (`normalDeg = 180`).
  - `"circular-arc-mirror"` — true circular arc mirror with `radius = -signedRadius` (`normalDeg = 180`), exposing genuine spherical aberration relative to the paraxial prediction at larger apertures/angles.
- **`emitter`**:
  - For `coaxial-stack-conjugate`: `{mode: "single-ray", directionDeg, brightness}` or `{mode: "directional", directionDeg, angleDeg, brightness}` placed at exact `(object.x, object.y ?? 0)`.
  - For `coaxial-stack-collimated-focus`: `{mode: "parallel-beam", x, y, width, brightness}` strictly preceding the first element (`directionDeg = 0`).
- **`detector`**: explicit passive witness detector `{id?, x, y, orientationDeg, length}`.
- **`runPolicy`**: optional `"preview-v1"` (default) or `"dense-v1"`.

## Side-by-side witness comparison

`runCoaxialStackNativeWitness(stackInput, spec, {execute})` keeps conditional paraxial predictions (`paraxial.nativeObservation: false`) and native PhyDemo evidence (`native.nativeObservation: true`) strictly separated:

- Native results are gated on canonical SHA-256 match, `v37EndpointsVerified === true`, zero truncation/undefined behavior/errors, and complete `detector-hit-events` (`<= 32` hits).
- Outgoing native ray hits are filtered to match the stack's `exitDirection` (`+x` for transmission, `-x` for return), ignoring forward-pass crossings on return-pass detectors.
- For finite paraxial targets (`imageX`/`imageY` or `backFocusX`), each outgoing ray reports its exact perpendicular miss distance (`perpendicularMissMm`) and transverse deviation at the paraxial target plane (`deltaYAtTargetXMm`). For afocal collimated stacks, it reports `maxAbsOutgoingSlope`.
- `nativeImageDetected` is always `false`: observed outgoing ray lines passing near a paraxial target point are geometric witness checks, never native image detection or continuous-aperture coverage.

## Offline CLI

```powershell
node scripts/witness-coaxial-stack.mjs capabilities
node scripts/witness-coaxial-stack.mjs plan stack.json witness-spec.json
node scripts/witness-coaxial-stack.mjs run stack.json witness-spec.json
```

See [examples/coaxial-stack-native-witness.json](../examples/coaxial-stack-native-witness.json) and [test/coaxial-stack-native-witness.test.mjs](../test/coaxial-stack-native-witness.test.mjs).
