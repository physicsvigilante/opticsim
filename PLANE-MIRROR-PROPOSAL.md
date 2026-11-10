# Bounded plane-mirror milestone

Status: approved and implemented on 2026-11-01. The design below records the
approved scope and original investigation; its future-tense implementation items
and unchanged-source statements describe that investigation. See README.md and
VALIDATION.md for current behavior and executed checks. The data-only lens fixture
was subsequently migrated to v3 without optical changes. Implementation approval
excluded Git publication; the user subsequently approved checkpointing this
completed milestone. Future commits and pushes require their own approval.

## 1. Data-only authoring prerequisite: verified

Added `scenes/two-lenses-data-check.json`, schema/adapter v2, with new stable IDs
`source-data`, `lens-a`, `lens-b`. It uses the existing validator, adapter,
analytical calculation, dynamic controls, save loader and native exporter.

| Component | Authored values (mm unless stated) |
| --- | --- |
| Point source | (-240, 16), brightness 0.15, directional 0 degrees, opening 20 degrees |
| Lens a | x=-40, f=80, aperture=200 |
| Lens b | x=240, f=120, aperture=240 |
| Sampling/view | Exact density 0.2, extended rays, grid, view (300,0), zoom 0.5 |

Independent sequential lens equations give first image distance 400/3 from lens a,
second object distance 440/3, final image distance 660 from lens b, and total
magnification 3. The existing matrix calculation reports real image **(900,48)**.

Actual checks, without production-code changes:

- Document validates; sandbox serialization/parsing is exactly equal; ID map is
  source-data -> 0, lens-a -> 1, lens-b -> 2.
- Three native rays launched toward different first-lens heights converge at
  the independent image within 1e-7 mm.
- The authored native directional source completes through the native Simulator:
  **6 emitted rays, 18 processed segments, no warnings/errors/truncation/undefined
  behavior**, brightness scale 1.
- Loaded the new file using the running browser's **Open sandbox**. Both lens
  parameter groups and custom source ID appeared automatically; Medium,
  directional/extended, and analytical (900,48), 3x were correct.
- Downloaded sandbox and native exports. The downloaded sandbox equals the
  authored document exactly. The native export reloads through the pinned core
  and matches all serialized native objects. Switched to the original single
  lens, then reopened the downloaded sandbox: values, IDs, source controls and
  results were restored. No error-level browser console messages observed.

Open the new JSON with **Open sandbox** to inspect it. The built-in scene menu
is an explicit list in `public/index.html`; adding a menu entry would be a UI
change, but authoring/loading a new valid arrangement does not require one.

Reproduction from this workspace in PowerShell:

```powershell
npm test
npm start
# In http://127.0.0.1:4173, Open sandbox -> scenes\two-lenses-data-check.json
```

All **15 existing tests pass** in this investigation. One-off probe scripts,
download copies and a browser screenshot are ignored under `test-artifacts/`;
they are evidence, not a new validation framework or permanent production path.
The current preview was restarted to perform this browser check.

## 2. Pinned native implementation findings

Verified `vendor/ray-optics` HEAD is exactly
`811f508d2b070898c241a568b0c167dcb8645251` (v5.4.0), with a clean tracked working
tree. Existing dependency locks, licenses and notices stay unchanged.

| Inspected source | Finding |
| --- | --- |
| `vendor/ray-optics/src/core/sceneObjs/mirror/Mirror.js` | Native type `Mirror`, finite endpoints `p1`/`p2`. `checkRayIntersects()` delegates to the filter and segment intersection. `onRayIncident()` mutates the incident ray's position and direction to reflect it. It does not attenuate the two polarization brightness fields. |
| `vendor/ray-optics/src/core/sceneObjs/LineObjMixin.js` | `checkRayIntersectsShape()` requires intersection on the finite segment and forward ray. A miss continues through empty space. |
| `vendor/ray-optics/src/core/sceneObjs/BaseFilter.js` | Optional wavelength filtering exists upstream. Keep `filter:false` and existing `simulateColors:false`; do not expose dichroism/wavelength controls. |
| `vendor/ray-optics/src/core/geometry.js` | Segment tests include endpoints. Parallel/collinear lines have no accepted finite intersection. Preserve native boundary behavior. |
| `vendor/ray-optics/src/core/Simulator.js` | Native minimum segment length is 1e-6 at lengthScale=1, excluding zero-length self-hits. Existing depth/processed limits and completion diagnostics apply. Extended mode already draws backward extensions after optical interaction, without initial trivial source extensions. |
| `vendor/ray-optics/test/sceneObjs/mirror/Mirror.test.js`, `test/scenes/mirror/Mirror/` | Existing interaction/property tests and detector/image fixtures are available upstream. They do not replace independent reflection-law checks. The full optional upstream suite was not run. |

There is no reflecting-side test or back coating in this native Mirror class:
**it reflects from both sides**. Reversing endpoints does not select a different
reflecting face. Use this behavior explicitly; no absorbing backing, one-sided
mode, reflectivity control, diffraction or endpoint special treatment is proposed.

A one-off read-only probe through the existing built core loaded native Mirrors
directly via Scene's registry, without teaching the sandbox contract about them:

- Reflection direction and virtual-image backward-line geometry passed 16 cases:
  tangent angles 0, 30, 90, -45 degrees, both source sides, both endpoint orders.
  Direction tolerance 1e-9, positional tolerance 1e-7 mm; brightness unchanged.
- Finite-segment misses, endpoint inclusion, and parallel/collinear misses checked.
- One complete native SingleRay -> Mirror -> Detector run observed the reflected
  crossing in the expected 0.01 mm bin, power 1, with no errors/truncation/undefined
  behavior. Incident and reflected detector paths were separated geometrically.

These establish feasibility. They are not browser validation of an implemented
mirror sandbox, nor exhaustive grazing/endpoint/numerical conditioning coverage.

## 3. Approved scope requested

Keep two explicit supported arrangements:

1. Existing lens bench: one semantic point source and one or two coaxial ideal
   lenses, with its current source-left/order/separation rules unchanged.
2. Plane-mirror arrangement: exactly one semantic point source and one finite
   plane mirror, no lenses. Source may be on either side and at any supported x/y.

Retain existing full-circle/directional emission, exact brightness and density,
Sparse/Medium/Dense/Custom display, native sampling, top source toolbar, rays and
extended rays, run guards, sandbox saves and independent native exports.

No mixed lens/mirror arrangements, multiple mirrors, curved mirrors, prisms,
additional sources, generic scene graph, source framework, observer/image-detection
mode, native physical dragging, or changes to upstream physics. No new packages,
build tools or validation infrastructure are needed.

## 4. Smallest document and scope changes

Bump sandbox schemaVersion and adapterVersion to **3**; keep native JSON version
5 and the upstream pin unchanged. Add one semantic component:

```json
{
  "id": "mirror-1",
  "type": "plane-mirror",
  "parameters": {
    "x": 0,
    "y": 0,
    "orientationDeg": 90,
    "length": 200
  }
}
```

Position is the segment centre in mm. Orientation is the **surface tangent**,
counterclockwise from +x in sandbox x-right/y-up coordinates: 0 degrees horizontal,
90 vertical, +45 rises to the right. It is not the surface-normal angle or the
source direction. Accept [-180,180] and preserve exact authored values; angles
180 degrees apart describe the same two-sided surface without silently rewriting
saves or IDs. Length is positive physical segment length.

Reuse `physics.model` as the explicit discriminator; do not add another redundant
arrangement field:

- `ideal-thin-lens-geometric`: unchanged lens model and scope policy.
- `plane-mirror-geometric`: new mirror model and scope policy.

Component schema validation describes fields and types; model-specific scope
validation enforces the currently supported combinations. Reject mixed/mismatched
models, extra components, unknown fields and unsupported versions explicitly.
Do not pretend a mirror is a lens with infinite focal length or run it through
the lens transfer matrix.

Proposed mirror bounds: centre x/y in [-10000,10000] mm, length [1,10000] mm,
orientation [-180,180] degrees, with derived endpoints also within the existing
coordinate bounds. Require source perpendicular distance from the mirror's
supporting line >=0.01 mm. This is an explicit milestone domain restriction,
including a source on the line's extension, to exclude on-line/grazing-source
degeneracy; it is not new native physics. Rays parallel to the segment remain
ordinary native misses. Positive finite length and finite numbers are mandatory.

Keep v1/v2 validation faithful to those historical schemas: they must not start
accepting mirrors simply because v3 supports them. Strictly validate v1, perform
the existing exact v1 -> v2 migration, then validate v2 before the v2 -> v3 version
update. V2 lens documents retain their existing model and every value/ID,
including precise brightness, custom density, inactive emission settings, view
and simulation limits. Loading never applies the interactive Directional default.
Current exports use v3; old native-only JSON remains rejected as a sandbox save.

## 5. Adapter and analytics

For centre C=(x,y), tangent t=(cos(theta),sin(theta)), length L, derive sandbox
endpoints A=C-L*t/2 and B=C+L*t/2. Compile to native
`{type:'Mirror',p1:{x:A.x,y:-A.y},p2:{x:B.x,y:-B.y},filter:false}`.
Test the y flip at horizontal, vertical and oblique orientations, including
negative angles. Retain the semantic ID externally in the existing ID map.
Never store native class names, endpoint duplicates, or derived results in the
authored component. Native export continues through Scene serialization.

Make `predict(doc)` dispatch explicitly on the two supported `physics.model`
values. Keep the existing lens calculation and result shapes intact, with the
current lens helper used only in that branch. Add one small plane-mirror
analytical calculation, not a general solver or tracing routine:

- Unit normal n=(-sin(theta),cos(theta)); source S; signed line distance
  d=(S-C) dot n.
- Analytical virtual point **I=S-2*d*n**. Source and image have equal positive
  normal distance |d| on opposite sides of the supporting line.
- Return a distinct result kind, e.g. `plane-mirror-virtual`, with x/y and normal
  distance. Do not attach the lens-specific axial image distance or transverse
  magnification fields to this point-source result. There is no mirror infinity
  case in this bounded off-line source domain; existing lens infinity remains.

This prediction belongs to the ideal supporting line and applies to rays that
actually strike the finite segment. Segment length, emission cone, sampling and
brightness do not change that ideal image point. They can leave few or no sampled
reflections. The image is a conditional analytical location, not a detector result,
not light propagating behind the mirror, and not a claim of visibility to an
unspecified observer. Missed rays are neither reflected nor artificially blocked.

Report actual native reflection interactions with a minimal instance-local
observer around the mirror's `onRayIncident`, following the existing source
emission observer: delegate once, pass unchanged arguments and preserve its
return value and ray mutations. Count calls only, never infer hits by tracing or
by counting intersection queries. With one straight mirror these count reflected
source rays. Add the optional count to diagnostics; keep it null/pending until a
run reports, reset per revision, and mark stopped/incomplete counts as partial.

Completed runs with zero reflections should say **No sampled rays reflected**;
one reflection should not imply a simulated image was established. The conditional
analytical location can still be displayed with this qualification. A completed
run is never evidence that the continuous cone was fully sampled. Existing
invalid/stopped/truncated/failed suppression and stale-callback guards stay in
force. Native brightness clipping remains separate from completion and hit counts.

## 6. Controls and browser behavior

Reuse the existing slider + editable-number helper for mirror centre x/y,
orientation and length, with explicit mm/degree labels and the tangent convention.
Use the contract bounds for position/length sliders, steps 1 mm and 1 degree;
numeric inputs accept finer precision without quantization. Keep the current
75 ms throttling/release flush and authoritative document update path. Mirror
controls sit in the component sidebar; current source/view/sampling controls
remain on top. No native editor dependency or physical object dragging.

Make the header, parameter guidance, undersampling message and analytical panel
arrangement-aware. A mirror result says **Analytical virtual-image prediction**,
shows (x,y) and equal normal distances, and explains finite segments/two-sided
reflection. Native extended rays remain the only drawn backward ray extensions;
no custom analytical ray or image overlay is needed in this milestone.

Add one mirror scene to the existing example menu (e.g. source (-200,30), centre
(0,0), orientation 90, length 200, directional 0/opening 30, Medium). Expected
analytical image is (200,30), normal distance 200. Additional horizontal/oblique,
other-side and cone-away checks can change scene data/controls, without
example-specific production branches. Keep the existing camera controls; saved
view x/y already support centring this example. Auto-fit/new navigation is outside
this proposal.

## 7. Source-impact assessment

| File/area | Bounded implementation impact after approval |
| --- | --- |
| `src/contract.js` | V3 component/model validation and explicit per-model scope rules; strict v1/v2 migration chain. Keep source policy and exact-value preservation. Confine source-left/lens sorting assumptions to lens scope. |
| `src/adapter.js` | Add plane-mirror compiler; optional native mirror interaction observer/diagnostic count. Existing Scene/Simulator, ID map and source compilation remain. |
| `src/analysis.js` | Two-way model dispatch; retain lens calculation; add independent reflected-source formula and distinct result kind. |
| `src/session.js` | No architectural change expected. Existing revision/cancel/result gating is model-independent; verify mirror regressions through it. |
| `src/app.js` | Reuse paired controls for the four mirror parameters; explicit result rendering for mirror versus existing lens cases; arrangement-aware text and reflection count. Replace current blanket millimetre labels for orientation. |
| `public/index.html` / `public/style.css` | Add mirror example entry and model-aware guidance hooks. At most small existing-control styling adjustments; no visual redesign. |
| `scenes/*.json` | Add mirror v3 example; update shipped lens versions to v3 without changing their authored optical/source values. Preserve historical test fixtures for migration. The data-only check scene is already authored in this investigation. |
| `test/mirrors.test.mjs` and existing tests | Use current Node built-in runner/headless bundle; native Mirror is already accessible through Scene's registry, so no new test entry export is necessary. Adjust schema-version assertions and retain old fixtures. |
| `README.md`, `VALIDATION.md`, `AGENTS.md` | Record approved new scope, conventions, migration and actual validation results/limitations after implementation. |
| Upstream, pin/locks/build/dependencies/licenses | No changes expected or authorized. Keep existing attribution distribution. |

## 8. Focused acceptance checks after approval

1. **Contract/migration:** v1/v2 saves migrate exactly; IDs and native behavior
   survive; v3 mirror save/reload preserves precise centre/orientation/length and
   source settings. Reject zero length, invalid numbers/angles/endpoints,
   source-on-line/near-line, mixed lens/mirror and extra components.
2. **Adapter/native export:** expected endpoints/y sign at 0, 90, +45/-45;
   endpoint-order invariance for the two-sided physics; stable external ID map;
   native version-5 export reloads as Mirror without semantic metadata.
3. **Independent reflection and image:** normalize native outgoing direction and
   compare with v-2*(v dot n)*n (not vector magnitude, which upstream does not
   normalize), preserving tangential component and reversing normal component.
   Cover normal/oblique incidence, both sides and reversed endpoints. Multiple
   interior hit points have backward extensions through I; equal normal distances
   and exact horizontal/vertical/oblique image fixtures provide independent
   checks. Target 1e-9 direction and 1e-7 mm positional tolerances in ordinary cases.
4. **Finite/native run:** interior hit, endpoint and just-outside miss, parallel
   miss and cone away. A few complete SingleRay/Detector fixtures measure outgoing
   crossings at two planes with existing 0.01 mm bins; separate incident and
   reflected paths. Exercise the actual authored directional/full-circle sources
   and native interaction counter, including zero/few reflections. Detectors and
   SingleRay remain test fixtures, not supported authored types.
5. **State/regression:** rerun the existing lens/source suite, preserving real,
   virtual/infinite images, exact densities, angle signs and old migrations.
   Mirror invalid edits, depth/processed limits and obsolete callbacks suppress
   stale results/counts. Observer delegation does not modify physics or sampling.
6. **Short browser review:** mirror position/orientation/length sliders and precise
   fields update together; compare both sides, horizontal/oblique rotations,
   long/short segments, sparse/dense, full-circle/directional/cone-away, rays versus
   extended. Verify qualified zero-reflection/image text, invalid edit recovery,
   sandbox download/reload and actual native export. Reopen one existing lens
   case to confirm its UI/results. Inspect console errors and screenshot the
   final state; do not infer numerical correctness from the picture.

No exhaustive parameter grid, broad device matrix, new browser automation suite,
performance project, diffraction/material model, or general optical solver is
part of acceptance. Report numerical failures or native edge behavior explicitly.

Approval requested: implement only this v3 plane-mirror extension and focused
validation in this workspace, retaining the pinned engine unchanged. Commit and
push remain separate approval gates.
