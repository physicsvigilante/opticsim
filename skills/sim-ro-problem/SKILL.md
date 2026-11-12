---
name: sim-ro-problem
description: Interpret an optics problem into one bounded task using existing physical facts, angular calculations, native observations and qualified evidence.
---

# One interpreted problem, one execution entry point

Read `AGENTS.md`, `docs/UNIFIED-PROBLEM-WORKFLOW.md`, and the live
`node scripts/run-problem.mjs capabilities` output. Preserve the original
problem reference, stated facts, unknowns, assumptions and requested quantities
before execution. The tool does not read images or understand natural-language
physics; the LLM performs that interpretation.

Use the existing minimal authoring request or reduced planar-angular facts in
`physical`. Put existing typed requested quantities in `requests`; the
`opticsim-problem-v1` wrapper routes them deterministically. Use null physical
representation and an unavailable quantity rather than silently substituting
an easier apparatus. Unknown kinds remain unavailable; never count that as a
proof that the original problem is physically underdetermined.

For sequential **plane-mirror angular inverses**, the physical view
`opticsim-plane-mirror-angular-facts-v1` takes 2–4 ordered mirror IDs
and **unsigned consecutive line inclinations** only. Request
`mirror-incidence-from-output-direction` with a reference mirror,
`outgoingRelation: parallel|perpendicular`, and explicit
`angleConvention: from-normal`. The solver enumerates inclination signs
and outgoing directions; never guess a handedness or fabricate source
position, brightness, mirror lengths or native hits. Multiple solutions
and grazing cases remain explicit. Read `docs/PLANE-MIRROR-ANGULAR-QUERIES.md`.

Do not compute outgoing answers merely to supply a required forward input.
Use the supported inverse query where applicable. Do not invent brightness or
picture coordinates for pure angular mathematics. Native simulation needs
complete explicit inputs; illustration is separately opt-in and physically
consequential. Branch event choices are conditional hypotheses, not native
ray-routing instructions.

Execute `node scripts/run-problem.mjs problem.json --out
test-artifacts/llm-authoring/<fresh>`. Retain the original request, plan,
analytical outcomes, native evidence, report and qualified package together.
A failed/incomplete native run cannot certify a native observation. A valid
conditional analytical result is not an observed ray or verified interpretation.
Raw report coverage is not an independent accuracy score.

Do not retry or rewrite a recorded first attempt. Keep subsequent corrections
as separate requests/reviews. Do not call an external model service, read a
Solutions image, publish a site or merge a new PR without the appropriate
separate authorization. Existing model, component and numerical restrictions
remain authoritative.

## Curved mirror image and instantaneous motion

Read `docs/CURVED-MIRRORS.md` and live `curvedMirrors` capabilities.
Use `opticsim-curved-mirror-facts-v1` with explicit `ideal-gaussian` or
`spherical-paraxial` and `real-positive-local` sign convention. Request
`curved-mirror-image` or `curved-mirror-image-velocity` through the same
unified command. Do not supply arbitrary focal length, brightness or aperture
merely to calculate scale-free magnification: a stated u/f ratio plus curvature
is sufficient. Velocity needs known height and object motion, stationary
mirror, fixed focal length and time unit; transverse motion includes
changing magnification. Focal infinity is not a finite velocity.

Native scenes distinguish `ideal-curved-mirror` from
`circular-arc-mirror`: all geometry and brightness are explicit, scenes
use v6, and numerical circular rays can aberrate. Their measured reflection
counts are not detected images. Keep local transverse height distinct
from global y. Later physical edits make attached calculations historical;
recalculate using the new facts rather than presenting old values as current.
