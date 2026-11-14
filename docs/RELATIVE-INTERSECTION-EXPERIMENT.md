# Relative-coordinate planar intersections — experiment, not production

This follows the exact recorded-line audit in PR #63 and issue #23. It tests
one proposed numerical change without editing the pinned PhyDemo checkout,
production `src/`, schemas, numerical thresholds, browser or JSON workflow.

## Candidate and boundary

`scripts/relative-intersection-candidate.mjs` evaluates the intersection using
relative endpoints: r = a.p2 - a.p1, s = b.p2 - b.p1, q = b.p1 - a.p1,
t = cross(q,s) / cross(r,s), point = a.p1 + t*r. The existing native
forward-point dot test and Simulator minimum-segment cutoff are retained.
There is no epsilon, snapped point, angle nudge, brightness adjustment,
exact-arithmetic fallback or alternate refraction law.

For paired trials only, `experimentalPlaneCore` overrides `checkRayIntersects`
on newly loaded PlaneGlass **instances**. It does not change prototypes or
vendor files. This deliberately changes the experimental run's intersection
behavior; it is NOT a read-only observation or ordinary canonical execution.
All candidate evidence is explicitly noncanonical. Overrides are not
serialized and must never be exported as a qualified model. Production loads,
native exports and browser runs continue to use the original pinned engine.

## Bounded comparisons

The existing 24 synthetic critical/neighboring/normal configurations are run
in both native numerical modes, once unchanged and once with the candidate:
48 paired cases. Exact references examine the **same recorded baseline
endpoints** after tracing, so improvements are not inferred by comparing two
differently rounded ray inputs. Candidate critical outcomes are retained;
completion alone does not establish physically exact critical propagation.

Additional controls comprise 12 normally incident two-interface systems with
0.011 mm and 0.02 mm genuine separation, forward/reverse travel and rotations
0/37/90 degrees, plus three rotated oblique interface–detector–mirror returns.
These must preserve actual interface hits, detector crossings, relative power,
reflection count and an independently checked Snell angle. These are supported
v5 planar compositions, not new lenses-in-glass or finite-glass capabilities.

The sealed exposed B06 full-Fresnel request is also replayed unchanged in both
modes with/without the candidate. It must remain incomplete with requested
observations withheld; a geometry experiment is not a weak-branch solution.
A subsequent fresh baseline run is compared in full to establish isolation.
One suite execution contains 131 traces: 96 grazing, 30 composition controls,
four weak-branch replays and one isolation replay. Repetition in unit tests
and CLI is software regression, not additional independent physical evidence.

## Known limitation: do not promote this formula as robust

A deterministic algebraic counterexample is retained, not hidden:

```
e = Number.EPSILON
ray      = [(0,0), (1,1+e)]
boundary = [(0,-e*e), (1-e,1)]
```

The exact intersection of these represented endpoints is unique, forward and
about (0.5,0.5). Binary64 differences/products in the candidate cancel to a zero
determinant, which it treats as parallel. This is a line-arithmetic stress
case, not a newly admitted source-on-interface physical scene. The exact
reference is independent BigInt rational arithmetic and is never used by the
candidate to steer a ray. Passing the limitation test means this defect was
retained and detected, NOT fixed. Relative coordinates alone are therefore
insufficient for a generally robust upstream geometry replacement.

## Reproduction and evidence

```
npm run setup
npm test
node scripts/relative-intersection-experiment.mjs
```

The CLI uses fresh nonsymlink storage under
`test-artifacts/llm-authoring/relative-intersection/`, saves explicit synthetic
inputs and their hash, candidate-source SHA-256 and paired evidence, then
checks acceptance. It verifies vendor commit and tracked-file cleanliness
before/after execution. The existing numerical workflow uploads this report;
no new permanent workflow, provider or deployment is added.

No browser qualification, global geometry replacement, finite Glass change,
new solver, original-problem accuracy score or upstream fix is claimed. This
experiment can establish a localized improvement and its limits. A production
numerical-policy or dependency change needs separate review and approval.
