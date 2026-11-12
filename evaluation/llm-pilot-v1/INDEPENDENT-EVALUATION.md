# Independent-model evaluation — controlled first-attempt protocol

This is a **separate model-runner**, not a claim that an independent model has already been tested.
It uses the existing ten authoring prompts and nine JEE *Problems* images,
with first-attempt responses preserved verbatim.

## Privacy, cost and scope

The runner makes **no network requests during ordinary CI**, pull requests,
setup or demo packaging. A separate manual-only GitHub Actions workflow runs
**only on main** after the runner is approved and merged, and only when
`external_transfer_approved=approved` is explicitly selected. The workflow
reads the repository secret `OPTICSIM_MODEL_API_KEY`; the API key is never
printed or included in saved evidence. The requested model must support
OpenAI-compatible chat completions, JSON-object outputs and PNG vision.

The default service is `https://api.openai.com/v1/chat/completions`. An
alternative compatible service must be explicitly configured using
repository variables `OPTICSIM_MODEL_API_URL` and
`OPTICSIM_MODEL_ALLOWED_ORIGIN` (exact HTTPS origin; redirects disabled).
Using ChatGPT does **not** provide an API key automatically; model inference
may incur separate provider charges. Do not submit confidential questions
or images unless transfer to the selected provider is authorised.

GitHub Models is **not** a fallback: that service was retired July 30, 2026.

## Protocol and separation

1. `run-independent.mjs` reads **only** the ten case prompts, the nine
   `corpus-prompts.json` entries, the live opticsim capability contract and
   the pinned original `01_problems.zip`. It does **not** read
   `authoring-reference.json`, `corpus-reference.json` or `Solutions` entries.
2. Each authoring prompt receives **one** JSON-only model call and returns
   an authoring request or an explicit inability to author. Each corpus case
   receives **one** original Problems PNG plus the capability contract
   and returns a scope label and reason. No retries or repairs.
3. It writes immutable `submission.json` and `first-attempt-trace.json`
   with raw model text, input/output SHA-256, image SHA-256, actual model
   identifier and token usage. Bad JSON remains a failed first attempt.
4. **Only after model responses are saved**, the separate existing
   `score.mjs` reads reference fixtures, invokes pinned PhyDemo and writes
   `score.json`. A physically wrong native-completed scene fails the
   separate physical-fidelity test. Explanations still need human review.

The manual workflow defaults to **one authoring and one image case**
to limit model usage, with choices up to 10 and 9. No full-corpus run
occurs automatically. No independent-model score exists until real inference.

### Local execution

After `npm run setup` and `npm test`, set `OPTICSIM_MODEL_API_KEY`,
`OPTICSIM_MODEL_ID`, `OPTICSIM_MODEL_API_URL`,
`OPTICSIM_MODEL_ALLOWED_ORIGIN`, `OPTICSIM_MAX_AUTHORING`,
`OPTICSIM_MAX_CORPUS`, and `OPTICSIM_EXTERNAL_DATA_APPROVED=yes`.
Place the original `01_problems.zip` in the repo root, or point
`OPTICSIM_CORPUS_ZIP` to its absolute path, then run:

```powershell
node evaluation/llm-pilot-v1/run-independent.mjs
node evaluation/llm-pilot-v1/score.mjs test-artifacts/llm-evaluation/independent/submission.json --report test-artifacts/llm-evaluation/independent/score.json
```

Output stays inside ignored `test-artifacts/llm-evaluation/independent/`.
Existing evidence files are never overwritten.

### GitHub Actions

**Only after a separately approved merge to main**, add the private
repository secret `OPTICSIM_MODEL_API_KEY` in Settings → Secrets and variables
→ Actions. Set both repository variables above if using a nondefault
compatible provider. Open **Actions → Independent opticsim model evaluation
(manual opt-in) → Run workflow** on main. Choose the model and case limits,
and select `approved` to allow transferring question text and images
to that provider. The private Actions artifact `independent-model-evaluation`
will contain the first-attempt trace, submission and separate score.

PRs #7 and #10 remain unmerged until separate explicit merge approvals.
