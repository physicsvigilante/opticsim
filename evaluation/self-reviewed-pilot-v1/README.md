# Three-case self-reviewed GPT-6 development pilot

This is an explicitly **same-assistant, non-independent** optics authoring exercise requested by the project owner. GPT-6 in one ChatGPT conversation composed all three *synthetic* textual questions and one JSON first response for each. There is no separate model/provider inference, independent question preparation, blinded adjudicator, external model API call or human subject-matter review. Its result **must never be reported as independent model accuracy or a held-out exam benchmark**.

## Temporal record

- The question text and untouched first outputs were frozen **before** the self-review/reference in Git commit `4ee53964751721bf4307ebef1c7de23a9c642486`.
- The runner pins those two prior Git blob SHA-1 values. This detects changes in the fixed files, but it does not establish genuine evaluator independence, unseen prompts or answer-key secrecy: the same model authored the questions and the first responses.
- The reference file was written *after the freeze* by the same assistant. Its `independentlyReviewed` flag is false. A model decline is recorded as **provisional self-reviewed refusal**, not certified negative handling.
- Two positive requests test separate native compositions: point source + circular opaque blocker + passive detector; and point source + finite aperture with an ideal lens entirely within the gap + passive detector. The third question omits a required opaque-disc radius and requests a refusal rather than a fabricated value.

## Execution

```sh
npm run setup
npm test
node evaluation/self-reviewed-pilot-v1/replay.mjs
```

The replay reads only frozen first attempts, invokes existing preflight and `runProblemEvidence` for the two authored physical requests, then uses the existing `scoreHeldout` on the **self** reference. The pinned native PhyDemo engine is invoked exactly once per accepted request. All evidence goes into the ignored `test-artifacts/llm-authoring/self-reviewed-pilot-v1` directory. The third model response is a refusal; no native scene is fabricated. The original JSON strings are not rewritten, fixed, retried or used to request a separate model result.

Failures and mismatches are retained in the report. A successful CI step means the replay/audit mechanism worked, **not** that all first attempts were right. The per-case report separately records native status, target/physical fidelity, actual sampled counts, and provisional refusal status.

## Further evaluation

The real independent milestone remains [Issue #46](https://github.com/physicsvigilante/opticsim/issues/46). A genuine test requires external reviewers, new unseen private cases, precommitment, explicit provider/data permission and real one-shot model calls. This development pilot deliberately does **not** satisfy those conditions.
