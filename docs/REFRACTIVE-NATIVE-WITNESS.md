# Refractive Paraxial Stack ↔ Native v38 Witness Bridge

`src/refractive-native-witness.js` and `scripts/witness-refractive-stack.mjs` bridge Opticsim's conditional exact `binary64-rational` coaxial paraxial stack (`opticsim-coaxial-paraxial-stack-facts-v1` / `opticsim-coaxial-paraxial-stack-package-v1`) to real finite-dielectric Snell ray tracing in schema-v38 `native-general-refractive-bench` on the pinned PhyDemo core (`811f508d2b070898c241a568b0c167dcb8645251`).

## Supported Stack-to-v38 Scope

- `lengthUnit: "mm"` and any valid explicit ambient `incidentIndex` in `[1, 4]` (works in air or immersed media).
- **1–2 disjoint finite dielectric bodies** formed by consecutive `refracting-surface` pairs `(front, back)` with `back.x > front.x`, `front.downstreamIndex !== outsideIndex`, and `back.downstreamIndex === outsideIndex`:
  - **Biconvex thick spherical lens** (`R1 > 0`, `R2 < 0`) → native `spherical-lens` (`frontRadius = R1`, `backRadius = -R2`).
  - **Coaxial planar dielectric slab** (`R1 = "infinity"`, `R2 = "infinity"`) → native `polygon-dielectric` rectangle.
- **0–1 optional planar terminal mirror** (`type: "terminal-mirror"`, `signedRadius: "infinity"`) → native `plane-mirror` (symmetric return pass).
- Unpaired half-spaces, thin lenses (`v37` bridge), curved mirrors, meniscus/plano-convex/biconcave surfaces, and cemented multi-index doublets are explicitly refused (`UNSUPPORTED_WITNESS_SCOPE`).

## Explicit Witness Inputs (No Silent Assumptions)

- `bodies`: explicit array matching every axial surface pair (`{id, frontSurfaceId, backSurfaceId, apertureHeight}`).
- `mirrorLength`: required iff the stack has a planar `terminal-mirror`.
- `partialReflection`: explicit boolean (`false` omits Fresnel partial reflections with explicit warning while keeping native TIR; `true` enables Fresnel splitting).
- `emitter`:
  - `coaxial-stack-conjugate`: `{mode: "single-ray", id?, directionDeg, brightness}` at exact real upstream `(object.x, object.y ?? 0)` (`object.x < firstSurface.x`).
  - `coaxial-stack-collimated-focus`: `{mode: "parallel-beam", id?, x, y, width, brightness}` (`directionDeg = 0`) OR `{mode: "single-ray", rays: [{id?, x, y, brightness}]}` (`1–4` distinct horizontal rays, enabling side-by-side paraxial vs. marginal spherical-aberration measurement in one native run).
- `detector`: explicit passive `ray-detector` (`{id?, x, y, orientationDeg, length}`), never auto-placed at the analytical image.

## Qualification & Physical Separation

- Conditional paraxial results (`nativeObservation: false`, `nativeImageDetected: false`) and native PhyDemo Snell results (`nativeObservation: true`, `nativeImageDetected: false`) remain strictly separate.
- Geometric comparison is gated on canonical `sceneSha256` match, `executionPassed === true`, `v38EndpointsVerified === true`, zero truncation/undefined behavior/errors, complete bounded `detector-hit-events` (`<= 32`), and exact per-element and per-optical-face native encounter counts matching full-stack traversal by every emitted ray (`emitted` on each optical front/back face and `0` on rim/side faces in transmission; `2 * emitted` on each optical face, `0` on rim/side faces, and `emitted` mirror reflections in return).
- Outgoing ray geometry is evaluated in exact `binary64-rational` arithmetic (`perpendicularMissMm`, `deltaYAtTargetXMm`, `deltaXAtTargetYMm`), exposing real longitudinal and transverse spherical aberration for marginal rays while confirming paraxial agreement near the axis.

## Offline CLI Usage

```powershell
node scripts/witness-refractive-stack.mjs capabilities
node scripts/witness-refractive-stack.mjs plan <stack-or-package.json> <witness-spec.json>
node scripts/witness-refractive-stack.mjs run <stack-or-package.json> <witness-spec.json>
```

See [examples/refractive-native-witness.json](../examples/refractive-native-witness.json) and [test/refractive-native-witness.test.mjs](../test/refractive-native-witness.test.mjs).
