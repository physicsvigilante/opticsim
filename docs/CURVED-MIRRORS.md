# Curved mirrors: separate native surfaces and conditional image kinematics

This extension reuses the unified problem command and pinned PhyDemo core. It adds two distinct native-backed components and two bounded mathematical queries, not a new ray tracer. Previous v4/v5 schemas remain unchanged; curved scenes use explicit **v6**, model `curved-mirror-tracing`.

## Corrections to the original proposal

The familiar mirror equation is ideal or paraxial, not an exact finite-aperture spherical-mirror image guarantee. `IdealMirror` implements the native ideal mapping; `ArcMirror` reflects from the actual local circular normal and can exhibit spherical aberration. Never replace one with the other without an explicit physical model change.

The axial velocity derivative assumes a stationary mirror and fixed focal length. For a transverse coordinate, the full derivative is **dy_i/dt = m dy_o/dt + y_o dm/dt**, not just m times transverse object velocity. Here v=fu/(u-f), m=-f/(u-f), dv/dt=-m² du/dt and dm/dt=f du/dt/(u-f)². The code validates the stated prerequisites before using them.

The signed convention is `real-positive-local`: positive u and v are in front of the mirror, concave f>0 and convex f<0. Transverse coordinates keep their declared direction. Scene analysis uses the front normal n=(cos a,sin a) and perpendicular t=(-sin a,cos a). A native source behind that front is not silently converted into a virtual object.

Primary background: OpenStax University Physics vol.3 §2.2 and its key equations, plus the pinned `mirror/IdealMirror.js` and `mirror/ArcMirror.js` source under PhyDemo commit 811f508d2b070898c241a568b0c167dcb8645251.

## Minimal mathematical inputs

Use `physical.format: opticsim-curved-mirror-facts-v1` with explicit `model: ideal-gaussian|spherical-paraxial` and `signConvention: real-positive-local`.

For dimensional calculations, provide `lengthUnit: mm|cm|m`, `focalLength` and `objectDistance`; `objectHeight` is needed only to calculate height or transverse image velocity. For scale-free image magnification use `objectDistanceOverFocalLength` and `curvature: concave|convex`, without inventing an absolute f. A known height can still be supplied with its unit. Do not mix absolute and normalized distance inputs.

Query `curved-mirror-image` returns conditional real/virtual classification, signed distance (if known), distance/f ratio, magnification and any determined height. Exactly at the focal plane, it returns image-at-infinity with null finite coordinates and magnification; near the pole in the equation, it returns numerical indeterminacy, not a huge confidently finite answer.

Query `curved-mirror-image-velocity` additionally needs `objectHeight`, `objectVelocity`, `timeUnit: s`, `stationaryMirror: true` and `fixedFocalLength: true`. Object velocity is either `{axial,transverse}` or `{speed,directionDeg}`; direction is measured from +axial toward +transverse. Moving mirrors and changing focal lengths are explicitly unavailable. No arbitrary time-expression evaluation or symbolic algebra is implemented.

```json
{"format":"opticsim-problem-v1","physical":{"format":"opticsim-curved-mirror-facts-v1","model":"spherical-paraxial","signConvention":"real-positive-local","lengthUnit":"cm","focalLength":20,"objectDistance":25,"objectHeight":0,"objectVelocity":{"speed":5,"directionDeg":135},"timeUnit":"s","stationaryMirror":true,"fixedFocalLength":true},"requests":[{"id":"motion","kind":"curved-mirror-image-velocity"}]}
```

The same `node scripts/run-problem.mjs problem.json --out test-artifacts/llm-authoring/<fresh>` entry point records exact inputs, qualified mathematical output and separate native status. Mathematical facts do not create a source brightness, aperture or native scene.

## Native curved scene components

Both native components require `x,y,normalDeg,apertureHeight` in the standard authoring request's chosen length unit. The normal points toward the declared front; the aperture is the transverse chord length.

- `ideal-curved-mirror` additionally requires signed `focalLength`. It compiles to native `IdealMirror` without synthesizing circular geometry.
- `circular-arc-mirror` requires signed `radius`. Positive is concave toward the normal; negative convex. The vertex is (x,y), circle centre is vertex+radius*n, and exact minor-arc endpoints are prepared deterministically. A stable rationalized sag is used. Native `ArcMirror`, not adapter code, selects the intersection and reflection.

Supported native scope: 1–4 sources, 1–2 curved reflectors, 0–2 plane mirrors and 0–2 finite detectors. No lens or refractive-media mixing in this first v6 model. Point sources may use full-circle, directional or single-ray modes. Source brightness and every aperture/geometry field remain required (source illustration policy may still be explicitly opted into); no curved aperture default is added.

Geometry is intentionally conservative: curved aperture bounding disks must be disjoint; sources and finite plane-mirror/detector segments must lie outside them by at least 0.01 mm. This is a supported-scope bound, not a claim that all excluded physical layouts are impossible. Arc half-aperture must be <0.99 |radius|, with |radius|>=2 mm. Degenerate arc data is rejected rather than relying on native fallback to a line mirror.

`mirror-reflections` reuses actual native counts for all supported mirror types. Conditional scene image calculation is only available for one source and one curved mirror (passive detectors may remain); no active component is removed to apply a convenient formula. Native incomplete/stopped outputs are still suppressed. Qualified packages preserve calculation provenance and show old results as historical after physical edits. The browser can save/reopen v6 and edit signed focal length/radius without changing the underlying native type.

## Verification and original Problems

Run `npm test`, `node scripts/curved-mirror-acceptance.mjs`, `npm run build`, then `node scripts/curved-mirror-browser.mjs`. Native tests independently compare reflected vectors against local circle normals and show narrow/wide circular-aperture ray intersections differing from the ideal image. Signed concave/convex, rotation, units, focal singularities, real/virtual objects, transverse product rule and qualification round-trips are covered. All original first attempts remain sealed.

The separately reviewed original U2 yields conditional instantaneous velocities; B03 yields a 5 cm inverted image without an invented focal scale. B04's full symbolic oscillation question remains unavailable; a labelled half-period subrequest returns image-at-infinity, not a complete answer. See `evaluation/curved-mirror-v1/REVIEW.md` for source-transcription corrections and limits. These previously seen cases are development evidence, not an independent model accuracy score.
