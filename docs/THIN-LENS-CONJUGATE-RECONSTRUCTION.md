# Single thin-lens reconstruction from an off-axis conjugate point pair

`thin-lens-conjugate-reconstruction` determines whether a single stationary ideal thin lens on the optical axis $y = 0$ can form a stated off-axis conjugate image $I = (x_I, y_I)$ from a real off-axis point object $O = (x_O, y_O)$ in `+x` propagation, and uniquely reconstructs the lens type (`converging` or `diverging`), optical centre $x_L$, signed focal length $f$, and focal points $F_1, F_2$.

It uses the separate `opticsim-thin-lens-conjugate-reconstruction-facts-v1` fact contract and leaves all forward lens-train contracts untouched.

## Physical relations

Because the paraxial ray through the optical centre $C = (x_L, 0)$ is undeviated, $O$, $C$, and $I$ are collinear. With $\Delta x = x_I - x_O$ and $\Delta y = y_I - y_O$ (and $y_O, y_I \neq 0$):

$$
u = x_O - x_L = \frac{y_O\,\Delta x}{\Delta y}, \qquad v = x_I - x_L = \frac{y_I\,\Delta x}{\Delta y}, \qquad x_L = x_O - u,
$$

$$
m = \frac{y_I}{y_O} = \frac{v}{u}, \qquad f = -\frac{y_O\,y_I\,\Delta x}{(\Delta y)^2}, \qquad x_{F_1} = x_L - f, \qquad x_{F_2} = x_L + f.
$$

Real-object admissibility along `+x` requires $x_O < x_L$ ($u < 0$), which uniquely selects the three physically admissible single-thin-lens regimes:
- **Converging, real inverted image** ($m < 0$, $x_I > x_O$): $x_O < x_L < x_I$, $f > 0$.
- **Converging, virtual magnified upright image** ($m > 1$, $x_I < x_O$): $x_I < x_O < x_L$, $f > 0$.
- **Diverging, virtual diminished upright image** ($0 < m < 1$, $x_I > x_O$): $x_O < x_I < x_L$, $f < 0$.

Configurations with $u \ge 0$ (`VIRTUAL_OBJECT_REQUIRED`), equal heights with distinct axial planes (`NO_FINITE_LENS_SOLUTION`), coincident object and image (`COINCIDENT_OBJECT_AND_IMAGE`), or coincident axial planes with distinct heights (`COINCIDENT_AXIAL_PLANES`) return `status: "unavailable"`.

In all three admissible regimes, the ray from $O$ parallel to the optical axis strikes the lens at $(x_L, y_O)$ and its outgoing line passes through both $I$ and the rear focal point $(x_L + f, 0)$ (reported in `rayConstruction`).

## Units, exact arithmetic and numerical guards

Declare `lengthUnit` as `mm`, `cm`, `m`, or `scale-unit`. Physical units enforce input coordinates in `[-10000, 10000]` mm and off-axis `|y| >= 0.01` mm; `scale-unit` enforces `[-10000, 10000]` and `|y| >= 0.001`.

All algebra is performed in exact `binary64-rational` arithmetic and rounded once to binary64 on output. Nonzero $\Delta y$ within $10^{-10}(|y_O| + |y_I|)$, nonzero $\Delta x$ within $10^{-10}(|x_O| + |x_I|)$, derived $|u|$ or $|v|$ below the minimum separation, or derived magnitudes above $10^9$ return `status: "numerically-indeterminate"`.

## Example and native verification

- The [example](../examples/thin-lens-conjugate-reconstruction.json) (`O = (-3, 1)`, `I = (6, -2)` in `scale-unit`, representative of an inverted off-axis conjugate pair) returns `lensType: "converging"`, `lensX: 0`, `focalLength: 2`, `frontFocusX: -2`, `rearFocusX: 2`, `magnification: -2`, `imageKind: "real"`, and `imageOrientation: "inverted"`.
- All three admissible regimes (converging real, converging virtual, diverging virtual) are independently round-trip verified in `test/thin-lens-conjugate-reconstruction.test.mjs` against both `calculateLensTrain` and pinned native PhyDemo `IdealLens` + `SingleRay` + `Detector` runs.

This query is conditional paraxial analysis only (`nativeObservation: false`, `nativeImageDetected: false`): no native scene, aperture, brightness, aberration, or detected image is created or certified.
