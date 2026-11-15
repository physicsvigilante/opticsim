# Conditional prism angles from reduced physical facts

The existing problem/preflight workflow can evaluate two operations:
`prism-transmission-angles` and `prism-index-from-deviation`. They need explicitly
stated angular/material facts, not a fabricated native optical apparatus.

Both use `opticsim-prism-angular-facts-v1`. The caller must state
`model: homogeneous-prism` and `branch: direct-two-face-transmission`. The exterior
is one homogeneous medium with the SAME explicit `outsideIndex` at both faces.
There is no implicit air index, minimum-deviation assumption, symmetry assumption,
unknown-incidence inverse, multiple-reflection solution, dispersion model, or
finite-face reach test. Angles are in degrees, refractive indices dimensionless.

## Physical branch and inputs

`apexAngleDeg` A is between 0 and 180 degrees. `incidenceAngleDeg` i is between
0 inclusive and 90 exclusive. The supported branch uses nonnegative principal
angles r1, r2 and e from the relevant face normals, each below 90 degrees, with
r1+r2=A. This deliberately excludes alternative signed internal branches.
Absolute indices retain the qualified [1,4] range. The prism may have a lower
index than its surrounding medium; signed deviation can therefore be negative.

Forward analysis requires `insideIndex`. Inverse analysis requires
`deviationDeg` and `deviationConvention: signed | magnitude`. Signed deviation
means delta=i+e-A, not an unspecified Cartesian clockwise sign. A magnitude
explicitly evaluates both +delta and -delta. Missing convention requires
information; the service never assumes that deviation is positive.

A supplied `insideIndex` on an inverse request is an independent consistency
constraint, not an unknown to overwrite. Supplied deviation on a forward request
is likewise checked. Invalid optional values are not ignored because a different
result was requested. Unexpected fields or full native scenes are refused; no
optical component is silently deleted to fit the angular model.

## Public authoring

Use the existing envelope and commands:

```json
{
  "format": "opticsim-problem-v1",
  "physical": {
    "format": "opticsim-prism-angular-facts-v1",
    "model": "homogeneous-prism",
    "branch": "direct-two-face-transmission",
    "apexAngleDeg": 60,
    "incidenceAngleDeg": 50,
    "outsideIndex": 1,
    "insideIndex": 1.5
  },
  "requests": [{"id": "angles", "kind": "prism-transmission-angles"}]
}
```

```sh
node scripts/preflight-problem.mjs capabilities
node scripts/preflight-problem.mjs examples/prism-angle-facts.json
node scripts/run-problem.mjs examples/prism-angle-facts.json \
  --out test-artifacts/llm-authoring/my-prism-attempt
```

The output directory must be new. Original bytes, hashes, plan, analytical
results and failures use the established evidence workflow. No native scene or
portable native package is created. These analytical requests run without a
PhyDemo checkout or build. An explicitly requested native verification remains
unresolved until a complete supported native apparatus is separately supplied.
Analytical success does not satisfy or override that request.

The native-scene browser importer does not accept analytical fact files. There
is no new browser control, scene version, automatic migration or provider here.
For direct JavaScript, use `analyzePrismAngleQuery(facts, query)`, with query
`{format:'opticsim-prism-angle-query-v1',kind:'prism-transmission-angles'}` or the
inverse kind. `prismAngleCapabilities()` and ordinary workflow capabilities
publish the required facts, branch, index bounds and numerical policy.

## Shared computation, not a ray solver

`src/angular-math.js` extracts the former planar analytical module's scalar
inverse-sine and Snell branch classification expressions unchanged. The existing
planar and new prism analytical services use the same functions. Native PhyDemo
refraction, reflection, TIR, intersections and branching are not modified.

Forward relations are n0*sin(i)=n*sin(r1), r2=A-r1, n*sin(r2)=n0*sin(e), and
delta=i+e-A. Before publishing transmission, both boundary and direct-branch
conditions are checked. TIR returns unavailable with a null transmitted result;
near-critical classification is numerically indeterminate. No alternate
internal-reflection route is substituted.

For the inverse, e=A+delta-i is checked first. Let p=n0*sin(i) and q=n0*sin(e).
Then n*cos(r1)=(q+p*cos(A))/sin(A), so

    n = hypot(p, (q+p*cos(A))/sin(A)).

The signs of BOTH internal normal components must be admissible. Blindly
squaring a negative normal would introduce an extraneous solution. Each candidate
is rechecked through the forward calculation and angular residuals. This is a
bounded derivation for the declared branch, not an arbitrary inverse tracer.

A signed deviation has at most one candidate on this branch. A magnitude can
have two; the service returns `multiple-solutions` and `value:null`, without
ranking. For A=40 degrees, i=30 degrees, n0=1.5 and magnitude 5 degrees, the two
indices are approximately 1.6750760458 and 1.3290406845. Separate explicitly
declared native apparatuses verify both candidates. A known material constraint
may eliminate one, but it must actually be supplied.

The common prism relations are described in NCERT Physics, Ray Optics and
Optical Instruments, section on refraction through a prism (official IIT Kanpur
SATHEE edition). The inverse expression above is derived from those relations;
it is not the minimum-deviation formula.

## Qualification and limitations

Successful results are `conditional`, `nativePathVerified:false`. They report
r1, r2, e, signed deviation and indices. No source brightness, launch position,
prism size, Fresnel policy, detector, intensity or simulated image is invented.

A real finite triangle can send a ray to its third face even when the angular
facts admit this calculation. A retained native counterexample demonstrates
that distinction. Native geometry and actual encounters must be verified
separately. Full Fresnel and depth-limited native runs keep their existing
incomplete status and suppress accepted native observations.

The scalar critical band is the existing 2e-12 ratio band. The new service's
conservative policy additionally uses an angular residual/resolution of 1e-8
degrees, relative index tolerance 1e-10, and minimum absolute apex sine 1e-8.
These do not relax native or historical tolerances. They describe numerical
qualification, not measurement error bars or proof of exact criticality.

A tiny nonzero deviation (for example 1e-15 degrees) can round both sign branches
to the same material. The service returns `UNRESOLVED_SMALL_DEVIATION`, not exact
zero or two resolved distinct candidates. Exact input zero is checked once.
Near-grazing, near-degenerate, critical and index-boundary cases remain explicit
numerical refusals. A partly unresolved or out-of-range sign branch cannot be
silently dropped to claim a unique unrestricted answer. `partially-indeterminate`
and `partially-unavailable` retain candidate diagnostics with `value:null`.

## Evidence and transfer

Tests preserve 252 complete pre-extraction planar response hashes from exact
baseline source and 1296 scalar-expression comparisons. These are regression
controls, not independent physical verification. Separate vector mathematics
checks 180 material/angle inputs, retaining refusals. Native controls verify two
motivating apparatus classes across 18 rotations/scales, both magnitude
candidates, TIR, different-face geometry and incomplete execution. Expectations
never supply intersections or outgoing rays to PhyDemo.

A preselected lower-index immersed obtuse-prism task was first executed after
production and checking-helper hashes were frozen. Forward and signed inverse
worked, but a test-harness expectation incorrectly required a unique magnitude
inverse. The original failed run is retained. Independent vector and native
checks establish two candidates; only the harness expectation changed. No
physical input, production source or physical checker changed for this transfer.
The final regression is exposed same-assistant evidence, not an independent
hidden benchmark or clean first-attempt success.

Run `npm test`, `node scripts/prism-angle-acceptance.mjs` and
`node scripts/prism-native-acceptance.mjs` after ordinary setup. The analytical
acceptance and native qualification have separate evidence directories and
counts. Their scripts refuse reused output directories. The existing unified
workflow runs both and uploads their evidence; no new workflow or deployment is
introduced. Actual run records establish local/CI/browser coverage, not this
scope document. Historical first attempts and scene fixtures are not refreshed.
