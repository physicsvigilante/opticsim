# Shared GitHub review protocol — two independent ChatGPT conversations

## Roles and independence

**Chat A (implementer)** creates code and tests, describes scope, submits draft PRs and responds to findings. Its reviews are self-review, not external evidence.

**Chat B (reviewer)** starts in a new chat, gets only public GitHub files, exact SHA, source requirements and relevant CI evidence. It must inspect actual source/diff and run or independently derive checks where feasible. It should report defects, uncertainties and negative results. Do not prime it with Chat A's desired conclusion, Chat A's private reasoning, or a prewritten answer. A different ChatGPT conversation does not guarantee a different underlying model; disclose the reviewer model if known and call the assessment **separate-chat LLM review**.

**Owner** decides merge approval. Chat B never merges or changes production source as part of the first review. Chat A does not impersonate Chat B or generate a fake independent report.

## Per-feature lifecycle

1. **Freeze:** Choose packet ID, repository, exact base SHA and exact proposed head SHA, request scope, relevant original physical facts, supported/unsupported outcomes, and review focus.
2. **Publish:** Keep feature as draft PR. Record links to CI runs, artifacts, hashes. Chat A can update the packet with a new revision but must never silently overwrite earlier review snapshots.
3. **Review:** Chat B fetches the pinned commit and changed files, reads repository `AGENTS.md`, tests the requirements, and writes `collaboration/review-results/<packet-id>/review-<reviewer-or-run-id>.md` in a **separate branch** and PR. This preserves attribution and avoids committing a review to the feature branch it is examining. If it lacks write access, post the report as a regular PR review/comment and supply a link; do not claim the folder was updated.
4. **Respond:** Chat A reads the posted report, annotates every finding with reproduced / confirmed / disputed / deferred and evidence. For any code correction, publish a new source SHA and rerun CI and Chat B review; never copy old passing checks to the new SHA.
5. **Gate:** Reviewer outcome can be `pass`, `changes-requested` or `insufficient-evidence`. A passing LLM review is advisory; separate owner approval is mandatory for merge.
6. **Post-merge:** Verify the exact merged commit, post-merge CI and provenance. Preserve the original review, subsequent decisions and counterexamples.

## Reviewer evidence boundaries

Distinguish **source/interpretation fidelity**, **physical and numerical correctness**, **native simulation coverage and completeness**, **educational usefulness**, and **textbook-answer completeness when specifically relevant**. Never pool their denominators.

Check native PhyDemo pin and exactly-once observer delegation, validation and conservation laws, numerical guards, stale/partial run suppression, data lineage and source attribution, historical fixtures, API and browser UX, bounded event storage, negative cases, build/package scope, and compatibility of qualified exports. Source code inspection, mathematical derivation, actual traced observations, browser screenshots and classroom tests have different evidential strength.

Counterexamples must include inputs, expected vs actual behavior, path/line references where possible, and which evidence exists or is missing. Tests do not prove an untested claim; screenshots do not certify physical laws. Never silently update expected answers or source files.

## Concurrency and safety

All reports must identify `repository`, `baseSha`, `headSha`, `reviewerChat`, `modelIfKnown`, review start date, `examinedFiles`, CI artifacts and unresolved blockers. Report `stale-head` if PR head moved. The reviewer does not edit implementation code in the same PR it reviews.

Use this existing owner-controlled public GitHub repository. Content placement follows owner direction; do not add API keys, access tokens, environment secrets, or private credential files. No automated external LLM calls are needed. This folder does not automatically authorize production merges, public deployment, new physics or CI changes.
