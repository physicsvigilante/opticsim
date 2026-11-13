# Moving-source thin-lens extension — reuse existing optics, not a new player

This is a deliberately narrow next capability after merging curved mirrors
(PR #27) and bounded source motion (PR #28).

## Source-independent framework

The **same** `opticsim-motion-experiment-v1` envelope, immutable
`frame(i)/sampleAt(t)`, signed and qualified source velocity, native
PhyDemo Simulator, playback, camera, density, brightness, source-cone controls,
aperture editor, static snapshot and experiment export/reopen can operate
with either of two **separately validated** optical families:

- v6 `curved-mirror-tracing`: one stationary ideal/circular curved mirror,
  one uniformly translating source, optional passive detectors; unchanged.
- v4 `ideal-thin-lens-geometric`: **exactly one** stationary ideal lens and
  one uniformly translating point source, with no other optical elements.
  Existing strict scene validation keeps the source on the left of the
  lens plane. The entire affine path is checked, not just sampled frames.

This does **not** turn the v4 lens scene into the unrestricted
`general-component-tracing` model to apply a favorable image equation,
remove a mirror, or assume a ray route. Multi-lens, returning, moving-lens,
moving-detector, refraction-media and crossing the actual lens plane are
unsupported by this motion extension.

## Computation

The canonical `predict(doc)` ABCD calculation in `src/analysis.js` is
the source of the thin-lens image point. It gives image distance, signed
magnification, real/virtual image and focal infinity using exactly the
same numerical indeterminacy policy as the existing static lens analyzer.

For the stationary lens at x=L and source at x=x_o, y=y_o, with
focal length f (signed) and source velocity v_x,v_y, the positive
object distance is u=L-x_o. All lengths are canonical millimetres.
The derived finite image is x_i=L+f*u/(u-f), y_i=m*y_o, where
m=-f/(u-f). Differentiate **without assuming y_o=0**:

```text
dx_i/dt = (f/(u-f))² * v_x
dm/dt   = -f*v_x/(u-f)²
dy_i/dt = m*v_y + y_o*dm/dt
```

The last term is essential for an off-axis moving source; finite
differences independently test both velocity components. Focus u=f has
an image **at infinity** with no finite image-point velocity, and no
finite marker is drawn. When the existing ABCD calculation classifies a
state unavailable/ill-conditioned, this extension cannot upgrade it.

A **positive-focal-length** lens may pass from a finite real image through
focal infinity to a finite virtual image while the source stays on the
same side of the lens. The mathematical image guide is explicitly
conditional, not a native detected ray intersection. PhyDemo still traces
only physical rays; brightness, aperture and sample density can affect
native illumination without moving the analytical image point.

## Synthetic demonstration (not an original question)

`examples/moving-lens.json` explicitly supplies every physical value
for a software-control example: x_o=-28 cm, y_o=+1 cm, L=0,
f=+20 cm, lens aperture 12 cm, 0.05 relative source brightness,
40° directional cone pointing right, and uniform velocity
(+4,+1.2) cm/s for 3 seconds over 61 samples.

| Time | u | Conditional image | Image velocity |
|---|---|---|---|
| t=0 | 28 cm | real, (+70,-2.5) cm, m=-2.5 | (+25,-4.25) cm/s |
| t=2 s | 20 cm | at infinity; no finite image or speed | unavailable |
| t=3 s | 16 cm | virtual, (-80,+23) cm, m=+5 | (+100,-17) cm/s |

The example is **entirely synthetic** and does not claim to answer or
transcribe an unseen problem. The LLM should not infer any of its
numerical choices for another question; the verified provenance marks
its original request illustrative.

## Verification and compatibility

The original U2 motion example and all mirror observations are retained.
A lens example is chosen by an explicit dropdown; compatible previously
saved motion packages reopen unchanged using their original canonical
schema and hash-bound baseline. All component geometry is validated
before and after the declared motion. Native rays, image calculations,
camera, and optional manual source/aperture edits remain distinct.

The new Node regressions compare exact known real, focal and virtual
results, both signed and negative focal length, off-axis velocity
finite differences, source-side crossing rejection even between two
sampled frames, and actual pinned PhyDemo native runs.

The dedicated CI workflow also runs the *previous* motion tests and
the original 122 U2 native samples and camera/browser regressions.
It adds 61 synthetic native lens snapshots and direct-browser lens
example and save/reopen checks. Passing these development checks is
not a held-out evaluation of LLM problem comprehension.

## Next validation milestone

Only after this extension passes should a new, **unseen** question be
selected under a recorded no-solutions protocol. Record its first
LLM interpretation and missing facts *before* inspecting any answers;
allow deterministic error/unavailable outcomes, and do not fabricate
apparatus data to make the native simulator run. The current synthetic
control and previously viewed U2 must not be counted as unseen solves.
