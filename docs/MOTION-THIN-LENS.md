# Moving-source thin lens — shared motion, not another player

PR #30 is the consolidated candidate after the merged curved-mirror and
source-motion foundations (#27 and #28). Read `LENS-CONSOLIDATION.md` for
what was retained from the overlapping PR #29 and the separate evaluation
records. No second motion implementation needs to be merged.

## Supported scope

The same `opticsim-motion-experiment-v1` envelope, immutable sampling,
qualified source velocity, pinned PhyDemo Simulator, playback, camera,
brightness/density/source controls, aperture editor, static snapshot and
experiment save/reopen serve two separately validated families:

- v6 curved-mirror tracing: one stationary ideal/circular curved mirror,
  one uniformly translating source, optional passive detectors; unchanged.
- v4 ideal-thin-lens geometric: exactly one stationary ideal lens and one
  uniformly translating point source, no additional optical elements or
  detectors. The source stays left of the lens throughout its affine path.

This does not relabel a general tracing scene to obtain a favorable image
formula or remove any supplied component. Multi-lens motion, returning rays,
moving lenses/detectors, media, and crossing the physical lens plane remain
unsupported. Crossing the focal plane is allowed; it is not a lens collision.

## Separate conditional analytical calculation

`src/motion-thin-lens.js` reuses the existing `predict(doc)` ABCD image
prediction. For lens x=L, source (x_o,y_o), fixed signed f and source velocity
(v_x,v_y), define u=L-x_o, m=-f/(u-f). In canonical millimetres and seconds:

```text
x_i       = L + f*u/(u-f)
y_i       = m*y_o
dx_i/dt   = (f/(u-f))^2 * v_x
dm/dt     = -f*v_x/(u-f)^2
dy_i/dt   = m*v_y + y_o*dm/dt
```

The transverse product-rule term is essential off axis. Finite differences
check both velocity components on both sides of focus and for negative f.
This is quasi-static ideal image kinematics, not native image detection,
time-of-flight optics or non-paraxial lens aberration.

At the exactly represented u=f condition, the image is at infinity and has
no finite position or image-point velocity. The existing static ABCD analyzer
uses a tolerance band. A nonzero u-f inside that band is instead labelled
`numerically-indeterminate` by the motion adapter; it is NOT asserted to be
exact infinity. Both position and velocity are withheld. The adapter never
rescues a static unavailable result with a different finite formula. No static
numerical threshold or native core code is changed.

## Explicit synthetic demonstration

`examples/moving-lens.json` declares every input: x_o=-28 cm, y_o=+1 cm,
L=0, f=+20 cm, aperture 12 cm, relative source brightness 0.3, a 40-degree
right-going cone, and velocity (+4,+1.2) cm/s for 3 seconds, 61 samples.

| Time | Object distance | Conditional image | Image velocity |
|---|---|---|---|
| 0 s | 28 cm | real, (+70,-2.5) cm, m=-2.5 | (+25,-4.25) cm/s |
| 2 s | 20 cm | at infinity, no finite marker | unavailable |
| 3 s | 16 cm | virtual, (-80,+23) cm, m=+5 | (+100,-17) cm/s |

These are illustrative software inputs, never inferred facts for a textbook
question. The lens example opens in Current frame camera mode because a
whole-motion fit near focus can make the apparatus tiny. U2 mirrors retain
Whole motion by default. Camera changes do not alter physical facts.

## Shared controls and backward compatibility

The generic `opticalApertureHeightMm` field edits the existing aperture for
either family; `opticId` and `opticType` identify it. The historical
`mirrorApertureHeightMm` alias still works for curved mirrors only and rejects
lens use. Supplying both aperture fields is rejected rather than choosing one.
This avoids teaching an LLM to describe a lens as a mirror. UI element IDs
remain stable; the same panel adapts its label and sends the generic field.

Lens v4 emission supports full-circle and directional, not v6 single-ray.
`motionRayControlCapabilities().sourceModesBySchema` makes that distinction
explicit. Existing qualified packages do not store these convenience field
names; their canonical scene and hash-bound motion schema are unchanged.
Physical revisions retain original assumptions and qualified edit history.

## Verification and evidence

The consolidated `.github/workflows/source-motion.yml` runs the full Node
suite, original 122 U2 native samples, 61 lens samples, all three existing
motion browser suites, and the historical PR #29 trial replay. There is no
second duplicate lens-motion workflow or simultaneous feature-branch push
run. It runs on main-targeted PRs and main pushes; obsolete PR runs can be
cancelled, but main runs are not. Motion artifacts are retained for 7 days.

Node tests observe actual per-instance `IdealLens.onRayIncident` calls at
real, focal and virtual samples and delegate unchanged to the pinned native
implementation. Emitted-ray counts alone are not the lens-hit assertion.
Browser tests also inspect native canvas pixels. Tests retain source-side
checks, camera/player reuse, real/virtual/infinite behavior, near-focus
suppression, diverging lenses, tamper rejection and qualified save/reopen.

```sh
npm run setup
npm test
node scripts/motion-acceptance.mjs
node scripts/motion-lens-acceptance.mjs
npm run build:motion
npm start
```

Open the existing `motion.html` page and select the synthetic lens option.
The built portable demo remains offline; no Pages publication or external
inference is enabled by this milestone. Passing software checks is not an
independent accuracy result on unseen questions.
