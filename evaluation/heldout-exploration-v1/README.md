# Milestone 35 — private first-attempt LLM-directed physical exploration protocol

**Status: infrastructure prepared, independent model evaluation NOT YET RUN.** There are **zero** private held-out questions, external model responses, expert reviews, student/teacher participants or independently verified learning outcomes in this public milestone. All code tests use explicitly exposed synthetic/mock data; they are **software harness tests**, not model-success denominators.

The educational objective is to let an LLM author **many meaningful, source-faithful investigations of one reusable physical system** with minimal intervention, while existing Opticsim validates and executes each independently. The LLM does not create native PhyDemo JSON, solve intermediate values, invent geometry, or certify its own interpretation.

## Two distinct, non-pooled evaluation tracks

**A. Unfamiliar source interpretation:** use the already implemented `evaluation/heldout-authoring-v1/` with previously unseen independently curated *full-scene* textual problems. Score physical-fact fidelity, declared IDs, requested kinds, appropriate missing-information handling and native coverage separately. Never reclassify successful tracing as correct interpretation.

**B. LLM-directed revision of a verified, unfamiliar-to-the-model baseline:** use this `heldout-exploration-v1` protocol. The model sees only the newly curated task, the **hash-verified qualified baseline** (physical scene, stable IDs, existing requested observations and its author-declared source notes), and the public live authoring capabilities. It produces a **minimal typed delta**, not the full model. The original baseline remains unchanged. Branching, hypothetical classification, numerical settings and provenance are checked after the first response. **Only Track B is implemented in this directory.**

Report the two denominators separately. A complete-scene authoring result and a baseline-directed revision result answer different questions; neither demonstrates human educational effectiveness.

## Curator and human-review prerequisites

Before any provider call, an independent curator should prepare **8–12 genuinely unseen** textual investigations, or a smaller precommitted pilot. Different physical families and genuinely different changes should be represented: stable-ID focal/source edits, addition/removal of registered components, explicit observations and unsupported or missing/ambiguous instructions. Avoid simply renaming the exposed synthetic PR #56–#58 fixtures. A baseline must be independently created and checked, include real physical information rather than arbitrary placeholder geometry, and carry a qualified source reference with SHA-256. A baseline is not automatically faithful because its save is valid.

**Two actual independent physics reviewers** separately adjudicate the original wording, model assumptions, allowed changes, expected full *physical* state after each admissible change, target observables, and when the correct outcome is to request more information or refuse. Resolve disagreements and record provenance before inference. Reviewers' labels in JSON are an attestation only; the software cannot authenticate them. Ensure a human review of the educational explanation separately from physical/numerical scoring.

The original questions and reviewed reference must remain in **ignored private `test-artifacts/`**, not public commits or GitHub Actions artifacts. Prepare a documented external exposure trail and a signed or timestamped hash record. A SHA alone does **not** establish temporal priority or expert independence.

## Private manifests (shapes only; NOT real evaluation problems)

`test-artifacts/private/exploration-questions.json`:

```json
{
  "format": "opticsim-heldout-exploration-questions-v1",
  "cases": [
    {
      "id": "E01",
      "task": "Independently curated physical investigation text goes here",
      "baseline": "<complete, verified opticsim-qualified-scene-v1 JSON object>"
    }
  ]
}
```

Replace the illustrative string with the **actual entire qualified baseline JSON object**. Every baseline must be validated with `verifyQualifiedBundle` and contain an author-declared source SHA-256. It may include sensitive source notes; all baseline information presented to the model counts as external transfer.

`test-artifacts/private/exploration-reference.json` (never read or imported by capture):

```json
{
  "format": "opticsim-heldout-exploration-reference-v1",
  "reviewers": ["Independent physics reviewer A", "Independent physics reviewer B"],
  "cases": [
    {
      "id": "E01",
      "classification": "supported",
      "expectedAction": "revise",
      "expectedPhysics": "<complete, independently adjudicated canonical scene.physics JSON object>",
      "expectedAdditionalTargets": [],
      "reviewNote": "Explicit rationale for the requested physical change and assumptions"
    }
  ]
}
```

Again, the string is a **placeholder**, not a valid adjudicated physical object. Real supported cases require a full physics object, valid under the existing canonical scene contract, with the unchanged model family and length gauge. `expectedAction` is one of `revise`, `structure`, or `observe`. Additional targets are exact `{kind,componentId}` pairs (use `[]` if none). The model's arbitrary request IDs do not count as physical facts; wrong component targets do.

For negative cases use `classification` `missing`, `ambiguous`, `unsupported` or `invalid`, with `expectedFirstStatus` `needs-information`, `unavailable` or `invalid-input` and a `reviewNote`. Do **not** provide `expectedPhysics` for a negative case. The review may identify multiple legitimate semantic descriptions; any such adjudication must be documented pre-inference. This pilot scores exact unambiguous admitted deltas and preserves ambiguity as a distinct negative, rather than inventing a unique answer.

## Offline freeze → one-call capture → offline review

All three commands reuse the existing private checksum, sandbox-output and fixed-model transport infrastructure. Nothing runs periodically or automatically; **normal CI makes zero provider calls**.

### 1. Freeze before the first model response (no network)

```sh
node evaluation/heldout-exploration-v1/commit.mjs \
  --questions test-artifacts/private/exploration-questions.json \
  --reference test-artifacts/private/exploration-reference.json \
  --out test-artifacts/private/exploration-commitment.json
```

This validates the exact input model/manifest/reference and freezes SHA-256 checksums and case order. Retain timestamped commitment evidence **outside** the inference/review environment. Never rewrite a committed question or adjudication to fit a model output.

### 2. Capture the separate model's raw first attempts (explicitly opt in)

Only after choosing and authorizing a specific model/provider, confirming rights to transmit all included question and baseline text, budget/charges, and verifying model access:

```sh
export OPTICSIM_MODEL_API_KEY='<PRIVATE: do not commit or paste into chat>'
export OPTICSIM_MODEL_ID='<preapproved model id>'
export OPTICSIM_MODEL_API_URL='https://api.openai.com/v1/chat/completions'
export OPTICSIM_MODEL_ALLOWED_ORIGIN='https://api.openai.com'
export OPTICSIM_MAX_HELDOUT_CASES=1
export OPTICSIM_EXTERNAL_DATA_APPROVED=yes

node evaluation/heldout-exploration-v1/capture.mjs \
  --questions test-artifacts/private/exploration-questions.json \
  --commitment test-artifacts/private/exploration-commitment.json \
  --out test-artifacts/llm-evaluation/private-heldout/exploration-attempt-01
```

The placeholder endpoint is not an instruction to use OpenAI specifically. Use only the provider explicitly selected and approved. A ChatGPT subscription does not imply API credits. Capture sends the task, the full baseline physical scene and source notes, plus the live public capabilities. **It does not load the reference.** Every case gets exactly **one** response and no retries, JSON repair, computed substitutions, rerouting or answer-key lookup. Raw responses, model ID, usage, case input SHA and output SHA stay in the fresh ignored output. Interrupted runs preserve already received attempts; never overwrite or silently resume.

Accepted output envelopes are:

```json
{"proposal":{"action":"revise","patch":{"changes":[{"id":"L1","section":"parameters","key":"focalLength","value":150,"unit":"mm"}]}}}
```

or `{"proposal":{"action":"structure","patch":{"format":"opticsim-component-revision-v1","operations":[...]}, "additionalObservables":[...]}}`, or `{"proposal":{"action":"observe","additionalObservables":[...]}}`, or `{"cannotAuthor":"specific missing, ambiguous or unsupported physical information"}`. The example is a **format illustration**, not a private model result; values must come from the actual task. The grader binds the baseline hash mechanically, not via model interpretation.

### 3. Verify frozen responses before opening reference; score offline

After saving a read-only copy of first attempts, set up the unchanged native core with `npm run setup && npm test` and run:

```sh
node evaluation/heldout-exploration-v1/review.mjs \
  --questions test-artifacts/private/exploration-questions.json \
  --reference test-artifacts/private/exploration-reference.json \
  --commitment test-artifacts/private/exploration-commitment.json \
  --capture test-artifacts/llm-evaluation/private-heldout/exploration-attempt-01/capture.json \
  --out test-artifacts/llm-evaluation/private-heldout/exploration-review-01
```

The review checks exact original question/model-input hashes, raw response text and separate first-attempt files **before reading the expert reference**, then verifies reference bytes. It uses existing `reviseScene`, `prepareQualifiedStructure`, canonical validation, qualified export, pinned native PhyDemo and `evaluateObservables`. No new physics engine, method names or canonical model schema is created. A malformed proposal, failed validation or missing value is retained; it cannot become a successful scene through automatic repair.

## Five separate evaluation dimensions

| Dimension | Score or review rule | What does NOT count |
| --- | --- | --- |
| **Original interpretation fidelity** | Track A: independently reviewed original facts, geometry, stable IDs, stated/unknown inputs | A valid native execution |
| **Requested revision fidelity** | Track B: exact reviewed post-revision physical system, action type, explicit observable type and target, no unintended physical/numerical/presentation edits, preserved original provenance | A runnable but different scene; a matched crossing count |
| **Physics and numerical qualification** | Native status, integrity/freshness, warnings, truncation, independently reviewed validity of the supported optical model | Native completion as proof of physical meaning or continuous irradiance |
| **Simulation coverage and refusal** | Actual accepted outcomes, unavailable quantities, rejected proposals, missing/ambiguous/unimplemented requests, separate denominators | Treating engine rejection as a deliberate correct LLM refusal |
| **Educational usefulness** | Independent teacher task review of intelligibility, manipulability, assumptions, comparisons and whether claims match evidence | Green CI, screenshots or the assistant judging its own quality |

Textbook-answer completeness is separately **optional**, never added to a pooled “overall” score. For revision Track B, original source interpretation is explicitly **not reassessed**, because the verified baseline is given to the model. Numerical sampling changes must never be sold as changed physical illumination; conditional ideal image calculations are not native detections.

Report case-level status and each denominator: submitted proposals, exact physical changes, matching targets, native-complete accepted scenarios, invalid submissions, engine rejections, and **provisional** negative declines awaiting human reason review. The scorer sets `overallModelAccuracy:null`, `independentlyVerifiedReviewers:false`, and teacher learning `not-assessed` until actual independent evidence exists. Even a correctly formatted refusal earns **no automatic** safe-negative approval.

## Security and publication boundary

No private questions, references, API keys, captured responses or raw evidence go into GitHub commits, PR comments, or public Actions artifacts. The existing manual public independent workflow uses different exposed prompts/images; **do not use it for private held-out cases**. Use a private authorized execution environment and privacy-review any future summary before publishing. Never add a GitHub action that uploads private raw artifacts.

The included regression tests use deliberately known, exposed, synthetic models and a **mock** transport. They verify protocol mechanics (one call, sealed bytes, refusal handling, exact target/physical scoring and native integration) but are not external-model inference, independently curated questions or educational measurements.

**Completion condition:** independently curated unseen questions, two verified reviewers and precommitted references, explicitly authorized external provider transfer, actual immutable first attempts, separated native/evidence scoring and real human interpretation/teaching review. Until then state **“independent exploration evaluation not yet run.”**
