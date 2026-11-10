# Bounded multi-lens composition — design proposal

**Status:** Design candidate for review. Not implemented; no native/browser tests executed for this proposal.

**Repository:** physicsvigilante/opticsim only. Work on design/bounded-multilens-trains; main and the pinned upstream PhyDemo core remain unchanged.

## Goal

Enable an LLM (or human author) to describe a novel one-source, **three- or four-lens coaxial ideal-thin-lens arrangement** entirely as existing versioned scene JSON. The same validator, component compiler, native PhyDemo tracer, UI controls, save/export, and independent analysis must work without writing apparatus-specific JavaScript for each arrangement.

A new composition of *supported* optical components should be data authoring. A genuinely new optical component or physical law may require a reusable engine extension.

## What the current code already supplies

- The authoritative v4 scene document has stable component IDs and separates physical, presentation, and simulation parameters (src/contract.js).
- Validation separates component schemas from arrangement-scope rules. The current ideal-thin-lens-geometric scope allows one or two lenses.
- The adapter compiles an array of components through a per-type compiler table, returns an external ID-to-native-index map, and delegates actual ray intersections to the pinned PhyDemo engine (src/adapter.js).
- Forward lens analysis already iterates through lenses ordered by x using an ABCD matrix (src/analysis.js); it is not an apparatus-by-apparatus formula.
- Parameter controls are generated from the scene component array; Open sandbox can load external authored JSON (src/app.js). A component add/delete GUI is *not* necessary for this milestone.
- Session status distinguishes successful native traces from unavailable/failed analytical predictions (src/session.js). Existing tests cover native detector probes, independent optical equations, and data-only authoring.

## Proposed bounded contract

For **current schemaVersion/adapterVersion 4** and physics.model **ideal-thin-lens-geometric**:

1. Exactly one semantic point-source and **1–4 ideal-lens** components; no mirrors, prisms, detectors, or additional source types in this model family.
2. All lenses remain finite vertical ideal-thin-lens segments centered on y=0, with existing x, signed focalLength, apertureHeight parameters. Point-source and emission settings retain current meanings. No new physical fields.
3. The source must lie at least 0.01 mm left of the first lens; adjacent physical lens planes must be separated by at least 0.01 mm. Lens x order for analytical propagation comes from coordinates, *not* scene-array position.
4. Preserve current units (mm), source/position and lens bounds, sampling and run limits, stable IDs, native export behavior, and y-up to native y-down transform. Component array order still determines the ID-to-native-index map.
5. Analytical image results are **conditional paraxial predictions** along the complete ordered lens train. They do not establish that finite sampled rays hit every lens or that a physical image has been detected.

The current 32-component document-array ceiling is unchanged and does not override these stricter scope rules.

### Historical save compatibility — mandatory

The validation of **v1, v2, and v3 documents must retain their original 1–2-lens scope before migration**. Do not simply relax shared validation and accidentally admit historically unsupported arrangements. Parameterize lens-scope validation by document version (or an equivalent explicit version-specific policy). The existing strictly validated sequential migration to v4 must preserve all accepted historical IDs, parameters, intensity/brightness, density, and presentation exactly.

**Do not bump the schema to v5 solely for increasing the cardinality of an existing component family.**

## Implementation plan (only after design approval)

### 1. Validation and adapter

- Make the current-v4 ideal-lens scope accept 1–4 lenses with the unchanged geometry and numerical safeguards. Continue to reject zero/five lenses, additional sources, mixed mirror/lens scenes, duplicate IDs, and coincident/unordered lens planes with actionable document-path errors.
- Preserve existing per-component native compilation and ID map; never insert forced ray routes, artificial lens encounters, or extra native lenses. Leave other model families unchanged.

### 2. Independent analysis and numerical reliability

- Keep the single ABCD transfer-matrix loop. A longer lens list must not introduce a three-lens/four-lens special-case formula.
- Verify matrix coefficients and derived x/y/magnification are finite. For a finite paraxial image, prefer the determinant-one identity m = 1/D and compare it to the independently evaluated A + z*C, where z = -B/D is the post-last-lens image distance.
- Use a conservative documented disagreement/conditioning guard, similar to the existing lens-mirror-return branch. If numerical results are unreliable, publish an explicit **unavailable** analysis reason while allowing valid native tracing, save, and export.
- Retain explicit at-infinity classification and its documented scale criterion unless separately justified by tests. Do not invent finite image coordinates for an infinity classification. Preserve established results for 1–2 lenses within existing tolerances.
- Neither consistency check nor completed native run implies continuous-ray coverage of finite apertures.

### 3. UI and LLM authoring

- Keep the Open sandbox JSON workflow, existing autogenerated parameter controls, conditional analysis explanatory text, and save/reload. A component editor, broad scene graph, and browser automation are not part of this scope.
- Update README, authoring skill, and VALIDATION.md only once implementation and qualification evidence exist; the live validator remains the source of truth. LLM authors must not infer missing focal lengths or apertures from diagram pixels.

## Qualification requirements

**Contract, versioning, and round-trip**
- Current v4 scenes with 1, 2, 3, and 4 lenses validate. Exactly five lenses and all unsupported mixes are rejected with correct status/path.
- Reorder component arrays while retaining positions/IDs; analytical results are invariant and ID-to-native-index mappings still reflect authored order.
- Verify plane separations, exact signed focal lengths and apertures, malformed/nonfinite values, duplicate IDs, and source-placement rejection.
- Synthetic old v1/v2/v3 three-lens saves must be rejected *before* migration. Existing 1–2-lens legacy migrations preserve IDs, parameters, custom ray density, and brightness.
- Native export/reload and sandbox save/reload preserve complete physical scenes without leaking sandbox metadata into native objects.

**Independent optical and native execution**
- Fixed three-/four-lens fixtures with unequal lens spacings, signed powers, finite real and virtual images, an intermediate collimated segment, and a final at-infinity result. Check against independently worked ABCD/scalar-conjugate expectations.
- Test an extreme, ill-conditioned train: prediction must become unavailable rather than emit a misleading finite number, but accepted native tracing and saves remain functional.
- Use test-only SingleRay sources, ray-incident observations, and native Detector planes to independently check slope/height propagation for rays meeting all lenses. Also test small apertures causing natural misses: no forced hits or image-detection claims.
- Exercise low processedRayLimit, maxRayDepth, stopped/truncated states, analysis failures, and stale completion guards.
- Run npm test, npm run build, and check-scene.mjs with authored three- and four-lens data-only fixtures. Report precisely which commands actually pass.

**Browser acceptance, when available**
- Open both scene JSON files, edit at least one focal length and lens x through native sandbox parameter fields, inspect rays/extended mode and warnings, save and reopen. Browser screenshots alone are not physics evidence.

## Out of scope

Rotated/decentered lenses; general mixed lens/mirror systems; multiple sources; curved mirrors; prisms; media/thick lenses; diffraction, interference, polarization, dispersion; symbolic inverse solving; detector components in authored scenes; generalized scene graph or GUI creation/deletion tools; unrestricted component count; upstream PhyDemo source changes.

## Gates

1. **Design review:** approve or revise the contract, historical-version policy, numerical safeguards, and acceptance tests.
2. **Candidate implementation:** only after review, make minimal source/test changes on a non-main branch; preserve all old fixtures.
3. **Independent qualification:** inspect numerical/native evidence, clarify remaining gaps, then obtain explicit user approval before merging to main.

**Decision sought:** approval of this bounded design. This document does not claim three- or four-lens support already exists.
