# Paired focused vs full LLM context: first-attempt research protocol

**Status: SOFTWARE HARNESS ONLY — NO REAL MODEL PAIRS CAPTURED.** No independently curated unseen questions, authorized external inference, independent expert adjudications, or teacher/student participation have occurred in this PR. See the [precommitted comparative design](PROTOCOL.md), original [private revision evaluation protocol](../heldout-exploration-v1/README.md), and [independent curation issue #60](https://github.com/physicsvigilante/opticsim/issues/60).

This small extension reuses the **same** qualified scene/source, `explorationContext` for full JSON, `focusedExplorationContext` for focused JSON, existing private SHA-256/strict manifest validation, guarded OpenAI-compatible provider transport, canonical revision/native validators and `scoreExplorationRevision`/refusal scoring. It adds **no new inference provider**, new model service, optical DSL, physical law, source schema or conditional prediction.

## Exact paired comparison

Use only independently reviewed previously **unseen** tasks targeting existing-component `revise` or explicit `observe`, plus meaningful missing/ambiguous/unsupported/invalid negatives. **Structural changes are excluded**: focused context does not advertise adding/removing objects or schema upgrades. Run **an even number of cases** (2–12), including at least two already-supported optical families and negative tasks if the independent curator can supply them. Both arms see the same original task and exact hash-verified baseline. The only deliberately varied prompt payload is **full versus focused context**; the system instruction, model/provider, configured decoding, sampling assumptions and original question are identical.

For case indices 0,2,4,... capture **focused then full**; indices 1,3,5,... **full then focused**. Calls are separate stateless single-turn model requests. Preserve raw first text, hashes, model identity and provider-reported usage. **No retries, repairs or answers from another arm.** The original frozen reference is never imported by capture. Comparison scoring is **offline**, after verifying original responses and bytes.

### 1. Prepare independent private materials

A separate curator and **two actual independent physics reviewers** must privately create/adjudicate baseline-qualified `questions.json` and `reference.json` in the existing `evaluation/heldout-exploration-v1` manifest shapes. The source must be genuinely unseen to the tested model, with recorded exposure/provenance history. Do NOT count `scenes/single-lens-detector.json`, `scenes/plane-mirror-detector.json` or `scenes/polygon-dielectric.json` as hidden holdouts; these are already public fixtures used **only for software MOCK tests**. The original notes and model geometry are part of the information transferred to the external model; obtain rights/permission before provider requests.

Save all actual task/reference bytes, reviewers' separate original labels, consent/identity, provider details and future model responses under ignored **private `test-artifacts/`**, not in GitHub PRs, Actions or public attachments. Retain an independent timestamped commitment *outside* the inference session.

### 2. Offline precommit (never invokes model/provider)

```sh
node evaluation/focused-context-pair-v1/commit.mjs \
  --questions test-artifacts/private/exploration-questions.json \
  --reference test-artifacts/private/exploration-reference.json \
  --out test-artifacts/private/context-pair-commitment.json
```

This wraps the existing `makeExplorationCommitment` and rejects odd case lists, source-missing baselines, duplicate reviewer labels and **supported structural tasks** before any model inference. The JSON commitment freezes **exact** question/reference SHA-256 and case IDs. SHA alone is not proof of genuine independent reviewers, expertise, exposure novelty or temporal priority.

### 3. Explicitly approved provider capture, private only

The following is a **template, not permission to send any data**. The user must separately approve the **specific provider and model**, the full task and baseline/source-note transfer, **two paid or limited API calls per question**, and charges. Do not paste API keys into chat or commit them. A ChatGPT subscription is not an API key.

```sh
export OPTICSIM_MODEL_API_KEY='<private configured credential>'
export OPTICSIM_MODEL_ID='<specific authorized provider model>'
export OPTICSIM_MODEL_API_URL='https://api.openai.com/v1/chat/completions'
export OPTICSIM_MODEL_ALLOWED_ORIGIN='https://api.openai.com'
export OPTICSIM_EXTERNAL_DATA_APPROVED=yes
export OPTICSIM_PAIRED_PROVIDER_AND_CHARGES_APPROVED=yes
export OPTICSIM_MAX_HELDOUT_CASES=2

node evaluation/focused-context-pair-v1/capture.mjs \
  --questions test-artifacts/private/exploration-questions.json \
  --commitment test-artifacts/private/context-pair-commitment.json \
  --out test-artifacts/llm-evaluation/private-heldout/context-pair-attempt-01
```

The sample endpoint is **not a provider recommendation**. The endpoint, model and allowed origin must reflect actual explicit authorization. This single manual command deliberately makes **two independent calls per selected case** (not one), with no attempt to hide token costs. It refuses without BOTH transfer and provider/charge approval flags, model credentials, a valid SHA commitment and fresh ignored output location.

Each `caseId.focused.first.json` / `caseId.full.first.json` and `capture.json` is original raw evidence. Interrupted model calls leave already sealed responses unchanged and **no automatic retry/resume**. Do not overwrite a past experiment to recover incomplete calls.

### 4. Review AFTER first-attempt preservation (no provider calls)

After saving a separate read-only copy of the first-attempt data, set up and run the existing pinned simulator:

```sh
npm run setup
npm test
node evaluation/focused-context-pair-v1/review.mjs \
  --questions test-artifacts/private/exploration-questions.json \
  --reference test-artifacts/private/exploration-reference.json \
  --commitment test-artifacts/private/context-pair-commitment.json \
  --capture test-artifacts/llm-evaluation/private-heldout/context-pair-attempt-01/capture.json \
  --out test-artifacts/llm-evaluation/private-heldout/context-pair-review-01
```

The reviewer verifies the exact per-arm prompt bytes/SHA, unchanged raw output, frozen order and same provider model identity **before loading the original reference**. It then invokes the existing strict `applyExplorationProposal` and `scoreExplorationRevision` / `scoreExplorationDecline` with real native results, separating **exact requested physical edits**, target/method fidelity, native completion, engine rejection, unavailable readouts and **provisional** negative declines pending actual explanation review.

Results show **separate full/focused denominators**, matched task-by-task outcomes, original input JSON byte counts, and actual provider token usage **if supplied**. No pooled “model accuracy,” unqualified optical correctness, causal effect, statistical significance, or educational usefulness is automatically inferred. If the references/first attempts are not independently verified, results stay provisional.

## Current software-only verification

`test/focused-context-pair.test.mjs` exercises **MOCK responses ONLY** on two already-exposed synthetic cases, offline precommit, balanced order, exact same baseline, source notes never converted to instructions, consent refusal, 4 first attempts, invalid JSON retention, tamper detection before reference loading, source/physical fidelity and **actual pinned-native** review, separate negative refusal and native-completion counts. CI makes **ZERO model/provider API calls** and may publish only mock/software test status, not private questions, reference data, original model replies or secrets.

### Hard boundaries

No change to production `src/`, native PhyDemo, scene schema, native random seed, numerical correction/tolerance, Stage-1 accepted optics, mandatory Stage-2 withholding, model credential handling, teaching outcome or full-scene authoring benchmark. Actual comparative LLM fidelity **NOT RUN** until independent curation and explicitly authorized separate model inference are available.
