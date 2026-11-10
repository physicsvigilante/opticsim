# case-01 interpretation

First-pass decision: resolved supported single-lens scene. Viewed `test/fixtures/image-to-scene/inputs/case-01.png` and read `case-01.md` in that directory. No factual corrections were made in this pass.

Origin is lens L's centre, with x right and y up; 1 cm = 10 mm exactly. Persistent IDs: S = `source-1`, L = `lens-1`.

| Quantity/component | Evidence | Value/unit | Status |
| --- | --- | --- | --- |
| S type/emission | Diagram and statement: isotropic point source | Point source, full-circle | Stated |
| S to L axial distance | Diagram `24 cm`; statement `24 cm left` | 240 mm; S x=-240 mm | Stated / derived coordinates |
| S height | Diagram `1.2 cm`; statement `above its optical axis` | S y=12 mm | Stated / converted |
| L centre | Chosen origin on optical axis | x=0 mm, y=0 mm | Coordinate choice |
| L signed focal length | Converging; `f = 8 cm`; statement `+8 cm` | +80 mm | Stated / converted |
| L full aperture | `aperture = 16 cm`; statement `full lens aperture` | 160 mm | Stated / converted |
| Two dashed guides and axis | Statement: `construction guides, not the source emission cone` | No optical components or cone inferred | Stated |
| Relative brightness | Not measured or specified | 0.15, upstream-relative | Authoring choice |
| Inactive emission fields | Full-circle mode | direction=0 degrees, opening=30 degrees | Retained defaults; not measurements |
| Sampling and limits | Presentation/execution choice | density=1 (Dense), depth=8, processed limit=10000 | Authoring choice |
| View | Presentation choice | centre=(0,0) mm, zoom=1, rays, grid off | Authoring choice |

Labels govern geometry; the drawing is explicitly not to scale. There are no essential unresolved physical values. The resulting document is authored only: validator/native/browser/save-reload and optical checks have not been run in this pass. Analysis, if later available, is conditional on finite-aperture traversal rather than image detection.


## Subsequent verification

After the authoring pass, the parent review checked this interpretation against the input and independent reviewer facts. The candidate passed the current validator, completed native execution without errors/truncation/undefined behavior, passed independent native-ray probes and sandbox/native round-trips, and was previewed and saved in the browser. The actual browser sandbox download matches this document exactly. See [the validation record](../../VALIDATION.md#image-to-scene-authoring-workflow) for evidence and limits; execution success does not itself certify interpretation.
