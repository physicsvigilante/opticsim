# Composable coaxial paraxial optical stack

`opticsim-coaxial-paraxial-stack-facts-v1` lets teachers and LLMs compose any ordered coaxial sequence of one to eight stationary paraxial optical elements with stable component IDs under one contract and query conjugate imaging, collimated focus, and system transfer properties—without switching to bespoke single-arrangement schemas.

## Composable element primitives

Declare `incidentIndex` ($n_0 \in [1, 4]$), `signConvention: "x-increasing"`, `lengthUnit` (`mm`, `cm`, `m`, or `scale-unit`), and `elements` in non-decreasing axial encounter order (consecutive separation either `0` for explicit co-located thin/silvered contact or at least `0.01 mm` / `0.001 scale-unit`):

1. **`thin-lens`**: `{id, type, x, focalLength}` — ideal thin lens with signed `focalLength` in its local ambient refractive index $n$.
2. **`refracting-surface`**: `{id, type, x, signedRadius, downstreamIndex}` — planar (`"infinity"`) or spherical (`signedRadius > 0` has centre downstream in `+x`) interface from the current medium $n_1$ to `downstreamIndex` $n_2$.
3. **`terminal-mirror`** *(optional, at most one, final element only)*: `{id, type, x, signedRadius}` — plane (`"infinity"`) or spherical (`signedRadius < 0` is concave facing `+x` incident light) mirror triggering a symmetric round-trip return back through all preceding elements in reverse order.

Optional `object: {x, y?}` specifies a real object strictly preceding the first element (`x < x_0`) and is required only by `coaxial-stack-conjugate` (`imageY` is reported only when `object.y` is supplied).

## Reduced-slope exact-rational ABCD kernel

All elements propagate in exact `binary64-rational` reduced-slope coordinates $(y, q = n\,u)$, making every step unimodular ($\det M = A D - B C = 1$ identically, and $A = D$ identically for symmetric return stacks):

- Homogeneous drift $(d, n)$: $T(d, n) = \begin{pmatrix} 1 & d/n \\ 0 & 1 \end{pmatrix}$
- Refracting surface $(n_1 \to n_2, R)$: power $P = (n_2 - n_1)/R$ (identical on forward and return passes)
- Thin lens $(f, n)$: power $P = n/f$
- Terminal mirror $(R_m, n_m)$: $K = \begin{pmatrix} 1 & 0 \\ 2 n_m / R_m & 1 \end{pmatrix}$

## Reusable queries

- **`coaxial-stack-conjugate`**: computes signed `imageDistance` along `exitDirection` (`+x` for transmission, `-x` for return), `imageX`, exact `magnification = 1 / (C*(s/n_in) + D)`, `imageKind` (`finite-real`, `finite-virtual`, `at-exit-plane`, or `at-infinity`), `imageOrientation`, and `imageY` (when `object.y` is supplied).
- **`coaxial-stack-collimated-focus`**: computes `state` (`real-focus`, `virtual-focus`, `at-exit-plane`, or `afocal`), `equivalentPower = -C`, `effectiveFocalLength = -n_out/C`, `backFocalDistance = -n_out*A/C`, `backFocusX`, `rearPrincipalOffset = n_out*(1-A)/C`, `rearPrincipalX`, or afocal `beamHeightScale = A` and `angularScale = (n_in/n_out)*D`.
- **`coaxial-stack-transfer`**: classifies afocal vs non-afocal behavior, constant transverse and longitudinal magnification (`+(n_out/n_in)*A^2` in transmission, `-A^2` in return), constant axial shift and axial-position preservation (`L_span - n_out*A*B = 0` when transmission longitudinal magnification is `1`), and—for return stacks—exact rational `selfConjugateObjects` ($C t^2 + 2 A t + B = 0$, $t = s/n_0 > 0$).

## Numerical guards and scope limits

Every boundary classification (`C`, `A`, `D`, `D_full`, `B_full`, transverse/longitudinal unit-magnification residuals, expanded axial shift `L + n_out*sa*sb`, and return self-conjugate roots) is guarded by a `1e-10` relative scale-invariant positive-monomial bound. Published return self-conjugate roots additionally require well-conditioned `D_full`/`B_full` and binary64 round-trip self-conjugacy plus resolvable root separation, returning `status: "numerically-indeterminate"` rather than publishing indistinguishable or contradictory roots.

See [examples/coaxial-paraxial-stack.json](../examples/coaxial-paraxial-stack.json) for a multi-query glass-slab + thin-lens stack. `test/coaxial-paraxial-stack.test.mjs` cross-checks composed stacks (slab + lens, planar liquid surface + lens, lens + concave return mirror, co-located silvered lenses, water-filled concave mirror, 3-lens relay, and thick curved glass + thin lens) against existing modules and pinned native PhyDemo `SingleRay` controls.

This contract is conditional paraxial analysis only (`nativeObservation: false`, `nativeImageDetected: false`): no native scene, finite aperture, Fresnel reflectance, aberration, or detected image is created or certified. All historical contracts and pinned PhyDemo remain untouched.
