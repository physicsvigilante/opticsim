# Moving-source prototype: quasi-static native time snapshots

This feature adds **time as a bounded scene parameter**, not a new ray tracer.
For each requested time t, the deterministic engine calculates
`sourcePosition(t) = baselinePosition + velocity * t`, validates the complete
scene, and runs the unchanged pinned PhyDemo core again. Positions are evaluated
from the original baseline, never integrated cumulatively. The mirror, aperture,
emission pattern, brightness and numerical policy do not change with time.

## Reusable layers (not a U2-specific trajectory solver)

This version separates **authoring facts**, **motion**, **native execution**,
**conditional analysis**, **camera presentation**, and **qualified evidence**:

1. The author/LLM supplies a validated baseline optical scene and a bounded,
   data-only motion specification. U2 is one explicit example file, not a
   special-case branch of the frame generator.
2. `prepareMotionExperiment` binds the fixed scene and law by content hashes.
   `frame(i)` or `sampleAt(t)` derives a fresh scene from the **original**
   baseline without accumulated editing.
3. Native PhyDemo chooses actual finite ray intersections for each time sample.
   Analytical image position and velocity are separate, conditional quantities.
4. `collectMotionView` / `fitMotionView` find camera targets generically from
   optical endpoints, sampled object positions and available finite image
   positions. `applyMotionCameraControl` adds presentation-only zoom/pan.
5. Playback and export preserve frame status, source-question provenance and
   method qualifiers without turning calculated image markers into native
   measurements.

New problem classes should expand the **smallest validated layer necessary**:
add a new declarative motion law only with justified data and tests; add new
native optical elements only when supported by pinned PhyDemo; add a new
analytical observable only with an explicit physical model; and leave unsupported
arrangements unavailable. **Do not** teach a general model a collection of
hard-coded textbook pictures or add an arbitrary equation interpreter.

This first implementation is intentionally *not* general motion dynamics.
It currently handles one translating source at constant velocity with one
stationary ideal/circular mirror, and it makes no claim about light-travel-time
effects. We can extend that scope gradually as independently checked examples
reveal recurring requirements.

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
and the time slider. Use **+ / −** to zoom both views relative to the selected
camera preset (25%–800%), **Fit** to restore that preset, the mouse wheel to
zoom toward the pointer, or drag either view to pan. **Whole motion** holds a
fixed automatic frame across time; **Current frame** refits the instant;
**Apparatus close-up** intentionally may omit the remote image. Camera choices
and their view adjustments affect **presentation only**; they do not change the
experiment's source trajectory, native mirror geometry, ray tracing or
numerical policy. A camera change may rerun the same static native frame to
redraw its rays. The finite camera zoom remains within the existing 0.03–10
native zoom range; extreme images, infinity and singularities cannot be made
finite by zooming. Frame evidence records the displayed camera separately,
while qualified static-scene export retains the authored frame's original
presentation rather than the temporary playback viewport.

Playback speed is a maximum requested rate: the next
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

## Light-source and ray controls (shared with the static editor)

Expand **Light & ray controls** in the portable viewer. These controls operate
on the *same canonical fields* as the normal Opticsim editor, not on a second
drawing-only brightness or sampling system:

- **Source brightness:** editable number plus native-style range, 0.01–1,
  stored as the source's real relative brightness. It is a physical
  experimental setting, not display exposure.
- **Sampling density:** Sparse (0.048), Medium (0.2), Dense (1) or an exact
  bounded custom density. This modifies the number of rays sampled by
  PhyDemo and can change observed reflections, diagnostics and truncation.
- **Source mode and cone:** full circle, directional cone, or one exact ray;
  authored direction in degrees and directional opening angle 1–180°.
  A single ray remains one ray even with Dense sampling. A change from
  full circle to single-ray requires an explicitly entered direction.
  As in the static editor, changing from non-directional to directional
  initially selects Medium sampling unless the user explicitly changes it.
- **View:** native Rays/Extended and grid display are presentation fields;
  they must never be confused with illumination physics.
- **Advanced limits:** native maximum ray depth and processed-segment budget,
  using the original canonical bounds. Lower limits can lead to incomplete
  native results; they never license claiming a complete ray observation.

Edits are explicit **experiment revisions**. The viewer validates the
entire accepted v6 optical scene, records the exact changed physical,
numerical or presentation fields using the existing qualified edit log,
creates a new integrity-bound baseline and motion experiment, and
re-simulates the currently selected time. The motion law, object trajectory,
mirror geometry, original problem interpretation and original input hash
are preserved. Invalid edits are rejected without rewriting the last
accepted experiment. **Save experiment** and reopen round-trip the altered
brightness, density, source mode and qualification history; a static
snapshot carries the same history.

This is a reusable control adapter over validated scene fields. It does
not special-case the U2 question, calculate native image detections, alter
upstream physics or silently convert a physical brightness edit into a
cosmetic zoom or color change. No arbitrary editable physics expression is
accepted. In problems where a detector or partial Fresnel reflection is
important, changing brightness and sampling can affect numerical/native
readouts, so their choice must be visible in the evidence.

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
indeterminate results are not plotted. The automatic diagram and native camera
fit supported finite points without clamping; after manual zoom or pan, an
off-screen point is reported rather than moved to the view edge. Extremely
far finite image positions beyond the supported camera range are not
silently given false coordinates.
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
