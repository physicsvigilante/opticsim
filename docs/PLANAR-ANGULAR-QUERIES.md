# Deterministic planar inverse and branch-angle queries (Milestone 11)

This is a **small, explicit requested-calculation contract**, separate from
the canonical scene. The LLM identifies the source, the constraint and
the diagram's branch choices; the deterministic engine validates and
computes angular relationships from the already authored interface indices.
It never generates rays, alters Fresnel policy, applies an unknown material
index, claims native evidence, or silently repairs incomplete native runs.

## Inputs

Input 1 is the ordinary **minimal LLM scene request** with explicit lengths,
source brightness and 1–4 parallel planar interfaces using the already
supported v5 component types. It must have exactly one native single-ray
emitter and no other optical apparatus in this first analytical scope.
All media indices and partial-reflection choices remain explicit; no
supporting lens, boundary or replacement source is invented.

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
to the native simulator. The validator enforces the actual next interface,
adjacent index consistency, the current medium, propagation direction,
the Fresnel reflection policy, impossible transmission under TIR,
and zero-reflection equal-index limits. It does not assume a weak native
branch was retained. A requested transmitted ray at an exact-critical
boundary is marked unavailable. No arbitrary code, user formula,
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
original request/query bytes, SHA-256s and the report. On a valid inverse
solution it also saves a derived forward scene, labelled as derived.
The scene is **not** a new original first request or a qualified
evidence package; provenance is in the surrounding report. The optional
native check runs the pinned, **unchanged** engine as a separate observation
and can be incomplete without invalidating a conditional mathematical result.

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
and internal-reflection branches. It is not a general arbitrary-geometry
inverse solver, analytical power/throughput solver, arbitrary equation
evaluation system, path detector or full optical model.

Canonical v4/v5 validators, PhyDemo's native scene, release pin and
refraction truncation policy are not modified. The recurring numerical
grazing issue stays tracked separately in issue #23. Any later linkage
to browser result requests must preserve these status/method boundaries
and the original authoring provenance.
