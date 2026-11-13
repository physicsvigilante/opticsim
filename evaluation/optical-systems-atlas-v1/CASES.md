# The 40 reviewed JEE Problems — capability discovery catalogue

Each row paraphrases only the optical system and requested observation, not the original statement, solution or answer. `existing` means the *apparatus family* is recognized somewhere in Opticsim, **not** that the entire JEE question can be simulated exactly from its stated facts. `conditional` is not native image detection. Full per-case limitations and image hashes are in [review.json](review.json).

| ID | Chapter / Problems image | Required physical system | Apparatus | Requested observable | Missing capability tags |
|---|---|---|---|---|---|
| A01 | 01/001.png | Infer plane-mirror incidence from incoming/outgoing direction vectors | partial | unregistered | `angular-inverse` |
| A02 | 01/004.png | Two-mirror directional constraints with parallel input and exit | partial | unregistered | `angular-inverse`, `ray-provenance` |
| A03 | 01/008.png | Object within an equilateral triangular plane-mirror enclosure | not-exposed | unregistered | `mirror-enclosure`, `extended-object` |
| A04 | 01/011.png | Four-walled reflective box requiring a ray from A to B after four hits | not-exposed | unregistered | `mirror-enclosure`, `ray-provenance`, `angular-inverse` |
| A05 | 01/015.png | Two inclined plane mirrors with a specified outgoing parallel direction | partial | unregistered | `angular-inverse`, `ray-provenance` |
| A06 | 02/001.png | Concave-mirror image height for object distance expressed as 1.5 focal lengths | partial | conditional | `extended-object` |
| A07 | 02/004.png | Inverse placement of object for fourfold concave-mirror magnification | partial | unregistered | `angular-inverse` |
| A08 | 02/007.png | Sinusoidally oscillating object before a concave mirror | not-exposed | unregistered | `general-motion` |
| A09 | 02/010.png | Quadrilateral extended object imaged in a concave mirror | not-exposed | unregistered | `extended-object`, `apparent-image` |
| A10 | 02/013.png | Moving point with axial and transverse velocity near a concave mirror | partial | conditional | — |
| A11 | 03/001.png | Near-normal viewing of a submerged object from air | partial | unregistered | `apparent-image` |
| A12 | 03/003.png | Curved mirror with a parallel glass slab between mirror and object | not-exposed | unregistered | `mixed-media`, `apparent-image` |
| A13 | 03/006.png | Plane-parallel glass plate backed by a plane mirror | partial | unregistered | `ray-provenance` |
| A14 | 03/009.png | Parallel beam entering a glass hemisphere above a table | not-exposed | unregistered | `glass-regions`, `beam-sources`, `opaque-screen` |
| A15 | 03/012.png | Continuous graded-index slab at grazing incidence | not-exposed | unregistered | `graded-index` |
| A16 | 04/001.png | Three planar media with grazing/critical incidence | existing | conditional | — |
| A17 | 04/003.png | Square glass cross-section at grazing input with emergence from neighboring face | not-exposed | unregistered | `glass-regions`, `beam-sources`, `ray-provenance` |
| A18 | 04/005.png | Point source under water hidden by opaque floating disk | not-exposed | unregistered | `opaque-screen`, `apparent-image`, `beam-sources` |
| A19 | 04/007.png | Rays guided by cylindrical glass pipe using total internal reflection | not-exposed | unregistered | `glass-regions`, `waveguide`, `beam-sources` |
| A20 | 04/010.png | Parallel rays crossing flat face and curved boundary of semicylindrical glass | not-exposed | unregistered | `glass-regions`, `beam-sources` |
| A21 | 05/001.png | Equilateral prism with internal TIR and different exit face | existing | unregistered | `prism-analytics`, `ray-provenance` |
| A22 | 05/004.png | Isosceles prism with grazing emergence and minimum-deviation condition | existing | unregistered | `prism-analytics` |
| A23 | 05/008.png | Prism given refracting angle, incidence, and net deviation | existing | unregistered | `prism-analytics` |
| A24 | 05/011.png | Prism emergence angle from incidence, prism angle and deviation | existing | unregistered | `prism-analytics` |
| A25 | 05/015.png | Parallel beam partly reflected and transmitted through small-angle prism | partial | unregistered | `beam-sources`, `ray-provenance`, `prism-analytics` |
| A26 | 06/001.png | Single convex refracting spherical boundary separating two media | not-exposed | unregistered | `glass-regions`, `apparent-image` |
| A27 | 06/004.png | Sphere sliced into finite paperweight viewed from above a table | not-exposed | unregistered | `glass-regions`, `apparent-image` |
| A28 | 06/007.png | Silvered glass hemisphere with internal bubble | not-exposed | unregistered | `glass-regions`, `mixed-media`, `apparent-image` |
| A29 | 06/010.png | Parallel beam through solid glass sphere near normal incidence | partial | unregistered | `beam-sources`, `apparent-image` |
| A30 | 06/013.png | Internal air bubble in glass sphere viewed along radius | partial | unregistered | `apparent-image` |
| A31 | 07/001.png | Place converging lens so two object points have coincident images | existing | unregistered | `multi-source-image` |
| A32 | 07/007.png | Converging and diverging ideal lenses in optical contact | not-exposed | unregistered | `lens-contact` |
| A33 | 07/014.png | Two coaxial converging lenses with specified separation | existing | conditional | — |
| A34 | 07/020.png | Identical double-convex lenses from different glasses immersed in a liquid | not-exposed | unregistered | `material-lens` |
| A35 | 07/027.png | Two decentered coaxially separated lenses illuminated by parallel light | not-exposed | unregistered | `offaxis-lens`, `beam-sources` |
| A36 | 08/001.png | Variable eye-lens power for near/far accommodation | not-exposed | unregistered | `instrument`, `apparent-image` |
| A37 | 08/003.png | Corrective lens for finite myopic far point | partial | unregistered | `instrument` |
| A38 | 08/005.png | Swap microscope objective and eyepiece while preserving angular magnification | partial | unregistered | `instrument` |
| A39 | 08/007.png | Microscope with final image at infinity | partial | unregistered | `instrument` |
| A40 | 08/009.png | Telescope refocused from distant to near object by moving eyepiece | partial | unregistered | `instrument`, `beam-sources`, `general-motion` |

**Only 40 questions were visually reviewed.** The 74 remaining `Problems` members are listed without invented interpretations in [inventory.json](inventory.json). Counts are nonexclusive; no Solutions or original answer key was consulted.
