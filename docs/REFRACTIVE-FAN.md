# Directional fan at a plane interface (v29)

Select `physical.model = "native-refractive-fan-tracing"` to trace a finite set of directions from one point in two dimensions. The [example](../examples/native-refractive-fan-v29.json) places the source 100 mm below an infinite horizontal interface. At the chosen density the native samples strike at 41° and 50° from the upward normal. For indices 1.5 below and 1 above, the first ray transmits and the second undergoes total internal reflection.

Supply one directional point source with position, brightness, heading and full cone angle, and one planar interface with position, upward normal (+90°), both absolute indices and explicit `partialReflection: false`. The source must be at least 1 mm below the plane. Both cone edges must lie within 75° of the upward normal. Heading is measured counterclockwise from +x in y-up coordinates. Existing v5 selection continues to require single rays.

The optional v29-only `physical.rayDensity` overrides the named numerical preset. Density must lie between 0.048 and 1, with brightness at most density and 1–100 sampled rays. Pinned AngleSource samples from one cone edge in steps of 360° / floor(500 × density), with the native upper-edge exclusion. Changing density can change which angles encounter total internal reflection.

The pinned PlaneGlass owns each intersection and dielectric interaction. The guard checks emitted identities, incident and outgoing directions, interface points, callback totals and terminal diagnostics. If any sampled incident direction satisfies `abs(nBelow × abs(unitDirection.x) − nAbove) ≤ 0.000001`, the whole fan is withheld. The admission check uses the authored samples and the runtime check uses actual native directions. The [frozen study](../research/refractive-fan-j11/README.md) preserves raw critical callbacks independently.

Source emissions, interface interactions, total internal reflections and the first native event are sampled observations. This profile omits partial Fresnel branches and supports no other components. It provides no continuous escape fraction, radiometric power or three-dimensional escape-disc measurement.
