# Bounded lens / plane-mirror return milestone

Status: approved and implemented, 2026-11-01, from published baseline
`91f742f1970367fdf510b67c37a3e8a93cbb3482`. The design/investigation below records
the approved scope; future-tense and unchanged-source statements describe that
investigation. See README.md and VALIDATION.md for current behavior and executed
checks. Local checkpointing was approved on 2026-11-02; pushing remains subject
to separate approval.

## Supported composition

Add one explicit arrangement model, `lens-mirror-return-geometric`: exactly one
existing semantic point source, one ideal thin lens, and one plane mirror. The
source is left of the lens; the mirror is right of it. All planes need >=0.01 mm
separation. The lens stays centred on y=0; initially keep the mirror centred on
y=0 and perpendicular to the x axis (surface orientation +90 or -90 degrees).
Allow the source's existing off-axis y, both signed focal lengths, finite lens
aperture and finite mirror length within current bounds. Other mirror positions
or orientations remain supported only in the existing mirror-only arrangement.

Keep existing component schemas, source controls, sampling, views, limits and
document/adapter workflow. One lens ID compiles to one native IdealLens instance
encountered again on return. The model declares the analytical path; PhyDemo
chooses every actual intersection. No cloned lens, route enforcement or animation.

Bump schemaVersion/adapterVersion to 4. Strict v1 -> v2 -> v3 -> v4 migration:
validate each historical schema before migration. V3 -> v4 changes version fields
only, preserving all IDs, optical/source values, exact density/brightness, inactive
angles, presentation and run limits. V3 must continue rejecting mixed scenes.
Use native JSON version 5 and unchanged pinned v5.4.0 commit
`811f508d2b070898c241a568b0c167dcb8645251`.

## Native feasibility: checked

Inspected pinned `IdealLens.js:148-181`, `Mirror.js:84-105`, and
`Simulator.js:674-727, 933-975`. IdealLens selects near/far focal planes from the
incident side and handles right-to-left incidence. Mirror reflects the native
direction; Simulator searches all optical objects for the nearest forward
intersection after every encounter and excludes zero-length self-hits. Nothing
requires replacing either object, prescribing a sequence, or modifying physics.

Ignored `test-artifacts/lens-mirror-investigation.mjs` probes used real Simulator
runs. Temporary instance observers recorded incidents without changing native
arguments/returns or enforcing a route.

- Five cases (focal return, finite real, virtual, infinity, and diverging lens),
  three launch heights and both mirror endpoint orders: **30 complete native
  runs**. Each recorded lens-stable -> mirror-stable -> lens-stable, using the
  very same lens instance. Forward/return slopes agree with independent thin-lens
  propagation within 1e-9; image geometry within 1e-7 mm. Two detector planes per
  run, beyond the source, measured outgoing crossings in 0.01 mm bins, with
  |power|=1 and no errors/truncation/undefined behavior.
- Native finite misses selected different routes: initial-lens miss -> mirror
  only; mirror miss -> first lens only; return-aperture miss -> lens then mirror.
  A depth limit of 2 truncates the attempted third optical interaction explicitly.
- Real native directional and full-circle point sources also completed the
  declared path (3 and 25 samples respectively in the focal-return probe at
  density 0.2). These counts are fixture-specific, not a coverage guarantee.
  Native exports reload with identical serialized objects and only one lens.
- All **24 existing tests pass** on the published baseline; pinned upstream HEAD
  and tracked working tree are unchanged. No browser review of a mixed sandbox
  was performed because the current authoring contract intentionally rejects it.

## Conditional analysis, separate availability

Use one small arrangement-specific calculation. In an unfolded coordinate that
increases along the declared propagation direction, let s=xLens-xSource,
g=xMirror-xLens, T(d)=[[1,d],[0,1]], L(f)=[[1,0],[-1/f,1]]. The perpendicular
plane mirror leaves height and slope relative to the new travel direction
unchanged, so the source-to-return-lens matrix is:

`M = L(f) T(g) T(g) L(f) T(s) = [[A,B],[C,D]]`.

For finite D, return travel distance z=-B/D, physical x=xLens-z,
m=A+z*C (=1/D), and image y=m*ySource. Positive z is real on the left-going
return branch; negative z is virtual to its right. Keep y-up fixed through the
reflection; do not accidentally flip the transverse axis. For D near zero, use
the documented scaled infinity tolerance and report collimated return output
without finite position/magnification. Intermediate collimation is handled by
the matrix, without dividing by a first image distance.

Mandatory examples, with lens x=0, f=100 mm and mirror x=200 mm:

| Source (mm) | Independent expectation for declared path |
| --- | --- |
| (-100,0) | First pass collimates; normal reflection returns through the lens to (-100,0). m=-1; the on-axis position is unchanged. |
| (-300,10) | First image distance 150, m1=-1/2. Reflected effective return object distance 2g-150=250; return image distance 500/3, m2=-2/3. Final (-500/3,10/3), total m=1/3. |

The probes independently cross-checked matrix results against these scalar
conjugates and direct outgoing native rays/detectors. Include virtual and final
infinity regressions too (source (-300,10), f=100, mirror x=80 and x=125).

Label the result **analytical prediction for lens-ID -> mirror-ID -> same
lens-ID**, with left-going return classification. It applies only to rays hitting
all three finite segments in that order. Cone/aperture/sampling changes can
eliminate those paths without changing the conditional formula. Completion,
reflection counts and extensions cannot establish image detection or path coverage;
some rays miss the first lens yet hit the mirror or lens on return.

`Session.apply()` currently couples native preparation and prediction in one try
block. Split them: invalid documents/native-load failures still block tracing;
analytical unavailability or errors get a separate status/reason while a valid
native run and save/export remain usable. Retain nullable `prediction` plus a
small analysis status/reason. Explicit model dispatch must never fall back to the
lens-only answer for mixed scenes. Nonfinite/unreliable evaluation returns
unavailable; unexpected analysis errors are distinct from native errors. Infinity
remains an available result. This failure boundary does not admit arbitrary layouts.

Revision guards clear old values/reasons on every edit. Invalid, stopped,
truncated, failed or undefined native runs still suppress predictions. Missing
the declared path is neither a measured image nor a native error. Test analysis
failure with a valid trace using the existing Node runner.

## Smallest source impact

| Area | Proposed change after approval |
| --- | --- |
| `src/contract.js` | V4 model and one explicit mixed-scope validator; freeze v1-v3 validation/migration. Existing parameter schemas and bounds retained. |
| `src/adapter.js` | Existing per-component compilers already suffice after validation accepts the layout. Preserve one ID map entry/native instance per component. No prescribed path or second lens; existing mirror/source diagnostics can remain. |
| `src/analysis.js` | Explicit model dispatch and the one return-path matrix/result; unavailable/numerical-failure reason where appropriate. Preserve lens-only and mirror-only results. |
| `src/session.js` | Separate analytical availability from valid native preparation and run status, preserving cancellation/revision suppression. |
| `src/app.js`, `public/index.html` | Reuse existing controls. Mixed layout fixes mirror y=0 and perpendicular orientation as read-only with clear guidance; x/length, source and lens controls remain editable. Add path-specific analytical wording and the two examples. Remove two-way model assumptions from header/notes only. No ray-history UI or visual redesign. |
| Scenes/tests/docs | Two data-only mixed examples; shipped docs v4 with unchanged physical values; preserved v3 lens/mirror fixtures and focused regressions in the current test runner. Update README/AGENTS/VALIDATION after implementation. |
| Upstream/dependencies/build | No changes needed or authorized. Retain locks, pin and attribution. |

## Acceptance and concrete blockers

Application blockers to change: the v3 whitelist/scope rejects mixed components;
the analysis fallback assumes a pure lens bench; Session currently conflates
analysis failure with invalid tracing; UI wording uses only lens/mirror-only
branches. **No pinned-engine blocker was found in the executed cases.** Broad
conditioning/grazing cases are not certified; report numerical failures without
patching upstream. The default depth 8 accommodates three optical encounters;
saved lower limits remain legal and must expose incomplete runs.

After approval, focused checks will cover both lens directions and the reflection
on the same instance; independent focal/finite/virtual/infinite results; initial,
mirror and return-aperture misses; actual source modes/densities; native limits;
analytical unavailability with a valid trace; obsolete callbacks; strict exact
v1-v3 migration and native export with one lens. Reuse existing native detectors
and temporary test observers; no production per-ray history is needed. Short
browser review: both examples, parameter edits/misses, rays/extended modes,
actual sandbox save/reload/native download, unavailable/partial result messaging,
and reopening existing lens-only/mirror-only scenes. Old regressions must pass.

Approval requested for this bounded implementation and validation only. Curved
mirrors, prisms, arbitrary mixed layouts, a scene graph, a general solver and the
previously suggested inspection tools are outside scope. Commit/push remain
separate approval gates.
