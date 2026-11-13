# Private held-out LLM authoring trial — preparation, not a fabricated result

This is a **separate** evaluation pipeline from the synthetic same-assistant
cross-family controls and the older public ten-prompt/9-image model pilot.

The objective is a real, first-attempt-only test of whether a **separate**
configured language model can identify the physical apparatus and requested
observable without inventing missing facts. This repository contains **no
private held-out problems, answers, or provider secrets**, and normal CI makes
**zero external model calls**. We do not claim a model evaluation has occurred
until a real capture and separately reviewed score exist.

## What is required before a real independent result

1. A new set of **unseen, independently prepared** questions (at most 12).
   Keep them under ignored `test-artifacts/` and do not upload to the
   public GitHub repository. Record origin and exposure history externally.
2. A reference prepared by **two independent subject-matter reviewers**.
   They should validate the wording, physical facts (including truly missing
   or impossible values), supported result kinds, and expected preflight
   classification *before* seeing any model response. The two declared reviewer
   strings in the JSON are an **attestation, not proof of independence**.
   Disagreements need manual reconciliation before committing.
3. An external model ID and a private API key for a supported, explicitly
   approved OpenAI-compatible chat-completions endpoint.
   ChatGPT subscription access does not itself confer API credits or a key.
   The real endpoint must implement JSON-object responses.
4. Explicit permission for the specific new question text to leave the local
   machine: `OPTICSIM_EXTERNAL_DATA_APPROVED=yes`. Without this flag, no
   model traffic occurs. **Never use confidential/private questions** without
   the right to transmit them.

The complete source-first sequence is intentionally three separate CLI
processes; the model-capture file **does not load or import reference/scoring
code**. The reference SHA is known to capture only as a checksum, not answers.

### Private file formats (examples are templates, NOT held-out tests)

`test-artifacts/private/questions.json`:

```json
{
  "format": "opticsim-heldout-questions-v1",
  "cases": [
    {"id": "H01", "prompt": "Original unseen physical question text ..."}
  ]
}
```

`test-artifacts/private/reference.json`:

```json
{
  "format": "opticsim-heldout-reference-v1",
  "reviewers": ["reviewer-A", "reviewer-B"],
  "cases": [
    {
      "id": "H01",
      "classification": "supported",
      "expectedPhysical": {
        "lengthUnit": "cm",
        "components": []
      },
      "requestKinds": ["source-emissions"],
      "requiredComponentIds": [],
      "expectedTargets": [],
      "expectedPreflight": "native-ready",
      "reviewNote": "Independently adjudicated facts and applicability."
    }
  ]
}
```

The structural example above is **not an executable physical reference**:
a real `supported` case must contain all stated, valid components and
complete authoring fields. Every supported reference must explicitly include
`requiredComponentIds` and `expectedTargets` arrays (use `[]` when the
question states no IDs or target constraints). Only IDs literally specified
by the question belong in `requiredComponentIds`. List an `expectedTargets`
entry with `kind` and `componentId` when a particular measurement target
is part of the required answer. This avoids grading an arbitrary reference
label as a physical requirement or accepting a wrong detector/source when
native tracing nevertheless completes.

Negative classifications are `missing`,
`unsupported`, `ambiguous`, and `invalid`; for them specify
`expectedFirstStatus` (required) and optionally `reasonCode` when the exact expected
native refusal is independently reviewed. `requestKinds` must reflect the
question asked, **even when the requested operation is unsupported**. Do
not silently replace an unsupported inverse/symbolic question with a handy
native count.

### Phase 1: private precommitment (offline, no model calls)

```sh
node evaluation/heldout-authoring-v1/commit.mjs \
  --questions test-artifacts/private/questions.json \
  --reference test-artifacts/private/reference.json \
  --out test-artifacts/private/commitment.json
```

It validates both files and writes SHA-256 checksums of their exact bytes
and fixed case ID order. Make this checksum commitment **before** any model
calls, independently retain a timestamp or signed record if auditability
matters. SHA-256 alone is **not a cryptographic signature** and does not
prove the timing or legitimacy of review.

### Phase 2: private capture (network; explicit opt-in; no reference reads)

Configure environmental variables in your terminal or private CI only:

```text
OPTICSIM_MODEL_API_KEY=<private API credential>
OPTICSIM_MODEL_ID=<supported model ID>
OPTICSIM_MODEL_API_URL=https://api.openai.com/v1/chat/completions
OPTICSIM_MODEL_ALLOWED_ORIGIN=https://api.openai.com
OPTICSIM_MAX_HELDOUT_CASES=1
OPTICSIM_EXTERNAL_DATA_APPROVED=yes
```

The call count defaults to **one** and is bounded at 12. The private key is
never printed or saved by the script. The transport has no HTTP redirects,
only an explicitly approved HTTPS origin, bounded response size and request
timeout. **One call per case, no repair or automatic retry**. Bad JSON is
recorded as a failed first attempt; a network failure stops capture, leaves
the already recorded immutable first responses in place and requires an
explicit new run to proceed.

```sh
node evaluation/heldout-authoring-v1/capture.mjs \
  --questions test-artifacts/private/questions.json \
  --commitment test-artifacts/private/commitment.json \
  --out test-artifacts/llm-evaluation/private-heldout/run-01
```

The first-attempt `capture.json` and each `H01.first.json` are stored
only under ignored local output. Keep copies of this raw evidence **before**
opening a reference or scoring. The capture contains the exact raw response,
response hashes, provider-reported model ID and usage where available, and
the reference checksum *but not its contents*. Do not re-run a failed case
on top of a frozen first attempt.

### Phase 3: post-capture deterministic review (no network/model calls)

Build the unchanged pinned PhyDemo test core once:

```sh
npm run setup
npm test
```

Then:

```sh
node evaluation/heldout-authoring-v1/review.mjs \
  --questions test-artifacts/private/questions.json \
  --reference test-artifacts/private/reference.json \
  --commitment test-artifacts/private/commitment.json \
  --capture test-artifacts/llm-evaluation/private-heldout/run-01/capture.json \
  --out test-artifacts/llm-evaluation/private-heldout/review-01
```

The scorer verifies all question/reference/commitment and first-response
byte hashes before running **the existing** `preflight-problem.mjs` and
`runProblemEvidence()`, reusing the pinned native core. It scores separate
dimensions: response validity; physical facts, requested kind fidelity and
stable IDs; preflight/refusal correctness; native completeness; and supported
result availability. Physically wrong but runnable scenes **fail fidelity**.
Native measurements are qualified only under existing truncation and hash
gates. A model refusal may be appropriate for an unsupported problem, but a negative-case
decline is **provisional** until its explanation is reviewed by a human. Such
declines do not increase the automatically verified `safeNegativeHandling`
count; they appear separately as `negativeDeclinesAwaitingReview`.
Supported exact-authoring credit additionally checks reviewed, explicitly
stated IDs and adjudicated result targets when the reference specifies them.

**Do not publish the output or provider responses unreviewed.** Although
the source questions are not committed, raw model output may repeat their
contents. The script does not authenticate reviewer independence or score
subjective explanations; these still need human review.

## Limitations and boundaries

- No real model has been run by this code change, and no unknown question or
  expert reference has been secretly generated by ChatGPT.
- This evaluates *text* questions first; PNG/image input is not enabled by
  this private held-out protocol. The older original-image scope pilot remains
  a separately opt-in study.
- Only an externally curated reference can establish a meaningful semantic
  fidelity benchmark. Native software correctness alone cannot do so.
- No new optical schema, source family, GUI/player, auto-imputation, solver,
  external network call in CI, extra workflow, publication or source archive
  modifications. The public repository retains **only runner and mock tests**.
