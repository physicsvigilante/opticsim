# Original refraction pair — initial interpretation

Engine baseline: `1b961a51259feea88c7ad0b8635ba4567bb54144` (merged PR #19).

Selection: revisit **B05 and B06**, the two planar-media problems in the existing broader capability review. These images were already seen in this project. This is a same-assistant development application, **not an unseen, blind or independent evaluation**. No Solutions entries are to be opened. The first interpretation and first requests are retained without later repair; follow-up requests and analytical work must be separate records.

Archive: `08_Ray_Optics_Explanations.zip`, SHA-256 `03fa29dc8a09f157692ea389354bc7393a96e49f792b60329164c03e56bc5939`.

## B05 — critical incidence after crossing a layer

Problem: `08_Ray_Optics_Explanations/04_Total_Internal_Reflection_TIR/Problems/001.png`.
Image SHA-256: `df2fad74e2e23469ad32e09efc894b2673f2504b11a30c988c0643d6b9730796`.

| Quantity / object | Evidence | Classification |
|---|---|---|
| Lower, middle, upper indices | Diagram labels n1=1.60, n2=1.80, n3=1.30 | Stated |
| Two interfaces | Parallel horizontal boundaries separating the three labelled regions | Stated diagram geometry |
| Requested input angle theta | Angle between incident ray and vertical normal in medium 1 | Unknown to solve, not an input to invent |
| Incidence at second boundary | Statement says critical angle between media 2 and 3 | Stated constraint |
| Decreasing theta | Part (b) asks whether the ray then enters medium 3 | Requested trend, not a numeric input |
| Layer thickness / source distance / brightness | No numerical labels | Not supplied; illustrative lengths and relative power only |

Use y-up, interfaces at y=0 and y=10 cm, a source at (-10,-10) cm, and normals +y. These distances are declared drawing choices; the local refraction angles at parallel homogeneous interfaces do not require the particular thickness or source offset. Do not infer distances from pixels or add exterior bounding surfaces from shaded-region borders.

The initial strict request **omits source direction** because theta is the requested unknown. The existing engine is a forward tracer, not a critical-angle inverse solver. A later externally derived direction or a declared forward sweep can check consequences, but must not be called the engine solving for its own input. Exact-critical native floating-point behavior must be reported as observed; do not replace a missing tangent branch by a finite-power transmitted ray.

## B06 — downward transmission and a separate reflected branch

Problem: `08_Ray_Optics_Explanations/04_Total_Internal_Reflection_TIR/Problems/006.png`.
Image SHA-256: `a330ac2c9eecf3e83a848eb76d475fde72876138974e5320a4b9a4a5fb5f8b0c`.

| Quantity / object | Evidence | Classification |
|---|---|---|
| Media from top interior to bottom | n1=1.3, n2=1.4, n3=1.32, n4=1.45 | Stated labels |
| Initial theta1 | Text gives 30 degrees; diagram measures it from the normal | Stated |
| Downward branch | Transmits through 1/2, 2/3, 3/4; theta4 is in medium 4 | Diagram interpretation |
| Upward branch | Reflects at the 1/2 boundary, then transmits through 1/air; theta5 is in air | Diagram interpretation |
| Air index | Label AIR, no numeric value | Explicit usual idealization n_air=1, not a labelled measurement |
| Absolute distances / brightness | Not labelled | Declared illustrative geometry and unit relative power |

This is **two branches of one native source**, not a single ray routed through every depicted segment. Do not insert a bottom mirror, a second emitter or an authored ray route. The outer lower line is not treated as another interface because no next medium or reflection is specified there. The branch reading is stated explicitly because the prose alone is less clear than the figure.

Use y-up; interfaces 3/4, 2/3, 1/2 and 1/air at y=0,10,20,30 cm, all normals +y. Source (-10,25) cm is in n1; direction -60 degrees from +x represents the stated 30-degree downward incidence. The 10 cm separations are drawing choices, not measurements. First request retains native Fresnel partial reflections at all boundaries, without altering weak-branch thresholds or run limits.

## Planned separation of evidence

Record native execution separately from requested-result availability. Incomplete Fresnel runs keep diagnostics but do not authorize published measurements. A later angular-only comparison may explicitly omit unwanted secondary partial reflections (preserving the split needed by B06), but must be named an approximation, saved as another attempt, and never replace the full-Fresnel first request. Analytical derivations are a separate review, not native observations or reference answers exposed during this first interpretation.

No output angles have been inserted into these initial interpretations or requests. No new production physics, inverse solver, permissive validation or public deployment is requested by this trial.
