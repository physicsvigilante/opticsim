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
