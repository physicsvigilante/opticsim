# Collimated-input focus of a coaxial thin-lens train

`lens-train-collimated-focus` computes the rear paraxial focal point, back focal distance, effective focal length, rear principal plane, or afocal emergence of a separated coaxial train of one to four stationary ideal thin lenses illuminated by an axial parallel beam along `+x`.

It uses the separate `opticsim-lens-train-collimated-focus-facts-v1` fact contract and leaves the finite-object `opticsim-lens-train-facts-v1` query and the `lens-train-axial-preservation` query unchanged.

## Physical relations

Let $M = \begin{pmatrix} A & B \\ C & D \end{pmatrix}$ ($AD - BC = 1$) be the paraxial ABCD transfer matrix from immediately before the first lens ($x_1$) to immediately after the last lens ($x_N$). For an incoming axial collimated ray with initial height $y_{\text{in}}$ and slope $u_{\text{in}} = 0$, the outgoing ray at $x_N^+$ has $y_{\text{out}} = A\,y_{\text{in}}$ and $u_{\text{out}} = C\,y_{\text{in}}$:

- **Afocal ($C = 0$, $AD = 1$):** The outgoing beam emerges parallel to the axis (`state: "afocal"`, `isAfocal: true`, `backFocalDistance: null`) with transverse beam height scale `beamHeightScale = A` and angular scale `angularScale = D`.
- **Finite focus ($C \neq 0$):** The outgoing beam crosses the optical axis at signed back focal distance $\text{BFD} = -A / C$ from the last lens plane $x_N$ (`backFocusX = x_N - A / C`), with effective focal length $f_{\text{eff}} = -1 / C$, equivalent optical power $\Phi = -C$, and rear principal plane at `rearPrincipalX = x_N + (1 - A) / C` (offset `rearPrincipalOffset = (1 - A) / C` from the last lens).
  - `state: "downstream"` when $\text{BFD} > 0$ (real focal point behind the last lens),
  - `state: "upstream"` when $\text{BFD} < 0$ (virtual focal point obtained by backward extrapolation),
  - `state: "at-last-lens"` when $A = 0$ identically ($\text{BFD} = 0$).

## Units, exact arithmetic and numerical guards

Declare `lengthUnit` as `mm`, `cm`, `m`, or `scale-unit` (exact finite multiples of one unspecified positive common length scale). Physical units enforce coordinates in `[-10000, 10000]` mm, focal-length magnitudes in `[1, 10000]` mm, and consecutive separations `>= 0.01` mm; `scale-unit` enforces coordinates in `[-10000, 10000]`, focal-length magnitudes in `[0.001, 10000]`, and separations `>= 0.001`.

The ABCD transfer matrix is computed in exact `binary64-rational` arithmetic from the supplied finite inputs. Nonzero optical power $C$ (bound $s_c$) or non-afocal exit-height coefficient $A$ (bound $s_a$) within $10^{-10}$ of its scale-invariant positive-monomial bound, or severe cancellation in afocal $A$/$D$, returns `status: "numerically-indeterminate"` rather than a brittle state classification.

## Examples and native controls

- The [two-lens example](../examples/lens-train-collimated-focus.json) (`f1 = 7 cm`, `f2 = 6 cm`, `d = 3 cm`) returns `state: "downstream"`, `backFocalDistance: 2.4 cm`, `backFocusX: 5.4 cm`, and `effectiveFocalLength: 4.2 cm`.
- A three-lens mixed system (`f1 = +10 cm`, `f2 = -20 cm`, `f3 = +9 cm` with gaps `15 cm` and `5 cm`) returns `state: "afocal"`, `isAfocal: true`, `beamHeightScale: -1.125`, and `angularScale: -8/9`.
- Both systems, plus upstream virtual-focus and `at-last-lens` controls, are independently cross-checked against pinned native PhyDemo `SingleRay` + `IdealLens` + `Detector` runs in `test/lens-train-collimated-focus.test.mjs`.

This query is conditional paraxial analysis only (`nativeObservation: false`, `nativeImageDetected: false`): no native scene, beam width, aperture throughput, aberration, or detected focus is created or certified.
