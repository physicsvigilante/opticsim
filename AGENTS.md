# ray-optics-2d

## Foundational objective — LLM-directed physical exploration

Opticsim is a **teaching and physical-exploration accompaniment**. The goal is a reusable, source-backed, versioned physical model, not a one-time textbook-answer calculation. A correct native ray trace, faithful interpretation of a source, and effective classroom communication are distinct claims. A final textbook answer or derivation is optional; an explicitly requested supported output cannot be called answered until verified.

- Preserve the original **source-backed physical baseline** and its declared model, identities, units, geometry and assumptions. Subsequent teacher-authored hypotheticals and numerical/presentation edits are separate qualified states with their own hashes and execution evidence. A source label or matching hash is not independent interpretation certification.
- Let the LLM propose meaningful physical property, initial geometry, boundary, external-input and supported structural changes using stable component IDs. The LLM need not reauthor unchanged components, solve an unknown first or prescribe native ray routing. Do not invent essential values or silently turn a hypothetical into an original given.
- The engine owns per-scenario validation, physical admissibility, numerical policies, execution, conditional analytics and explicit error reporting. An accepted baseline does not license an invalid variant; no scenario inherits its predecessor's execution verification.
- Distinguish **targeted physical-parameter revisions**, **structural reassembly**, **observation/analysis selection**, **numerical sampling** and **presentation changes**. Current `reviseScene` supports targeted existing fields only; the separate bounded `reviseComponents` contract accepts explicit stable-ID add/remove operations and reuses canonical validation, with no implied cross-family migration or component replacement. See `docs/STRUCTURAL-REVISION.md`.
- Compare only quantities with compatible identities, methods, units, assumptions, numerical policy and qualified evidence. Native counts are sampled and native signed relative power is not watts or continuous optical flux. Changed density/brightness clipping is not proof of changed physical illumination. Conditional image equations are not native image detections.
- Reuse existing qualified packages, SHA-guarded revisions and bounded parameter sweeps. A sweep sample must be revalidated from the unchanged baseline and retained as a failure when inadmissible. Static configuration branches and quasi-static retracing are not finite-speed time evolution or simulated dynamics.
- Evaluate **interpretation fidelity**, **physical/numerical correctness**, **simulation coverage**, **educational usefulness**, and optional **textbook-answer completeness** separately. Software CI, same-assistant visual inspection and independent teacher/student evidence are not interchangeable.
- Prefer the smallest generally reusable change justified by a demonstrated physical/teaching need. Do not replace the pinned PhyDemo engine, add exam-specific semantics or introduce an abstract graph solver solely to shorten a question-specific prompt.

See `evaluation/reusable-model-v1/README.md` for a bounded developmental scenario-branching exercise; it is not a general structural-edit API or an independent LLM benchmark.

- This workspace is an independent local 2D optics project. No mechanics or 3D integration.
- Baseline: PRs #7 (general authoring), #10 (evaluation runner) and #13 (minimal problem preparation) were merged on 2026-11-12. Preparation is not an image interpreter or proof of independent model accuracy. Read `README.md`, `docs/MINIMAL-PROBLEM-AUTHORING.md`, `docs/QUALIFIED-AUTHORING.md`, `PROPOSAL.md`, `PLANE-MIRROR-PROPOSAL.md`, `LENS-MIRROR-PROPOSAL.md`, and `upstream-pin.json` for boundaries and evidence.
- Reuse pinned PhyDemo optics and rendering. Do not rewrite ray tracing or modify upstream core without separate approval.
- Milestone 5 builds a standalone static **browser** distribution using the
  exact native core and strict scenes. The package may contain only reviewed
  `index.html`, `style.css`, `app.js`, bundled `scenes/`, complete
  `licenses/`, and `.nojekyll`; never include `test-core.cjs`, unreviewed
  `dist/` extras, caches, private files, runtime secrets or a backend. Keep
  CSP self-origin and validate the `/opticsim/` hosted path in real Chrome.
  Shareable query links choose known starting examples only, never user edits.
  **Do not publish a GitHub Pages site automatically or change repository
  visibility; publication needs a separate explicit public-visibility choice
  and manual opt-in.** A private source repo alone does not imply a private site.
- Supported arrangements: one point source with one to four coaxial ideal lenses in current v4 scenes (historical v1-v3 saves remain limited to one/two); one point source with one plane mirror; or the bounded source-left / lens / perpendicular-mirror return layout. Return layout has one lens ID/native instance, mirror y=0/orientation ±90 degrees and >=0.01mm plane separations. Current-v4 mixed-lens-mirror-tracing allows 1–4 independently authored sources, 1–4 coaxial lenses
  and 1–4 plane mirrors with independent centre/tangent/length. All current-v4
  models may additionally contain 0–2 independently authored finite
  `ray-detector` measurement segments; validation excludes detector/optical
  intersections and source-on-surface degeneracies. No intersecting optical surfaces. No route-independent image
  prediction for this tracing mode. Keep restrictions in model-specific scope validation. Examples are scene data only.
- The versioned sandbox document is authoritative. Native JSON and annotations are derived. Keep IDs, parameter bindings, and sandbox metadata outside native objects. Reject unsupported inputs explicitly.
- Parameter updates must keep the document, simulation, and annotations synchronized. Native physical editing is disabled in the first milestone; exported native files are independent copies.
- From this workspace in PowerShell: `npm run setup`, `npm run build`, `npm start` (http://127.0.0.1:4173), `npm test`. Use installed Node 24.19.0/npm 11.17.0 and project-local dependencies/cache; no Python, Conda, global packages, or system configuration changes.
- Analytical availability/errors are separate from native run status. A valid native trace and save/export remain usable when analysis is unavailable or fails. Infinity is explicit. Invalid edits, stops, truncation, and native failures suppress stale predictions/reasons. Preserve revision guards against old asynchronous callbacks.
- Source controls retained in schema/adapter v4: one semantic point-source with full-circle/directional emission, paired native-style sliders/numbers, source-relative brightness, and sampling presets. Strictly validate historical v1/v2/v3 before sequential migration; preserve exact brightness/density/IDs and all lens/source values. Selecting Directional defaults to Medium; loading saves never resets density. Do not resample native rays. Keep angle sign and symmetric-cone regression tests.
- Plane mirror: semantic centre x/y, tangent orientation counterclockwise from +x in y-up, and finite length compile to native Mirror endpoints with y flipped. Native physics is two-sided. Source must be >=0.01 mm from the supporting line, including its extension; derived endpoints stay within coordinate bounds. Separate conditional virtual-image prediction from native rays/reflection counts; misses continue unchanged. Count native incident calls only, with per-run instance observers; partial runs label counts partial. No ray history, custom tracing, image-detection claim or analytical ray overlay.
- Mixed return analysis is conditional on lens-ID -> mirror-ID -> same lens-ID, not a prescribed ray route or image detection. In unfolded travel coordinates use L T(2g) L T(s), then xImage=xLens-z for left-going output. Keep y-up fixed. PhyDemo chooses all intersections and finite misses. No production ray-history viewer; test-only native incident observations are allowed.
- Multi-source support applies to both mixed-lens-mirror-tracing and general-component-tracing. Pure
  lens, plane mirror and return analytical models retain exactly one source and their
  analytical predictions. Sources have independent IDs, positions,
  brightness and emission mode/direction/cone; ray density and native limits are
  scene-wide. Validate every source against every lens plane, mirror supporting
  line and detector supporting line, and reject coincident source positions.
  Native emissions are counted per source by wrapping each actual start once;
  no source-specific detector attribution, summed brightness scale or
  per-source analytical image may be fabricated. Keep the real native
  inconsistent-source-saturation warning and its caution about detector power;
  do not silently normalize user brightness or report a clean physics result. The browser source selector
  is UI-only; every source remains editable in sidebar fields.
- The mixed-tracing branch uses the same native component compiler and stable
  IDs; report total and per-ID reflection hits via native observers. Do not
  prescribe ray paths, fabricate image predictions, or use analytical equations
  from the restricted lens/mirror return family for arbitrary mixed systems.
- Ray-detector readings are derived native observations by stable ID: crossing
  count and signed native detector power in relative units. Do not call them watts,
  physical irradiance, detected images, or continuous throughput. Detectors must
  be nonintersecting with other segments; invalid/incomplete run readouts are
  withheld. Keep native physics, source/optics and measured values separate.
- Use proportionate validation: contract/adapter tests, independent lens checks including virtual/infinite images, and browser parameter/save/reload checks. Screenshots alone do not establish physics correctness. Report errors, truncation, and untested behavior.
- The general `general-component-tracing` model reuses PhyDemo components with
  1–4 sources, 0–4 vertical coaxial lenses, 0–4 finite mirrors and 0–2 passive
  detectors. Existing arrangement-specific models remain strict. The LLM
  selects and describes actual physics; `src/authoring.js` prepares only
  mechanical boilerplate, unit conversions, camera and named sampling policy.
  `scripts/author-scene.mjs` reuses the checker/native physics, returns
  separate execution/measurement/analysis/interpretation status, and enforces
  SHA-based targeted edits before any native run. No custom ray routing,
  invented physical values in strict mode, apparatus template language, or new LLM provider.
- `src/problem-authoring.js` may apply only the documented `illustration-v1`
  policy with explicit opt-in. Aperture, brightness and emission are physical
  assumptions, not presentation settings. Distinguish proposed from applied
  choices; blocked requests have no applied choices and no scene. Preserve
  all supplied values, including invalid values for diagnosis. Aggregate field
  issues using the shared authoring contract; do not duplicate its schema.
  `fully-specified` means request completeness, not correctness about a question.
- Authoring CLI output directories must be fresh, non-symlink paths inside
  `test-artifacts/llm-authoring/`. Preserve original input bytes and hashes
  alongside the scene and report. Do not silently overwrite prior evidence.
  Canonical scene JSON alone does not preserve physical-assumption provenance.
  Use `scripts/qualified-scene.mjs` and the portable qualified package to carry
  assumptions and edit history through browser preview and qualified revisions.
  Raw sandbox/native exports omit this history and must show unknown provenance
  when reimported. Never attach the previously loaded scene's qualification.
- `src/observables.js` accepts explicit companion result requests, not another
  apparatus DSL. Native observations require complete hash-matching execution.
  Existing single-source analytical models may be applied to an analysis copy
  only after their exact scope validates; do not change the native scene, remove
  components, prescribe ray paths, or call a conditional image a detected image.
  Unknown result kinds are unavailable; stale/incomplete results are suppressed.
- Qualified package hashes detect mismatches, not authenticity or truth. Author
  evidence notes are unverified text. Preserve original applied assumptions and
  later physical/numerical/presentation edits separately; never upgrade an
  illustrative origin to stated physics. Keep all async browser work revision-
  guarded and bound metadata sizes/history. Raw imports clear qualification.
- The five-problem record under `evaluation/qualified-workflow-v1/` is a sealed
  same-assistant development attempt, not an independent model evaluation.
  Do not edit `first-attempt.json`; add later reviews separately. Read only its
  specified Problems entries, never Solutions without a separate protocol.
  Replaying its three illustrative configurations in CI is software validation,
  not three successful answers to the original inverse/material questions.
- Image authoring uses the explicitly invoked repo skill `skills/sim-ro-image-to-scene/SKILL.md`. Keep provenance outside strict sandbox JSON, prefer labels over pixels, withhold scenes for essential unknowns/conflicts, and reject unsupported arrangements. The Node checker rebuilds/reuses the current core; execution success does not certify interpretation. Generated reports/previews stay in ignored `test-artifacts/image-to-scene/`.
- After approval, routine implementation and focused testing may proceed within the agreed milestone. Ask before scope expansion, upstream physics changes, writes outside this workspace, committing, or pushing. Keep caches/build outputs inside this workspace where configurable.
- Circular dielectric v7 is separate from v4/v5/v6: exactly one stationary
  `circular-dielectric`, 1–4 explicit single rays inside/outside, 0–2 external
  detectors. Require centre, positive radius and absolute inside/outside
  indices plus partialReflection. Compile to pinned CircleGlass with the
  index ratio; no custom refraction, image detection, circle motion, other
  optics or nested finite media. Reuse boundary observations with the actual
  local outward normal; counts span the entire circle and first-event is
  simulator-order, not source attribution. Keep Fresnel/trapped-TIR truncation
  incomplete, explicit Fresnel-off qualified, and initial near tangencies
  rejected conservatively. Read docs/CIRCULAR-DIELECTRIC.md for bounds.
- Triangular-prism v8 is isolated from prior schemas: one finite triangle,
  1–4 explicit single rays, 0–2 external detectors. Require three vertices,
  absolute inside/outside indices and partialReflection; compile one native
  Glass polygon, never crossing PlaneGlass half-planes. Face labels follow
  authored vertex order, not a ray route. Per-face first events are bounded,
  simulation-order evidence, not multi-source attribution. Keep initial
  vertex clearance and runtime ambiguous-face failures, Fresnel truncation
  suppression, qualified history, and old scene scopes unchanged. See
  docs/TRIANGULAR-PRISM.md; do not reinterpret sealed textbook trials.

- The Optical Systems Atlas under `evaluation/optical-systems-atlas-v1/`
  is a **same-assistant capability discovery** over a deterministic 40-of-114
  Problems-only sample, not 40 solved JEE questions or an independent accuracy
  score. Its pinned source SHA, individual image hashes, selected paths,
  unreviewed inventory, review labels and candidate roadmap must stay
  consistent. No Solutions entry was opened. A proposal to add convex polygon
  glass, blockers, screens, or beams is **not** permission to extend existing
  v4–v8 scope; require separate feature review and merge approval. The
  source-only transfer workflow is temporary and must not reach main.

- Convex polygon dielectric v9 is a **four-vertex, strictly convex** finite
  homogeneous Glass path, not general arbitrary polygons or layered media.
  Keep 1–4 exact single-ray sources inside/outside, 0–2 external detectors,
  explicit material indices and reflection policy, source/edge and vertex
  clearance, 1 mm edge/altitude bounds, and geometric nonconvex rejection.
  One pinned native `Glass` instance owns ray optics; per-face observer
  delegates exactly once, and its face labels never invent source-specific
  routes, images, inverse answers or 3D geometry. Fresnel truncation and
  ambiguous corners must suppress accepted readings. New v9 cannot leak into
  historical v4–v8 scopes; no change to PhyDemo core or numerical cutoffs.
  See `docs/POLYGON-DIELECTRIC.md`.

- The fully opaque `line-blocker` is accepted only in v4 general-component-tracing, with explicit centre/tangent orientation/length and at most two disjoint segments. Compile directly to pinned PhyDemo `Blocker` with `filter:false`. Native `isAbsorbed:true` calls, not a custom ray tracer, determine bounded sampled counts; incomplete/stale/invalid runs suppress accepted results. Do not infer continuous shadows, observer visibility, 3D circular discs, filtered wavelengths, or JEE answers. Leave dedicated refractive/mirror/lens scene scopes and core pin unchanged. See docs/OPAQUE-LINE-BLOCKER.md.

- Finite dielectric composition v10 combines exactly one existing convex four-vertex polygon dielectric and one external plane mirror, 1–4 explicit single rays and 0–2 external detectors. Reuse polygon validation and native component observers; do not relax historical v4–v9 scopes or silently migrate qualified models. External segments need a common separating face and 0.01 mm clearance; no other optics/media are admitted. No prescribed return path, source-attributed ray history or analytical image is implied. The unchanged maxRayDepth=8 counts detector encounters too; two crossed detectors can truncate a return and all accepted readings must remain suppressed. Keep PR #64 experimental intersections out of production. See docs/FINITE-DIELECTRIC-COMPOSITION.md.

- Finite composition v11 extends the SAME `finite-dielectric-composition` model to one or two external plane mirrors through shared whole-system cardinality and geometry checks. Keep v10 exactly one mirror and older source/native fingerprints unchanged. New two-mirror minimal requests prepare v11; no automatic qualified migration. In v11, mirror add/remove remains within 1–2, retired IDs cannot be reused, and missing target observations are not reassigned. No third mirror, other optical type, extra medium, route controller, native modification or budget change. See docs/TWO-MIRROR-COMPOSITION.md.
