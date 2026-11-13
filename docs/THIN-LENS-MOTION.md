# Moving thin lens — reuse of bounded source-motion, not a new dynamics engine

This milestone extends the already-implemented **opticsim-motion-experiment-v1**
with **one stationary ideal thin lens in an existing canonical v4
`ideal-thin-lens-geometric` scene**, exactly one moving point source, and
optional passive detectors. The JSON envelope, uniform-translation law,
qualified baseline and hash rules, time sampling, native PhyDemo ray tracing,
camera fitting, playback, physical/ray controls and exports are **unchanged**.

The author does not supply a per-frame answer, invent image points or write a
ray tracer. PhyDemo chooses finite lens hits at every sampled instant. An
independently qualified analytical layer reuses the existing `predict` lens
ABCD calculation for image position, and differentiates the ideal mapping for
instantaneous image velocity. Neither analytical position nor velocity is a
native measurement.

## Explicit synthetic demonstration

Use the built-in **Ideal thin lens — moving source** choice in the same motion
page. The synthetic model is **not a transcription of an original question**:

- Lens pole x = 0, ideal thin-lens f = +10 cm, finite aperture height 8 cm.
- Source starts at (x, y) = (-20, +1) cm; right-going 50° emission cone,
  relative brightness 0.05, dense sampling are **deliberate illustration inputs**.
- Source velocity is (+12, +2) cm/s for an **explicitly assumed** 1 second,
  with 61 samples. Lens geometry and focal length remain stationary.
- The source remains on the left of the lens plane at every instant, while
  crossing its **focal** plane at t = 5/6 s.

The calculation returns:

| Time | Object distance u | Image distance v | Image kind | Magnification m | Global image (x,y) |
|---|---|---|---|---|---|
| 0 s | 20 cm | +20 cm | real | -1 | (+20, -1) cm |
| 5/6 s | 10 cm | no finite v | at infinity | no finite m | unavailable |
| 1 s | 8 cm | -40 cm | virtual | +5 | (-40, +15) cm |

The moving object has global x-right/y-up velocity, **not mirror-normal
coordinates**. The ideal lens relation for a source remaining left is
`u = x_lens - x_source`, `v = f*u/(u-f)`, `m=-v/u`.
For fixed f and stationary lens, `du/dt=-vx_source`,
`dv/dt = m*m * vx_source` and

```
vx_image = m*m * vx_source
dm/dt    = -(m*m/f) * vx_source
vy_image = m*vy_source + y_source*dm/dt
```

At t = 0 the image velocity is (+12, -3.2) cm/s; at t = 1 it is
(+300, -80) cm/s. The transverse product-rule term matters when the
source is off-axis. Both are instantaneous conditional Gaussian values.
A near-focal interval is explicitly **numerically indeterminate**; at the
exact focal plane there is **no finite image marker or finite image velocity**.

## Same source-motion contract and viewer

```sh
node scripts/run-motion.mjs capabilities
npm run setup
node scripts/lens-motion-acceptance.mjs
npm run build:motion
npm start
```

Open `http://127.0.0.1:4173/motion.html`, choose **Ideal thin lens —
moving source**, and use the same Play/Pause, time slider, camera
mode, +/− zoom, pointer pan and Fit. Current lens aperture uses the same
control as mirror aperture, with a dynamic **Lens aperture** label;
its value is the existing lens `parameters.apertureHeight` in millimetres
after a UI cm conversion. Brightness/density/direction/angle, native
limits, Rays/Extended and grid retain their existing meanings and
qualified edit history.

The original canonical v4 source contract supports **full-circle and
directional** emitters only. It does not silently gain the v6 mirror
**single-ray** mode: that option is disabled and programmatic use rejects.
Previously saved U2 mirror experiments remain valid and playable. Importing a
supported qualified lens experiment uses the exact same loader, no new file
extension or accepted LLM physics vocabulary.

`src/motion-lens-analysis.js` is an isolated analytical adapter reusing
`predict`. `src/source-motion.js` has a second, strict lens scope for
validation, with the same immutable frame loop. `src/motion-viewport.js`
adds the lens's existing finite segment endpoints to the common fit
collection. The ray UI adapts the optical-type label rather than spawning
another editor.

## Supported scope, honest limits and tests

- Only **one source left of one stationary vertical ideal thin lens** in
  the original v4 lens model. No arbitrary lens trains, moving/rotating
  lenses, negative-side/dual-source incidence, lens-plus-mirror compositions,
  graded media or equation-expression language is added.
- The full translated source path must remain left of the lens plane, and
  preserve existing detector and source separation bounds. Focal-plane
  crossing is allowed **because it is an analytical image singularity,
  not a collision with the physical lens**.
- Numerical budgets are unchanged: at most 241 frames, duration 10 s,
  10,000 processed segments and ray depth 8.
- Finite ideal image predictions are **conditional on ideal paraxial
  imaging**, not evidence that sampled rays through a finite aperture meet
  there; at infinity / near singularity the location is withheld.
- Only the source position changes with time. Each frame is an independent
  native ray simulation; no time-of-flight, wave optics or lens acceleration.
- The synthetic example and its native tests are **not scored as a solution
  to a previously unseen original problem**.

Regression tests independently check signed real/virtual images,
converging/diverging lenses, finite-difference off-axis velocities, focal
infinity and near-singular suppression, actual unmodified PhyDemo
`IdealLens.onRayIncident` calls on four distinct time samples, invalid
geometry and tamper rejection, camera fit, source controls, qualification
and export, and retention of the old curved-mirror mode.

`scripts/lens-motion-acceptance.mjs` uses the same native
`runMotionEvidence` function for **all 61 samples** and archives
native/analytical outcomes and qualified snapshots. It makes no external
model call or automatic repair. Browser tests use the existing motion page
and verify real→infinite→virtual playback, lens-aperture adjustment, and
portable save/reopen. A separate prospective original-problem trial is
reported on its own terms; it must not be conflated with these synthetic
regression examples.
