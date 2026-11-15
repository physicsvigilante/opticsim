# Conditional prism angles and refractive index from reduced physical facts

The existing problem/preflight workflow exposes **prism-direct-angles** and
**prism-direct-index**. Both are conditional mathematical operations, not native
observations. Neither generates rays, instantiates glass, guesses dimensions or
illumination, or proves which finite face a native ray encounters.

## Explicit physical scope

One homogeneous, isotropic, nondispersive prism with a stated included angle A
and the SAME stated exterior refractive index at its two faces. The author must
select `direct-two-face-transmission` and `normal-angles-signed-deviation`.
Incidence i, entry refraction r1, exit incidence r2, and emergence e are
nonnegative degrees from the relevant normal, each below 90 degrees. The
conventional branch has r1+r2=A and signed deviation delta=i+e-A. A negative
deviation is meaningful for a prism whose index is lower than its exterior.
There is no implicit air, symmetric path, minimum deviation or reflected route.

Angles satisfy 0<A<180 and 0<=i<90. Absolute material indices retain the qualified
[1,4] bounds. These are qualification limits, not universal physical restrictions.
Only angular data is required: no length unit, scale, source brightness, source
position, aperture, native partialReflection setting or finite geometry is added.
The same exterior is explicit because distinct entrance and exit media require
another relationship and qualification. TIR, a third-face exit and repeated
internal reflections must not be replaced with the direct branch.

## Forward request

```json
{
  "format": "opticsim-problem-v1",
  "physical": {
    "format": "opticsim-prism-angular-facts-v1",
    "model": "homogeneous-prism",
    "branch": "direct-two-face-transmission",
    "angleConvention": "normal-angles-signed-deviation",
    "prismAngleDeg": 60,
    "incidenceAngleDeg": 45,
    "outsideIndex": 1,
    "insideIndex": 1.5
  },
  "requests": [{"id":"angles","kind":"prism-direct-angles"}]
}
```

The synthetic example in `examples/prism-angular-facts.json` returns conditional
r1 approximately 28.125506 degrees, r2 approximately 31.874494 degrees, emergence
52.381306 degrees and signed deviation 37.381306 degrees. These are not measured
native angles or a claim about any source problem. Changing only the stated
incidence is a separate mathematical investigation with its own input/evidence.

## Index inversion and uniqueness

`prism-direct-index` requires the same conventions, A, i and exterior index, but
**omits insideIndex** and supplies `deviationDeg`. The nominal measured deviation
is signed, not an unsigned magnitude. Supplying both index and deviation is
rejected rather than overwriting a known value or silently ignoring a constraint.
The separate example `examples/prism-index-facts.json` specifies A=60, i=30,
delta=30 degrees and exterior index 1. Emergence is approximately 60 degrees and
the recovered index is approximately 1.382275; the path is NOT symmetric.

No minimum-deviation inference is needed. With m=n/n0, u=sin(i), v=sin(e),
e=A+delta-i, and w=(v+u*cos(A))/sin(A), the two Snell equations give
m*sin(r1)=u and m*cos(r1)=w. The declared forward-normal branch requires w>=0;
then the sole positive candidate is m=hypot(u,w). It is checked by the same
forward operation, including r2, TIR, numerical and material bounds, and must
reproduce the supplied deviation within 1e-8 degrees.

Known incidence and signed deviation yield **at most one positive index within
this declared branch**. This is not the different problem of finding incidence
from a given deviation, which can have multiple paths. Missing incidence,
unspecified branch, unsigned deviation, unknown external medium, or a statement
such as "slightly greater than critical" is not replaced with a convenient root
or an exact-critical/minimum-deviation assumption. No broader inverse method is
claimed. Successful inversion includes one `candidates` entry and identifies
uniqueness as conditional on the supplied branch.

## Reuse and numerical boundaries

`src/analytical-angle-math.js` extracts the existing planar-query arcsine and
critical-sine classification, retaining the same 2e-12 uncertainty band and
arithmetic. Planar queries and prism queries use that shared code; native
PhyDemo refraction is untouched. The 102-record preservation fixture retains
original planar results AND rejection messages from the pinned baseline.

At or too near the critical boundary, the new query returns
`numerically-indeterminate`, not a falsely exact grazing emergence. Definitely
supercritical cases return `unavailable` with entry/exit TIR identified. The
result value remains null; there is no fabricated deviation for an absent direct
transmission. An admissible native run may nevertheless reflect and later exit
another face, which is a different branch from the requested calculation.

The new service also refuses sine(A)<=1e-10, input/derived grazing within 1e-9
degrees, unresolved inverse-normal cancellation, an index just outside a supported
bound rather than clamping it, and inverse forward-residual failures. These are
conservative floating-point safeguards, not complete conditioning proofs or
measurement-uncertainty intervals. Provided measurements are nominal numerical
facts; precision, experimental noise and model uncertainty are not inferred.

## Ordinary entry points and evidence

```sh
node scripts/preflight-problem.mjs capabilities
node scripts/preflight-problem.mjs examples/prism-angular-facts.json
node scripts/run-problem.mjs examples/prism-index-facts.json \
  --out test-artifacts/llm-authoring/my-prism-index-attempt
```

The output directory must be fresh. Original bytes and hashes, plans and
analytical results are preserved. There are zero native calls and no portable
native scene package. `verifyNative:true` remains unresolved without complete
native facts and returns a non-success exit despite conditional mathematics.
Old unregistered result names are not automatically aliased to these operations.

For JavaScript, use `analyzePrismAngleQuery(facts, {format:
'opticsim-prism-angular-query-v1', kind:'prism-direct-angles'})`, or the index
kind. `prismAngularCapabilities()` and the existing workflow capabilities expose
the same live contract. Source fidelity remains unassessed by the engine.

No saved-scene version, browser analytical interface, public deployment, provider,
new optical component, native observer change, ray budget or upstream pin change
is part of this extension. Existing native-scene imports require full scenes;
these angular requests are not files for the native viewer's scene importer.

## Qualification and bounded transfer

The test-only reference uses a vector Snell construction and an independent
bracketed angular inverse, not the production inverse's closed expression.
A 100-case analytical grid includes 59 direct cases and 41 TIR/other-branch
refusals, with 11 negative-deviation direct cases. Native tests cover two
motivating shapes (isosceles and immersed scalene), an obtuse prism, 24
rotation/scale/material/incidence configurations, real TIR at each face, a
finite alternate-face exit, and unchanged Fresnel/depth/stale suppression.

The native acceptance saves eight distinct synthetic apparatuses: six completed
and two incomplete. Each canonical run has a separate read-only diagnostic
replay; these are 16 executions, NOT 16 independent physical cases. Analytical
acceptance separately saves 23 outcomes with zero native calls. No screenshot or
execution hash is treated as proof of source interpretation or classroom use.

A preselected immersed scalene index investigation was first executed only after
the production modules and physical-checking helper were frozen. Its reciprocal
native probe swaps the entry/exit faces and retraces the ray in reverse. The
reserved inverse input, native geometry and exposure notice are retained in
`test/fixtures/prism-angular-transfer.json`. No production or checker change was
needed for this transfer. It is same-assistant exposed preselection, not an
independent hidden benchmark. Later CI replays are regression evidence.

The development record retains an equal-index grazing rejection encountered
while capturing the preservation fixture, a test that initially expected an
invalid nonfinite JSON value to reach the service rather than the envelope, and
an acceptance assertion that incorrectly demanded exact floating equality with
60 degrees. Corrected checks preserve the rejection and use the predeclared
1e-8 degree verification tolerance; production answers were never rounded or
changed to make the assertions pass. Historical fixtures are not refreshed.

## Physical reference

NCERT, *Physics Part II*, Chapter 9, section 9.6, gives the conventional prism
relations r1+r2=A and delta=i+e-A and distinguishes reciprocal incidences from
minimum deviation. The positive-index inverse above is derived algebraically
from these relations and Snell's law, not a minimum-deviation formula.
Official Ministry of Education/IIT Kanpur reproduction:
https://sathee.iitk.ac.in/sathee-neet/ncert-books/neet-ncert-books/neet-nb-phy-12/phy-12-chapter-9-ray-optics-and-optical-instruments/
