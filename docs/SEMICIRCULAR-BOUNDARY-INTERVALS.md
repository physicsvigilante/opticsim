# First-passage intervals for a semicircular dielectric

The problem workflow can calculate a continuous interval for a parallel beam in a homogeneous meridional section. Supply the absolute glass and exterior indices, with the same exterior on both faces. The calculations use measured distances divided by the radius, so an absolute radius is optional.

### Curved entry and the extent on the flat face

Measure the signed entrance ordinate h in units of the glass radius R from the symmetry axis. Let m be the glass/exterior index ratio. At the arc the inward normal has tilt α = asin(h), and the transmitted angle relative to it is β = asin(h/m). Propagation to the diameter gives Y/R = h − cos(α) tan(α − β) = (h/m)/cos(α − β). For h ≥ 0 and m > 1 the difference α − β increases because 1/√(1 − h²) > 1/√(m² − h²). The map is odd and strictly increasing. Its two endpoint values therefore bound the full first-incidence interval, including for an off-axis beam.

Use `meridional-parallel-interval` for a signed interval. Use `centred-filled-circular-beam` with `hemisphere-of-revolution` to obtain a disk radius by rotational symmetry. Both endpoints must lie within half a glass radius of the axis, their separation must be at least 10⁻⁸ radii, and the index ratio must be at most 1.6. For A14 the geometric radius is 4r/(2√6 + 1). Interpreting the disk as a visible spot on the table requires an explicit assumption about how the contacting table registers incident light. [A14 example](../examples/semicircular-interval-a14.json)

### Flat entry and the transmission interval on the arc

Let t be the entry offset from the centre of the diameter divided by R. With exterior incidence θ, Snell's law gives sin β = sin θ/m in the glass. The straight internal line passes the circle centre at perpendicular distance R |t| cos β. At the first arc encounter that distance also equals R sin i, where i is the incidence angle to the local normal. Strict transmission therefore requires |t| < 1/(m cos β). At the critical offset the limiting outgoing direction is tangent. Higher absolute offsets undergo total internal reflection. These conditions apply only inside the open diameter, where |t| < 1.

The query accepts |θ| ≤ 60°. It returns the open transmission interval, an interior critical offset when one exists, and the TIR region. Near index matching or a critical boundary indistinguishable from the flat/arc joint, it withholds the numerical classification. For A20 the critical offset is √(2/3) in units of R. [A20 example](../examples/semicircular-interval-a20.json)

The public v21 and v30 native scenes provide finite controls at authored scales. Three curved-entry controls compare measured flat-face extrema with the formula at actual emitted sample positions. Five flat-entry controls check actual first arc incidence and branch outcomes on either side of the analytical threshold. [Frozen protocol](../evaluation/semicircular-boundary-intervals-v1/frozen.json)
