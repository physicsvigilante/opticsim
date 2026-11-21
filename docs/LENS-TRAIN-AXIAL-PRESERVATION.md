# Coaxial lens-train axial-position preservation and transverse magnification

`lens-train-axial-preservation` tests whether a separated coaxial train of one to four stationary ideal thin lenses in a uniform medium preserves axial image position for arbitrary finite axial objects preceding the first lens, and how it transforms transverse magnification.

It uses the separate `opticsim-lens-train-axial-preservation-facts-v1` fact contract and leaves the historical per-object `opticsim-lens-train-facts-v1` query (`lens-train-image`, `lens-train-image-height`) and frozen native relay study untouched.

## Physical relations

Let $M = \begin{pmatrix} A & B \\ C & D \end{pmatrix}$ ($AD - BC = 1$) be the paraxial transfer matrix from immediately before the first lens ($x_1$) to immediately after the last lens ($x_N$), with train span $L = x_N - x_1$. For any finite axial object at $x_{\text{obj}} < x_1$ whose paraxial pencil passes through every lens in order:

- **Non-afocal ($C \neq 0$):** Neither transverse magnification nor axial image shift is constant across object positions (`isAfocal: false`, `constantTransverseMagnification: false`, `preservesAxialImagePosition: false`). For all finite objects preceding the first lens ($s = x_1 - x_{\text{obj}} > 0$), $m(s) = (C s + D)^{-1}$, so `imageOrientation` is `"upright"` when $C > 0, D \ge 0$ (e.g., a single diverging lens), `"inverted"` when $C < 0, D \le 0$, and `"object-dependent"` when $C$ and $D$ have opposite signs (front focal plane at $s_F = -D/C > 0$).
- **Afocal ($C = 0$, $D = 1/A$):** Every finite axial object has constant transverse magnification $m = A$ (`upright` for $A > 0$, `inverted` for $A < 0$) and constant longitudinal magnification $m_{\text{long}} = A^2$.
  - When $|A| \neq 1$, the axial shift varies linearly with object position (`constantAxialShift: false`, `preservesAxialImagePosition: false`).
  - When $|A| = 1$ ($A = D = \pm 1$), every finite axial object experiences the constant axial shift $\Delta x = x_{\text{img}} - x_{\text{obj}} = L - A B$ (`constantAxialShift: true`, `preservesTransverseSize: true`). Axial position is preserved identically if and only if $\Delta x = 0$ (`preservesAxialImagePosition: true`).

## Units, exact arithmetic and numerical guards

Declare `lengthUnit` as `mm`, `cm`, `m`, or `scale-unit` (dimensionless multiples of one unspecified positive common length scale, without inventing a millimetre value). Physical units enforce coordinates in `[-10000, 10000]` mm, focal-length magnitudes in `[1, 10000]` mm, and consecutive separations `>= 0.01` mm; `scale-unit` enforces coordinates in `[-10000, 10000]`, focal-length magnitudes in `[0.001, 10000]`, and separations `>= 0.001`.

The ABCD transfer matrix is computed in exact `binary64-rational` arithmetic from the supplied finite inputs. Nonzero optical power $C$ (bound $s_c$), non-afocal orientation coefficient $D$ (bound $s_d$), unit-magnification residual $A^2 - 1$ (bound $s_a^2 + 1$), or constant axial shift $L - A B$ (fully expanded positive-monomial bound $L + s_a s_b$) within $10^{-10}$ of its scale-invariant positive-monomial bound returns `status: "numerically-indeterminate"` rather than a brittle classification.

## Examples and native evidence

- The [source relay example](../examples/lens-train-axial-preservation.json) (`4a, a, 4a` with gaps `4a`) returns `isAfocal: true`, `transverseMagnification: -1`, `imageOrientation: "inverted"`, `constantAxialShift: true`, `axialShift: 0`, and `preservesAxialImagePosition: true`.
- Changing only the middle focal length to `2a` returns `transverseMagnification: -1` with `axialShift: 8` (`preservesAxialImagePosition: false`), matching both cases of the [frozen three-lens native relay study](../evaluation/three-lens-relay-study-v1/README.md).
- A four-lens converging relay (`x = 0, 4, 8, 12`, `f = 3, 1, 1, 3`) gives an upright axial-preserving control (`transverseMagnification: 1`, `axialShift: 0`, `preservesAxialImagePosition: true`), independently cross-checked with pinned native PhyDemo `SingleRay` tracing in `test/lens-train-axial-preservation.test.mjs`.

This query is conditional paraxial analysis only: no native scene, finite aperture, illumination, aberration or physical image detection is created or certified.
