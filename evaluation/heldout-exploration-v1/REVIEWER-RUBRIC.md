# Independent reviewer worksheet — held-out physical exploration

This worksheet governs a future **human** evaluation. It is not a completed review or a new model score. The precommitted reference must be prepared by two independent physics reviewers who have not seen a model's responses.

## Before first inference — curator and physics reviewers

For each private case, record in a separately protected adjudication record:

| Field | Reviewer requirement |
| --- | --- |
| Source and exposure | Provenance of original unfamiliar text/diagram, publication/creation, who may have seen it; no reused synthetic benchmark controls |
| Physical regime | Opticsim admitted family and unsupported interactions; model assumptions and limitations |
| Base model | Canonical physical facts and stable component IDs, origin hash, independent validation, all genuinely missing facts |
| Proposed experiment | Exactly what the teacher changes; classify **physical**, **structural**, **initial geometry**, **observation-only**, **numerical**, or **presentation** |
| Correct revised state | Complete expected physical state for supported unambiguous changes; retain unchanged fields and original source provenance. For structural additions, independently verify that **every new ID is explicitly named in the task** and record it in `sourceNamedNewComponentIds` (use `[]` for removal-only). Unnamed fresh IDs are outside this exact-label v1 rubric, not physically invalid |
| Observables | Kind, physical component target, expected status/method if applicable; no fabricated per-source detector attribution |
| Invalid or ambiguous case | Explicitly say what essential value, identity or supported operation is absent; do not fill it in for the model |
| Independent disagreement | Both experts' initial independent judgments and reconciled ruling, preserved before any first response is opened |

The trial's current typed revision actions are **`revise`**, **`structure`**, and **`observe`**. Physical motion/time evolution, numerical solver initial guesses, or presentation animation should not be silently represented by static optical edits. If a task needs a model change outside these admitted actions, adjudicate it as unsupported rather than selecting a convenient substitute.

## After capture — physical and numerical scoring

**Fairness gate:** This v1 exact-identity scoring admits new structural components only when their new IDs are explicitly supplied in the original task. A differently named but physically identical added component is not a valid basis for grading without a separate ID-isomorphism-aware rubric. Do not silently assign a reviewer-chosen new ID to an unnamed task or count it as a physical-fidelity failure.

Every model response receives its own raw immutable record. Report the following **separately**, at case level and with appropriate denominators.

| Dimension | Automated check | Independent review |
| --- | --- | --- |
| Source interpretation (Track A only) | Original-source physical facts, stable IDs and requested kinds versus the precommitted independent reference | Whether source wording and diagrams are interpreted faithfully |
| Revision action | `revise` / `structure` / `observe` equals adjudicated operation | Whether the task admits this operation |
| Exact physical outcome | Full canonical physical state matches adjudicated physical scene, preserving original model family | Whether equivalences are genuinely allowed; decide **before** grading |
| Minimality | No redundant existing-field assignments; no invented components or physically unnecessary changes | Whether each provided physical parameter is source-given or an explicit teacher hypothetical |
| Observation targeting | Exact physical measurement kind and component target; old targets remain old | Whether measurement is pedagogically pertinent |
| Native execution | New qualified scene, current hashes, native status, warnings, depth/truncation, valid zero | Whether numerical limitations undermine the intended inference |
| Safety and honest refusal | Unsupported proposals are rejected; unexecuted declines are **provisional** | Whether missing-information or unsupported explanations are accurate; *never* credit an engine rejection as a correct model refusal |
| Pedagogical usefulness | **Not graded by software** | Teacher can inspect assumptions, make a second meaningful change, distinguish native observations from analytical predictions, and explain sampling limitations |
| Textbook answer | **Optional / out of scope** | Record only when independently requested; do not penalize a useful correct simulation for not supplying an examination solution |

A physically wrong but natively runnable scene receives **physical-fidelity failure**, even if detector counts happen to match an answer. A valid physical change with incomplete native tracing may satisfy the *revision-fidelity* dimension but not *native-completeness*. Brightness clipping and ray density changes cannot be marketed as changes to physical irradiance. A conditional ideal image is never credited as a native detected image.

### Denominators and prohibited summary shortcuts

Report counts of all first attempts; supported versus negative cases; structured valid proposals; physically faithful revisions; correct observation targets; native attempted/completed; engine-rejected proposals; malformed JSON; provisional declines; and human-adjudicated refusals separately. Source-authoring and model-revision tracks have **different denominators**. Do not publish an 8/8, pooled percentage, overall "accuracy", or educational-success rate based solely on green CI or a same-assistant review.

## Independent teacher evaluation (additional phase)

Use scenario packages *only after* independent physics review. Give teachers a baseline and a change request without an answer key shown in the interface. Observe whether they can identify original facts, hypothetical changes, qualified native readings, unsupported quantities, and numerical/presentation-only edits. Record teacher expectations, actual observed tasks, errors, time and qualitative explanation quality with consent. If no teacher is involved, mark **teacher effectiveness not assessed**.

Reviewer identities, consent, exposure evidence, private question text, raw model responses and adjudicated reference files must never be committed to the public repository or uploaded as public GitHub Actions artifacts.
