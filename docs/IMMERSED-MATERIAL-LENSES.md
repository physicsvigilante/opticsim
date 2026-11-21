# Comparing thin lenses made from different materials

Two lenses of identical shape can respond differently to the same surrounding medium. Give each lens a material ID and an absolute index. Give each comparison medium its own ID and absolute index. The declared paraxial model places the same medium on both sides of each lens and compares the two lenses separately.

For light travelling along positive x, a surface whose centre lies downstream has positive radius. Let the common curvature factor be C = 1/R₁ − 1/R₂. Power in dioptres is (nGlass − nMedium) C for radii in metres. The signed focal distance in metres is nMedium divided by that power. Its sign classifies an off-axis parallel ray. An exactly axial ray continues along the axis.

When only the sign of C is supplied, the comparison can still determine each action and f₁/f₂ = (n₂ − nMedium)/(n₁ − nMedium) for two finite focal lengths. Exact matching gives an afocal state. If either lens is afocal, the finite focal-length ratio is unavailable. A near match or uncertain cancellation withholds the comparison. With signed radii in metres the query reuses the two-surface paraxial calculation at zero analytical thickness. The finite native controls retain their 5 mm thickness.

The [A34 example](../examples/material-lens-a34.json) declares unit-index air as the assumption for part (a). In air f₁/f₂ is 1.4. In the stated liquid of index 1.6 the first glass diverges and the second converges. Its radii remain unknown. The [frozen protocol](../evaluation/immersed-material-lens-v1/frozen-protocol.json) records the separate numerical controls and their provenance.
