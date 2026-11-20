# JEE J13 — Equilateral three-face reflected-prism index bound

**Status: draft candidate, no public native engine change.** This is a standalone reduced mathematical query for a precisely declared **2D equilateral prism branch**. It does not run PhyDemo, verify a physical ray path, infer source intensity, or certify the original textbook answer. The separately frozen nine-case pinned-native witness under `research/jee-j13-reflected-prism-native-v1/` is an explicitly added teaching apparatus.

## Why this is not a unique refractive-index answer

The frozen JEE J13 **Problems** image in the 20-case source audit says the ray enters face AB of an equilateral prism, reflects internally at face AC at an angle **slightly above** the critical angle, and exits face BC at **30° from its outward normal**. It asks for the angle of incidence and the index of the prism. It provides **no absolute exterior refractive index**, no source position/brightness, and no quantified difference between upper-face incidence and the critical angle.

The new model requires that exact face ordering and deliberately interprets "slightly above" only as the mathematically strict condition for **total internal reflection**. It will **not** replace it with equality or assign a small invented epsilon.

Use a conventional 2D orientation: AB is the vertical left entrance, AC the upper face, BC the lower exit, and apex C points right. Let `m=n_inside/n_outside>1`, `i` be external incidence at AB, `r` the refracted entrance angle, `e` the external emergence angle from the BC normal. **Conditional on the stated actual sequence of faces**, the internal incidence at BC is also `r`; Snell at entry and exit gives:

    sin i = m sin r = sin e
    => i = e on the supported principal branch

Thus at the original `e=30°`, the first incident angle is also **30°** in this ideal model. The incidence at AC is `60°-r`; its **strict TIR condition** is:

    m sin(60°-r) > 1
    r = asin(sin e/m)

Eliminating `r` (and preserving the principal half-plane orientation) gives a **strict lower bound**, not one glass index:

    m > (2/sqrt(3))*sqrt(1+sin e+(sin e)^2)

For e=30° this is

    n_inside/n_outside > sqrt(7/3) = 1.52752523165...

Equality is **critical incidence**, not above it. Qualitative "slightly" cannot justify a numerical margin. If one adds exterior index=1, then the absolute glass index is still only **strictly greater than √(7/3)**; it is not determined uniquely. The model refuses to infer exterior=1 from the problem.

## Strict standalone authoring

The source-only input is `examples/jee-j13-reflected-prism-bound-v1.json`:

```json
{
  "format": "opticsim-three-face-prism-tir-bound-v1",
  "kind": "three-face-reflected-prism-index-bound",
  "model": "equilateral-prism-geometrical-principal-branch",
  "branchConvention": "AB-entry-AC-total-internal-reflection-BC-exit",
  "angleUnit": "deg",
  "emergenceAngleDeg": 30,
  "criticalRelation": "strictly-above"
}
```

Run without a native build or PhyDemo checkout:

```sh
node scripts/three-face-prism-bound-query.mjs capabilities
node scripts/three-face-prism-bound-query.mjs examples/jee-j13-reflected-prism-bound-v1.json --out test-artifacts/llm-authoring/j13-user-attempt-01
```

The only optional fields are `outsideIndex` (explicit exterior **absolute** refractive index) and `candidateInsideIndex` (a separately supplied **absolute** interior index, which requires exterior index). Without them, the output is only the strict relative bound and the conditional incident angle. With exterior index, it reports only an **open lower bound** for the interior index, not a guessed value. With a candidate pair, the model can mark it safely above critical, unavailable below critical, or numerically indeterminate close to critical. Such a check **still does not certify finite face reach**.

Every successful, negative or unresolved analysis returns `native.status:'not-run'`; malformed JSON gets `rejected` with that same native status. The CLI exclusively reserves a fresh evidence directory, saves `input.json` *byte-for-byte* and its SHA-256 before parsing, and writes a separate result/report with no scene, hit, or image. This is a **standalone query**, not a new unified `opticsim-problem-v1` route or a browser scene.

## Numerical admission and physical limitations

The supported principal 2D model bounds emergence to **0.1–30°**; this is a conservative subset of possible equilateral prism rays, not a law limiting the prism itself. Optional indices must be explicitly finite in [1,4]. If an exterior index implies a strict interior lower bound at or above 4, the bounded absolute-index domain has no admissible result. A known candidate with interior index at or below exterior cannot satisfy the specified higher-index TIR branch.

The test-only native study demonstrated that sufficiently above-critical rays truly encounter AB → AC (TIR) → BC (transmission); below-critical rays instead refract out of AC. **At and extremely near critical incidence the native path is unstable or too close to classify responsibly.** A candidate whose signed critical sine residual `m*sin(60°-asin(sin e/m))-1` has magnitude at most **1e−5** is therefore withheld, even if a raw native callback happens to complete. The margin is an *engineering uncertainty band*, not a universal floating-point error bound, physical measurement uncertainty or a numerical value for the word "slightly". Source-only lower-bound results do not need a candidate and cannot be counted as a native simulation.

The full pinned-native study uses **additional** finite triangle dimensions (140 mm left face), a single ray at a chosen position, and synthetic indices including 1.5 and 1.6. These are not source facts and must not become JEE answer keys. Existing v8 PhyDemo geometry and v22 native Beam-prism authoring remain unchanged. The public query does **not** enable new Fresnel-on branch propagation or assign source-specific ray lineage, image positions, irradiance or 3D visual perception.

## Development, evidence and independent review

- Pre-execution source-native protocol was frozen first at `6fb6625453eb62c24d9d7b40d929b9cfb75d5596`; no source solution or previous first attempt was rewritten.
- `test/jee-j13-three-face-native-research.test.mjs` separately runs pinned PhyDemo on nine fixed synthetic controls. Actual native events and byte-bound inputs are archived. A real AB → AC → BC witness must have a finite, complete native run, exactly one native TIR at AC, no truncated/stopped/error evidence, and a sufficiently large critical margin.
- `test/jee-j13-three-face-prism-query.test.mjs` checks the general analytic threshold at distinct emergence angles, the source 30° case, candidate above/below/near critical, missing exterior material and original-byte CLI evidence. The mathematical test alone is not a native ray trace.
- Score separately the original source interpretation, mathematical correctness, conditional or physical simulation coverage, educational usefulness, and optional textbook-answer completeness. The original J13 answered percentage is **not recomputed**.

Before any merge, require full exact-source Node/native/Chrome CI and **one independent focused review of this final combined native research plus standalone analytical contract**, with explicit correction of any physics or numerical issue. Do not re-review unchanged historical v8 or v22 native refraction engines merely for this source-bound extension. PR #188's numerically incomplete Fresnel-on research remains unrelated to the J13 TIR witness.
