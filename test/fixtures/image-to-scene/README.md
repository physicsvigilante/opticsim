# Image-authoring pilot fixtures

These are original, deliberately simple evaluation diagrams and statements.
`inputs/` contains curated PNGs, their authored SVG sources, and statements.
The raster images are intentional source fixtures, not simulation screenshots.
`reviewer/expected.json` contains separate expected physical facts and analytical
points; it must not be supplied as an authoring input.

| Input | First-pass result |
| --- | --- |
| case-01: single lens | Resolved; image (120,-6) mm, m=-0.5 |
| case-01-stretched: changed pixel geometry, same labels/statement | Resolved; identical physical document to case-01 |
| case-02: two unequal coaxial lenses | Resolved; image (760,18) mm, m=1.5 |
| case-03: vertical plane mirror | Resolved; virtual point (150,20) mm |
| case-04: mirror normal labelled +45 degrees | Resolved; tangent -45 degrees, virtual point (-40,120) mm |
| case-05: missing distance | Withheld scene; asked for d |
| case-05-conflict: 24 cm diagram versus 30 cm statement | Withheld scene; asked which distance is authoritative |
| case-06: refracting prism | Rejected; no substituted component or scene |

`case-01-stretched.png` uses `case-01.md`. The planned evaluation follow-up
`case-05-clarification.md` supplies d=24 cm; it is not an actual user answer or
an input to the first pass. The second pass creates the sixth resolved document,
preserving the IDs reserved in the missing-distance interpretation.

Actual author outputs are in `authoring/<case>/` at the repository root. They
declare Dense density=1, relative brightness=0.15 and camera settings as authoring
choices, not diagram measurements. Isotropic emission is explicitly stated in
the supported fixture problems. Inactive direction/opening values are labelled
defaults. Physical values were not changed to obtain a passing execution.

The separate-context author saw PNGs/statements and the skill/current contract.
The proposal, SVGs, generator, expected answers and evaluation scripts were
excluded by instruction, not an OS access boundary. First-pass artifacts were
frozen before the clarification. There were no factual corrections.

See [VALIDATION.md](../../../VALIDATION.md#image-to-scene-authoring-workflow) for
the separate interpretation, native-ray and browser findings. Generated checks,
source/input hashes, first-pass copies and screenshots are ignored under
`test-artifacts/image-to-scene/`. This small clean synthetic pilot does not
measure broad perception accuracy; statements repeat most diagram quantities.
