# Planar refraction: native capability and scoped contract

This milestone adds a **v5 planar-media scene** while retaining existing v4
scenes and validators unchanged. It is not a new ray tracer or an inverse solver.
The existing authoring request, qualified package, revision and sweep interfaces
are reused. Only requests containing `planar-interface` become v5; old requests
still produce v4. V4 cannot acquire refraction by editing its component names.

## Native capability audit

Pinned upstream: `ricktu288/ray-optics`, commit
`811f508d2b070898c241a568b0c167dcb8645251` (v5.4.0).
Sources audited: `src/core/sceneObjs/glass/PlaneGlass.js`,
`src/core/sceneObjs/BaseGlass.js`, `src/core/sceneObjs/lightSource/SingleRay.js`,
`src/core/Simulator.js` and `src/core/Scene.js` at that exact commit.

`PlaneGlass` is an infinite half-plane, not a finite segment or a closed polygon.
Its two points define an oriented supporting line. `onRayIncident` delegates to
native `BaseGlass.refract`; the native engine chooses every intersection and
computes Fresnel branches and total internal reflection. `SingleRay` supplies
one actual ray with an explicit direction and native `gap=true`; no cone edge
is relabelled as a central ray. Source brightness remains relative native power.

Native glass indices are relative multiplicative factors. We compile a parallel
ordered interface to a positive-normal half-plane with index `positiveIndex /
negativeIndex`. Overlapping half-planes telescope: each region has its stated
index normalized by the leftmost/negative exterior index. All exposed ray
angles and Fresnel ratios are invariant under this common normalization. No
absolute speed, optical path length, phase, dispersion or time of flight is
claimed. Native shading represents effective normalized indices, not calibrated
material appearance. Absolute author-supplied values remain in the canonical
scene and qualifications, outside the native objects.

## Minimal authoring data

```json
{"id":"I1","type":"planar-interface","parameters":{
  "x":0,"y":0,"normalDeg":0,"negativeIndex":1,"positiveIndex":1.5,
  "partialReflection":true
}}
```

The normal is `(cos(normalDeg), sin(normalDeg))` in x-right/y-up coordinates.
Positive signed distance is the positive-index side. x/y locate **any point**
on the infinite boundary. They are not endpoints or aperture choices. Indices
are explicit dimensionless numbers in [1,4]. The boolean `partialReflection`
is also required; no index or reflection policy is inferred.

V5 currently admits 1–4 single-ray emitters, 1–4 parallel interfaces with
consistently directed normals, up to four existing finite mirrors and two
passive detectors. Interfaces are separated by >=0.01 mm and adjacent indices
must agree exactly. Sources cannot lie on an interface. Finite mirrors and
detectors must remain wholly within one medium, separated from its boundaries.
Existing source/surface and finite-surface collision checks remain in force.

Nonparallel/crossing interfaces, coincident boundaries, curved surfaces,
negative/complex indices, absorption, dispersion, gradient media, ideal lenses
in media, polarization control and arbitrary closed regions are out of scope.
The schema rejects them rather than constructing an equivalent apparatus.

A source retains type `point-source` and uses emission
`{"mode":"single-ray","directionDeg":30}`. The canonical cone-angle field
is retained as inactive boilerplate for the existing source interface; it has
no effect on native SingleRay and is not an authored aperture. Other source
modes remain available in historical v4, but not in this first v5 scope.

## Reflection policy and native numerical limits

With `partialReflection:true`, use native Fresnel partial reflections. Native
weak-branch thresholds and depth/segment budgets can truncate multiple-reflection
series. Such runs remain **incomplete**, their partial diagnostics are retained,
and requested measurements are **suppressed** by the existing result contract.
No threshold, intensity, ray or completion flag is modified to get a pass.

With `partialReflection:false`, the author explicitly selects the native
**transmitted-only approximation**: partial Fresnel reflection is neglected,
while total internal reflection remains active. This is not a complete dielectric
power model. Requested results and the browser label the approximation. It is
never selected automatically to repair a Fresnel run.

The pinned default-color implementation can amplify weak secondary rays for
nongap source sampling. In particular zero-power branches can acquire nonfinite
power for some nongap inputs. The scoped native single-ray source and its native
gap-preserving branches avoid that path without mutating rays or upstream code.
Observers reject nonfinite branch evidence as an execution error regardless.
Expansion to cones requires a separate native-behavior audit.

## Observations, not prescribed paths

Instance-local wrappers call each native `onRayIncident` once with exactly the
same arguments and preserve its return object and mutated rays. Memory is bounded
by aggregate counts plus the **first event per interface**, not a ray-history
viewer. No labels are inserted into native rays or serialized native objects.

Requested kinds: `interface-interactions`, `interface-tir-count`,
`interface-incidence-angle`, `interface-transmission-angle`,
`interface-reflection-angle`, and `interface-first-event`. Target a stable
interface component ID. Angles are unsigned degrees from the normal, computed
from the incoming and actual outgoing native vectors. Counts describe native
encounters/branches, not unique rays, sources, optical images or full paths.

The first event is simulation-order dependent, especially with multiple sources
or repeated reflections. A missing transmitted branch under TIR is unavailable,
not zero degrees; zero incidence and zero encounters remain valid observations.
No encounter means no angular result. Incomplete, stopped and stale execution
suppresses all requested interface results. Raw partial event records are only
execution diagnostics. Exact-critical classification follows native floating-
point behavior; tests bracket the critical angle and do not invent a transmitted
finite-power ray at the tangent limit. TIR classification uses the audited native
return path, not an independently implemented Snell test.

## Workflow

Use `scripts/qualified-scene.mjs create` with a normal request and observable
array. The existing `revise` command accepts atomic medium-index changes.
For layers, changing an interior index requires changing both adjacent fields
in the same revision; the single-parameter sweep cannot silently update another
field to repair consistency. Source direction sweeps work without that issue.
The provided synthetic record is `evaluation/planar-refraction-v1/first-request.json`.

Validation must include exact native normal/oblique/reversed incidence,
near-critical and TIR cases, rotation/unit/order invariance, weak-branch
truncation, explicit transmitted-only composition, detector observations,
serialization, qualified revision, stale suppression, a real angle sweep and
browser import/edit/export. Mathematical test oracles stay outside production
ray execution. A development demonstration is not independent LLM accuracy.
