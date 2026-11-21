# Ideal thin powers at a common plane

Use the public problem CLI with `opticsim-coincident-power-facts-v1`, model `ideal-thin-powers-in-unit-index-air`. Each of one to four elements has its own stable ID and exactly one of `powerD`, `focalLengthM`, or `unknown: true`. This reduced model composes paraxial powers at a common plane. A separated optical train still requires spatial propagation between lenses.

With propagation toward +x, signed axial distance s is positive downstream. Vergence is L = 1/s in unit-index air. A real incoming object has s < 0; a virtual outgoing image has s < 0. Use `{"signedDistanceM": -2}` or the literal `"infinity"` for a collimated pencil. Power P = 1/f and all powers are in dioptres. The common-plane rule is L′ = L + ΣP.

| Request | Physical condition | Output |
|---|---|---|
| `contact-equivalent-power` | Known element powers | Sum of powers and signed equivalent focal length; explicit infinity for zero power |
| `outgoing-vergence` | `forward` with `incoming` | Signed input/output vergence and output conjugate |
| `required-component-power` | `conjugate-pair` with `incoming`, `outgoing` and one unknown power | The missing power identified by component ID |
| `fixed-output-power-change` | `fixed-outgoing-vergence` with `initialIncoming`, `finalIncoming` and `adjustId` | Baseline, final and change in adjustable power, with other powers and output vergence held fixed |

**Source-backed examples.** [A32](../examples/optical-power-a32.json) supplies +5 cm and −10 cm in contact. [A36](../examples/optical-power-a36.json) uses the explicit reduced eye plane, holds the corneal power and retinal conjugate fixed, and gives approximate eye-lens powers of 20 and 24 D. This calculation needs no retinal distance. [A37](../examples/optical-power-a37.json) locates the correction at the relaxed eye's reference plane and forms a virtual conjugate at −2 m. A physical spectacle vertex distance would require propagation between planes. These cases describe first-order optics and do not model individual anatomy or establish a clinical prescription.

**Numerical qualification.** Finite signed distances have magnitude 0.001–1,000,000 m. Nonzero supplied powers have magnitude 0.000001–1,000 D. A sum within 1e−10 × max(1, sum of absolute terms) of zero is withheld unless exact rational addition of the represented inputs establishes zero. This check retains the original signed distance for reciprocal terms. Rounded input data do not acquire extra measurement precision.

The [pre-implementation freeze](../evaluation/coincident-power-v1/frozen-protocol.json) records physical assumptions and acceptance expectations. The native control traces a collimated Beam through one independently specified +100 mm IdealLens and verifies finite detector callbacks at its focus. Contact between native lenses stays inadmissible. Running these reduced facts through `scripts/run-problem.mjs` creates analytical evidence and executes no native contact scene.
