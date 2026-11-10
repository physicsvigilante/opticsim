# case-06 interpretation

First-pass decision: unsupported; no authoritative sandbox scene. Viewed `test/fixtures/image-to-scene/inputs/case-06.png` and read `case-06.md`. No factual corrections were made in this pass.

Reserve semantic identities S = `source-1`, triangular prism = `prism-1` for discussion only; these do not introduce a supported prism type. Diagram axes are x right/y up. No physical coordinate scale or complete geometry is inferred from pixels.

| Quantity/component | Evidence | Value/unit | Status |
| --- | --- | --- | --- |
| S type/emission | Diagram and statement isotropic point source | Point source, full-circle | Stated |
| Optical component | Diagram triangular glass prism; statement `Preserve the prism and its refractive behavior` | Glass prism | Stated, unsupported |
| Refractive index | Diagram and statement `n=1.5` | 1.5 (dimensionless) | Stated |
| Apex angle | Diagram and statement `60 degrees` | 60 degrees | Stated |
| Full physical position/size | Not labelled; figure not to scale | Unspecified | Missing; no pixel inference |
| Dashed horizontal line | Coordinate/reference guide | No separate ray/source component inferred | Diagram interpretation |

The current contract supports bounded ideal-lens and plane-mirror layouts and has no prism component or refractive-index parameter. Native PhyDemo capability cannot expand the sandbox contract. An ideal lens would not preserve the requested prism behavior and is not substituted. Resolving numeric omissions alone would not make this task supported; a different supported task or separately approved scope expansion is required. No scene, raw native JSON, production changes, or validation runs are supplied.
