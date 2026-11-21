# A planar liquid surface followed by a lens

Use the dry image of an axial point to calibrate a fixed ideal thin lens. Filling part of the object-side path with a different material changes the point's apparent distance from the lens. The same two optical relations can predict the filled image from a known index or infer an unknown index from the measured filled image. In both configurations the lens is in the stated exterior medium.

Use `layer-lens-image-distance` with `layerIndex`, or `layer-index-from-lens-images` with `filledImageDistance`. Positive image distances lie beyond the lens in the incident direction. The object distance H and fill depth d are positive. The dry image distance and a supplied filled image distance are signed. All authored distances have magnitudes of 1–10000 mm in one declared unit. The residual gap H−d must be at least 1 mm. Require explicit exterior index and absolute indices in [1,4].

The dry observation gives reciprocal focal length P = 1/H + 1/v₀. With exterior index e and liquid index n, the lens sees object distance u = H−d + de/n, and 1/v = P−1/u. The inverse uses u = 1/(P−1/v) and n = de/(u−H+d). Exact collimation in the forward query returns an explicit at-infinity state. Near cancellation within a relative 10⁻¹⁰ band, or a finite output beyond 10⁹ mm, withholds the result. Candidate indices outside the physical domain are unavailable.

The [Problem 009 example](../examples/layer-index-from-lens-images.json) assumes unit-index air and a paraxial axial observation. It yields n = 56/41. The [frozen native study](../evaluation/planar-interface-lens-conjugate-v1/README.md) separately checks forward propagation and includes a synthetic virtual-image case.
