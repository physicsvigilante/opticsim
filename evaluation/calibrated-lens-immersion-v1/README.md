# Calibrating a lens before changing its surrounding medium

Lens Problem 005 gives a biconvex glass lens of index 1.6 and focal length 10 cm in air. It asks for the focal length in media of index 1.5 and 1.7. The [frozen source and controls](frozen.json) record the thin-lens approximation and unit-index air assumption. For unchanged shape, the source measurement fixes the curvature difference. The signed thin focal lengths in the two media are +90 cm and −102 cm. Many radius pairs share that curvature difference.

Commit `2e8af82` froze the separate finite-thickness experiment before execution. It explicitly assigns radii of +120 and −120 mm and a 5 mm centre thickness. Six pinned PhyDemo runs use one incident ray at a time. Each crosses the native front face, rear face and detector. Return to the axis is estimated from the measured downstream direction, using backward extrapolation for the diverging lens.

| Exterior index | Finite paraxial distance from rear pole (mm) | Native line intercept (mm) |
|---:|---:|---:|
| 1 | 99.212598 | 99.209154 |
| 1.5 | 898.826597 | 898.817571 |
| 1.7 | −1021.326398 | −1021.318385 |

The largest axial residual was 0.009027 mm against the frozen 0.5 mm limit. Run `node scripts/build.mjs --test` and `node --test test/calibrated-lens-immersion-native.test.mjs` to regenerate the per-ray evidence.
