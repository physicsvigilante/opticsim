# Bounded source controls extension

Status: approved and implemented as the bounded source-controls extension.
The proposal below records the agreed design. Approval clarified that selecting
Directional defaults to Medium, migration preserves exact legacy brightness and
density, angular conversion/symmetric emission must be tested, and controls should
pair native-style sliders with precise numbers. No commit or push is authorized.
See VALIDATION.md for the actual extension checks.

## Inspected implementation

Verified the local upstream checkout is unchanged at v5.4.0 commit
`811f508d2b070898c241a568b0c167dcb8645251`. Inspected:

- `vendor/ray-optics/src/core/sceneObjs/lightSource/PointSource.js`:
  `x`, `y`, `brightness`, optional wavelength; native full-circle emission.
- `vendor/ray-optics/src/core/sceneObjs/lightSource/AngleSource.js`:
  `p1` is the emitter, `p2` defines direction, `emisAngle` is the full opening
  angle in degrees, and `symmetric: true` centres the cone on that direction.
  Its native UI offers angles from 0 to 180 degrees. The source code can accept
  wider values, but this extension will declare a smaller supported domain.
- Both `onSimulationStart()` methods use angular step
  `2*pi / parseInt(scene.rayDensity * 500)` in the existing default colour mode.
  `Scene.rayDensity` selects `rayModeDensity` in both rays and extended modes.
  No new ray generator is needed.
- Both set total per-ray brightness to `min(brightness / rayDensity, 1)` and
  return `brightnessScale`. Rendering/intensity is therefore coupled to sampling
  by upstream. The sandbox must preserve source brightness independently and
  report clipping, without applying compensating power normalizations.
- The source loops have native endpoint exclusions/tolerances. A symmetric cone
  need not produce a central ray or samples at both boundaries. Preserve the
  native sampling lattice and `gap` flags rather than correcting either.
- Existing upstream AngleSource tests cover native creation, transforms and
  properties. They do not replace emission-direction/count regression checks.

A read-only probe through the already-built pinned core called the native
sources' emission methods (no scene format or production logic was changed):

| Preset | Native density | Full-circle rays | 30-degree directional rays | Angular step |
| --- | --- | --- | --- | --- |
| Sparse | 0.048 | 24 | 2 | 15 degrees |
| Medium | 0.2 | 100 | 9 | 3.6 degrees |
| Dense | 1 | 500 | 42 | 0.72 degrees |

These counts were observed for rays mode, `symmetric: true`, direction to the
right, brightness 0.5, and default colour mode. The directional counts depend
on the opening angle, not a fixed rays-per-cone promise. Returned brightness
scales were respectively 0.096, 0.4 and 1 for both source classes. Values below
1 indicate native brightness clipping at this sampling level; they are not
geometric truncation or failure to complete the ray-processing loop.

## Document contract

Keep one semantic component type, `point-source`, with its existing stable ID.
Full-circle versus directional is a characteristic of that component, not two
sandbox component types. Neither native class name appears in sandbox saves or
the authoring interface. Keep the current one-source/one-or-two-coaxial-lens
scope policy. Do not add other sources or a general source framework.

Proposed version-2 source component:

```json
{
  "id": "source-1",
  "type": "point-source",
  "parameters": { "x": -300, "y": 10, "brightness": 0.5 },
  "emission": {
    "mode": "directional",
    "directionDeg": 0,
    "angleDeg": 30
  }
}
```

- `mode`: `full-circle` or `directional`.
- `directionDeg`: finite [-180,180], measured counterclockwise from +x in the
  sandbox's y-up coordinates. Thus 0 points right, +90 up, and -90 down.
- `angleDeg`: full opening angle, finite [1,180]. No zero-angle/single-ray
  special case and no intermediate openings above 180 in this bounded extension.
- Direction and opening stay stored/validated but inactive in full-circle mode,
  so switching modes retains the user's settings. Disable their controls then.
- `brightness`: finite [0.01,1], an upstream-relative source intensity setting,
  not calibrated watts or guaranteed conserved total emitted power. It belongs
  to the source characteristics, alongside position/emission, not camera/theme.

Sampling remains under `simulation.rayDensity`. Extend its lower bound from
0.1 to 0.048; retain the upper bound of 1. The three preset buttons/select options
write the density values in the table. Do not store a second preset value that
could disagree with density. Existing valid non-preset densities remain exact
and appear as Custom in the preset selector; no new raw-density editor is needed.
This also allows programmatic authors to supply a bounded density directly.

Presentation retains title, view, mode and grid. Remove
`presentation.brightness`, which currently feeds the native source brightness.
There is no separate global exposure control in this extension.

Bump `schemaVersion` and `adapterVersion` to 2. Add one explicit v1-to-v2 load
migration, first validating the entire old document against the old contract:
preserve IDs, positions, optics, density, limits and presentation; move the old
brightness to the source; add full-circle mode with inactive direction 0 and
opening 30. Save as v2 thereafter. Existing examples retain their full-circle,
dense appearance until the user changes controls. No silent nearest-preset
conversion or repair of malformed/unsupported saves; incompatible versions fail
with paths. No native-to-sandbox semantic conversion is added.

## Adapter, controls and result policy

- Full-circle compiles to native PointSource. Directional compiles to native
  AngleSource with `symmetric: true`, `emisAngle: angleDeg`, and source brightness.
  With angle theta, use native emitter `(x,-y)` and direction point
  `(x + L*cos(theta), -y - L*sin(theta))`, for a fixed adapter reference length
  L=20 native units. L is only a nonzero direction reference/marker; it is not
  a physical source extent, second emitter, or authored parameter.
- Keep native object metadata external and rebuild the ID map when mode changes.
  The same source ID remains authoritative even when its native class changes.
- Expose source mode, full opening angle, direction and relative brightness in
  the source controls. Put Sparse/Medium/Dense under a separate Sampling control.
  Give degree/brightness fields their actual units rather than the existing
  generic numeric control's unconditional mm label.
- Use the existing validate/compile/load/revision/simulate transaction for every
  edit. Save/reload and native export follow the same authoritative document.
  Native export uses native fields only and retains the selected density.
- Preserve ray/extended rendering, default colour mode, depth limit <=8 and
  processed-segment limit <=10,000. Report actual source-emitted count separately
  from processed-segment count; read emission count from the native source's
  returned `newRays` while delegating its emission once, without resampling or
  changing rays. Do not estimate a cone's count as density*500. If this requires
  an instance-level observation wrapper, keep it adapter-owned, delegate once,
  and test that returned rays are unchanged; do not patch upstream source.
- Show the native brightness scale/clipping note separately from completion,
  truncation and undefined behavior. Do not report brightness clipping as lost
  geometric rays or imply equal apparent brightness across presets.
- Preserve the existing lens prediction mathematics, finite/virtual/infinity
  states, and suppression on invalid/stopped/incomplete/failed runs. Changing
  only emission/sampling/brightness must not move the ideal image prediction.
  Strengthen its qualification: these are ideal image locations for rays through
  the lens system; the selected cone and samples may not illuminate that image
  or even hit the first lens. Do not infer a detected image from the calculation,
  add ray aiming, or implement a new aperture/illumination solver.

## Agreed focused acceptance

1. Keep the current numerical and session tests passing. Add focused contract
   and migration cases: both source modes, invalid angles/directions/brightness,
   stable IDs, exact legacy density retention, version rejection, and v2 save/reload.
2. Verify native class/field mapping, y/angle signs at 0/+90/-90/180 degrees,
   symmetric cone limits, counts from the table, native endpoints/brightness
   behavior, and rays/extended mode sampling consistency. Test the observer
   wrapper delegates once and preserves the native rays/return value.
3. Compare unchanged real/virtual/infinite lens predictions across both source
   modes, all presets and brightness changes. Run a few directional native
   simulator regressions with detector observations, including a cone pointing
   away from the lenses. Assert that prediction is conditional, not a simulated
   image detection. Retain stop/truncation/error and stale-callback coverage.
4. Short browser review on one existing bench: compare full-circle Dense versus
   Sparse, then directional Dense versus Sparse; rotate/widen the cone; adjust
   brightness; switch back to full-circle. Check synchronized controls, status,
   counts and prediction labels. Save/reload and export both source modes; load
   exported JSON in the pinned core. Check invalid inputs and browser errors.

No new dependencies or build tools, new optical component types, upstream physics
changes, general graph/source system, commits or pushes are proposed. The native
emission probe above is retained investigation evidence; completed extension
regression and browser checks are recorded in VALIDATION.md.

Approved scope: version-2 source contract/migration, directional opening 1-180
degrees, density presets above, source-relative brightness and its explicit
clipping note, and the focused implementation/validation scope above.
