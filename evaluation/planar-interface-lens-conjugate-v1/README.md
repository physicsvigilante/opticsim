# A flat liquid surface before a fixed imaging lens

Lens Problem 009 provides two observations of the same tank-bottom point. With the axis directed from the point toward the lens, the empty separation of 45 cm and image distance of 36 cm give a focal length of 20 cm. The filled image distance of 48 cm requires an apparent object distance of 240/7 cm. The remaining 5 cm air gap leaves 205/7 cm of apparent liquid depth. For unit-index air and a plane interface, the inferred liquid index is 56/41.

Commit `0f21351` froze the [source, assumptions and controls](frozen.json) before native execution. Each incident slope uses its own pinned SingleRay. A dry ray meets IdealLens then Detector. A wet ray exits PlaneGlass into air before reaching the same lens and detector. The test checks the signed direction change at the boundary, callback order and the outgoing line measured at the detector.

| Geometry | Predicted dry / wet distance (mm) | Measured dry / wet intercept (mm) |
|---|---|---|
| Source dimensions and inferred index | +360 / +480 | +360.000000 / +480.000994 |
| Synthetic real-to-virtual control | +1500 / −1000 | +1500.000000 / −999.985000 |

Distances are signed from the lens along the incident axis. The virtual intercept uses backward extrapolation of measured rays. The supplied index is an input to each native wet run. The inverse inference uses the paraxial model and the two source observations. Run `node scripts/build.mjs --test` and `node --test test/planar-interface-lens-conjugate-study.test.mjs` for fresh callback evidence.
