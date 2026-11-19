# JEE spherical-interface paraxial query — draft research v1

**Development candidate, not merged, not an independently reviewed physics release.**
This is a bounded first-order analytical engine capability motivated by frozen JEE coverage J15 (single spherical-surface power) and J16 (curved-surface apparent position). It is **not** a new PhyDemo native optical system, not a 3D sphere solver, and not a modification to schemas 1–23. The 20 original source records in held PR #165 are unchanged. No Solutions entries were consulted for this implementation.

## Why this scope after v20–v23

- v20 merged a genuinely decentered two-ideal-lens Beam system, addressing the specific J19 apparatus gap at the native-capability level.
- v21 merged a flat-plus-curved native semicircular Glass profile, addressing J12's missing physical shape at the native-capability level.
- v22/v23 merged real finite native Beam systems for triangular prisms and **complete** circular dielectric regions, respectively. V23 crosses **two** curved interfaces. Neither a complete circle nor a meridional section of a sphere is a *single* spherical refracting surface.
- The fixed J15 source states index 1 to 4/3, signed convex geometry of radius 10 cm, and a 40 cm image-side focal label. The model can compute conditional surface power with no source brightness, aperture, detector or second surface.
- The fixed J16 source states glass index 1.5, radius 15 cm and a bubble 5 cm toward the viewed surface from the centre. Its incident medium for exiting rays is glass, and the source is 10 cm below the pole. Its **exterior index is not numerically specified**; the synthetic J16 illustration explicitly chooses air index 1 and does not claim an original-question numerical result without that extra convention.

## Strict input contract and physics

Input format: `opticsim-spherical-interface-paraxial-query-v1`. Run

```sh
node scripts/spherical-interface-query.mjs capabilities
node scripts/spherical-interface-query.mjs examples/jee-spherical-interface-power-v1.json --out test-artifacts/llm-authoring/spherical-demo-01
```

Every input must explicitly state `format`, `kind` (`surface-power` or `real-object-conjugate`), `signConvention: "positive-along-incident-light"`, `lengthUnit` (`mm`, `cm`, `m`), `incidentIndex`, `transmittedIndex`, and `signedRadius`. Only the real-object-conjugate kind also requires `signedObjectDistance`, which must be negative: an actual real axial object on the incoming side. The radius sign locates the centre of curvature, not an inferred label `convex` / `concave`.

Let `u` be the signed object distance from the pole, `v` the signed Gaussian image distance, `R` the signed curvature radius and `n1/n2` the incident/transmitted indices, all oriented along the actual light propagation direction. The **paraxial** relationship is

```text
n2/v - n1/u = (n2 - n1)/R
power (diopters) = (n2 - n1) / R_m
signed object-space focal distance = -n1 * R / (n2 - n1)
signed image-space focal distance  =  n2 * R / (n2 - n1)
signed transverse Gaussian magnification = n1 * v / (n2 * u)
```

The analytic `power` kind computes the first-order refracting *surface* power, **not** a thin-lens power. Equal indices produce exactly zero power with no finite focal distances. The conjugate kind calculates a conditional Gaussian image, real for `v>0` and virtual for `v<0`, with no detector hit or observer. The query returns canonical millimetre values and results in the explicitly stated input length unit.

Explicit bounds: both indices finite in [1,4]; `|R|` from 1 to 10,000 mm; real object distance magnitude from 0.01 to 10,000 mm. Unknown fields and missing indices are errors. Numerical policy conservatively withholds near-equal (but not exactly equal) indices, near-focal/cancelled conjugates, and focal/image distances beyond 10^9 mm rather than silently reporting a stable finite position. Such withheld calculations return `numerically-indeterminate`, `value:null`, and a reason code.

**J15 check:** For the stated ideal single surface, incident n1=1, transmitted n2=4/3, R=+10 cm gives surface power +10/3 D and image-space focal distance +40 cm in the declared orientation. This is an analytical calculation; the reported 40 cm is not a native measurement or proof of interpretation of the diagram.

**J16 conditional synthetic check:** For a chosen exterior index 1, incident n1=1.5, transmitted n2=1, R=-15 cm (centre on incoming side), object u=-10 cm, the predicted image is virtual at v=-60/7 cm. That differs from the planar approximation -20/3 cm. The exterior index is an **explicit added assumption** for this conditional illustration. This does not model a complete glass sphere, eye location, full three-dimensional visibility, blur or detected physical image.

## Evidence and limitations

- `src/spherical-interface-paraxial-query.js` is a standalone pure numerical analysis function; it never calls the native simulator and never mutates an optical scene.
- `scripts/spherical-interface-query.mjs` stores **exact original JSON input bytes** and SHA-256, the analytical result and a report. Rejected requests still preserve input bytes and a refusal report. No portable scene or cached native `results` is fabricated.
- `test/jee-spherical-interface-paraxial-query.test.mjs` covers positive/negative curvature, index reversal, real/virtual outcomes, units, zero contrast, missing source facts, singularities and an independently coded *mathematical* finite-height circle/Snell limiting check. The independent mathematics is **not a native PhyDemo execution**.
- Future native single-interface feasibility would require genuine PhyDemo geometry with a bounded one-boundary observation window; do not fake this by taking arbitrary hits of a whole circle and deleting its second surface.
- The next release gate is one focused independent review of the exact final source/CI after this feature is integrated with any adjacent changes. This draft does not authorize merging or changing any earlier reviewed source.
