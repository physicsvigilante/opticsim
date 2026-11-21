# Grazing emergence and minimum prism deviation

Supply the prism apex angle A and one absolute exterior index shared by both faces. Declare a denser homogeneous prism and the direct meridional branch with nonnegative internal angles whose sum is A. The grazing inverse requires the incident angle for which the second-face emerging direction is tangent. The minimum query accepts that boundary premise or a known inside index.

If m is the relative index and s = sin i at the grazing premise, Snell's law gives m sin r₁ = s and m sin(A − r₁) = 1. Expanding the second sine gives m = hypot(s, (1 + s cos A)/sin A). The grazing result records a critical limit. It does not describe a native grazing ray.

For a strict direct branch the deviation is g(r₁) + g(A − r₁) − A, where g(r) = asin(m sin r). For m > 1, g is strictly convex within the nonnegative transmitted range because g″(r) = m(m² − 1) sin r / (1 − m² sin² r)^(3/2) for interior r > 0. The minimum therefore has r₁ = r₂ = A/2 and i = e = asin(m sin(A/2)). If this symmetric angle is beyond critical, there is no strict direct branch. Near the critical boundary the numerical result is withheld.

For A22, the 45° apex and 45° grazing-incidence premise give m = √5. With the explicit unit-index exterior this is also the inferred absolute prism index. Minimum deviation occurs at incidence asin(√5 sin 22.5°). The finite native controls inspect TIR at 44°, direct transmission at 46° and sampled deviations around the analytical minimum. [A22 request](../examples/prism-angular-limits-a22.json) · [Frozen protocol](../evaluation/prism-critical-minimum-v1/frozen.json)
