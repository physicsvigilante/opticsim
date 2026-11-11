# Validation record - 2026-11-01

Environment: Windows PowerShell, Node 24.19.0, npm 11.17.0, Git
2.43.0.windows.1. Upstream v5.4.0 at
811f508d2b070898c241a568b0c167dcb8645251.

## Executed checks

- Obtained the exact upstream source, installed using its frozen lockfile and
  project-local cache, then successfully reran the documented `npm run setup`.
  No source/lockfile changes were made in upstream (`git diff HEAD` and
  `git status --short` were empty). The setup script's existing-checkout path
  was tested; its initial-clone branch uses standard Git clone but was not
  separately repeated from an empty folder after writing the script.
- `npm run build`: browser bundle and local license/scene assets built.
- `npm start`: localhost preview started and loaded successfully in the
  in-app browser after starting the server outside the tool's restricted
  socket sandbox. Ordinary Windows terminals do not have that tool sandbox.
- `npm test`: **7 tests passed, 0 failed**, including multiple parameter/ray
  fixtures inside each test. This builds the actual pinned core for Node
  and uses Node's built-in test runner. It is not an upstream snapshot suite.
- `npm --prefix vendor/ray-optics run build-app`: pinned upstream browser editor
  built for export compatibility verification only. It emitted Sass and bundle
  size warnings; no build error. The sandbox itself does not need this build.

## Numerical and state coverage

- Scene validation rejects unknown fields/types, version/pin/unit mismatches,
  duplicate IDs, nonfinite values, zero focal length, invalid aperture/planes,
  invalid sampling settings, and unsupported component counts. Native JSON is
  rejected as a sandbox save. Stable IDs and physical values round-trip through
  the sandbox save; native export reloads in the pinned core without errors.
- Independent expected positions/magnifications: f=100 mm with object distances
  300 mm (real), 50 mm (virtual), 100 mm (infinite); a diverging f=-100 mm lens;
  both sides of infinity; two-lens finite imaging; intermediate collimation;
  final image at infinity.
- Native public ideal-lens intersection/incident-ray methods checked against
  independent slopes at three aperture heights for each representative case.
  Position tolerance 1e-7 mm; slope tolerance 1e-9. Virtual images are checked
  through backward line extensions, infinity through parallel directions.
- Complete bounded Simulator runs with SingleRay and two Detector planes
  checked against independent forward slope propagation for eight arrangements
  at two launch heights each. Detectors use 0.01 mm bins; expected crossings must
  lie in the measured interval (1e-7 mm numerical slack). All complete test
  runs had zero errors, truncation, and undefined behavior. These detector/ray
  fixtures do not expand the authored component set.
- Native processed-segment stopping and depth truncation exercised. Session
  tests cover invalid edits, native load failure, run failure, stop, truncation,
  and obsolete asynchronous completions; predictions are cleared/suppressed.

## Browser checks performed through the actual UI

- Inspected native ray rendering in the single-lens scene.
- Source x changed to -50 mm: virtual image (-100,20), m=2. Changed to -100 mm:
  explicit image at infinity and no finite magnification.
- f=0 rejected with a component parameter path; old canvas hidden, prediction
  removed, save/export disabled. Correcting f restores a valid run.
- Two-lens scene loaded; second focal length changed to 120 mm. Sandbox save
  downloaded and then loaded through the file chooser after switching scenes:
  stable IDs, both lenses, f=120, and prediction (650,7.5), m=0.75 restored.
- Third arrangement loaded from its JSON file: virtual image (200,-2.5), m=-0.25.
  Source y changed to 20 mm: image y=-5. Rapid sequential focal/source edits
  settled on the final values and synchronized prediction.
- Extended rays and grid toggled. Export button downloaded native JSON; the
  downloaded file loaded in the pinned headless core with no errors and also
  opened/rendered in the locally built pinned upstream browser editor.
- Sandbox fixtures with processedRayLimit=1 and maxRayDepth=0 loaded through
  the file chooser: respectively STOPPED and INCOMPLETE, with predictions
  unavailable and a visible warning about partial rays.
- No error-level browser console messages observed during these interactions.
  The browser smoke checks are interactive tool-driven checks, not a checked-in
  automated end-to-end runner. Downloaded examples go to the browser's default
  Downloads folder; workspace copies used for checks are under test-artifacts.
- The separate upstream compatibility editor rendered the exported optics but
  showed missing toolbar SVG icons in this local preview, despite HTTP 200
  image/svg+xml responses. This did not affect the sandbox UI or numerical
  checks; upstream UI fidelity beyond native import/rendering was not resolved.

## Practical limits and untested behavior

- No exhaustive validation of every allowed numerical combination, extreme
  conditioning, aperture throughput, or continuous-ray completeness. The
  analytical ideal model concerns rays traversing all lens segments.
- A manual Stop click during a naturally long run was not separately exercised:
  supported examples complete quickly. The same state transition was tested
  in session tests, and native stopping plus UI stopped state were tested via
  the segment limit. No artificial slow simulation was added for this check.
- Not a broad browser/device matrix, performance benchmark, full upstream test
  suite, security audit, or optical accuracy claim from screenshots. Optional
  upstream Jest/native image generation dependencies were omitted.
- npm reported an existing deprecated core-js and unapproved package install
  scripts. No global package/script approval, dependency upgrade, or upstream
  source patch was applied. This milestone uses the tested ideal-lens path.
- There are no unresolved focused-test failures. Upstream editor build warnings
  and the finite-model/sampling limits remain. Implementation changes have not
  been committed or pushed.

## Approved source-controls extension

Implemented schema/adapter version 2 without new dependencies or upstream source
changes. Examples retain their original full-circle mode, brightness 0.5 and
exact dense sampling value 1. The original milestone record above is historical.

`npm test` now reports **15 passed, 0 failed** (the original seven groups plus
eight source-control groups). The extension checks include:

- Strict v1 validation followed by migration; exact density/brightness transfer
  for 1/0.5, 0.137891/0.073219 and 0.1/0.875. Native full-circle emission return
  values match the corresponding legacy native setup exactly; no input document
  mutation, preset rounding, source ID change or lens changes.
- Directional selection defaults to Medium. Explicit saved directional Sparse
  or Custom values survive loading. Inactive full-circle direction/opening values
  survive mode switches. Invalid modes/angles/directions/brightness/density are
  rejected. Fine numeric values survive save/reload without quantization.
- Explicit x-right/y-up conversion at 0, +90, -90 and +/-180 degrees, native
  reference-point coordinates, symmetric cone bounds and the native half-open
  angular lattice. Angular/coordinate tolerance is 1e-9. Samples are not forced
  into an artificially symmetric set or supplemented with a centre ray.
- Full-circle emitted counts 24/100/500 and 30-degree directional counts 2/9/42
  for Sparse/Medium/Dense, in rays and extended modes. Brightness and scale match
  native values. The adapter observer delegates exactly once, preserving the
  return object/ray array and its contents. A 1-degree cone emits one native ray.
- Existing real/virtual/infinite analytical results are identical across source
  modes, sampling presets and brightness changes. Native exports reload with
  the right class, exact density and brightness, without semantic fields.
- Full Simulator directional-source/detector regressions: a forward cone images
  at the expected detector interval; a cone pointing backward produces zero
  detector power while retaining the conditional ideal prediction. The forward
  fixture uses a declared 200mm aperture because one 30-degree sample misses
  the original 180mm aperture from y=10. Native aperture physics was preserved.
- Source edits retain invalid/stopped/truncated/error and stale-callback guards.

Interactive browser review of the running app:

- Full-circle Dense 500 versus Sparse 24, then Directional Medium 9 (default),
  Dense 42 versus Sparse 2 at 30 degrees. Visually inspected the changed rays.
- Narrowed the opening to 1 degree: displayed one native ray and an explicit
  undersampling warning. Set direction +90 degrees; the source points upward.
- Opening, direction and brightness sliders each updated their number field and
  native simulation via actual slider key events. A pointer drag of the opening
  slider from 1 to 87 degrees also synchronized the field and native simulation
  (25 emitted rays at Medium), with multiple interactive revisions. Precise numeric values 12.75,
  17.125 and 0.073219 were retained. Invalid angle 0 suppressed predictions and
  disabled saving; correction restored the run. Number edits are throttled at
  75ms; slider release flushes the last value.
- Directional Sparse sandbox downloaded, switched away, and reloaded through the
  file chooser: same source ID, mode, Sparse density, angle, direction, brightness
  and analytical values. Loading did not apply the new-directional Medium default.
- A v1 save with exact density 0.137891 and brightness 0.073219 loaded as Full-circle
  with Custom (0.137891), brightness unchanged, inactive angle controls disabled.
- Downloaded both full-circle and directional v2 saves and native exports.
  Inspected the actual downloaded files and loaded both native exports in the
  pinned core, comparing all serialized native objects with the saved document's
  adapter output. Full-circle remained PointSource at 0.137891; directional
  remained AngleSource at 0.048; both retained brightness 0.073219 and source-1.
- No browser error-level console messages observed. Browser review uses the
  existing tool; no extra browser test runner or acceptance framework was added.

Limits remain intentional: symmetric cones only, openings 1-180 degrees,
relative brightness with native low-density clipping, and finite angular
sampling that may miss lenses or the analytical image. Slider thumbs use their
coarse steps; number fields retain finer precision. Desktop browser interactions
were reviewed; no broad device/touch/performance matrix is claimed. The native
engine source and upstream dependency lock remain unchanged. No commits/pushes
were performed for this extension.

## PhyDemo-style selector UI follow-up

Replaced the source-mode select with an illustrated Light Source dropdown and
checked options for the two supported modes. Replaced the View select with
adjacent radio buttons for Rays and Extended rays. The four illustrations/glyphs
are reused from the exact pinned PhyDemo SVG assets and bundled inline; existing
upstream attribution/license output is retained. No schema, physics, source type,
dependency, or upstream source change was needed.

`npm run build` passed. Browser review verified both source options, the Medium
default, mutually exclusive View choices, unchanged prediction, all four images
loaded, Escape dismissal, and keyboard navigation. A sandbox with directional
source and extended view was downloaded, switched to full-circle/rays, and
reloaded: both choices, Medium density and source-1 were restored. The downloaded
JSON was also inspected directly. Existing numerical tests were not repeated for
this UI-only follow-up; no new test infrastructure was added. No commits/pushes.

Top-toolbar layout follow-up: Light Source, View and Ray sampling now share a
sticky, full-width toolbar below the header. Source/lens parameter fields remain
in the sidebar. `npm run build` passed; browser review verified directional
selection, extended view and Sparse sampling together (2 native rays), plus
parameter editing with the toolbar still available while scrolled. This changes
layout only; no numerical tests were added or repeated.

Brightness, opening angle and direction were subsequently moved into the same
sticky top toolbar, retaining their paired sliders and number fields. Source
position and lens fields stay in the sidebar. Build passed; browser review
verified disabled angular controls in full-circle mode, activation in directional
mode, exact numeric edits to all three controls, slider-to-number synchronization
(opening 45 to 46 degrees), and completed simulation updates. This is layout-only.

## Approved publication checkpoint

The user approved the completed interface and requested pushing the project.
Before committing, `npm test` was rerun against the final implementation:
15 passed, 0 failed. `npm run build` also passed. The exact pinned upstream
checkout is clean, and dependency/build/cache/test-output paths remain ignored.
Earlier notes saying no commit/push was made describe those earlier checkpoints.

## Approved plane-mirror milestone - 2026-11-01

Implemented the approved PLANE-MIRROR-PROPOSAL.md in the same workspace, with no
dependency/build-script/lock/pin changes and no upstream source changes. Current
schema/adapter version is 3; native JSON remains version 5. Existing shipped lens
documents changed version fields only. One semantic plane mirror compiles to the
native Mirror class, using centre/tangent/length endpoints and a y flip. Session
revision/cancellation architecture is unchanged.

Executed `npm test`: **24 passed, 0 failed**, comprising the original 15 groups
and 9 mirror/migration/data-authoring groups. `npm run build` passed. New checks:

- Historical v1 migration retains its prior emission/brightness checks, now
  migrating through v2 to v3. A preserved v2 fixture tests full-circle/directional
  emission, exact densities 0.048/0.137891/1, brightness 0.073219, precise inactive
  angles, custom stable IDs, nonmutation, native emission equality, and exact
  save round-trips. Old versions reject mirror model/types before migration;
  malformed adapter versions, optics, scope and unknown fields remain rejected.
- Mirror contract rejects zero/out-of-bounds length, invalid orientation/numbers,
  derived endpoints outside bounds, on/near-line sources including line
  extensions, duplicate IDs, unsupported fields, mixed lens/mirror arrangements
  and multiple mirrors. Precise mirror/source values and IDs round-trip.
- Native endpoint/y-sign checks at 0, 90, +45, -45, +180 and -180 degrees, with
  component array order reversed to verify external ID lookup. Actual native
  exports reload with the same serialized objects, density and brightness,
  without sandbox metadata; native-only import as a sandbox remains rejected.
- Independent fixed image fixtures for vertical, horizontal, +45/-45-degree and
  other-side arrangements. Equal normal distances and geometric midpoint checks;
  image results stay conditional and identical across mirror length, source
  mode/brightness/direction and sampling changes. Mirror results have their own
  kind and omit lens-specific distance/magnification fields.
- Native reflected direction versus independent vector reflection for 4 tangent
  angles, 2 sides, 2 endpoint orders, and 3 distinct interior hits: 48 interactions.
  Check tangential preservation, normal sign reversal, unchanged polarization
  brightness, and backward extensions through the predicted virtual point.
  Tolerances: 1e-9 direction, 1e-7 mm geometry in these ordinary configurations.
- Exact-coordinate native endpoint inclusion, just-outside finite misses and
  parallel misses. During test development, an endpoint expectation based on
  trig-generated vertical geometry encountered native floating-point boundary
  sensitivity. The boundary fixture uses exact native endpoints; production
  geometry/physics was not snapped or patched to force endpoint hits.
- Complete bounded native SingleRay/Mirror/Detector runs at 4 orientations on
  both sides; two detector planes per run. Incident and reflected paths are
  geometrically separated. Reflected crossings lie in the expected 0.01 mm bins,
  |power|=1, no errors/truncation/undefined behavior. Detectors and SingleRay remain
  test-only objects, not supported authored components.
- Instance-local mirror observer delegates once with identical argument identity,
  return value and ray mutations. Actual authored sources tested at all 3 presets,
  in full-circle/directional modes, with counts bounded by emitted samples and
  native processed/brightness diagnostics equal to unobserved runs. Cone-away,
  short-segment zero-hit and narrow one-ray/one-reflection cases are explicit.
- Native processed-limit stopping and depth truncation for mirrors. Session
  invalidation, native errors, stop/truncation and obsolete completions cannot
  publish stale predictions or overwrite reflection counts for a newer revision.
- The previously data-only unequal two-lens fixture remains valid in v3, with
  custom stable IDs and independent expected real image (900,48), magnification 3.
  Its initial data-only authoring/browser/export evidence is in the proposal.

Browser review through the actual application UI:

- Default directional mirror: 9 emitted / 9 reflected at Medium; Sparse 2 / 2,
  Dense 42 / 42. Rays-only and native extended rays visually inspected.
- Full-circle Dense: 500 emitted / 72 reflected in the default arrangement.
  Changing back to Directional defaults to Medium. Brightness clipping at Sparse
  remains independently labelled, with no compensating sampling/intensity change.
- Cone directed away: completed, 9 emitted / 0 reflected, explicit no-sampled-rays
  message, conditional analytical location retained. A 1mm mirror also produced
  zero hits. Moving the source to the other side and pointing it toward the
  mirror gave 9 reflections and the opposite-side image (-200,30).
- Horizontal surface: 3 reflected samples, image (-200,-30), normal distance 30.
  At +45 degrees: 7 reflected samples, image (30,-200). Native rays/extensions
  visually inspected for both, without drawing analytical ray paths.
- Mirror numbers x=12.125, y=-5.25, orientation=45.5 and length=220.75 retained
  exact values. All four sliders exercised using actual slider key events;
  values synchronized with their numeric fields and completed simulations.
  Thumb steps do not quantize precise numbers unless the slider is itself used.
- Invalid length 0 hides old canvas, removes prediction/count, disables save and
  export, and reports the parameter path. Correction restores a valid run.
- Actual sandbox/native downloads with those precise mirror values were read
  back: sandbox equals the expected v3 document exactly, and the native export
  reloads in the pinned core and matches every serialized compiled object.
  After loading other scenes, reopening the downloaded sandbox restored IDs,
  source settings, Medium density, precise mirror values, view and prediction.
- V2 lens save with exact custom density 0.137891 and brightness 0.073219 loaded
  with 68 native samples, the unchanged real image (150,-5), m=-0.5, and no mirror
  controls or reflection statistics. This also verifies the lens UI after mirrors.
- Browser-loaded mirror fixtures with processedRayLimit=1 and maxRayDepth=0 gave
  STOPPED (2 processed, 2 partial reflections) and INCOMPLETE (0 reflections,
  truncated brightness 6.75). Both explicitly mark counts partial and suppress
  predictions. No stale successful image was retained.
- No error-level browser console messages observed. These are interactive
  tool-driven browser checks, not a new automated browser-testing framework.

Remaining limits: one source with one mirror only; native two-sided finite-segment
behavior, finite angular sampling and existing brightness clipping; no observer
visibility or image detection guarantee; on/near-supporting-line sources rejected
within 0.01mm; exact grazing/endpoint intersections remain subject to native
floating-point behavior. No exhaustive numerical grid, broad device matrix,
performance benchmark or optional full upstream suite was run. New mirror sliders
were reviewed with keyboard events; no separate pointer-drag timing benchmark was
added (the unchanged slider helper was previously pointer-drag tested). The
previous upstream-editor icon limitation remains; this milestone's actual mirror
export was checked in the pinned headless core, not rerun in that separate editor.

There are no unresolved focused-test failures. The pinned source, locks and
attribution remain unchanged. No commit or push has been made for this milestone.

### Plane-mirror checkpoint approval

The user subsequently approved checkpointing the completed plane-mirror milestone.
Before committing, `npm test` was rerun: 24 passed, 0 failed; `npm run build`
passed. The pinned upstream checkout is clean. Only authored source, scene data,
tests/legacy fixture and documentation are included; dependencies, build output,
cache and generated test/browser artifacts remain ignored. The inspection-tool
suggestions are outside this checkpoint. Earlier no-commit/push statements record
the approval boundaries at those earlier checkpoints.

## Approved lens / mirror return composition - 2026-11-01

Implemented LENS-MIRROR-PROPOSAL.md on the published plane-mirror baseline
91f742f1970367fdf510b67c37a3e8a93cbb3482. Schema/adapter v4 adds one bounded
source-left / lens / perpendicular-mirror arrangement. Existing component
compilers are unchanged: exactly one lens ID maps to exactly one native lens.
The engine still selects every intersection. There is no production ray-route
enforcement, component duplication, history viewer, new dependency or test runner.
Old scene optical/source/presentation values are unchanged; their version fields
advance to v4. V3 lens/mirror fixtures are retained for strict migration checks.

`npm test`: **30 passed, 0 failed** (24 existing groups and 6 return-layout groups).
`npm run build` passed. Focused new coverage:

- V3 lens and mirror documents validate before exact migration; old v1/v2 tests
  still pass through the complete migration chain. IDs, precise brightness
  0.073219, custom density 0.137891 and inactive angles are preserved without
  input mutation. Historical versions reject return layouts. New scope rejects
  extra/missing components, wrong ordering/separation, mirror y!=0 and oblique
  mirror orientations. Both +90/-90 native endpoint orders are accepted.
- Native exports reload with exactly one lens and the same serialized objects;
  reordered component arrays preserve external stable-ID lookup. Sandbox
  serialization/reload is exact. No path or ID metadata is embedded in native
  objects; prediction path IDs are derived from the accepted document.
- Independent scalar-conjugate fixtures: on-axis source at (-100,0), f=100,
  lens x=0, mirror x=200 returns to (-100,0), m=-1; source (-300,10) returns to
  (-500/3,10/3), m=1/3. Also virtual return (mirror x=80), infinity (x=125), both
  sides of infinity, translated lens/mirror positions and signed focal lengths.
  Conditional prediction remains unchanged across source mode/brightness/direction,
  sampling and finite aperture/length changes.
- Complete native Simulator runs for focal, finite-real, finite-virtual, infinity
  and diverging-lens return, at 3 incident heights each: **15 detector-backed
  runs**. Test-only instance observations verify forward lens -> mirror -> return
  through the identical native lens instance, actual incoming/outgoing direction
  signs, independent slopes and hit heights. Native rays are never routed by the
  observer. Two detector planes beyond the source isolate return crossings in
  0.01mm bins, |power|=1. Ordinary cases use 1e-9 slope / 1e-7mm geometry tolerances;
  complete runs have no errors/truncation/undefined behavior.
- Native finite misses naturally select mirror-only, first-lens-only, and
  lens-then-mirror paths for initial lens, mirror and return-aperture misses.
  Actual full-circle/directional sources exercise all three density presets.
  Cone-away yields no encounters but retains the conditional prediction. Depth
  2 and a segment limit of 1 expose truncation/stopping rather than a successful
  declared path. Investigation endpoint-reversal evidence is recorded in the
  proposal; the implementation also tests both serialized perpendicular angles.
- Analysis status is independent of trace status. A valid extreme scene
  (source x=-9000, f=1, mirror x=9000) triggers the mixed matrix consistency guard
  and still completes native tracing. Explicit unavailable and throwing analysis
  functions are tested through Session's optional predictor argument using the
  existing Node runner: native completion and save/export remain usable. New edits
  clear old reasons; invalid input, native failure, stops/truncation and obsolete
  completions preserve prediction suppression and revision guards.

Actual browser review:

- Both data-only examples loaded and completed. Focal case: 6 emitted / 6
  reflections / 24 processed segments, image (-100,0), m=-1. Finite case:
  6 emitted / 6 reflections / 23 processed segments, conditional image
  (-166.6667,3.333333), m=0.3333333. Aggregate reflection counts explicitly do not
  certify the whole return path. Native rays and extended view visually inspected.
- Mirror y and orientation fields/sliders are disabled only for the mixed layout;
  source, lens, mirror x/length and existing ray controls remain editable.
  Mirror x=125 gives explicit collimated return/infinity; x=80 gives virtual
  return at (11.11111,-5.555556) with negative left-going travel distance.
- Lens aperture=1 gives 13 processed segments and 6 reflections; mirror length=1
  gives 12 segments and 0 reflections. Conditional image wording remains clear
  and unchanged. Invalid mirror x=0 suppresses the prediction/canvas, disables
  save/export and reports the scope error; correcting the draft restores tracing.
- Precise mirror x=200.125, length=400.5, focal length=100.25 and source y=12.5
  synchronize with native simulation and prediction. Sparse (2 emitted/2 reflected)
  versus Dense (28/28) changes native sampling, not the analytical location. Sparse
  brightness scale 0.96 is reported independently of completion/truncation.
- Actual sandbox/native downloads were read back. The sandbox exactly matches
  the expected v4 document, IDs, precise parameters, extended mode and Sparse
  density 0.048. Reopening after other scenes restores them without applying
  the interactive Medium default. The actual native file reloads in the pinned
  core with exactly one source, one lens and one mirror, matching all compiled
  native objects. No semantic metadata or duplicated lens is exported.
- Loaded a numerically unreliable but valid scene (source -9000, f=1, mirror
  9000, 1-degree cone): native COMPLETED, 1 emitted / 2 segments / 0 reflections;
  Analysis unavailable with a reason, no stale image and enabled save/export.
  Export was actually downloaded and reloaded with the same native objects.
- Loaded depth-2 and segment-limit-1 mixed saves: INCOMPLETE (truncation 1.25,
  partial reflection count) and STOPPED respectively; both show Analysis
  suppressed and no old result. Restoring a normal scene recovers analysis.
- Reopened the original single-lens scene: (150,-5), m=-0.5. Reopened the original
  mirror-only scene: (200,30), with arbitrary-position/orientation controls again
  enabled. A v3 mirror save retains custom density 0.137891, brightness 0.073219,
  stable IDs and its original analytical result. No error-level console messages
  observed. These checks use the existing interactive browser workflow, not new
  browser-test infrastructure.

Remaining limitations: the new mixed layout fixes source/lens/mirror ordering and
mirror centre y=0/perpendicular orientation. The analytical result applies only
to the declared lens -> mirror -> same lens path, without proving illumination,
path coverage or image detection. Native finite misses, two-sided reflection,
sampling/clipping and endpoint roundoff remain. The numerical consistency guard
(relative 1e-7 agreement of m=1/D and A+z*C) is conservative, not an exhaustive
conditioning proof. No arbitrary layouts, broad device/performance matrix or full
upstream suite were tested. New mixed UI controls were checked with precise
number edits; the unchanged paired slider helper retains earlier slider/drag
coverage. The separate upstream editor was not reopened for this milestone;
actual native downloads were checked in the pinned headless core.

No unresolved focused-test failures. Upstream pin/source, dependency locks,
build scripts and attribution remain unchanged. Local checkpointing was approved
on 2026-11-02; pushing remains subject to separate approval.

## Image-to-scene authoring workflow

Implemented and reviewed on 2026-11-02 under the approved
[proposal](IMAGE-TO-SCENE-PROPOSAL.md). The explicitly invoked repository
[skill](skills/sim-ro-image-to-scene/SKILL.md) and one Node checker reuse the
current schema-v4 validator, adapter, Session and pinned native Simulator.
No production/schema/engine/build/dependency changes were needed. At evaluation,
the local v4 composition implementation was uncommitted and HEAD was the published
plane-mirror checkpoint `91f742f1970367fdf510b67c37a3e8a93cbb3482`. The generated
execution reports preserve that historical Git/dirty state.

Actual interpretation evaluation:

- A separate-context author inspected all eight PNG/statement pairs: six base
  cases plus a stretched single-lens and a conflicting-distance variant. The
  proposal, SVGs, generator and reviewer answers were excluded by instruction,
  not an OS access boundary. This was a small manual pilot, not a statistically
  blind trial. First-pass outputs were frozen before supplying clarification.
- First pass: **5 resolved, 2 requiring clarification, 1 unsupported**. All
  stated physical quantities, units, component models and signs matched the
  reviewer facts; **zero factual corrections**. The stretched diagram produced
  identical physical data despite different apparent distances. A normal angle
  of +45 degrees became a tangent of -45 degrees, equivalent to +135 degrees.
- The missing-distance case withheld a scene and reserved stable source/lens IDs.
  A planned follow-up supplying d=24 cm produced the sixth resolved scene with
  those IDs retained. The 24-versus-30 cm conflict still has no scene. The prism
  was rejected without substitution, raw-native output or production changes.
- Per-case evidence/assumptions remain in `authoring/<case>/interpretation.md`.
  Dense density=1, relative brightness=0.15 and camera settings were explicitly
  declared authoring choices. They were not interpreted as measured quantities.
  Supported problems explicitly specify isotropic point emission.

Actual optical and checker validation:

- `npm test`: **34 passed, 0 failed** (the previous 30 regressions plus four
  focused checker test groups). Tests cover strict rejection of malformed,
  native-only, old-schema and unsupported inputs; exact round-trips; native run
  limits; unavailable analysis versus successful tracing; native load failure;
  and report-path rejection without modifying destination files.
- The CLI freshly rebuilt the current headless core before checking all six
  resolved outputs. All six passed validation, completed native simulation with
  no errors/truncation/undefined behavior, and passed exact sandbox/native
  serialization round-trips. Analytical availability was reported separately.
  Reports record actual dirty Git state, upstream commit, source/core/input and
  document hashes. A separate clarification run included the follow-up evidence.

| Authored scene | Emitted / processed | Analytical point (mm) | Magnification |
| --- | --- | --- | --- |
| case-01 | 500 / 551 | (120,-6) | -0.5 |
| case-01-stretched | 500 / 551 | (120,-6) | -0.5 |
| case-02 | 500 / 618 | (760,18) | 1.5 |
| case-03 | 500 / 577 | (150,20), virtual | Not a lens quantity |
| case-04 | 500 / 560 | (-40,120), virtual | Not a lens quantity |
| case-05 after clarification | 500 / 551 | (120,0) | -0.5 |

- Independently checked **14 native probe rays** across these six outputs using
  the existing native incident-method testing technique, without modifying the
  authored/exported scenes. Lens outgoing lines match independent conjugate
  points; mirror rays satisfy vector reflection and their backward lines pass
  through the reflected-source point. Maximum positional residual was
  3.56e-14 mm, within 1e-7 mm geometry and 1e-9 slope/direction tolerances.
  This is ray evidence separate from comparison of analytical predictions.
- Loaded all six through the actual browser **Open sandbox** flow and inspected
  values, native rendering, analytical results and completed status. Downloaded
  all six with **Save sandbox**; their parsed JSON exactly equals the authored
  documents, including IDs, parameters, density and inactive emission values.
  Reopening the downloaded two-lens save after another scene restored its values
  and result. No error-level browser console messages were observed.
- The final two-lens preview uses camera zoom 0.6 and horizontal pan to show the
  source, both lenses and finite convergence. These presentation-only changes
  were not silently written into the authored fixture. Native export/reload was
  checked by the checker for every candidate; this pilot did not separately
  repeat the browser export download or open the full upstream editor.

Skill frontmatter and relative links were checked using Node/manual inspection;
no Python skill tooling or global skill installation was used. SHA-256 comparison
confirmed all 15 pre-existing application/public/build-script/pin/manifest/lock
files unchanged during this milestone. The upstream tracked tree remains clean at
`811f508d2b070898c241a568b0c167dcb8645251`. Generated reports, frozen first-pass
copies and previews remain ignored under `test-artifacts/image-to-scene/`;
curated input diagrams and author outputs are reviewable source fixtures.

Remaining limitations: clean synthetic diagrams only, with statements repeating
most labels. No scan/OCR, handwriting, extended-object interpretation, ambiguous
symbol corpus or mixed lens/mirror image-authoring trial was evaluated. Existing
mixed-layout numerical regressions still pass. Native finite segments/sampling
and conditional analytical results do not establish that every emitted ray reaches
an image. The helper certifies bounded execution checks, never interpretation
accuracy. No unresolved focused-test failures, runtime AI or new dependencies.
Local checkpointing was approved on 2026-11-02; pushing remains subject to
separate approval. The pre-checkpoint rerun passed all 34 tests and the browser
build. Git history records the two separate local checkpoints.

## Bounded multi-lens composition candidate — 2026-11-10

This entry records an **implementation candidate**, not a qualified release. The
accepted design and conditions are in `MULTI-LENS-COMPOSITION-PROPOSAL.md`
and `MULTI-LENS-COMPOSITION-REVIEW.md`. Work is confined to branch
`design/bounded-multilens-trains`; `main` and the pinned upstream physics code
remain unchanged pending review.

Implemented changes:
- Current schema-v4 `ideal-thin-lens-geometric` allows one source and 1–4
  coaxial ideal thin lenses, retaining all existing coordinate and parameter
  bounds. Historical schema-v1/v2/v3 validators still limit this family to
  one or two lenses before migration.
- The adapter retains one native object per authored component and the original
  stable-ID/index map. Neither PhyDemo ray tracing nor ray-routing was modified.
- Analytical forward ABCD propagation now checks finite matrix/image values and
  cross-checks `m=1/D` against `m=A+z*C` with a 1e-7 relative tolerance.
  Numerically unreliable finite predictions become unavailable while validated
  scene tracing and export remain available. This heuristic does not certify
  all possible poorly conditioned cases.
- Two scene-only composed examples (`scenes/three-lenses.json` and
  `scenes/four-lenses.json`), a new regression file
  `test/multilens.test.mjs`, updated agent/user authoring instructions, and
  a branch GitHub Actions workflow were added.

Independent **exact rational arithmetic** confirms the intended reference
predictions for the chosen parameter data (not native-run evidence):
- Three lenses at 0/120/260 mm with focal lengths +75/+100/-200 mm,
  source x=-300 mm, y=10 mm: `D=-219/50`,
  `z=-6600/73 mm`, image x=`260-6600/73` mm,
  magnification `-50/219`.
- Four lenses at 0/100/250/400 mm with focal lengths
  +100/-100/+125/+150 mm and the same source:
  `D=1/3`, `z=420 mm`, image x=820 mm, magnification=3.

**Not yet established in this record:** full `npm test`, the native detector
tests, `npm run build`, `check-scene.mjs`, or browser open/edit/save/reload
on the implementation. The tool runtime used to author this candidate has
Node.js 22.16.0 and cannot retrieve the pinned upstream dependencies from
GitHub (network DNS unavailable), so it is not an equivalent test environment.
The included GitHub Actions workflow is intended to run the actual pinned
project setup and these commands after the branch commit. Do not upgrade this
candidate's test status without inspecting the resulting checks and any
failures. An independent implementation review is still required before
merging.

### Candidate CI qualification — GitHub Actions

After correcting the three-lens infinity fixture spacing (second lens x=150 mm),
the branch run [Optical composition checks #2](https://github.com/physicsvigilante/opticsim/actions/runs/42868739598)
at commit `c30eeac81f624a3c102d94c5a0438fe4cdaa7c9b` completed **successfully**:

- Pinned PhyDemo `811f508d2b070898c241a568b0c167dcb8645251`
  cloned and installed under Node.js 24.19.0/npm 11.17.0.
- `npm test`: **41 tests passed, 0 failed**; all older focused tests
  and the seven new multi-lens tests passed, including native detectors,
  incident sequences, aperture misses, historical migration and numerical
  unavailability.
- `npm run build`: local browser production bundle built successfully.
- `check-scene.mjs`: both three- and four-lens authored scenes reported
  `executionPassed: true` with native execution and serialization checks.
  The emitted report is preserved as the workflow artifact.
- The initial CI run had **one erroneous test expectation** for a final
  infinity case: the second lens retained x=120 mm instead of the required
  x=150 mm. That fixture was corrected without changing production optics.
  The earlier failing run is retained in GitHub Actions history.

These results establish **headless native/runtime/build qualification on
the bounded examples**. They do not establish visual browser acceptance,
accuracy of image interpretation from arbitrary diagrams, general mixed
systems, or independent implementation review. Do not merge to `main`
without those applicable review gates and user approval.
### Browser acceptance — actual headless Chrome run, 2026-11-10

**Evidence:** [GitHub Actions run #42873516129](https://github.com/physicsvigilante/opticsim/actions/runs/42873516129) on commit `7174f037fd1f6253deef8d1bce0955ff296e622a`, with browser screenshots, the saved browser sandbox JSON, the independent native-export JSON, and machine-readable `report.json` in the `browser-acceptance-evidence` workflow artifact.

The browser regression at `scripts/browser-acceptance.mjs` uses preinstalled **Google Chrome 156.0.8078.79** in headless mode and built-in Node WebSocket/CDP: no new npm dependencies and no changes to upstream PhyDemo. **8/8 scripted browser checks passed**, together with **42/42 Node tests**, the production Webpack build, and both image-to-scene checker examples.

Observed browser behavior:
- Three- and four-lens presets loaded using the real scene picker; native canvases were painted and all dynamically generated lens controls appeared with unique IDs. Simulations completed without errors. The three-lens screenshot reports 100 emitted / 127 processed segments, conditional virtual image approximately (169.589, -2.283105) mm; the four-lens screenshot reports 100 emitted / 140 processed segments, conditional real image (820, 30) mm.
- In the three-lens scene, editing focal length (100→120 mm), lens position (260→270 mm), and aperture height (180→160 mm) changed the accepted scene; the prediction responded to the focal edit.
- A zero focal length produced an invalid state, disabled saving, and suppressed stale analysis; correcting it restored a completed simulation.
- The extended-ray toggle switched to the native extension view with a nonblank canvas.
- **Save sandbox** initiated an actual browser JSON download retaining authored IDs and edited parameters. After switching to the four-lens preset, **Open sandbox** restored that downloaded file, including the extended view and revised values. **Export PhyDemo JSON** produced native version-5 objects without sandbox IDs/parameters.
- Three full-page screenshots (`three-lenses-rays.png`, `three-lenses-extended.png`, `four-lenses-rays.png`) were captured and inspected. The displayed source, all lenses, ray drawing, generated controls, numeric results, and status labels are legible without observed overlapping controls; the extended view has the expected additional backward constructions. Screenshots are **qualitative UI evidence**, not proof of physical laws.

The browser acceptance requirement for the bounded fixtures is now met **for automated headless Chrome at the captured viewport**. It does not establish a broad device/responsiveness matrix, optical behavior for unsupported layouts, image-to-scene interpretation accuracy on arbitrary diagrams, or a separate-agent implementation review. The extreme numerical-unavailability example has a real load/export check but its simulated-completion callback remains mocked; do not claim a completed native run for that extreme scene. Merge approval remains outstanding.
## Milestone 2 — bounded mixed lens–mirror tracing candidate (2026-11-11)

**Candidate only; not merged to `main`.** This milestone adds current-v4
`physics.model: "mixed-lens-mirror-tracing"` for an authored combination of
exactly one point source, 1–4 existing coaxial ideal thin lenses, and 1–4 finite
plane mirrors with individually authored centre, length, and surface tangent.
It reuses the same component compiler and pinned PhyDemo v5.4.0 core; no optical
engine rewrite, new solver or npm dependencies were introduced.

- The bounded geometry validator rejects overlapping/intersecting finite optical
  segments, coincident lens planes, a source on a lens plane, a source on the
  supporting line of a mirror, and out-of-bounds mirror endpoints. The original
  pure-lens, plane-mirror, and restricted lens/mirror-return models retain their
  previous validators and analytical predictions. Historical schema v1–v3 does
  not admit the new model. Older v4 readers may also reject this additive model.
- The mixed mode intentionally has **no route-independent image prediction**.
  A native completed run does not certify a single image or continuous-ray
  throughput. `Session` retains an unavailable-analysis status with an explicit
  reason, independently of native simulation completion and save/export.
- A native observer is attached to **every** authored mirror by stable ID;
  aggregate and per-ID reflection counts are exposed to browser and headless
  checker diagnostics without replacing the underlying `onRayIncident` law.
- Two data-only examples explore a two-lens/two-rotated-mirror path and a
  right-side directional source with one lens and two mirrors. Their view
  settings and Dense sampling are explicitly presentation/inspection choices,
  not extra physical assumptions about the problem.

**Qualification at commit `7557b5c356972bf3a05916eeb0fb6301cb259003`:**
[GitHub Actions run #42879650662](https://github.com/physicsvigilante/opticsim/actions/runs/42879650662)
successfully executed pinned setup, **50/50 Node tests**, the production
Webpack build, **5/5 headless scene-checker candidates** (three-/four-lens,
extreme lens train, and both new mixed scenes), and **11/11 headless Chrome
browser acceptance checks**. Zero failures were recorded.

Independent native tests for the new family exercise malformed counts,
unsupported intersections, source degeneracies, old-model isolation, strict
save/export round trips, native completion, real stop/truncation and revision
invalidation. A test-only `SingleRay` traversed **lens-1 → lens-2 → mirror-1
→ mirror-2**, in both original and deliberately shuffled authored-array
orders; real native hit locations, incident/output slopes and specular
reflection vectors were compared with independent geometric calculations.
No forced ray route or upstream physics change was made.

The latest headless Chrome screenshots were also inspected qualitatively:
both mixed diagrams now fit their optical elements inside the canvas at the
tested desktop viewport, with distinct native rays and legible controls.
The browser accepts a mirror-angle edit without changing the unavailable
analytical status. The test artifacts retain `report.json`, five screenshots,
saved sandbox JSON, native JSON export and the checker report.

At Dense sampling, the two-lens/two-mirror scene emitted **17 rays** and
processed **85 segments** with **17 native interactions on each mirror**.
The right-side-source scene emitted **14 rays** and processed **56 segments**,
with **14 interactions on mirror-1 and none on mirror-2**. Both simulations
completed with zero native errors, warnings, truncated brightness or undefined
behavior. Reflection counts are samples, not image detections.

**Remaining scope:** one source, 1–4 coaxial lenses, 1–4 mirrors, disjoint
finite optical surfaces, finite sampling and bounded interaction depth. No
arbitrary curved/thick elements, crossing surfaces, general source composition,
symbolic inverse imaging, prescribed rays or verified image formation. Browser
qualification covers an automated Chrome desktop viewport, not a broad device
matrix. The implementer reviewed the code and successful evidence, but this
record does not represent an independent external implementation review.
## Milestone 3 candidate — reusable native ray measurements (2026-11-11)

**Status: implemented and qualified on the feature branch, not merged.**

The current-v4 scene contract accepts **zero to two passive `ray-detector`
components alongside any existing optical model**: one/multiple coaxial lenses,
a plane mirror, the restricted lens–mirror return, or mixed lens–mirror tracing.
Detectors are an independent measurement layer; adding or relocating a detector
does not change the supported optical arrangement or its analytical model. No
new apparatus-specific simulator, ray equation, or external dependency is used.

- The detector has stable `id` and explicit `x, y, orientationDeg, length`
  parameters. Its finite tangent-oriented segment is compiled to an existing
  PhyDemo `Detector`, using the same y-up → y-down conversion as mirrors.
- Model-specific optical cardinality and version 1–3 validation remain strict.
  Detector validation runs separately after the optical model validation:
  at most two detectors, complete bounded segment geometry, no supporting-line
  source degeneracy, and no detector/optical or detector/detector intersections.
- Native `onRayIncident` calls are counted by stable detector ID while
  preserving the original native incident method and its return. The native
  `Detector.power` value is exposed unchanged as `signedPower`, not a
  calibrated watt or irradiance reading. Opposite-direction crossings can
  cancel algebraically, so **zero signed power does not imply zero crossings**.
  No detector readings are authored into sandbox JSON.
- `Session` revision status governs display; current results appear only for
  completed/completed-with-warnings native runs. During invalid, stopped,
  incomplete, or failed runs, the browser withholds current measurements rather
  than showing stale data. The authoring checker distinguishes detector
  `complete`, `incomplete-or-failed`, `unavailable`, and `not-applicable`
  measurement statuses. Its execution pass requires finite readings whenever
  detectors are authored.
- Two mixed and two simple optical examples provide independently authored
  detector configurations. All four previously supported optical families
  retain their original analytical predictions, conditional qualifications,
  native exports, and historical migration semantics.

**Verified CI** at feature commit
`6784de6ec7b50a17d87bc8e5a0b6991580467fd5`:
[GitHub Actions run #42883955139](https://github.com/physicsvigilante/opticsim/actions/runs/42883955139)
**completed successfully**, with pinned PhyDemo v5.4.0, **56/56 Node tests**,
successful production browser build, **9/9 authoritative scene-checker cases**,
and **17/17 headless Google Chrome browser checks**. The CI run retained nine
screenshots, download/export evidence, and the JSON checker report. No changes
were made to the upstream engine or dependency lockfiles.

Native tests verify direct detector intersections, single-ray signed power
magnitudes, independently authored native object ordering, invalid geometry,
round-trip retention of stable IDs, zero-hit readings, and unchanged older
apparatus predictions. The browser covers full-scene editing, invalid-state
suppression, and per-detector results with analytical calculations still active.

Examples from the actual native evidence:

- Mixed two-lens/two-mirror/detector scene: 17 emitted rays, 119 processed
  segments, 17 crossings at `detector-early` with signed native power -8.5,
  and 17 at `detector-return` with signed power +8.5.
- Reverse mixed scene: 28 crossings at `detector-left` with **signed power 0**,
  and zero crossings/power at `detector-away`. Cancellation is explicit.
- Single-lens scene with a downstream detector: 46 crossings, signed native
  power -23, while the existing real-image prediction remains
  (150 mm, -5 mm), magnification -0.5.
- Plane-mirror scene with a detector: 16 crossings, signed native power -1.5,
  with the original conditional virtual-image prediction at (200 mm, 30 mm).

The new screenshots were visually inspected at the CI desktop viewport; the
native rays, finite detector segments, generated controls, values, and
conditional-analysis readouts were visible. Captured screenshots provide
qualitative interface evidence, **not a physics proof**; the native tests
supply separate numerical verification.

**Limits:** at most two finite detectors, no surface intersections, one source,
bounded supported optical apparatus, finite sampled ray data, signed relative
native power only. No continuous field/irradiance integration, spectrum or
polarization measurement, general symbolic solution, image detection, broad
device testing, or general scene graph. A code-focused review and user
approval are required before merging this candidate into `main`.
## Milestone 4 — independent multi-source composition candidate (2026-11-11)

**Status: candidate implementation on `feature/multi-source-composition`, not merged.**
The current-v4 `mixed-lens-mirror-tracing` family admits **1–4 independent
point-source components**, reusing the existing PhyDemo `PointSource` and
`AngleSource`, 1–4 lenses, 1–4 plane mirrors and the current 0–2 optional
passive detectors. Source components retain independent stable IDs, x/y position,
relative brightness and full-circle/directional emission settings. The ray
density, maximum interaction depth and processed-ray limit remain **shared**
simulation settings. The three older analytical optical families continue to
accept **exactly one** source, and prior version migrations stay strict.

The mixed validator checks every source against every lens plane, mirror
supporting line and detector supporting line, and rejects coincident source
locations (less than 0.01 mm separation) and more than four sources. The
existing compiler still creates one native emitter per authored source without
rewriting PhyDemo or imposing ray paths. `observeSourceSet` wraps each native
`onSimulationStart` once through the stable ID map, publishes per-ID emitted
sample counts and original native brightness scales, and sums emitted counts.
It does **not** synthesize a combined brightness scale or claim that detector
readings/reflections belong to specific source IDs. The mixed analytical image
remains explicitly unavailable.

For several sources, the browser provides a **UI-only active source selector**
for the Full-circle/Directional mode; every source has numeric x/y/brightness/
cone/direction fields in a labelled sidebar group. Source selection does not
change the saved document or force a new physics revision. Native diagnostics
are displayed per source only for a completed run. Invalid, stopped or
incomplete runs suppress current emission readouts, as with detectors. The
authoring checker independently checks that every source has an observed
nonnegative integer sample count and that the counts sum to the native total.

**Verified on candidate commit `e260668010d84a128ef115f73b0ba8e9d31968b2`:**
[GitHub Actions #42888983977](https://github.com/physicsvigilante/opticsim/actions/runs/42888983977)
completed successfully using the pinned PhyDemo checkout:
**65/65 Node tests**, production Webpack build, **11/11 authored-scene
checks**, **23/23 headless Chrome checks** and twelve retained screenshots.
Native cases include original and shuffled source/object order, independently
computed source sampling, one-to-four cardinality, earlier-model isolation,
source-plane degeneracies, independent source-mode and brightness edits, native
stop/truncation, browser invalid/recovery, and real Save/Open round trips.

Example actual native results at density 0.2, all without warnings:
- Three-source mixed scene: 13 rays emitted (source-1: 4, source-2: 5,
  source-3: 4), 67 segments processed, 17 total mirror interactions.
  Every source's native brightness scale was 1.
- Four-source scene: 113 emitted (source-1: 4, source-2: 5,
  source-4 full circle: 100, source-3: 4), 219 processed segments,
  27 total mirror interactions. Every scale was 1.
  Both scenes completed with zero native errors, truncation or
  undefined brightness. Existing detectors report only aggregate crossings
  and signed relative native power, **not per-source provenance**.

A separate **real native warning regression** deliberately increases source-1
brightness to 0.5 and source-2 to 0.25 at density 0.2 (source-3 remains 0.18).
PhyDemo completes **with warnings** because clipping ratios differ (0.4, 0.8,
1), and warns that detector readings and colour may be misleading. The
validated scene is not silently altered. This warning is physical/measurement
evidence, not a test failure; users may increase density or explicitly
change relative brightness if comparative detector power is needed.
Previous CI attempts that treated this warning as a clean completion were
left in workflow history; the warning was diagnosed before qualification.

The browser screenshots and saved JSON were inspected qualitatively. All
authored sources and shared optical surfaces appeared at the tested desktop
viewport; the controls remained distinct by ID and numerical emission counts
were visible. The test validates actual renderer behavior, not interpretation
of arbitrary diagrams.

**Limitations:** no general multi-source analytical image, no source-specific
detector power or per-ray provenance, no extended-object semantic primitive,
no intersecting optical components, no source outside the existing 2-D
bounded domain, and no broad device matrix or new optical physics.
This was a focused implementer review plus automated verification, **not
a separate independent reviewer**. The PR remains draft pending explicit
user merge approval.

## Milestone 5 — standalone static browser demo (2026-11-11)

**Status: tested candidate in draft PR #5; not deployed or merged.** Source repo
`physicsvigilante/opticsim` remains private; no outside repository was changed.

The existing pinned PhyDemo v5.4.0 browser build is now distributable as a
**strict, isolated static website** without any runtime Node server. The
`npm run demo:package` command produces ignored
`test-artifacts/demo-site/` containing exactly the browser HTML, stylesheet,
Webpack application bundle, third-party license directory, `.nojekyll`, and
**only the 16 explicitly listed example scene JSONs**. It must not include
the checkout, `vendor/`, `dist/test-core.cjs`, caches, environment files or
other unpublished scenes. All example documents are validated during packaging.

The app's content security policy restricts scripts, styles, images and fetches
to its own origin (plus data-URI images for the original SVG controls).
`?scene=<known-name>` selects bundled examples at root or nested project
paths such as `/opticsim/`. Unknown or path-shaped names revert to a known
single-lens example; the **Share starting example** link includes only a safe
scene slug and strips unrelated query parameters. It never includes locally
loaded files, edited scene values or detector readings. Local Save/Open and
native export remain the mechanism to preserve a changed simulation.

**Confirmed in GitHub Actions CI #42962178637**
(<https://github.com/physicsvigilante/opticsim/actions/runs/42962178637>):
the pinned setup, **67/67 Node tests**, production Webpack build, isolated
static asset package check, **11/11 scene authoring checks**,
**23/23 existing Chrome browser checks** and **5/5 nested-path hosted Chrome
smoke checks** all passed. Existing acceptance preserved 12 screenshots;
the hosted smoke captured a further screenshot and tested real rays from the
four-source example, editing a source brightness, downloading the exact changed
JSON, rejecting arbitrary scene URL values, and all observed HTTP requests
staying within the packaged origin. CI attaches the downloadable
`opticsim-demo-site` artifact, plus hosted-browser acceptance evidence.

A separate GitHub Pages workflow is **manual-only** and guarded by both
`refs/heads/main` and a deliberate `public-site-approved` choice. Its
permissions are scoped to that manual publication job. It has **no push,
pull-request, or scheduled deployment trigger**. Although the GitHub source
repository can remain private, ordinary Pages publication can expose the
compiled JavaScript and bundled scenes publicly; the user must explicitly
approve that visibility and configure GitHub Pages settings before publication.
Private-site access control depends on GitHub Enterprise Cloud configuration.
No Pages site or public URL has been asserted as deployed.

**Limits:** the package is a static host artifact, not a live URL until a
manual deployment succeeds. It includes compiled client-side source and is
intended for public examination if deployed; do not embed secrets. Hosted
acceptance covers local Chrome and a simulated project subpath, not a real
remote CDN/HTTPS delivery, broad devices, server authorization, or access
control. All earlier physics validity and finite-sampling limitations apply.
