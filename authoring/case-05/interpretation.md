# case-05 interpretation

First-pass decision: unresolved; withhold an authoritative scene. Viewed `test/fixtures/image-to-scene/inputs/case-05.png` and read `case-05.md`. No factual corrections were made in this pass.

Proposed coordinate convention for later clarification: lens centre at (0,0), x right/y up. Reserve stable IDs S = `source-1`, L = `lens-1`; preserve them after clarification. 1 cm = 10 mm exactly.

| Quantity/component | Evidence | Value/unit | Status |
| --- | --- | --- | --- |
| S type/emission | Diagram and statement isotropic point source | Point source, full-circle | Stated |
| S height | Statement `on the optical axis`; dot on axis | y=0 mm | Stated |
| L centre | Proposed origin, optical axis | x=0 mm, y=0 mm | Coordinate choice |
| L signed focal length | Converging; statement `+8 cm` | +80 mm | Stated / converted |
| L full aperture | Statement full aperture `16 cm` | 160 mm | Stated / converted |
| Source-to-lens distance | Diagram `d = ?`; statement `distance d is not supplied` | d unknown; S x=-d in mm | Missing, essential |
| Pixel source-to-lens gap | Figure explicitly not to scale | No physical distance derived | Unusable as physical evidence |
| Brightness / sampling / view | Unspecified | No measured power; future presentation/execution choices remain free | Nonessential authoring choices |

Focused clarification: What is the source-to-lens distance d, including its unit?

No scene is supplied because choosing d would fabricate an essential physical fact. The supported single-lens model becomes authorable once d is supplied within contract bounds. No checker, native, browser, optical or save/reload validation was attempted. No prior output or answer key was consulted.

## Clarification and second-pass authoring

The evaluation follow-up explicitly supplies `d=24 cm`. This resolves the missing source-to-lens distance without inferring it from pixels. The first-pass decision above remains the record of what was known before clarification; its statement that no scene is supplied describes that first pass.

| Quantity/component | Evidence | Value/unit | Status |
| --- | --- | --- | --- |
| Source-to-lens distance | Follow-up: `d=24 cm` | 240 mm | Clarified / converted |
| Source position | Source left of L, on axis; clarified d; L-centred origin | (-240,0) mm | Derived |
| Lens centre | Same chosen origin | x=0 mm, y=0 mm | Coordinate choice retained |
| Lens signed focal length | Original statement `+8 cm` | +80 mm | Original stated fact retained |
| Lens full aperture | Original statement `16 cm` | 160 mm | Original stated fact retained |
| Source type/emission | Original isotropic point source | Point source, full-circle | Original stated fact retained |
| Relative brightness | Measured power unspecified | 0.15, upstream-relative | Authoring choice |
| Inactive emission fields | Full-circle mode | direction=0 degrees, opening=30 degrees | Retained defaults; not measurements |
| Sampling/limits | Execution choice | density=1, depth=8, processed limit=10000 | Authoring choice |
| View | Presentation choice | centre=(0,0) mm, zoom=1, rays, grid off | Authoring choice |

Second-pass decision: resolved supported single-lens scene. Persistent IDs remain `source-1` and `lens-1`. No other physical fact changed. No checker, build, native, optical, browser or save/reload validation was performed. Later lens analysis remains conditional on traversal of the finite lens rather than image detection.


## Subsequent verification

After the authoring pass, the parent review checked this interpretation against the input and independent reviewer facts. The candidate passed the current validator, completed native execution without errors/truncation/undefined behavior, passed independent native-ray probes and sandbox/native round-trips, and was previewed and saved in the browser. The actual browser sandbox download matches this document exactly. See [the validation record](../../VALIDATION.md#image-to-scene-authoring-workflow) for evidence and limits; execution success does not itself certify interpretation.
