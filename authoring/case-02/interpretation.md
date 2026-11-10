# case-02 interpretation

First-pass decision: resolved supported two-coaxial-lens scene. Viewed `test/fixtures/image-to-scene/inputs/case-02.png` and read `case-02.md`. No factual corrections were made in this pass.

Choose L1 centre as origin, x right/y up; 1 cm = 10 mm exactly. Stable IDs: S = `source-1`, L1 = `lens-1`, L2 = `lens-2`.

| Quantity/component | Evidence | Value/unit | Status |
| --- | --- | --- | --- |
| S type/emission | `S (isotropic point source)` and statement | Point source, full-circle | Stated |
| S position | `24 cm` left of L1; `S is 1.2 cm above axis` | (-240,12) mm | Stated / converted |
| Lens centres | L1/L2 on shared axis; `28 cm` separation | L1 x=0 mm; L2 x=280 mm; both y=0 | Stated / derived coordinates |
| L1 signed f | Converging, `f = 8 cm`; statement `+8 cm` | +80 mm | Stated / converted |
| L2 signed f | Converging, `f = 12 cm`; statement `+12 cm` | +120 mm | Stated / converted |
| L1 full aperture | `aperture = 20 cm`; statement full aperture heights | 200 mm | Stated / converted |
| L2 full aperture | `aperture = 24 cm`; statement full aperture heights | 240 mm | Stated / converted |
| Horizontal dashed line/dimension arrows | Axis and labelled spacing guides | No extra optical components | Diagram interpretation |
| Relative brightness | No measured power supplied | 0.15, upstream-relative | Authoring choice |
| Inactive full-circle fields | Full-circle mode | direction=0 degrees, opening=30 degrees | Retained defaults; not measurements |
| Sampling/limits | Execution choice | density=1, depth=8, processed limit=10000 | Authoring choice |
| View | Presentation choice | centre=(50,0) mm, zoom=1, rays, grid off | Authoring choice |

No missing essential physical values or conflicts. Labelled dimensions, not pixels, set the geometry. Only an authored document is delivered: contract, native, independent optics, browser and save/reload validation remain unperformed in this pass. Finite lens misses remain native behavior; no claim is made that all rays traverse both lenses.


## Subsequent verification

After the authoring pass, the parent review checked this interpretation against the input and independent reviewer facts. The candidate passed the current validator, completed native execution without errors/truncation/undefined behavior, passed independent native-ray probes and sandbox/native round-trips, and was previewed and saved in the browser. The actual browser sandbox download matches this document exactly. See [the validation record](../../VALIDATION.md#image-to-scene-authoring-workflow) for evidence and limits; execution success does not itself certify interpretation.
