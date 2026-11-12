# Plane-mirror angular constraints (bounded inverse capability)

This is a small new **requested calculation**, not a new mirror component,
ray tracer, scene format, or image interpreter. It reuses the existing
\`opticsim-problem-v1\` unified problem entry point.

The LLM supplies the genuinely stated angular physics: ordered ideal plane
mirrors, unsigned angles between consecutive mirror **lines**, and a
desired outgoing line condition. No source brightness, mirror lengths,
coordinates or invented incoming direction is required.

## Minimal example — original U1 post-trial follow-up

\`\`\`json
{
  "format": "opticsim-problem-v1",
  "physical": {
    "format": "opticsim-plane-mirror-angular-facts-v1",
    "mirrorIds": ["M1", "M2"],
    "consecutiveInclinationsDeg": [70]
  },
  "requests": [
    {
      "id": "theta",
      "kind": "mirror-incidence-from-output-direction",
      "referenceMirrorId": "M1",
      "outgoingRelation": "parallel",
      "angleConvention": "from-normal"
    }
  ],
  "verifyNative": false
}
\`\`\`

\`\`\`sh
node scripts/run-problem.mjs capabilities
node scripts/run-problem.mjs input.json --out test-artifacts/llm-authoring/mirror-case-01
\`\`\`

The pure analytical result is **50 degrees measured from the first mirror
normal**, and the complementary angle to its surface is **40 degrees**.
The usual angle-of-incidence convention is a declared interpretation:
the original wording does not provide a drawing specifying a different
theta reference.

This is a **separate, later follow-up** to the earlier fixed six-problem
trial U1. The first interpretation and its unresolved result are not edited.
No Solutions image is read, and the result is same-assistant development
evidence rather than independently adjudicated textbook accuracy.

## Mathematical model and enumeration

Let a directed ray heading angle be beta and a plane mirror's tangent
angle be alpha, both in the chosen x-right/y-up angular gauge. The ideal
specular reflection is

\`\`\`text
beta_out = 2 alpha - beta_in  (mod 360 degrees)
\`\`\`

Only the relative tangent angle matters: mirror 1 is set to 0 degrees as
a **coordinate gauge**, not as a physical choice. An unsigned inclination
between two undirected mirror lines has both +/- orientation signs.
The solver enumerates each possible orientation for 2–4 ordered mirrors,
and both directed headings parallel (or perpendicular) to the stated
reference mirror. It applies reflection in reverse order, computes
the first **unsigned normal incidence** and deduplicates equivalent
normal angles.

For two mirrors at 70 degrees and final output parallel to mirror 1:

\`\`\`text
alpha1 = 0, alpha2 = +/-70 degrees
beta_out = 0 or 180 degrees
beta_in = beta_out - 2(alpha2 - alpha1)   (mod 360 degrees)
theta = angle between incoming ray and first mirror normal
theta = 50 degrees in every non-grazing orientation/direction case
\`\`\`

This calculation does NOT prove that finite mirror segments at unspecified
positions intersect the ray in the stated order. The event order is
author-stated, not an imposed native route. There is no source position,
intensity, handedness or camera to compile to PhyDemo, so **native status
is not-run**. An optional native verification request remains not-run
until all required physical scene details are explicitly supplied.

## Applicability and rejection

- The first mirror ID is the first item in the authored reflection order.
  There are 2–4 IDs and exactly one finite unsigned inclination in [0,90]
  for every adjacent pair; no arbitrary equations or unbounded input.
- Requests specify a known mirror ID and whether the final ray is
  \`parallel\` or \`perpendicular\` to its line, with the explicit
  \`from-normal\` incidence-angle convention.
- All orientation signs are enumerated. If distinct physically non-grazing
  solutions remain, the result is \`multiple-solutions\`, carries candidate
  values and never silently chooses one.
- Exactly grazing interactions cannot hit a finite straight mirror and
  are excluded with \`GRAZING_MIRROR_INTERACTION\` diagnostics. If all
  possibilities graze, the result is \`unavailable\`, not a falsely valid
  90-degree reflection.
- Malformed fields, unknown IDs, nonnumeric angles, missing conditions,
  incompatible request formats and executable payloads are rejected.
  Missing physical facts are distinguished from mathematical impossibility.
- The result is **conditional-analytical-specular-reflections**, never a
  native ray observation or source-specific optical history. A conditional
  solution also does not establish that the LLM interpreted the question
  correctly.

## Verification and evidence

\`\`\`sh
npm run setup
npm test
node scripts/mirror-angle-acceptance.mjs
\`\`\`

This runner checks the original U1 PNG SHA, confirms the earlier
\`evaluation/unified-workflow-v1/first-attempt.json\` canonical SHA is
unchanged, and executes the separately preserved post-trial follow-up.
It also runs independent 30 and 45 degree cases, a four-mirror ambiguity,
and a grazing negative control through the **same** unified CLI.
All original request/report bytes are written to fresh evidence directories.

Pure tests independently apply the 2D vector reflection equation for
every enumerated ray. A **separate synthetic test-only** finite apparatus
uses real pinned native \`SingleRay\` and two native \`Mirror\` objects,
observes exactly two physically selected mirror hits and unchanged native
outgoing directions. This test is **not** claimed as a native simulation
of the underspecified original U1 mirror lengths or locations.

No additional upstream optics, numeric cutoffs, general symbolic algebra,
external model provider, image-language interpreter or public deployment
is added. More optical families need separate evidence-led approval.
