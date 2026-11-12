# Unified LLM problem-to-result workflow

One offline command accepts a structured LLM interpretation and dispatches it
to the existing angular calculations, native scene preparation and requested
observables. It is **not** an image reader, a universal equation solver or a
new physics engine. No external model service, key or automatic retry is used.

```sh
node scripts/run-problem.mjs capabilities
node scripts/run-problem.mjs problem.json --out test-artifacts/llm-authoring/attempt-01
```

## The only new structure is the task envelope

```json
{
  "format": "opticsim-problem-v1",
  "physical": {
    "format": "opticsim-planar-angular-facts-v1",
    "source": {"id":"S1","region":0},
    "interfaces": [
      {"id":"I12","negativeIndex":1.6,"positiveIndex":1.8},
      {"id":"I23","negativeIndex":1.8,"positiveIndex":1.3}
    ]
  },
  "requests": [
    {"id":"angle","kind":"critical-input-angle","sourceId":"S1",
     "boundaryId":"I23","approach":"positive","tangentSide":"negative"}
  ],
  "interpretation": {
    "requestedResult":"Find the initial incidence that makes I23 critical.",
    "stated":["Parallel homogeneous media with indices 1.6, 1.8 and 1.3."],
    "assumptions":[], "unknowns":["Initial incidence is the requested unknown."]
  },
  "illustration":false,
  "verifyNative":false
}
```

`physical` is an existing minimal authoring request, the existing reduced
planar-angular facts, or `null` for explicitly unrepresented physics. No new
apparatus fields are introduced. A nullable input does not make a problem
unanswerable in principle; it records that this author has supplied no
supported physical representation. The original statement/image remains the
source of truth.

`requests` reuses existing observable and angular-query kinds. The wrapper
supplies the angular-query format marker mechanically. A maximum of 16 total
requests, of which at most four are angular queries, is enforced. Unknown
quantity kinds remain `unavailable` with `UNSUPPORTED_QUANTITY`; they are not
replaced with a convenient supported question. Unknown fields and duplicate
IDs are rejected. `interpretation` uses existing, unverified qualification
metadata. Generated code, formulas, network endpoints and secrets are not
accepted as instructions.

## Deterministic routing

- Angular queries use the existing pure analytical solver. Reduced facts do
  not require or manufacture brightness, drawing geometry or native policy.
- Registered native observables trigger at most **one** default-mode pinned
  simulation. `ideal-image` retains its existing strict native-completion gate
  and analytical model applicability check; it is not called native detection.
- `verifyNative:true` requests an additional native check where an unambiguous
  complete scene can be prepared. If native-only inputs are absent, that check
  is explicitly not run. Opposite inverse proposals are not arbitrarily chosen.
- Both routes may be used in one task. Incomplete or failed native evidence
  suppresses gated native observations but **does not erase** a separately
  justified conditional angular calculation.
- Illustration is off unless explicitly enabled. Its existing physical choices
  and provenance are retained; no new defaults, denser-ray fallback, alternate
  color mode, source substitution or repair is performed.

This dispatcher routes already typed requested quantities. The LLM still
interprets the question, chooses relevant known facts and identifies branch
hypotheses. The software does not establish whether that interpretation is
faithful to the image.

## Durable evidence and normal qualified packages

Every call requires a fresh, nonsymlink output path below the existing ignored
`test-artifacts/llm-authoring/` directory. Exact original bytes and input hash
are retained; invalid JSON/envelopes leave structured rejection reports.
`plan.json` and `analytical-results.json` are saved **before** native work.
A real run additionally records native diagnostics, hashes and final results.

When possible, `qualified-scene.json` is the same normal qualified-package
format already supported by the browser. It includes original interpretation,
illustrative assumptions, computed values and typed query provenance. Native
completion is a separate status; a package may legitimately reopen to an
incomplete native trace. Reduced facts alone never fabricate a package.

Exit 0 means all authored requested quantities are available (possibly
conditional) with no requested native verification failure. Exit 1 indicates
invalid input/infrastructure; exit 2 indicates unavailable/partial requested
results, unavailable verification, incomplete native execution or package
failure. **None of these is an original-question accuracy score.** The report
preserves exact per-result statuses and method labels, not just this exit code.

## Original-problem trial and control experiments

`evaluation/unified-workflow-v1/first-attempt.json` is immutable. Six original
Problems images were fixed before opening them, from sections 01/02/03/04/07/08,
choosing the highest numbered full-path-unmentioned item in each. This rule
favors difficult end-of-section questions and is not representative sampling.
Text search cannot certify no prior exposure. These are same-assistant first
interpretations and later separate reviews, **not independent model inference**.
No Solutions images are read. Unsupported cases are retained, not replaced.

```sh
node scripts/unified-problem-acceptance.mjs
node scripts/unified-original-trial.mjs
```

The five integration controls exercise analytical-only, native-only, mixed
incomplete, missing-input and unsupported paths. They are separate from the
six original questions. Passing control/regression tests does not turn the
original problem trial into a successful answer benchmark.
