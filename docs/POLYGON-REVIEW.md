# Polygon review and authoring hardening — 13 November 2026

Reviewed baseline: PR #41 head `102b0436fb4c05ede1c88141241dd47498dab5af`.
The unchanged baseline was reproduced locally with Node 24.19.0 and the pinned
PhyDemo core; all 362 pre-existing tests passed. New targeted tests exposed
three integration defects despite that green baseline.

## Reproduced defects and fixes

| Defect | Before the fix | Correction |
|---|---|---|
| Fourth-vertex unit conversion in the evaluation scorer | `x4`/`y4` were missing from a duplicated three-vertex length-field pattern. Equivalent cm/mm scenes differed in raw physical/stable-ID comparison, including negative controls. | Reuse `LENGTH_PARAMETERS` from the live contract. Positive, invalid and missing-fact controls retain their physical input without repairing it. |
| Explicit nonexistent or incompatible observation target | Preflight accepted the request and launched a native run, only to report an unavailable value afterward. | Resolve explicit IDs against the requested physical type before execution. Missing IDs report `UNKNOWN_COMPONENT_TARGET`; wrong-type IDs report `INCOMPATIBLE_COMPONENT_TARGET`. Candidate IDs are diagnostic, never silently substituted. |
| Malformed model request aborts held-out review | Rejected preflight reports omitted `native.calls`; the reviewer asserted `undefined === 0` before recording the model failure. | Every rejected preflight report records zero native calls. A malformed first response remains a failed first attempt and later cases continue; no retry, correction or external model call. |

Four targeted regression tests failed on the original code and passed after
repair. The malformed-request regression uses a mocked provider and verifies
that the original capture bytes are unchanged. It is not an independent
language-model score. No sealed questions, attempts or reference files changed.

Valid requested observations can still run alongside unresolved targets;
`verifyNative:true` remains explicit authorization to verify a scene even when
its measurement targets cannot be resolved. The original envelope is preserved.

## Shared finite glass geometry, not another optical engine

The triangle and quadrilateral adapters now reuse `finite-glass-geometry.js`
for finite face labels/normals, native Glass compilation and identification of
an already returned native hit. Triangles retain three vertices and their v8
validator; quadrilaterals retain four vertices and their v9 convexity/clearance
validator. Historical scopes, numerical limits and PhyDemo source are unchanged.

The native observer continues to delegate exactly once and preserves the actual
ray mutation and return object, including Fresnel branches. Tests compare the
observed operation directly with an unwrapped native instance and ensure
returned measurement copies cannot mutate later readings.

## Validation performed

The repaired local suite contains **368 tests**, all passing without skips.
It includes **54 deterministic nonrectangular/rotated/material-ratio cases**
with signed local Snell/reflection checks, and the existing 12 polygon and 11
prism synthetic command-line controls with their immutable vertex sweeps.

An additional exploratory seeded geometry sweep at the baseline checked 2,400
configurations: 2,082 completed, 303 were rejected by geometry validation, and
15 remained incomplete. No signed local Snell/reflection mismatch was found
among the completed sampled first-face events. This exploratory sweep is not
proof for all rays, a JEE answer score, or continuous optical coverage.

Local Chromium was blocked from localhost by the execution environment's
browser policy, before the viewer loaded. Browser acceptance must therefore be
verified by the existing GitHub CI browser workflows, not inferred from this
local attempt. Consult the PR's exact-head CI record for final browser results.

## Continuing development

This hardening removes duplicated geometry before the next system extension.
Opaque blockers/apertures remain the next proposed optical capability; they
are not silently added here. Extra refractive source modes remain deferred.
No new equation language, per-question solver, native ray tracer, public site
or external-model invocation is introduced by these repairs.
