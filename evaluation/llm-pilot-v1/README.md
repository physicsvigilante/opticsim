# LLM authoring pilot v1 — evaluation, not new physics

This development benchmark is a **candidate on top of the unmerged Milestone 6
PR #7**, not a benchmark score from an independently sampled language model.
The engine under test is the existing pinned PhyDemo native tracing adapter.

## Two independent parts

**Composition (10 synthetic fully specified prompts):**
[Prompts](prompts.json) are the only inputs given to an authoring model, along
with the runtime \`capabilities()\` contract. Ask the model to return one
\`prepareScene()\`-compatible request per case. Do not show it
[authoring-reference.json](authoring-reference.json) until after submission.
The reference is a deterministic control fixture, not evidence of a held-out
LLM success rate. The LLM may choose different IDs or component array order;
the physical score compares native component types and their physical values
order-independently after the same deterministic unit conversion. ID preservation
is reported separately. Even when physically faithful, a run can be incomplete.

**Real JEE interpretation (9 uploaded question images):**
[Corpus prompts](corpus-prompts.json) contains paths to nine **Problems** PNGs
inside \`01_problems.zip\`, pinned to repository \`physicsvigilante/opticsim\`,
branch \`evaluation/jee-problems\`, commit
\`6883c12d431961156aee47b7b8c129231753878c\` and complete ZIP SHA-256.
The archive is not copied onto the Milestone 6 or this evaluation branch.
For each image, the model must classify whether the **question's actual
requested result** is \`exact\`, \`illustration-only\`, or \`unsupported\` under
the current authoring contract, and explain its conclusion. Distinguish an
illustrative ray drawing from an authoritative answer; optical surface contact,
unknown physical lengths, finite spot width, moving mirror, curved surface,
refraction, prism, extended-object and observer constraints all matter.
The preliminary human-review labels are in
[corpus-reference.json](corpus-reference.json) and **must not** be shown to
the interpreting model. Do not access any \`/Solutions/\` images until after
the independent evaluation.

These human scope labels are not an independent accuracy ground truth for
every optical conclusion. A correct label with a faulty explanation is **not**
a success: the scorer checks label equality only and flags explanation review
as manual.

## Submission format

Create a UTF-8 \`submission.json\` file with a single object:

\`\`\`json
{
  "format": "opticsim-pilot-submission-v1",
  "authoring": [
    {"id": "C01", "request": {
      "lengthUnit": "cm",
      "components": [
        {"id": "S1", "type": "point-source",
         "parameters": {"x": -8, "y": 3, "brightness": 0.08},
         "emission": {"mode": "full-circle"}}
      ]
    }}
  ],
  "scope": [
    {"id": "R01", "scope": "illustration-only",
     "reason": "The requested result cannot be obtained from the strict native tracer without changing the geometry and adding an inverse-ray constraint."}
  ]
}
\`\`\`

This example shows only the first case in each category; it is not an
evaluation of the other cases. Remaining cases can be provided as additional
rows, with no added optical components not justified by the prompt.

## Running the deterministic evaluation

From the repo root with Node 24.19.0+, after \`npm run setup\`:

\`\`\`powershell
npm test
node evaluation/llm-pilot-v1/score.mjs submission.json --report test-artifacts/llm-evaluation/my-report.json
\`\`\`

The ordinary \`npm test\` builds the unchanged pinned \`dist/test-core.cjs\`.
The scorer uses the **exact current** \`prepareScene()\` and native
\`checkCandidate()\` without implementing any new ray physics. It returns
separate counts for submitted, structurally valid, physically faithful,
stable-ID fidelity, native execution passed, and scope-label matches.
Incomplete native execution is not counted as a passed run, and analytical
image prediction remains unavailable for general tracing. An invalid physical
request never executes. Reports stay under ignored
\`test-artifacts/llm-evaluation/\`. No online LLM, provider API, or secret is
required.

The tests intentionally submit a physically wrong focal length that still
compiles and runs: this must fail the **physical fidelity** score even when
native execution completes. They also check missing emission parameters,
component reordering, millimetre conversion, scope mistakes and missing rows.
A perfect control-fixture score is a **scorer self-test**, NOT an LLM benchmark.

## Next experiment

Give an independent LLM only \`prompts.json\`, \`corpus-prompts.json\`,
the specified **Problems** PNGs and \`capabilities()\`; collect its output
without access to either reference file. Run the scorer, then **independently
review explanations** and questionable geometry, including any results that
the native execution accepts but the model has physically misinterpreted.
Only after that should the existing solution images be consulted as an
additional, separate check. Report the name/configuration of the evaluated
model, authoring attempts and repairs, not simply a success fraction.

No GitHub visibility/public demo changes or source-image rewriting are
authorized by this pilot.
