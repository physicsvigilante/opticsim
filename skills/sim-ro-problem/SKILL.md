---
name: sim-ro-problem
description: Interpret an optics problem into one bounded task using existing physical facts, angular calculations, native observations and qualified evidence.
---

# One interpreted problem, one execution entry point

Read `AGENTS.md`, `docs/UNIFIED-PROBLEM-WORKFLOW.md`, `docs/WHICH-MODEL.md`, and discover live capabilities **without triggering oversized legacy dumps** via:
- `node scripts/author-scene.mjs workflow-capabilities` (compact index of the problem envelope, `interpretation` schema, all analytical families, and observables)
- `node scripts/author-scene.mjs workflow-capabilities <family>` (full field schema for one family, e.g. `angular`, `coaxialParaxialStack`, `prismAngular`, `curvedMirrors`, `observables`, `interpretation`)
- `node scripts/author-scene.mjs bench-capabilities` (self-contained `v40` native bench contract with component nesting, bounds, revision payloads, and a minimal example)

(`node scripts/run-problem.mjs capabilities` also exists as the full combined dump, but is ~180 KB because it embeds frozen `v1`–`v39` authoring contracts.) Preserve the original problem reference, stated facts, unknowns, assumptions and requested quantities before execution. The tool does not read images or understand natural-language physics; the LLM performs that interpretation.

**`opticsim-problem-v1` envelope & `interpretation` schema:**
- Top-level required keys: `format: "opticsim-problem-v1"`, `physical` (request/facts object or `null`), `requests` (`1–16` items, each `{ id, kind, ...fields }` — omit `format` on items inside `requests[]`; for native observables, use `componentId` — not `targetId` — when naming an authored component).
- Top-level optional keys: `interpretation`, `illustration` (boolean), `verifyNative` (boolean).
- Allowed `interpretation` keys (any other key is rejected): `source` (optional object with allowed keys `caseId`, `path`, `sha256`), `requestedResult` (string), `stated` (`string[]`), `derived` (`string[]`), `assumptions` (`string[]`), `unknowns` (`string[]`).

**Model selection (`v40` vs reduced analytical facts vs dedicated legacy profiles):**
- Use **`v40` (`physical.model: "native-optical-bench"`, explicit `backgroundIndex` in `[1, 4]`, `lengthUnit`, `components`)** by default for supported **native 2D ray-tracing** setups. `v40` composes `1–4` point sources (single-ray, directional, or full-circle; ambient or strictly inside circle/cap/prism/quad) OR `1` external `parallel-beam`, `0–4` finite dielectrics (`circular-dielectric`, oriented `circular-cap-dielectric` minor/hemisphere/major caps, `triangular-prism`, `polygon-dielectric`, signed/flat `spherical-lens`; disjoint, 2–4 layer touching flat media, or coaxial cemented doublets/triplets), `0–4` decentered vertical `ideal-lens`, `0–4` `plane-mirror` (disjoint, corner-touching enclosures, or flush flat silvering), `0–2` `beam-splitter` (exterior-only broadband partial reflector/transmitter, `transmissionRatio` in `[0.01, 0.99]`, `beam-splitter-interactions` observable), `0–2` curved mirrors (`circular-arc-mirror` with exact arc clearance against emitters/segments/circles/non-silvered dielectrics — exact against the conservative AABB for `spherical-lens`, otherwise exact against the physical body — or concentric curved silvering, `ideal-curved-mirror`), `0–2` opaque stops (`line-blocker` and `circle-blocker` ambient or strictly inside circle/cap/prism/quad `>= 0.01 mm`; `finite-aperture` exterior-only), and `0–2` passive detectors (ambient or strictly inside circle/cap/prism/quad `>= 0.01 mm`; `spherical-lens` exterior-only; `maxRayDepth <= 16`, `v40EndpointsVerified`). Note: on realistic low-contrast glass/water stacks or spheres, `partialReflection: true` can emit faint multi-bounce Fresnel rays clipped by PhyDemo's minimum-brightness cutoff (`truncation > 0` → `withheld-incomplete`); use `partialReflection: false` when an explicitly labeled transmitted+TIR exploration is intended, or use `beam-splitter` when modeling a thin partial reflector/transmitter without internal slab echoes. For coaxial paraxial stacks that also need side-by-side native ray corroboration, use `node scripts/witness-optical-bench.mjs capabilities|plan|run`.
- Use the matching **reduced analytical-facts** format (`opticsim-coaxial-paraxial-stack-facts-v1`, `opticsim-lens-train-facts-v1`, `opticsim-planar-angular-facts-v1` — see `docs/PLANAR-ANGULAR-QUERIES.md` or `workflow-capabilities angular`, `opticsim-plane-mirror-angular-facts-v1`, `opticsim-curved-mirror-facts-v1`, `opticsim-prism-angular-facts-v1`) whenever the requested result is a supported pure analytical calculation.
- Use an existing **dedicated legacy profile** (do **not** set `model: "native-optical-bench"`) when its specific conditional analytical or specialized native capability is required:
  - Conditional `ideal-image` on a single point source with 1–4 coaxial thin lenses, 1 plane mirror, or 1 lens + perpendicular plane mirror (a `v40` scene traces natively, but `ideal-image` returns `unavailable` because `src/observables.js` does not downgrade `v40` to a historical analytical model).
  - `planar-interface` (including `v5` opt-in `detector-ray-provenance`) or graded-index slabs (`graded-index-rectangle`, `v25`/`v33`), which are not part of `v40`.
  - No automatic model fallback or schema migration occurs between `v40` and legacy profiles.

Put existing typed requested quantities in `requests`; the `opticsim-problem-v1` wrapper routes them deterministically. Use `null` physical representation and an unavailable quantity rather than silently substituting an easier apparatus. Unknown kinds remain unavailable; never count that as a proof that the original problem is physically underdetermined.

For sequential **plane-mirror angular inverses**, the physical view
`opticsim-plane-mirror-angular-facts-v1` takes 2–4 ordered mirror IDs
and **unsigned consecutive line inclinations** only. Request
`mirror-incidence-from-output-direction` with a reference mirror,
`outgoingRelation: parallel|perpendicular`, and explicit
`angleConvention: from-normal`. The solver enumerates inclination signs
and outgoing directions; never guess a handedness or fabricate source
position, brightness, mirror lengths or native hits. Multiple solutions
and grazing cases remain explicit. Read `docs/PLANE-MIRROR-ANGULAR-QUERIES.md`.

Do not compute outgoing answers merely to supply a required forward input.
Use the supported inverse query where applicable. Do not invent brightness or
picture coordinates for pure angular mathematics. Native simulation needs
complete explicit inputs; illustration is separately opt-in and physically
consequential. Branch event choices are conditional hypotheses, not native
ray-routing instructions.

Execute `node scripts/run-problem.mjs problem.json --out
test-artifacts/llm-authoring/<fresh>`. Retain the original request, plan,
analytical outcomes, native evidence, report and qualified package together.
A failed/incomplete native run cannot certify a native observation. A valid
conditional analytical result is not an observed ray or verified interpretation.
Raw report coverage is not an independent accuracy score.

Do not retry or rewrite a recorded first attempt. Keep subsequent corrections
as separate requests/reviews. Do not call an external model service, read a
Solutions image, publish a site or merge a new PR without the appropriate
separate authorization. Existing model, component and numerical restrictions
remain authoritative.

## Curved mirror image and instantaneous motion

Read `docs/CURVED-MIRRORS.md` and live `curvedMirrors` capabilities.
Use `opticsim-curved-mirror-facts-v1` with explicit `ideal-gaussian` or
`spherical-paraxial` and `real-positive-local` sign convention. Request
`curved-mirror-image` or `curved-mirror-image-velocity` through the same
unified command. Do not supply arbitrary focal length, brightness or aperture
merely to calculate scale-free magnification: a stated u/f ratio plus curvature
is sufficient. Velocity needs known height and object motion, stationary
mirror, fixed focal length and time unit; transverse motion includes
changing magnification. Focal infinity is not a finite velocity.

Native scenes distinguish `ideal-curved-mirror` from
`circular-arc-mirror`: all geometry and brightness are explicit, new scenes
use `v40` (`native-optical-bench`, or legacy `v6`), and numerical circular rays can aberrate. Their measured reflection
counts are not detected images. Keep local transverse height distinct
from global y. Later physical edits make attached calculations historical;
recalculate using the new facts rather than presenting old values as current.
