# Hybrid Paraxial Stack ↔ Native `v39` Verification Bridge

`src/hybrid-native-witness.js` and `scripts/witness-hybrid-stack.mjs` bridge supported hybrid `coaxial-paraxial-stack` models (combining **finite dielectric bodies**, **coaxial ideal thin lenses**, and an optional **planar or spherical terminal mirror** in a shared exterior medium `outsideIndex`) into validated schema-v39 native PhyDemo scenes (`native-general-hybrid-bench`).

## Scope & Build-Time Guards

- **Length unit:** `mm` only (no silent rescaling).
- **Shared exterior medium:** Any explicit `incidentIndex` (`outsideIndex`) in `[1, 4]`. All finite dielectric bodies must return to this shared `outsideIndex`; all thin lenses and terminal mirrors operate in this exterior medium.
- **Supported elements:**
  - `1–2` disjoint finite dielectric bodies formed by consecutive `refracting-surface` pairs: biconvex `spherical-lens` (`R1 > 0`, `R2 < 0`) or coaxial planar slab `polygon-dielectric` (`R1 = R2 = "infinity"`). Pure thin-lens/mirror stacks (`0` dielectric bodies) belong to `src/coaxial-stack-native-witness.js` (`v37`).
  - `0–2` coaxial `thin-lens` elements (`ideal-lens` with `focalLength` in `outsideIndex`).
  - `0–1` `terminal-mirror` (`plane-mirror` for `signedRadius = "infinity"`, or explicit `mirrorModel: "circular-arc-mirror" | "ideal-curved-mirror"` for finite `signedRadius`).
- **Build-time `maxRayDepth = 8` guard:** Planned encounters including the witness detector (`2*bodies + lenses + 1` in transmission, or `4*bodies + 2*lenses + 2` in return) must be `<= 8`. Stacks exceeding `8` (such as `2 bodies + mirror` or `1 body + 2 lenses + mirror`) are refused explicitly with `UNSUPPORTED_WITNESS_SCOPE`.
- **Explicit finite geometry only:** Every dielectric body requires explicit `{ id, frontSurfaceId, backSurfaceId, apertureHeight }`, every thin lens / terminal mirror requires an explicit entry in `aperturesById`, `partialReflection` must be an explicit boolean, and the passive witness detector must be placed explicitly (never auto-placed at the analytical image).

## Qualification & Encounter Gating

- **Strict separation:** Conditional exact `binary64-rational` ABCD predictions (`paraxial.nativeObservation: false`) and observed pinned-PhyDemo native ray lines (`native.nativeObservation: true`) are reported separately, with `nativeImageDetected: false` on both.
- **Execution gate:** Uses `isAcceptedExecutionSummary` requiring exact `sceneSha256` match, `executionPassed === true`, `v39EndpointsVerified === true`, accepted terminal native status, zero truncation/undefinedBehavior, empty native errors, accepted `measurementState`, and bounded `detector-hit-events`.
- **Full-stack per-axial-face encounter gate:** Aggregate geometric comparison requires observed per-element and per-axial-face counts to match expected stack totals:
  - Each finite dielectric body (`interfacesById` & `interfacesById[id].faces`): `interactions === expected`, `transmitted === expected`, `reflected === 0`, `totalInternalReflections === 0`, **and** declared axial front/back faces (`front-arc`/`back-arc` for `spherical-lens`; `face-41`/`face-23` for coaxial `polygon-dielectric` slab) each equal `(returnMode ? 2 : 1) * emitted` with **zero** lateral-rim hits (`top-rim`/`bottom-rim` or `face-12`/`face-34`). Any ray exiting through a lateral rim fails closed with `lateral-rim-encounter-route-unverified`.
  - Each `ideal-lens` (`v39OpticalIncidentsById`): `incidents === expected` (`1 * emitted` in transmission, `2 * emitted` in return).
  - Optional `terminal-mirror` (`reflectionsById` and `v39OpticalIncidentsById`): both equal `emitted`.
  - Plus `outgoingHitCount === emitted`.
  - For multi-ray witnesses, `routeQualification` is reported honestly as `aggregate-axial-faces-and-optics-matched` (aggregate count evidence, not per-ray route attribution); single-ray witnesses report `single-ray-axial-faces-and-optics-matched`.

## Offline CLI

```powershell
node scripts/witness-hybrid-stack.mjs capabilities
node scripts/witness-hybrid-stack.mjs plan <stack-or-package.json> <witness-spec.json>
node scripts/witness-hybrid-stack.mjs run <stack-or-package.json> <witness-spec.json>
```
