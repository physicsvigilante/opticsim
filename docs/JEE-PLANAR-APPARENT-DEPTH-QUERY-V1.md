# JEE planar apparent-depth query v1 — bounded analytical engine candidate

**Draft, main-based. Not released or merged.** This engine capability is a separate, typed analytical question about a *known* source and a *single* ideal infinite planar refracting boundary. It is intentionally **not** a new PhyDemo ray tracer, native observer, reconstructed image, or general optical apparatus. The existing canonical v1–v13 scene contracts, v5 native planar refraction, pinned PhyDemo and its detector-result qualification are unchanged.

The independently reviewed [PR #143 feasibility report](https://github.com/physicsvigilante/review_sandbox/blob/main/projects/opticsim/pr-143/reviews/review-01-chat-b.md) supports a narrower physical interpretation: real native detector observations in isolated one-ray experiments agree with Snell's law and a mathematical backward extension. The familiar JEE textbook apparent-depth relation is a **paraxial limit**, not a common virtual point for every finite incidence angle.

## Authorable input

The input is explicit, strict JSON: no missing material indices, location, normal or observation condition is guessed; no incomplete diagram is silently completed.

```json
{
  "format": "opticsim-planar-apparent-depth-query-v1",
  "lengthUnit": "mm",
  "source": {"x": -60, "y": 0},
  "interface": {
    "x": 0, "y": 0, "normalDeg": 0,
    "sourceIndex": 1.5, "observerIndex": 1
  },
  "observation": {
    "kind": "finite-incidence-angle", "incidentAngleDeg": 5
  }
}
```

The interface point is any point on the **infinite** boundary. Its unit normal `n=(cos normalDeg,sin normalDeg)` points from the **source** medium (negative signed side) to the **observer** medium (positive signed side). An explicit signed incident angle is measured from that normal, positive towards its CCW tangent `t=(-n_y,n_x)` in world x-right/y-up coordinates. The source must be at least 0.01 mm on the negative side; other orders are **rejected** rather than silently changing the normal.

`lengthUnit` can be `mm`, `cm` or `m`, converted to mm with complete authored points inside ±10000 mm. Both material indices must be explicit finite values in [1,4], as in the native planar contract. The `finite-incidence-angle` field must be finite, strictly between −90° and +90°. This is **incident** angle on the source side, not an unknown observer/view angle deduced from a drawing. An optional physical observer coordinate, detector or ray path is not accepted by this v1 calculation schema.

For a distinct **paraxial-only** query, replace `observation` with `{"kind":"paraxial-limit"}` and do *not* supply an incident angle.

## Mathematical meaning and boundaries

Let `P` be the boundary point, `S` the source, `n` the source-to-observer normal, `t` its CCW tangent, and `d=−(S−P)·n>0` the real perpendicular depth. Let `F=P+((S−P)·t)t` be the interface foot of the source axis. For incident angle `i` and a physically propagating transmitted ray, Snell's law gives `sin(r)=(n_source/n_observer)sin(i)`. The proposed incoming ray meets the ideal infinite plane at `Q=F+d tan(i)t`.

The **backward mathematical extension** of this candidate transmitted direction reaches the normal axis through S at `A=F−d_app n`, where

`d_app(i)=d tan(|i|)/tan(|r|) = d (n_observer/n_source) [cos(r)/cos(i)]`.

The second algebraically equivalent expression is used for better numerical conditioning away from exact axial inversion. This is a conditional optical construction, not a physical backward ray or an actual detected virtual image. A `conditional-axis-intercept` result includes explicitly labelled `apparentPointMm`, `interfaceCrossingMm`, `apparentDepthMm`, incidence/transmission angles, and a comparison `paraxialLimitMm`. These positions are analytical predictions, not native object or detector positions.

The separately requested *limit* is `d_app,paraxial=d (n_observer/n_source)`. It returns `resultKind:paraxial-limit`, with no claim that an exact on-axis ray uniquely identified a virtual point. One **exactly normal** incident single ray instead returns **`not-identifiable`** and `value:null`. A very small nonzero angle (under 0.000001°) or very grazing input (cosine ≤1e−8) returns **`numerically-unstable`**, rather than claiming a well-conditioned inversion.

This analytical calculation refuses a near-critical ambiguity using the project's existing `classifySnellTransmission` tolerance of `2e−12` in the dimensionless refraction ratio. Definite higher-to-lower-index TIR returns `TIR-no-transmission`, no apparent position. A predicted intercept/crossing outside ±10000 mm returns `numerically-unstable` with no physical value. Near-critical cases cannot be accepted merely by clamping a ratio slightly above one. Equal-index transmission works without a fictitious boundary effect.

## Result provenance and CLI

The v1 output is `opticsim-planar-apparent-depth-result-v1`. Its *only* currently supported numerical methods are `analytical-snells-law-conditional-axis-intercept` and `paraxial-snells-law-limit`. It explicitly records `native.status:not-run`, `native.observations:null` and `nativeImageDetected:false`. This does **not** mean an optional native run was performed or an image appeared.

```sh
node scripts/planar-apparent-depth-query.mjs capabilities
node scripts/planar-apparent-depth-query.mjs input.json --out test-artifacts/llm-authoring/unique-apparent-depth-trial
```

The CLI refuses to overwrite an existing output directory. It preserves the **unaltered input bytes**, their SHA-256, an `analytical-result.json` on valid input, and a `report.json` for both valid and invalid inputs. Invalid input is rejected *before* any native work; physically unavailable/indeterminate results remain successful typed analyses with `value:null`. No qualified forward PhyDemo scene is fabricated because source brightness, Fresnel policy, detector and full physical observability were deliberately not specified.

## Required independent tests and deliberate omissions

Contract tests should cover mm/cm/m invariance, translation/rotation, signed ± angles, known 40-mm near-axis limit for 60-mm depth and 1.5→1, finite-angle depth differences, index reversal/equality, precise critical and TIR cases, source-side confusion, missing indices, 0° non-identifiability, stale/incomplete native evidence (separately, without promoting it), and evidence file integrity. A separate test-only native cross-check may author full v5 scenes with explicit source brightness and transmitted-only policy and compare real detector hits to the **independent** analytical formula; that comparison is not itself a public native result of this query.

This stage **does not** expose a native-hit request, `native-hit-unavailable` status or `incomplete-or-stale` status within the analytical query. Such statuses belong to a *future optional native verification interface*, not to a method that never starts the simulator. The existing v5 evaluator already suppresses stale/incomplete readings; contract tests verify this independently. Do not combine a mathematical answer with a stopped run and call it native-verified.

Further work needs separately qualified native hit identity/parentage for multi-source or multi-ray systems; explicit detector reachability, observer-side angle inversion if requested; bounded near-critical/grazing numerical treatment; and an image/observer model only with separate physical evidence. No general multi-element optics, PSF, virtual-image reconstruction, continuous irradiance or JEE problem coverage claim follows from this query.

All earlier held v14–v19/reviewed PR #141 branches remain unchanged. Branch protection issue #123 and owner release decisions remain separate.
