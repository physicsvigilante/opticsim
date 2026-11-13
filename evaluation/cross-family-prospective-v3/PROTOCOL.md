# Cross-family prospective authoring controls v3

This evaluation exercises the *existing* LLM-authorable Opticsim system, not a
new optical component or a benchmark of unseen real textbook answers.

## Chronology and separation

1. **Prompt/policy freeze** `08518e49cea9a27e9e73965a9954618ac9517b26`:
   fixed eight explicitly specified supported synthetic configurations plus
   four negative controls, before any original attempt or scoring.
2. **First-attempt freeze** `ab792a3923da13f956eded1fa364d8089875bb21`:
   one `opticsim-problem-v1` envelope per case authored in this very
   conversation by the *same ChatGPT assistant*, without an independent model
   or deterministic preflight/physics execution. Do not silently edit.
3. **Reference commit** `aed2f9543dcc618134f24fc9ac14ae7223c5995d`:
   a manually curated fact transcript from the prompt, authored **after**
   attempts were sealed. It is **not** externally adjudicated.
4. The replay runner uses pinned Git blobs and existing deterministic
   `preflight-problem.mjs` and `runProblemEvidence`. It supplies a prebuilt
   pinned native test core, preserving exactly one executor call per native
   candidate. Incomplete native runs remain incomplete, not automatic repairs.

The Git blobs of the four frozen JSON files are pinned in `replay.mjs`.
The CI test independently verifies the same historical records and attempts.
Every per-case input's SHA256 and preflight evidence is retained.

## Scored dimensions (never conflated)

- **Physical fidelity**: compare known component types and parameters, after
  deterministic unit conversion for supported cases; ignore ordering.
  Separately score stable authored IDs. For missing/invalid cases compare the
  explicit original *unvalidated* supplied facts: do not repair them.
- **Requested-result fidelity**: multiset of requested kinds relative to the
  prompt, independent of the optical run and supplied result IDs.
- **Preflight correctness**: all supported cases must be fully specified and
  native-ready; missing, unsupported, ambiguous-target and invalid-index
  negative controls must refuse or ask for missing facts as appropriate.
- **Native execution and coverage**: record actual call count, completion,
  requested result count, first-event availability and suppression. Native
  success cannot turn a physically inaccurate request into a correct answer.
- **LLM work avoided**: count unambiguous target IDs bound by the deterministic
  engine. An omitted target with two possible emitters does **not** count as
  a reduction or authorized native measurement.

This fixed sample is small, synthetic, deliberately chosen, and authored by the
same agent as the reference. Scores are **development diagnostics**, not an
independent model's accuracy. There were no external-model API calls, Solutions
reads, original textbook answer grades, or automatic corrections. A true blind
evaluation needs a separate model, undisclosed cases, and an independently
reviewed ground truth.

## Replay

After `npm run setup && npm test` builds the unchanged pinned native core:

```sh
node evaluation/cross-family-prospective-v3/replay.mjs
```

The command creates fresh outputs under
`test-artifacts/llm-evaluation/cross-family-v3/` and
`test-artifacts/llm-authoring/cross-family-v3-...` (existing folders refuse
overwrites). It runs each first attempt once: read-only preflight CLI first,
then the **existing** unified command and native executor only if authorized.
It emits `review.json`, twelve per-case preflight/input records and twelve
portable original-result directories. Re-run using a new
`--out test-artifacts/llm-evaluation/<fresh>` suffix.

The existing Qualified authoring CI job runs this replay, shares the already
built native core and attaches evidence to its existing artifact.
No additional long-lived CI workflow, provider API, deployment or physics
schema is introduced. The original source ZIP archives and all previous
sealed studies remain unchanged.

The summary of actual first-attempt counts is recorded **after** the first
replay in `REVIEW.md`; consult that file rather than inferring performance
from this protocol.
