# Ray Optics 2D

A standalone-browser-capable optical bench powered by PhyDemo Ray Optics Simulation **v5.4.0**,
pinned to **811f508d2b070898c241a568b0c167dcb8645251**. Browser runtime resources
are local. No LLM request is needed to open, simulate, or edit supported scenes.

## Finite opaque blockers — native absorbed-ray measurements

General component scenes now accept up to two explicit finite `line-blocker` elements, using native PhyDemo `Blocker` absorption. Each blocker has an authored center, surface orientation and length, and can compose with supported general sources, lenses, plane mirrors and passive detectors. `blocker-absorptions` counts actual sampled hits, not continuous shadow or invisibility. See [finite opaque blocker scope](docs/OPAQUE-LINE-BLOCKER.md) and [the synthetic source–blocker–detector example](examples/blocker-detector.json). The static viewer has a `blocker-detector` example; no JEE disc geometry is inferred.

## Convex four-vertex dielectric — native finite glass

The same LLM-authorable Opticsim contract can now specify **one stationary
strictly convex four-vertex glass region** with four explicit physical
vertices, inside/outside refractive indices and a required Fresnel policy.
It compiles to pinned native PhyDemo `Glass`, with 1–4 exactly directed rays
and up to two external passive detectors; v9 is deliberately isolated from
earlier scene schemas. Existing per-interface and per-face native observations,
qualified editing and exports, immutable sweeps, and the main viewer are reused.
See [polygon-dielectric geometry and constraints](docs/POLYGON-DIELECTRIC.md),
the [synthetic problem request](examples/polygon-dielectric.json), and the
`polygon-dielectric` viewer example. This is 2D software validation, not a
claim that an original JEE square-glass question was solved.

## JEE Optical Systems Atlas — capability discovery, not problem solving

The [Optical Systems Atlas](evaluation/optical-systems-atlas-v1/README.md)
indexes all 114 *Problems* images in the pinned eight-chapter Ray Optics
archive, visually reviews 40 preselected examples and ranks reusable optical
objects/compositions that Opticsim does not yet expose. It does **not** read
Solutions, rerun sealed authoring studies, score textbook answers, or modify
native physics. Candidate systems include bounded polygonal glass and opaque
screens. Beam sources for refractive systems remain deferred by the owner.

## Private independent-model authoring assessment (manual only)

A separately reviewable, **local-only** held-out protocol is available at
[evaluation/heldout-authoring-v1](evaluation/heldout-authoring-v1/README.md).
Its question text, reference and model key must stay in ignored local files,
and external transfer requires an explicit opt-in. It reuses the existing
preflight and native execution layer. Neither normal CI nor repository setup
sends text or runs a live external LLM; mock tests are not model accuracy scores.

## LLM authoring without unnecessary physics choices

For an existing `opticsim-problem-v1` request, `node scripts/preflight-problem.mjs my-problem.json` checks complete physical facts and requested results **without a native run**. The dispatcher now binds omitted measurement `componentId` values only when the validated scene contains exactly one compatible authored component; multiple matches require an explicit ID. The original input bytes and binding decision are preserved. See [LLM authoring preflight](docs/LLM-AUTHORING-PREFLIGHT.md). This is not an image interpreter, new optical physics or an independent LLM score.

## Windows PowerShell

Verified toolchain: Node.js **24.19.0**, npm **11.17.0**, Git **2.43.0.windows.1**.
Node and Git must already be installed. No Python, Conda, or global npm packages
are used. From a fresh project checkout:

```powershell
Set-Location 'C:\Users\samee\Documents\sim_ro'
npm run setup
npm run build
npm start
```

Open **http://127.0.0.1:4173/**. Keep the server terminal open; Ctrl+C stops it.
To use another port: `$env:PORT = '4175'` before `npm start`.

Run focused tests in a separate PowerShell terminal:

```powershell
Set-Location 'C:\Users\samee\Documents\sim_ro'
npm test
```

After editing application source, run `npm run build` and reload the browser.
`npm start` serves the existing build; it does not rebuild it.

## Standalone browser demo (Milestone 5)

The same production application can be packaged as a **self-contained static
website** with no installation required **for visitors**. All ray tracing and
example/parameter operations occur in the visitor's browser; there is no backend
or remote simulation API. The built site works from a nested URL such as
`/opticsim/?scene=multi-source-four`, and its **Share starting example** link
shares a known example only (not edited physical values or uploaded files).
Saving and reopening an edited scene still uses local sandbox JSON files.

To generate the static hosting directory after `npm run setup`:

```powershell
npm run demo:package
```

The tested site is isolated in `test-artifacts/demo-site/` and includes the
bundle, bundled scenes and original license notices, **not** the repository,
vendor checkout, Node test core or caches. GitHub Actions CI also attaches
the ready-to-host `opticsim-demo-site` artifact and tests the site under a
nested project URL with headless Chrome. A new **manual-only GitHub Pages**
workflow can deploy it after separate explicit permission to publish a public
site. **No public demo URL has been deployed by this change** and the repository
is not made public. A private GitHub repository does not automatically make its
Pages site private. The publication steps, hosting requirements and limitations
are in [docs/DEMO-DEPLOYMENT.md](docs/DEMO-DEPLOYMENT.md).

Setup obtains an unmodified checkout at `vendor/ray-optics`, verifies the exact
commit and tracked source, and runs `npm ci --omit=optional` using `.npm-cache`.
Its Git HTTPS transport adjustment is scoped to that child process. A mismatched
existing checkout fails explicitly rather than being reset. The upstream
`package-lock.json` stays unchanged. The root package has no dependencies and
uses upstream's locked Webpack installation. Root `package-lock.json` is tracked.
No full site/gallery build or native node-canvas installation is required.

## Using the bench

- Choose a one-, two-, three-, or four-lens, converging-plus-diverging, plane-mirror,
  lens/mirror return, or mixed lens/mirror tracing example. Ray-detector
  examples demonstrate native measurement segments in lens-only, mirror-only
  and mixed scenes, without changing the existing optical apparatus models.
  The `multi-source-mixed.json` and `multi-source-four.json` examples show
  independent emitters sharing one native optical system. Examples use JSON
  data through the same pipeline.
  `scenes/two-lenses-data-check.json` is another unequal-lens arrangement to load
  with Open sandbox; it was verified without production-code changes.
  Three-/four-lens examples are data-only; the same parameter controls apply.
  New optical components must still be added to the library.
- Edit source position, lens position, signed focal length, or aperture height.
  Positive f converges; negative f diverges. Lenses are centred on y=0.
- The mixed-tracing model supports **1–4 independent point sources**, each
  with its own stable ID, position, brightness and full-circle/directional
  emission settings. Every source is compiled into one unmodified native
  PhyDemo emitter; the optical surfaces are shared. The toolbar selects
  **which source's emission mode to edit**, while each source's numerical
  parameters remain in its labelled sidebar fieldset. This selector does not
  change the saved physical document or rerun the simulation. It does not
  invent separate detector measurements by source.
- The semantic point source supports Full-circle or Directional emission.
  Choose it in the illustrated **Light Source** menu in the top ray toolbar, following PhyDemo's
  source-tool dropdown style. The selected entry is marked with a check.
  Selecting Directional starts with Medium sampling; loading a saved directional
  scene preserves its explicit density. Opening angle is the full symmetric cone
  (1-180 degrees). Direction is -180 to 180 degrees, counterclockwise from +x:
  0 right, +90 up, -90 down. In Full-circle mode the angle/direction are inactive
  but retained for the next mode switch.
- Opening angle, direction and relative source brightness have paired sliders
  and precise editable numbers, following PhyDemo's basic interaction style.
  Slider steps are 1 degree / 0.01 brightness; numeric fields retain finer values
  without quantization. Continuous input simulates at most once per 75 ms; release
  commits the latest slider value. Source brightness is 0.01-1 in upstream-relative
  units, not watts. Native low-density clipping is reported separately.
- Ray density, depth and processed-segment limits apply to the **entire scene**,
  not separately per source. Native emissions are counted per stable source
  ID and summed into the scene's total. A multi-source scene displays the
  individual actual emitted counts and native relative brightness scaling;
  source-specific detector power, images and ray path attribution are not
  inferred. Stopped/invalid/incomplete runs do not publish completed
  per-source emission results. When brightness exceeds the scene's sampling
  density, PhyDemo may clip it; differing clipping ratios across sources
  trigger an **explicit native warning** that detector power or colour can
  be misleading. The validator preserves valid source brightness rather than
  silently changing physical parameters. Increase sampling or adjust explicitly
  authored brightness if accurate comparative power is important. The prior single-source mode change to
  Directional still selects Medium sampling for the entire scene.
- Sampling is separate from source characteristics and camera settings. Sparse,
  Medium and Dense correspond to densities 0.048, 0.2 and 1: respectively 24, 100
  and 500 full-circle samples. A 30-degree directional cone emits 2, 9 and 42 rays;
  narrower cones may have only one ray. The UI reports the actual native count,
  without adding rays, and warns for fewer than three. Native boundary sampling
  need not include the centre or both cone edges.
- Use grid, zoom, and horizontal pan for the view.
  The **View** control uses adjacent illustrated Rays / Extended rays buttons,
  following PhyDemo's view-mode toolbar. Both controls use the existing document
  update path; their pictures are upstream UI illustrations, not simulated rays.
  Physical dragging and native object editing are disabled in the managed sandbox.
  Light Source, View, Ray sampling, brightness, opening angle and direction share
  a sticky toolbar above the scene. Position, lens and mirror parameters remain in the sidebar.
- The plane mirror has paired sliders and precise numbers for centre x/y,
  surface orientation and length. Orientation is the surface tangent,
  counterclockwise from +x in y-up: 0 degrees horizontal, 90 vertical, +45 rises
  to the right. It is not the normal angle. Numeric precision is preserved;
  slider steps are 1 mm / 1 degree. The native mirror reflects from both sides.
  Native reflection counts distinguish actual sampled hits from misses, and
  stopped/truncated runs label their counts partial. Missed rays continue unchanged.
- In **any current-v4 optical model**, authors can add **zero to two** passive
  `ray-detector` components to measure sampled native ray crossings and signed
  native detector power (relative units, **not watts**). Each detector has stable
  `id` and `parameters: {x, y, orientationDeg, length}`; the angle is its
  finite segment's tangent in y-up coordinates, just like a mirror. The detector
  does not replace an image-formation solver or establish continuous throughput.
  Detectors must not intersect optical segments, one another, or the source.
  Completed runs display per-ID readings. Invalid, stopped, truncated, or failed
  runs never publish current measurements; save/export preserves the authored
  detector geometry without embedding measurements in scene JSON.
- The new mixed-tracing scenes combine a source, coaxial ideal lenses and freely
  oriented finite plane mirrors as ordinary component data. PhyDemo chooses all
  native intersections. Reflections are summed and reported by stable mirror ID.
  **No route-independent analytical image is claimed**; the native run, save and
  export remain available when analysis reports unavailable.
- The two lens/mirror examples demonstrate focal-point return and a finite return
  image. One lens ID compiles to one native lens, encountered again on return if
  PhyDemo finds an intersection. Mirror y=0 and orientation ±90 degrees are fixed
  in this bounded layout; mirror x/length and existing source/lens parameters stay
  editable. Reflection counts do not certify the lens-mirror-lens sequence.
- **Save sandbox** downloads the authoritative versioned scene document.
  **Open sandbox** restores it, including stable IDs, physical parameters,
  presentation, and bounded simulation settings.
- **Export PhyDemo JSON** downloads native version-5 JSON compatible with the
  pinned core. This is an independent copy. It has no sandbox IDs/bindings or
  host processed-ray guard. Native-only JSON cannot be imported as a sandbox save.

The browser chooses the download location (normally Downloads). Use the file
chooser to reopen the downloaded sandbox JSON.

## Authority and supported scope

`src/contract.js` defines the version-4 document and separate arrangement scope
validators. Components have persistent IDs, explicit types, and named numeric
parameters. Physical settings, presentation, and simulation limits are separate.
`src/adapter.js` compiles this document into native objects, with an external ID
map. PhyDemo performs all ray tracing and ray drawing. A future scene graph can
emit this same document; no general scene graph is implemented.

Historical version-1, version-2 and version-3 saves are strictly validated before
sequential migration to v4. V1 brightness moves from presentation into source
parameters; full-circle emission is retained. V2 to v3 and v3 to v4 change version fields only. IDs,
optical/source values, brightness, exact density, inactive emission settings,
view and simulation limits are preserved. Older schemas cannot acquire new
component/model/count support through migration: v1-v3 remain limited to two lenses. Non-preset densities display as Custom
and are never rounded. Both schemaVersion and adapterVersion are 4; native PhyDemo version 5 and the pin
remain unchanged.

Four explicit `physics.model` values select supported arrangements:
`ideal-thin-lens-geometric` for **one point source and one to four coaxial ideal
thin lenses**, with the source left of the lenses; `plane-mirror-geometric` for
**one point source and one finite plane mirror**, with the source on either side;
`lens-mirror-return-geometric` for **one source left of one ideal lens left of one
perpendicular plane mirror**; and `mixed-lens-mirror-tracing` for **1–4
independent point sources, 1–4 coaxial ideal lenses and 1–4 finite plane mirrors**
with independently
authored x/y centres, lengths and tangent orientations. In this bounded mixed
family, optical segments may not intersect, lens planes cannot coincide or
contain any source, distinct source positions must remain at least 0.01 mm
apart, and no source may lie on a mirror or detector supporting line.
A model-independent current-v4 layer permits **0–2 passive `ray-detector`
components** with segment geometry in all four optical models, disjoint from
other finite segments and with the source off their supporting lines.
The component array has no prescribed physical ray order. The mixed family
does not supply a route-independent analytical image formula; use native ray
paths and per-mirror hit counts without claiming image detection.
Lengths are mm;
x points right, y points up. One mm maps to one native unit; y is flipped for
the native canvas. Focal length is signed. Source/lens coordinates are bounded
to +/-10,000 mm; |f| and aperture height are 1-10,000 mm; lens/source planes need
at least 0.01 mm separation. Unsupported fields, types, versions, and values
raise errors with document paths.

Mirror centre coordinates use the same bounds, orientation is [-180,180] degrees,
length is 1-10,000 mm, and derived endpoints must lie within +/-10,000 mm. The
source must be at least 0.01 mm from the supporting line, including its extension.
This bounded domain excludes on-line source degeneracy. Mixed tracing additionally
rejects touching/crossing/overlapping optical segments, whose hit ordering is
ambiguous. Its plane mirrors are two-sided (the pinned PhyDemo law). Detectors are native
non-blocking crossing observations with an orientation-dependent signed power.
They are not calibrated physical optical-power meters. Their raw readings are
derived per run and are never stored as authored physics parameters. Angles 180 degrees apart
describe the same two-sided surface; saves retain the exact authored angle.

Predictions use independent ideal-lens transfer matrices, explicitly labelled
**analytical**. They apply to rays traversing all lens segments, without an
aperture-throughput guarantee. Rays missing a finite lens are not blocked.
The selected cone and sampled rays may not illuminate the predicted image, or
even hit the first lens. The analytical location is not an image detection.
For finite lens trains, numerical analysis uses magnification `1/D` with an
independent `A+z*C` check; unreliable results are explicitly unavailable, without
blocking native tracing or save/export. At infinity, the UI reports collimated
output and omits finite position and transverse magnification. The infinity classification uses |D| <= 1e-10 *
max(1, |B|/100 mm), with B and D from the source-to-last-lens matrix.

The mirror branch independently reflects the source across the supporting line:
I = S - 2 ((S-C) dot n) n, for centre C and unit normal n. It reports a conditional
virtual point and equal source/image normal distances. It does not use the lens
matrix or lens axial distance/magnification fields. Finite mirror length, emission
direction and finite sampling can leave no reflected samples; the ideal point
can still be reported with that qualification. It is not light propagating behind
the mirror, an image detection, or a claim about an unspecified observer's view.
Only native extended mode draws backward ray extensions; no analytical rays or
image overlays are added.

The mixed return branch uses L(f) T(2g) L(f) T(s) in unfolded travel coordinates,
with source-to-lens distance s and lens-to-mirror gap g. The same stable lens is
used on both encounters; the mirror keeps y=0 and tangent orientation ±90 degrees.
For matrix [[A,B],[C,D]], return distance z=-B/D, global x=xLens-z, m=1/D,
y=m*ySource. The transverse axis stays y-up. Positive z is a real image along the
left-going return; negative z is virtual to the right of the lens. At infinity
use the same documented scaled D tolerance. The focal example returns to (-100,0)
mm; the finite example predicts (-500/3,10/3) mm, m=1/3. These are conditional on
the lens -> mirror -> same lens path, not claims that every sampled ray takes it.
Rays can miss the first lens yet reflect or encounter it on return. Native
intersections, ray tracing and backward extensions remain entirely PhyDemo's.

Analysis has a separate available/unavailable/failed/suppressed status and reason.
For the mixed finite prediction, the independent identities m=1/D and m=A+z*C
must agree to relative 1e-7; nonfinite evaluation or disagreement withholds the
analytical result as numerically unreliable. This is a conservative consistency
guard, not an exhaustive conditioning guarantee. Native tracing, accepted sandbox
saves and native export remain available when analysis is unavailable or fails.
An invalid document/native load still blocks tracing; stopped, truncated, failed
or undefined native runs still suppress predictions. Revision changes clear old
values and reasons. No new ray-routing, solver framework or ray-history UI is used.

Each full-circle source uses at most 500 native samples at Dense sampling;
the current mixed-tracing model permits up to four independent sources. The
scene-wide interaction depth is at most 8 and the processed-segment limit is
10,000. Saves may lower these settings. A stopped,
truncated, undefined, or failed run is labelled explicitly. Invalid drafts hide
the previous canvas, clear predictions, and disable saving/exporting until
corrected. Accepted scene values are retained for correction. Run revision
checks suppress older completions. Ray sampling is finite; completion does
not certify all continuous rays or physical accuracy outside the ideal model.

No curved mirrors, prisms, material thickness, dispersion, diffraction, 3D, mechanics, continuous-ray power integration, native semantic
round-trip conversion, runtime AI, or general symbolic solver is provided.
The one-to-four lens restriction is a scope policy, not a universal
constraint on the document design. Earlier v4 readers enforcing old model/scope
rules may reject newly authored mixed-tracing or three-/four-lens v4 scenes. View controls are deliberately small.

## Milestone 6: general component tracing and LLM authoring

The new explicit `general-component-tracing` scene model uses **the same pinned
PhyDemo compiler** but does not require a lens or mirror to be present:
**1–4 point sources, 0–4 coaxial vertical thin lenses, 0–4 finite plane
mirrors, and 0–2 passive ray detectors**. Source-only and detector-only
observations, multiple-source lens experiments, and mirror-only systems
share one tracing path. The existing four arrangement models and their
conditional analytical predictions are unchanged. General tracing intentionally
does **not** fabricate an analytical image position or ray sequence.
Existing geometric restrictions, native limits and finite ray sampling remain.

The LLM **authors physical components**, not PhyDemo rays, Javascript or an
apparatus-specific template. The deterministic authoring interface prepares
the canonical versioned scene, converts units, provides a bounded camera and
named run policy, validates the exact existing contract, executes PhyDemo, and
returns compact diagnostics using the existing scene checker. No external LLM
API, online service, new optical laws or extra npm dependencies are required.

CLI commands (from the repo root, after `npm run setup`):

```powershell
node scripts/author-scene.mjs capabilities
node scripts/author-scene.mjs evaluate test/fixtures/llm-authoring/general-source-detector.request.json --out test-artifacts/llm-authoring/my-scene
node scripts/author-scene.mjs evaluate test/fixtures/llm-authoring/general-mirror-pair.request.json
```

The `evaluate` command produces `scene.ray-optics-2d.json` (openable via
**Open sandbox**) and `report.json` under the requested, ignored
`test-artifacts/llm-authoring/` directory. Without `--out` the canonical
scene is returned with the JSON response. Only a successful native run exits
with status 0. Preparation rejects missing physics before native execution.

An authoring request has `lengthUnit` (`mm`, `cm`, `m`) and
`components` using the same types and parameter names as the sandbox;
optional `title` and named `runPolicy`. It is **not** a separate
physics language. Source position, brightness and emission, lens focal length
and aperture, and finite mirror/detector geometry must be specified.
Only inactive full-circle direction/opening fields receive recorded
nonphysical defaults. Numerical run policies are explicit:
`preview-v1` (density 0.2, depth 8, processed limit 10000) and
`dense-v1` (density 1, same limits). No physical quantities are silently
inferred, added or altered to satisfy validation.

For targeted edits, run:

```powershell
node scripts/author-scene.mjs revise test-artifacts/llm-authoring/my-scene/scene.ray-optics-2d.json test-artifacts/llm-authoring/my-edit.json --out test-artifacts/llm-authoring/my-revision
```

The edit JSON must supply the accepted scene's `expectedSha256` (from its
evaluation report) and a `changes` list with stable component ID,
`section` (`parameters` or `emission`), `key`, `value`, and optional
length `unit`. A stale hash, unknown field, unsupported geometry or
incomplete switch to directional emission rejects the whole revision.
No full-scene rewrite is required for a one-parameter edit.

The summary separates native completion, emitted rays, reflection/detector
observations, warnings, measurement availability, and analytical applicability.
**It does not evaluate whether an LLM correctly interpreted a question**.
Warnings (including inconsistent brightness saturation) remain visible, and
stopped/truncated runs withhold current measurements. User questions with
missing physical facts still require clarification or explicitly agreed
illustrative assumptions.

## Image-to-scene authoring

Ask Codex to use [skills/sim-ro-image-to-scene/SKILL.md](skills/sim-ro-image-to-scene/SKILL.md)
and provide an optics diagram with its problem statement. This is an explicitly
invoked repository workflow, not a globally installed skill or a browser AI service.
It records stated facts, conversions, assumptions and missing information in
`authoring/<case>/interpretation.md`, then writes a supported sandbox document when
the essential physics is resolved. Conflicting or missing labels require
clarification; unsupported components/layouts are rejected. Labelled dimensions
take precedence over pixel distances.

Check a candidate from PowerShell after the existing project setup:

```powershell
Set-Location 'C:\Users\samee\Documents\sim_ro'
node skills/sim-ro-image-to-scene/scripts/check-scene.mjs authoring/case-01/scene.ray-optics-2d.json --evidence test/fixtures/image-to-scene/inputs/case-01.png --evidence test/fixtures/image-to-scene/inputs/case-01.md --report test-artifacts/image-to-scene/case-01/checks.json
```

The checker rebuilds the existing headless core and reuses the live validator,
adapter, session and native simulator. It reports bounded native execution,
analytical availability and sandbox/native round-trips separately, with input and
source hashes. Exit 0 means execution checks passed, not that image interpretation
is correct. Exit 1 means a candidate/run failure; exit 2 means a setup/usage failure.
It accepts strict current-version sandbox JSON without migration or repair.
Open the candidate with **Open sandbox** in the running app to inspect parameters
and rays, then save/reload it. Review interpretation separately against the inputs.

The [fixture guide](test/fixtures/image-to-scene/README.md) and
[validation record](VALIDATION.md#image-to-scene-authoring-workflow) describe the
small lens/mirror pilot. It does not establish accuracy on scans, handwriting,
extended objects or arbitrary optical arrangements. Generated reports/previews
remain ignored under `test-artifacts/image-to-scene/`.

## Validation and attribution

See [VALIDATION.md](VALIDATION.md) for actual tests and limitations.
The application build preserves upstream `LICENSE`/`CITATION.md` and bundled
dependency notices under `dist/licenses`. Original upstream license and citation
files are also retained in [third_party/phydemo](third_party/phydemo), with
supplemental MIT notices in `third_party/ADDITIONAL-MIT-NOTICES.txt`.

PhyDemo Ray Optics Simulation is by **The Ray Optics Simulation authors and
contributors**, licensed under **Apache-2.0**. See the
[pinned release](https://github.com/ricktu288/ray-optics/releases/tag/v5.4.0).
The upstream source/lockfile is unchanged. Its existing npm dependencies emit
deprecation/install-script notices; no global approvals or dependency updates
were applied. Broader upstream optional test/gallery dependencies were omitted.

`.gitignore` excludes local upstream/dependencies, builds, caches, temporary
files, and generated test artifacts; authored scenes and tests remain trackable.
Implementation changes require separate approval before committing or pushing.

## Minimal problem-to-scene authoring (Milestone 7 draft)

The strict LLM authoring interface remains unchanged. For incomplete textbook
arrangements, `node scripts/author-scene.mjs problem <request.json>` returns
explicit missing/unsupported issues without running native physics. An optional
`--illustrate` allows only three documented, labeled display choices (source
relative brightness, finite ideal-lens aperture and unspecified full-circle
emission). Its provenance stays in the report, not the canonical scene JSON;
valid native execution does not certify correct question interpretation.
See [minimal problem authoring guide](docs/MINIMAL-PROBLEM-AUTHORING.md).

## Finite circular dielectric (v7)

A strict `circular-dielectric` component now reuses pinned native `CircleGlass`
with explicit centre, positive radius, inside/outside indices and Fresnel
policy. One finite circular region supports 1–4 explicitly directed native
single rays and up to two external passive detectors. It reuses the minimal
authoring request, unified problem command, boundary observations, qualified
edits, main viewer and exports. It does not add a new ray tracer, image detector,
prism/cap geometry, nested media, or circular-region motion playback.

See [scope and usage](docs/CIRCULAR-DIELECTRIC.md) and the fully declared
[synthetic request](examples/circular-dielectric.json). The existing scene menu
includes **Synthetic: circular dielectric**. Full-Fresnel or trapped-ray
truncation remains incomplete; explicit Fresnel-off is labelled as an
approximation, not a numerical repair. Earlier sealed evaluations are not
rewritten or counted as new successes.

### Finite triangular prism (v8)

A single `triangular-prism` is specified by three vertices, explicit inside/outside
indices and reflection policy. It reuses pinned native `Glass`, the unified
problem workflow, the same viewer and qualified exports. One to four explicit
single rays may start inside or outside; up to two external detectors are allowed.
Existing interface measurements now include bounded first events per prism face.
See [`docs/TRIANGULAR-PRISM.md`](docs/TRIANGULAR-PRISM.md) and the synthetic
[`examples/triangular-prism.json`](examples/triangular-prism.json). Select the
triangular-prism example after building, or load a qualified acceptance bundle.
Truncated Fresnel runs remain incomplete; no arbitrary polygon, nested medium,
image detector, new motion model or textbook-specific solver is implied.
