# Moving-source prototype: quasi-static native time snapshots

This feature adds **time as a bounded scene parameter**, not a new ray tracer.
For each requested time t, the deterministic engine calculates
`sourcePosition(t) = baselinePosition + velocity * t`, validates the complete
scene, and runs the unchanged pinned PhyDemo core again. Positions are evaluated
from the original baseline, never integrated cumulatively. The mirror, aperture,
emission pattern, brightness and numerical policy do not change with time.

## What is actually being animated

The native canvas shows the rays produced by the point emitter at its current
position. The second, explicitly separate diagram shows a **conditional
calculated image point**. It is not native image detection and it does not add
analytical ray paths to the native canvas. The browser reports sampled native
reflection counts separately from analytical position, magnification and image
velocity. Circular mirrors use native circular-surface reflection, but their
single-image calculation remains Gaussian/paraxial and can disagree with
finite-aperture rays because of aberration.

This is quasi-static geometric optics: **no light-travel time**, retarded fields,
wave dynamics, radiation from acceleration, moving-mirror physics, Doppler
shift, or relativistic effect is simulated. At each time the source is frozen
while that optical snapshot is traced. It is useful for a slow prescribed
object trajectory; it must not be described as photons propagating through a
changing apparatus.

## U2: the initial instant versus an extra motion assumption

The original previously viewed U2 problem states a concave mirror with f=20 cm,
object distance 25 cm, and instantaneous object velocity of 5 cm/s at 45 degrees
up and toward the mirror. Only that instant is the original question. The
animated example **additionally assumes constant velocity for 0.5 seconds**.
A finite aperture of 6 cm, brightness 0.05 and fixed 40-degree right-going
emission cone are explicitly illustrative; none is silently inferred from U2.
The circular alternative uses radius 40 cm under the spherical paraxial f=R/2
relationship and is explicitly a different model from the ideal mirror.

World coordinates use x-right/y-up. The pole is (0,0), source initially
(-25,0) cm, and its motion is +x/+y. Speed/direction are converted to components
by deterministic code; the LLM need not do this trigonometry. At t=0 the
conditional image is (-100,0) cm, with x velocity -56.56854249 cm/s and y
velocity -14.14213562 cm/s (away and downward). At later times the analytical
image velocity is recomputed, including the changing-magnification term
`dy_i/dt = m*dy_o/dt + y_o*dm/dt`. The same original instantaneous velocity
must not be reused at every frame.

## Use it

From the prototype branch, after `npm run setup`:

```sh
npm run build:motion
npm start
```

Open `http://127.0.0.1:4173/motion.html`. The initial example is built into the
bundle, not fetched from an external server. Use **Play**, **Pause**, **Reset**,
and the time slider. Playback speed is a maximum requested rate: the next
sample waits until the current native frame finishes, so a slow machine can
play more slowly but does not queue unlimited simulations or skip silently.

The CI-built `opticsim-moving-source-demo` artifact is a separate private
portable folder with `index.html`, `motion.js`, `motion.css` and full license
notices. It is intended to open directly from disk in Chromium browsers;
that file-opening path is covered by the browser check. It contains no
headless test core, source archive, network API, secret or public deployment.
The existing public-site allowlist and publication approval are unchanged.

**Save experiment** preserves the verified baseline qualified package and
motion law. **Save current static scene** exports an ordinary qualified scene
for one evaluated time, retaining its assumptions and a derived-position
record. The regular static app opens that snapshot; it cannot replay the
experiment. **Save frame evidence** preserves the separate current analytical
and native outcomes. Retain the experiment package to reproduce playback.

## Minimal bounded motion declaration

```json
{
  "format": "opticsim-source-motion-v1",
  "sourceId": "S1",
  "law": "constant-velocity",
  "velocity": {"speed": 5, "directionDeg": 45, "unit": "cm/s"},
  "durationSeconds": 0.5,
  "samples": 61,
  "continuationAssumption": "Constant velocity beyond the given instant is an illustration assumption."
}
```

Cartesian velocity `{x, y, unit}` is also supported. All directions are global,
not mirror-local; units are mm/s, cm/s or m/s. No executable expression, implicit
acceleration, arbitrary equation or unknown velocity is accepted.

`createMotionExperiment(baselineQualifiedPackage, motion)` binds this law to
its accepted baseline by an integrity hash. `prepareMotionExperiment` verifies
both hashes, snapshots inputs before asynchronous work, and offers `frame(i)`
and `sampleAt(t)`. Native time batches use:

```sh
node scripts/run-motion.mjs capabilities
node scripts/run-motion.mjs experiment.json --out test-artifacts/llm-authoring/my-motion
```

The CLI stores original bytes, a plan, a durable analytical record before each
native attempt, every frame's actual result, and initial/middle/final static
qualified snapshots in a fresh directory. Native failure is never rewritten as
a complete frame. Storage errors abort rather than being called optics errors.

## Deliberate first-version limits

One source and one stationary ideal/circular curved mirror, with optional
passive detectors, are supported. At most 241 time samples cover a positive
interval of at most 10 seconds. Native limits are at most 10000 processed
segments per frame and maximum depth 16. A conservative continuous-path check
excludes source motion through the mirror aperture disk, the mirror's back
side, or detector supporting lines; these are supported-scope restrictions,
not claims about the impossibility of every excluded arrangement.

No stateful native run is continued between times. Play waits for completion;
scrubbing/reset/model replacement cancels old native work and uses generation
guards against late callbacks. Invalid, stopped, failed or incomplete frames
pause playback and do not publish accepted native measurements. The separate
conditional mathematics retains its own method/status.

Exact focal inputs have no finite image point or velocity. Near-focal
indeterminate results are not plotted. Finite points beyond the fixed diagram
range are explicitly reported as off-plot, never clamped onto an edge.
The prototype does not claim to identify every singularity between discrete
samples, and does not draw a line joining image points across infinity.

## Verification

Node tests cover U2's initial derivative, finite-difference image velocity,
out-of-order frames, unit equivalence, input mutation, malformed and over-budget
laws, continuous collision rejection, focal/near-focal/virtual images, qualified
snapshot round trips, incomplete native evidence, stale callbacks and playback
pause/reset. Acceptance executes 61 ideal and 61 circular snapshots with the
real pinned native core. Browser tests cover playback, scrubbing, export/reopen,
model distinction, focal and tampered-package controls, and direct file opening.
These are development and integration checks, not independent LLM evaluation.

This work is a draft stacked on PR #27. Neither #27 nor this new PR is merged
by implementing this prototype. No earlier original problem record is changed.
