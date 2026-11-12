# Deterministic planar inverse and branch-angle queries (Milestone 11)

This is a **small, explicit requested-calculation contract**, separate from
the canonical scene. The LLM identifies the source, the constraint and
the diagram's branch choices; the deterministic engine validates and
computes angular relationships from the already authored interface indices.
It never generates rays, alters Fresnel policy, applies an unknown material
index, claims native evidence, or silently repairs incomplete native runs.

## Inputs

Input 1 can be either a **complete, existing minimal v5 scene request**
or a narrow **analytical-only ordered-media facts record**. The former
requires source brightness, all geometry and the native Fresnel policy
because it can compile to PhyDemo. The latter requires only indices,
medium ordering, source medium and relevant incidence information—**not**
brightness, artificial layer thicknesses, picture coordinates or a
chosen numerical reflection mode. Analytical-only facts never compile
to a native scene by themselves.

The facts format is `opticsim-planar-angular-facts-v1`:
~~~json
{
  "format": "opticsim-planar-angular-facts-v1",
  "source": {"id": "S1", "region": 0},
  "interfaces": [
    {"id": "I12", "negativeIndex": 1.6, "positiveIndex": 1.8},
    {"id": "I23", "negativeIndex": 1.8, "positiveIndex": 1.3}
  ]
}
~~~
The array order is **explicit negative-to-positive medium order**.
Region 0 is before the first interface, region 1 lies between the
first two, etc. For branch queries, additionally state
`source.incidentAngleDeg` (unsigned from the normal, 0–90° exclusive)
and `source.approach` (`positive` or `negative`). For inverse critical
queries, the incidence is intentionally **absent**; a contradictory
provided incidence is rejected. The query itself specifies propagation
and tangent-side signs. Indices remain finite in [1,4], with exactly
matching shared-media values. A policy `partialReflection` may be
specified as a boolean, but it is **not required for pure angular
mathematics**. If absent, Fresnel reflection is labelled conditional
and never claimed as a chosen native simulation policy. No other optical
components are silently removed from a complete scene request.

Input 2 is this separate query:

**Inverse critical-input angle** (an original source `directionDeg` must be
**absent**, not filled with a sample guess):

~~~json
{
  "format": "opticsim-planar-angle-query-v1",
  "kind": "critical-input-angle",
  "sourceId": "S1",
  "boundaryId": "I23",
  "approach": "positive",
  "tangentSide": "negative"
}
~~~

The approach and tangentSide identify which side of the normal the ray
travels. Without that directional information, an unsigned angle would
correspond to multiple possible source directions. The engine derives
the source direction from the requested critical condition and **only then**
calls the ordinary strict scene-preparation validator on that candidate.

For parallel media with no intervening mirrors, the conserved transverse
index invariant is (q=nsin\theta). At critical incidence at the specified
higher-to-lower-index boundary, (q=n_{out}). The initial incidence
angle is therefore (arcsin(n_{out}/n_{start})), provided the initial
ray and every intervening transmitted segment are propagating.
The engine checks those conditions, and returns **unavailable** rather
than inventing an angle when the model is impossible or unsupported.

At criticality the transmitted direction is only a limiting grazing
direction. No finite-power transmitted ray or native completion is inferred.

**Conditional branch angles**, with **known** source direction:

~~~json
{
  "format": "opticsim-planar-angle-query-v1",
  "kind": "branch-angles",
  "sourceId": "S1",
  "branches": [
    {
      "id": "down",
      "events": [
        {"interfaceId": "I12", "action": "transmit"},
        {"interfaceId": "I23", "action": "transmit"},
        {"interfaceId": "I34", "action": "transmit"}
      ]
    },
    {
      "id": "up",
      "events": [
        {"interfaceId": "I12", "action": "reflect"},
        {"interfaceId": "I1A", "action": "transmit"}
      ]
    }
  ]
}
~~~

Events are **conditional analytical branch hypotheses**, not instructions
to the native simulator. Every bounded branch/event is validated for
structure *before* physical feasibility is evaluated, even when an earlier
event would be unavailable. The solver enforces the actual next interface,
adjacent index consistency, source medium, propagation direction, any
**explicitly chosen** transmitted-only policy, TIR, and equal-index identity
transmission. Missing native Fresnel policy never becomes a fabricated
native setting. It does not assume a weak native branch was retained.

Near the mathematical critical boundary, an uncertainty interval yields
`numerically-indeterminate` with **no outgoing numerical value**, rather
than falsely classifying the branch as physically absent or transmitted.
Above the resolved critical threshold, TIR reflection remains possible
even with `partialReflection:false`, because that option omits *partial*
Fresnel reflection, not TIR. A truly critical transmitted direction is
only a grazing limit, not evidence of a propagating finite-power ray.
Aggregate result status distinguishes all conditional, all unavailable,
all indeterminate and mixed outcomes. No arbitrary code, user formula,
generic ray-route script or symbolic algebra is evaluated.

The interface accepts 1–4 branches with 1–8 bounded events each. The
available output is explicitly `status: conditional` with
`method: analytical-snells-law-plus-specular-reflection`.
A native status remains `not-run` unless separately requested.

## Run locally

After regular project setup:

~~~sh
node scripts/planar-angle-query.mjs capabilities
node scripts/planar-angle-query.mjs b05.request.json b05.query.json --out test-artifacts/llm-authoring/b05-angle
node scripts/planar-angle-query.mjs b06.request.json b06.query.json --out test-artifacts/llm-authoring/b06-angle --native-check
~~~

Use a **new** output directory on each attempt. The CLI saves exact
original request/query bytes and SHA-256s. It then writes
`analytical-result.json` **before** attempting any optional native build,
so a native setup failure cannot erase a successful conditional answer.
All rejected analytical inputs write a structured `report.json`
containing an error and `native: not-run`, with no phantom physical scene.

When a complete forward scene is possible, the CLI saves a normal
hash-bound `derived-forward-scene.qualified.json` package. Its
`qualification.calculations` includes the original parsed request,
typed query, both raw input hashes, method, conditional result and any
computed source-direction field. It imports into the existing browser,
where calculated values are distinct from author assumptions and later
physical revisions. This metadata is not an authenticity proof of the
source question or an independent adjudication.

The existing browser shows the actual **calculated initial/critical
angle** or individual **calculated branch exit angles**, with method,
query hash, conditions and any derived source-direction field. When
a user edits the physical apparatus, the original result is labelled
**historical** and must be recomputed; the old calculation is never
silently promoted as a current native measurement. The general
image-analysis panel explicitly identifies that it has a different
scope from the attached conditional angular calculation, even if the
native forward run is incomplete. Neither source brightness nor the
native weak-ray policy is changed by this display.

For **angular facts without native geometry**, the calculation succeeds
without a qualified scene and explicitly lists missing native-only inputs.
Requesting `--native-check` in that case records `not-run` and retains
the analytical result. If a native build fails, the result and portable
package remain saved; the report records the native failure separately
(exit 2). Native incomplete runs retain their original suppression.
No new physical values or fake rays are inserted to obtain a passing run.

## Original and independent development cases

The evaluation file `evaluation/planar-angular-v1/cases.json` was saved before
CI execution. It refers to B05/B06 already viewed previously by the
same assistant (not blind or independent scoring) and two additional
synthetic cases:

- Reverse-travel critical constraint with materials 1.33, 1.6 and 1.1.
- A middle-medium source with a transmitted branch in one direction and
  reflected-then-transmitted branch in the other.

**B05** predicts an initial normal angle **54.3409123039°** and a
target critical incidence **46.2382573073°**. The derived forward
direction is a computed value, *not* a missing datum invented by the LLM.
PhyDemo still reports exact-critical tracing incomplete.

**B06** predicts conditional angles **26.6331187492°** and
**40.5416018735°** for the two declared paths. Its native full-Fresnel
run remains incomplete, and the weak reflected ray is absent from
default-mode native observations. Neither angle is relabelled as a
native image/ray observation.

All numeric solutions are **model-conditional**: real questions can
contain different geometry, media, polarization or material properties,
and a correctly computed ideal result does not certify the author's
interpretation or the source question. This is not an independent model
accuracy benchmark.

## Scope and next work

This milestone covers unsigned ideal Snell angles for 1–4 parallel
planar boundaries; one source; normal-incidence, reflection, transmitted
and internal-reflection branches. Native scene creation requires separate
complete numerical/geometry inputs, and the canonical scene schema is
unchanged. It is not a general arbitrary-geometry
inverse solver, analytical power/throughput solver, arbitrary equation
evaluation system, path detector or full optical model.

Canonical v4/v5 validators, PhyDemo's native scene, release pin and
refraction truncation policy are not modified. The recurring numerical
grazing issue stays tracked separately in issue #23. Any later linkage
to browser result requests must preserve these status/method boundaries
and the original authoring provenance.
