# JEE J14: conditional two-branch small-angle prism inverse

**Draft analytical capability, not a native Fresnel-on optical scene.** This standalone JSON query addresses a reusable first-order angular relation: one normally incident ray enters a small homogeneous prism at face 1, then light reaching face 2 has both a transmitted branch and a reflected branch that returns to and leaves face 1. No finite ray path, polarization, interface power, 3D physical scene, detector, or complete original JEE answer is implied.

## Source-fact boundary and original problem

The frozen developmental 20-case audit's J14 is `08_Ray_Optics_Explanations/05_Prism/Problems/015.png`. Its source facts: parallel beam enters face 1 normally; the prism has a small apex; face 2 partially transmits and reflects; the **forward transmitted** branch deviates by 1 degree; the **backward exiting** branch deviates by 4 degrees relative to the reversed incident beam. The original Problem does **not** specify the exterior refractive index, a finite triangle, source brightness, a detector, or a numerical budget. No Solutions are read or scored here. Frozen protocol committed before implementation: [`evaluation/jee-j14-prism-two-branch-inverse-v1/frozen-protocol.json`](../evaluation/jee-j14-prism-two-branch-inverse-v1/frozen-protocol.json).

The new standalone model is conditional on these explicit first-order 2D geometric assumptions. Other JEE prism problems (including J13 with an internal ray *slightly above* critical incidence) do not automatically use this branch model.

## Mathematical derivation

Define positive apex `A` in degrees, relative index `m=n_inside/n_outside`, positive transmitted deviation `T` measured from forward incident light, and positive return deviation `R` measured from **reversed** incident light. At first-order for small `A`, initial normal incidence gives zero first-face bending. The second-face transmitted angle is approximately `m*A`, so

    T=(m-1)*A

The ray **reflected at the second face** reverses inside the prism at approximately `2*A` from the reversed initial direction. On leaving face 1, its external angular deviation is approximately `2*m*A`:

    R=2*m*A

Therefore the inverse for a *positive* apex and `m>1` is

    A=R/2-T
    m=R/(R-2*T)       (requires R>2*T)

For the original angular inputs `T=1°` and `R=4°` this yields **`A=1°`, `m=2`** conditionally. The result does **not** silently call the exterior air. If `outsideIndex` is omitted, `insideIndex` is `null`. Supplying an explicit exterior index of `1` separately produces an absolute interior index of `2`; that index value is an **added physical assumption**.

For a conservative check of first-order applicability the model also evaluates **exact-Snell angular functions only**:

    T_exact=asin(m*sin(A))-A
    R_exact=asin(m*sin(2*A))

These values are independent of any native simulation and do not solve the nonlinear inverse, enforce physical finite reach, assign Fresnel power or generate optical rays. For J14 their deviations from the linear model are approximately 0.000305° and 0.002442°. A model qualified within the declared 0.05° residual gate is still first-order and source-conditional; that fixed threshold is **not** a rigorous global modelling-error bound or measured uncertainty.

## Strict standalone query

The complete [example](../examples/jee-j14-prism-two-branch-inverse-v1.json):

```json
{
  "format": "opticsim-prism-two-branch-inverse-v1",
  "kind": "small-angle-prism-apex-relative-index",
  "model": "first-order-small-angle-homogeneous-prism",
  "branchConvention": "normal-first-face-incidence-second-face-reflection-and-transmission",
  "angleUnit": "deg",
  "transmittedDeviationDeg": 1,
  "returnedDeviationDeg": 4
}
```

The only optional field is numeric `outsideIndex`. All seven other fields are required and unknown fields, malformed numbers or undeclared branches are rejected rather than repaired. `capabilities` publishes the exact accepted domain:

```sh
node scripts/prism-two-branch-inverse-query.mjs capabilities
node scripts/prism-two-branch-inverse-query.mjs \
  examples/jee-j14-prism-two-branch-inverse-v1.json \
  --out test-artifacts/llm-authoring/j14-inverse-run-01
```

Every run reserves an unused output directory, stores `input.json` **byte-for-byte** and its SHA-256, and writes a conditional result, explicit `unavailable`/`numerically-indeterminate` status, or `rejected` report. It **never** creates a qualified native scene. `native.status` remains `not-run` in successful, negative, unresolved and rejected cases.

## Refusals, provenance and safety

- The stated `T` and `R` must both be positive and no greater than 10°. The inferred apex must be positive and no greater than 5°, and relative index must be no greater than 4. Exterior and derived interior absolute indices, when provided, must be in [1,4]. No material is filled in from common textbook convention.
- `R=2T` produces a zero-apex/infinite-index singularity, **not a physical result**. `R<2T` cannot represent the declared positive-apex greater-index branch. Near the singularity (`|R-2T|<=1e-7°`) is withheld as numerically indeterminate. Tiny positive angles at the `1e-8°` resolution floor are also withheld.
- The independently evaluated exact-Snell branch must be propagating and not near the critical boundary (`1e-5` sine margin), and its angular residual relative to first-order must be at most 0.05°. Otherwise the numerical result is withheld. These bounds deliberately limit the domain rather than turning the model into an unreviewed exact solver.
- Source ray emission and finite prism position are unknown. No native ray encounters are supplied, simulated or counted by this standalone query.
- Separate [research PR #188](https://github.com/physicsvigilante/opticsim/pull/188) observed actual forward and return native Glass+Beam sample events, **but Fresnel-on native truncation made them unqualified**. The current v22 production native prism continues to require `partialReflection:false`; no branching policy, native core, historical schema or UI is changed in this PR.
- The original JEE J14 textbook answer and educational effectiveness are **not** independently graded. Simulated coverage stays zero for this analytical query; conditional physical relation is a separate evaluation axis.

## Release gate

The new files are an isolated analytical module, byte-bound CLI, tests, frozen protocol, example and this document. Existing `src/` optical systems, canonical schemas, pinned PhyDemo, fixtures and historical attempts remain untouched. After full exact-source CI (including existing native and real Chrome regressions), obtain **one focused independent physics/code/evidence review** of this final source tree, then an owner release decision. Until then the PR stays draft and unmerged. No independent review of research-only PR #188 is needed to review this isolated analytical model.
