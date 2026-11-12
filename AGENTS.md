# ray-optics-2d

- This workspace is an independent local 2D optics project. No mechanics or 3D integration.
- Baseline: PRs #7 (general authoring), #10 (evaluation runner) and #13 (minimal problem preparation) were merged on 2026-11-12. Preparation is not an image interpreter or proof of independent model accuracy. Read `README.md`, `docs/MINIMAL-PROBLEM-AUTHORING.md`, `PROPOSAL.md`, `PLANE-MIRROR-PROPOSAL.md`, `LENS-MIRROR-PROPOSAL.md`, and `upstream-pin.json` for boundaries and evidence.
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
  Canonical scene JSON alone does not preserve physical-assumption provenance;
  the browser currently does not load the sidecar. Do not claim otherwise.
- Image authoring uses the explicitly invoked repo skill `skills/sim-ro-image-to-scene/SKILL.md`. Keep provenance outside strict sandbox JSON, prefer labels over pixels, withhold scenes for essential unknowns/conflicts, and reject unsupported arrangements. The Node checker rebuilds/reuses the current core; execution success does not certify interpretation. Generated reports/previews stay in ignored `test-artifacts/image-to-scene/`.
- After approval, routine implementation and focused testing may proceed within the agreed milestone. Ask before scope expansion, upstream physics changes, writes outside this workspace, committing, or pushing. Keep caches/build outputs inside this workspace where configurable.
