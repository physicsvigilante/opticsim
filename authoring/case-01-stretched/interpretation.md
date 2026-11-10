# case-01-stretched interpretation

First-pass decision: resolved supported single-lens scene, independently read from the stretched raster `test/fixtures/image-to-scene/inputs/case-01-stretched.png` and the supplied `case-01.md` statement. No factual corrections were made in this pass.

Origin is lens L's centre, x right/y up; 1 cm = 10 mm exactly. Persistent IDs: S = `source-1`, L = `lens-1`. The raster's changed pixel positions do not alter labelled physical quantities.

| Quantity/component | Evidence | Value/unit | Status |
| --- | --- | --- | --- |
| S type/emission | Diagram `S (isotropic point source)`; same in statement | Point source, full-circle | Stated |
| S to L distance | Raster `24 cm`; statement `24 cm left` | 240 mm; S x=-240 mm | Stated / derived coordinates |
| S height | Raster `1.2 cm`; statement above optical axis | S y=12 mm | Stated / converted |
| L centre | Chosen optical-axis origin | x=0 mm, y=0 mm | Coordinate choice |
| Signed focal length | Raster `f = 8 cm`; statement converging `+8 cm` | +80 mm | Stated / converted |
| Full aperture | Raster `aperture = 16 cm`; statement full aperture | 160 mm | Stated / converted |
| Dashed lines | Raster `guide rays only`; statement not an emission cone | No components/cone inferred | Stated |
| Relative brightness | Unspecified measured power | 0.15, upstream-relative | Authoring choice |
| Inactive emission fields | Full-circle mode | direction=0 degrees, opening=30 degrees | Retained defaults; not measurements |
| Sampling/limits | Execution choice | density=1, depth=8, processed limit=10000 | Authoring choice |
| View | Presentation choice | centre=(0,0) mm, zoom=1, rays, grid off | Authoring choice |

No essential physical facts are missing. Pixel scaling is unused, including the apparent source height and source/lens separation. No checker, native, optical, browser, or save/reload validation was performed in this pass; any later analytical prediction is conditional rather than an image detection.


## Subsequent verification

After the authoring pass, the parent review checked this interpretation against the input and independent reviewer facts. The candidate passed the current validator, completed native execution without errors/truncation/undefined behavior, passed independent native-ray probes and sandbox/native round-trips, and was previewed and saved in the browser. The actual browser sandbox download matches this document exactly. See [the validation record](../../VALIDATION.md#image-to-scene-authoring-workflow) for evidence and limits; execution success does not itself certify interpretation.
