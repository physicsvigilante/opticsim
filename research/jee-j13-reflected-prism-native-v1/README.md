# JEE J13 three-face prism: source-constrained TIR native feasibility

**Research only.** No production optical primitive, authoring schema, Fresnel policy, existing test, original problem evaluation or pinned PhyDemo file has changed. This is a finite, explicitly **additional** teaching apparatus motivated by the frozen J13 Problems image. The original Solutions file has not been opened.

## Frozen identities and scope

- Production base: `c4e436fca34c01b3ce63bd426dc71bd0daf1daa9` — independently reviewed J14 merge.
- Immutable original source audit: held PR #165, `evaluation/jee-post164-coverage-v1/source-review.json` at `6a72bd67e58e9a3fd94a6bf33d88d1f20295b4c2`.
- Original Problems path: `08_Ray_Optics_Explanations/05_Prism/Problems/001.png`; text says **equilateral prism**, ray entering AB, **slightly-above-critical** internal reflection at AC and emergence from BC **30° from its outward normal**.
- Native PhyDemo pinned to `811f508d2b070898c241a568b0c167dcb8645251`.
- Nine-case **pre-execution frozen** protocol: `research/jee-j13-reflected-prism-native-v1/frozen-protocol.json`, committed at `6fb6625453eb62c24d9d7b40d929b9cfb75d5596` before the test was written.

J13 does **not** state exterior refractive index, finite dimensions, exact initial ray placement, or how close **slightly above** critical actually means. Do not infer an air index, use drawing pixel scale for distance or replace an inequality by critical equality. For the separate numerical control, a native 2D equilateral prism uses A=(0,70) mm, B=(0,−70) mm, C=(70√3,0) mm and an exterior refractive index **chosen** as 1. An added single native ray starts to the left and is directed at 30° so the first hit is at face AB, y=20 mm. Declared finite scales and the resulting native intersection pattern are **research choices**, not textbook facts.

## Independent conditional ray-angle logic (not an imposed native path)

Take the outward normal to AB in the +x direction, positive ray incidence upwards, the upper face AC and lower face BC. Suppose the actual ray enters AB from outside, undergoes genuine **TIR at AC**, then exits BC as an outward-transmitted ray.

Let `m=n_inside/n_outside` and `r` be the internal first-entry angle. For this equilateral geometry the reflected ray reaches BC with the same internal incidence magnitude `r`. Snell at entry and exit gives `sin i=m sin r=sin e` for outside incidence i and exterior emergence e. For `e=30°`, on the declared principal branch, `i=30°` regardless of the numerical value of `m`.

The actual upper-face internal incidence is `60°-r`. A **strictly above-critical** TIR condition requires:

```
m sin(60° - asin(sin 30°/m)) > 1
=> m > sqrt(7/3) ≈ 1.52752523165
```

Equality is a **critical boundary**, not a valid strictly-above-critical ray, and a statement that an incidence is *slightly above* it supplies no quantitative proximity. Consequently **there is no uniquely determined absolute prism refractive index from these source facts**, and a numerical example of `m=1.6` must not be reported as the original index. The inquiry is an inequality, not a textbook solved-rate claim. These relations are conditional on the named face sequence and entry/exit principal branches, **not** proof that a finite ray reaches these faces.

## What the raw pinned-native test checks

Use the existing public **v8 SingleRay + true three-face native Glass**, with `partialReflection:false` (Fresnel partial reflection explicitly omitted, native TIR still active). Actual pinned callbacks determine all intersections and outgoing rays; the test observes face order, transmitted/reflective events, measured exit angle and the native terminal status. No source ray is steered or route forced.

The predeclared nine cases include: strong above-threshold TIR, a below-threshold control, above/below separated near-threshold cases, exact and +1e−8 near-critical controls that must **not qualify** regardless of raw completion, coordinate translation, depth-zero incomplete trace, and processed-ray stop. Reports preserve original compiled input bytes/SHA and real native callbacks under `test-artifacts/llm-authoring/jee-j13-reflected-native-v1/`. A complete test-only three-face witness requires native-complete status, zero error/undefined/truncation, exact face sequence AB → AC → BC with actual AC TIR, a measured BC emergence near 30°, and an explicitly comfortable dimensionless critical margin above 1e−5. No detector/physical image/energy/polarization/3D answer is inferred.

A raw `simulationComplete` with truncation or a near-critical event is still **unqualified** even if callbacks exist. No existing canonical scene schema or public result qualification is broadened. Original J13 source interpretation, physical correctness, native illustration coverage, teaching value and optional answer completeness must remain independently assessed.

## Decision gate

First inspect actual exact-source GitHub CI/logs and recorded native event sequences. If the physical branch is supported, a **separate, reusable conditional three-face angular inverse** may be developed against the frozen source and witnessed by these declared native controls, returning a material ratio bound rather than an invented index. The final production query should be independently physics/code/evidence reviewed **once on its exact final source tree** with no redundant full review of the unchanged v8/v22 native physics. Neither this experiment nor any future model is automatically authorized for merge without its applicable review and owner gate.
