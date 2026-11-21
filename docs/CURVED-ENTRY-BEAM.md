# Curved-entry beam through a finite semicircle

The explicit `physical.model` value `native-curved-entry-beam-tracing` selects v30. Its two components are a deterministic native Beam and the closed right-facing semicircular Glass used by v21 and v24. The flat diameter is at the authored centre x. A source to the right illuminates the curved arc.

Supply both refractive indices, glass centre and radius, beam position, width, direction, brightness and the partial-reflection policy. The radius is 50–1000 mm. The inside/outside index ratio must exceed one and be at most 1.6. The beam travels horizontally left, starts at least 1 mm beyond the rightmost arc, and spans 10–100 mm. Both beam edges must lie within half a radius of the glass axis. Set partial reflection to false. The maximum arc incidence is then 30 degrees. The internal ray tilt at the flat face is at most 30 degrees, below the smallest critical angle in this domain.

Numerical density is 0.048–1, with 1–100 deterministic samples and brightness at most density. The v26 near-half-integer guard uses the compiled Beam endpoints. Each emitted object must encounter the arc from outside and the flat face from inside. Only actual PhyDemo callback positions contribute to the output. Missing events, warnings, incomplete runs and inconsistent geometry withhold the measurement.

Request `interface-face-events` on the glass component. On a qualified v30 run the flat face includes `sampledYRangeMm` with the minimum and maximum **world y** coordinates and sample count. Translating the apparatus translates these coordinates. Increasing the sampling density can move both extrema. A14 motivates this arrangement. A continuous footprint on a table needs an explicit base model and a separate envelope argument.

Run the [public example](../examples/curved-entry-beam-v30.json) through `scripts/run-problem.mjs`. The [frozen controls](../evaluation/curved-entry-beam-v1/frozen.json) identify the dimensions and sampling choices introduced for the native study.
