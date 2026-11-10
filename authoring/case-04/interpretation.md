# case-04 interpretation

First-pass decision: resolved supported point-source/tilted-plane-mirror scene. Viewed `test/fixtures/image-to-scene/inputs/case-04.png` and read `case-04.md`. No factual corrections were made in this pass.

Choose C as origin, x right/y up; 1 cm = 10 mm exactly. Stable IDs: S = `source-1`, mirror = `mirror-1`.

| Quantity/component | Evidence | Value/unit | Status |
| --- | --- | --- | --- |
| S type/emission | Statement isotropic point source | Point source, full-circle | Stated |
| S position | Diagram `S = (-12 cm, +4 cm)`; same statement | (-120,40) mm | Stated / converted |
| Mirror centre | Coordinates relative to C; chosen origin | (0,0) mm | Coordinate choice |
| Normal orientation | Diagram labelled normal and 45-degree arc; statement CCW from rightward +x to NORMAL | +45 degrees | Stated |
| Surface tangent orientation | Perpendicular to labelled normal | -45 degrees (=45-90); equivalently +135 degrees for two-sided mirror | Derived |
| Mirror full length | Diagram and statement `16 cm` | 160 mm | Stated / converted |
| Reflecting behavior | Statement `ideal two-sided plane mirror` | Native two-sided idealization | Stated / supported |
| Normal, arc, coordinate arrows | Construction/coordinate annotations | No additional optical components | Diagram interpretation |
| Relative brightness | Measured power unspecified | 0.15, upstream-relative | Authoring choice |
| Inactive full-circle fields | Full-circle mode | direction=0 degrees, opening=30 degrees | Retained defaults; not measurements |
| Sampling/limits | Execution choice | density=1, depth=8, processed limit=10000 | Authoring choice |
| View | Presentation choice | centre=(0,0) mm, zoom=1, rays, grid off | Authoring choice |

No essential missing values or conflicts. +45 degrees is not authored as the mirror tangent. The selected -45-degree tangent matches the descending surface in y-up coordinates; the adapter alone handles native y-down. Checker/native/optical/browser/save-reload validation has not been run. Later conditional mirror analysis is not image detection or proof of a sampled reflection.


## Subsequent verification

After the authoring pass, the parent review checked this interpretation against the input and independent reviewer facts. The candidate passed the current validator, completed native execution without errors/truncation/undefined behavior, passed independent native-ray probes and sandbox/native round-trips, and was previewed and saved in the browser. The actual browser sandbox download matches this document exactly. See [the validation record](../../VALIDATION.md#image-to-scene-authoring-workflow) for evidence and limits; execution success does not itself certify interpretation.
