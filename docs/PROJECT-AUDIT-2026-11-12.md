# Opticsim audit and recommended direction — 2026-11-12

## Assessment

Keep the architecture: one semantic component contract, deterministic
preparation, a pinned unmodified PhyDemo engine, and independent checks of
native behavior. Do not replace it with an LLM-written ray tracer, a template
per textbook question, or another large apparatus language.

The important gap is not just component coverage. The current workflow can
prepare and execute requests, but that does not demonstrate faithful
interpretation of an unfamiliar question or availability of its requested
answer. Milestone 7 should be described as problem-request preparation,
not a completed automatic question-image-to-simulation system.

The baseline audited was main commit
`d8ea048bf4cb6386431645be30ec044ad3c213b7`. Its post-merge CI passed in
[run 43172898756](https://github.com/physicsvigilante/opticsim/actions/runs/43172898756).

## Reproduced and corrected

1. **Stale evidence:** reusing a CLI output directory could leave an old
   scene next to a new rejection report. Attempts now require fresh
   directories; existing output is not deleted or overwritten. Original
   input bytes and hashes accompany the output. Existing symlink ancestors
   are refused. This is local CLI hardening, not a hostile-process sandbox.
2. **Wrong diagnostic category:** malformed objects and invalid numerical
   values were reported as missing information. `invalid-input` is now a
   separate preparation status. Unsupported capability and absent physical
   data remain separate.
3. **First-error masking:** an early missing source field could conceal an
   unsupported component or other missing values later in the request.
   The shared strict authoring layer now collects independent field issues
   from the live parameter contract before canonical geometry validation.
4. **Ambiguous assumption provenance:** proposed defaults and values used
   in a scene shared the same list. Reports now distinguish `proposedChoices`
   from `appliedChoices`, record policy version and final component IDs,
   and report no applied choices for blocked requests.
5. **Lossy model contract:** model prompts omitted available observations
   when copying a subset of capabilities. They now receive the complete
   live strict capability contract, with a regression test against drift.
6. **Coverage gap:** preparation tests did not exercise the successful
   illustrative CLI path. Acceptance now executes it through native PhyDemo,
   checks preserved input/report/scene evidence, and rejects a second
   attempt aimed at the same output directory.

The tests-only commit `6a4cbf8dd7c0bfd7467cb494b5e4c9b77f252bf2` reproduced
all eight new audit expectations as failures, with all 102 pre-existing
checks passing. See [baseline regression run](https://github.com/physicsvigilante/opticsim/actions/runs/43173929200).
This distinguishes demonstrated gaps from speculative improvements.
Final candidate CI evidence is recorded on the audit pull request.

## Correct the terminology and guarantees

Aperture, emission and relative source strength are **physical assumptions**,
not harmless display details. They can alter clipping and detector readings.
Sampling density is a numerical setting; camera/grid are presentation.
The fixed 100 mm aperture is not universally appropriate and must never be
presented as an inferred or automatically adequate physical aperture.

`fully-specified` describes completeness of the submitted request. It does
not mean that it matches a source question or answers it exactly.
`questionSupport`, interpretation and physical fidelity are explicitly not
assessed by the deterministic engine. Analytical predictions, native
observations and reference-answer agreement are different kinds of evidence.

Scene JSON stores the selected numerical values, not their source history.
Keep its sidecar report and original input. Browser-side qualification and
provenance-preserving revisions are **not yet implemented**. A scene opened
or revised on its own must not acquire a new claim that all values were
stated in the original question.

## Recommended sequence

### 1. Integrate reliability corrections after review

Review this patch and its regression evidence. Keep main changes subject to
explicit merge approval. Preserve historical validation records rather than
editing old results into newly claimed success. No new provider, public
website, archive transmission or upstream physics is needed.

### 2. Finish one complete, observable authoring workflow

Use five held-aside cases, selected and recorded before interpretation:
complete supported apparatus, supported apparatus requiring declared
illustration, missing essential information, unsupported physics, and a
multi-component arrangement. This is a development experiment, not a
statistically reliable accuracy estimate.

For every case retain: the source question and its identifier/hash; requested
quantity; first interpretation and which facts were stated/derived/assumed;
unknowns; unedited request; chosen illustration policy; native outputs and
warnings; separate physical-fidelity review; and later revisions separately.
A legitimate refusal is a valid outcome. Native completion by itself is not.
Do not tune physical values merely until the picture looks right.

A separate model API is optional for this development work. A fresh isolated
model context with withheld references can be used for a later controlled
benchmark; this project conversation is not such a context. In either case,
manual review of question interpretation is separate from mechanical JSON
validation. The existing external runner should remain opt-in.

### 3. Make requested observables and applicability explicit

Keep the same scene contract. Add a small companion request for what the
user wants measured or inferred, rather than a second apparatus language.
Examples include native detector crossings, reflection direction, and a
conditional ideal image coordinate. Return whether each quantity is available,
its method and assumptions, and its limitations.

Reuse existing analysis for arrangements that meet its actual preconditions.
A general scene must not silently inherit a restricted lens-train formula;
finite misses and return routes still belong to native tracing. Do not present
an analytic coordinate as a point independently detected in a sampled image.
Never use an unsupported measurement as an excuse to fabricate a scene.

Add browser-visible assumption summaries and hash-bound sidecars so the same
qualification follows a scene through preview, opening, revision and export.
This closes a user-facing trust gap, not a new optical-physics requirement.

### 4. Expand one reusable native capability at a time

Use the trial's failure ledger to distinguish interpretation mistakes,
interface friction, missing geometry, missing native physics and missing
observations. Only the latter categories justify engine expansion.
A parallel-beam source is a plausible first candidate if held-aside problems
repeatedly require collimated illumination; verify the pinned implementation
and add native/contract/round-trip tests before exposing it. Do not fake exact
parallel input with an arbitrarily distant point source. Lens offsets or
refracting surfaces should follow demonstrated demand, not a promise to solve
all of JEE in one milestone.

## Evaluation cautions still open

The image benchmark currently measures scope classification, not end-to-end
image-to-scene authoring. Synthetic fidelity checks compare against curated
component references, not every physically equivalent representation.
Preliminary scope labels and explanation text need separate adjudication.
Five examples cannot establish general LLM reliability. Preserve untouched
first attempts and report retries separately.

Before paid API benchmarking, audit transport failures, truncated completions,
partial-run denominators and evidence completeness as their own outcomes.
Mock-provider CI does not establish real provider compatibility or model
accuracy. No independent API invocation or new JEE-image evaluation is claimed
by this corrective patch.

## Guiding principle

The LLM interprets intent and evidence, selects supported physical components,
and identifies unresolved choices. Deterministic code validates, converts
units, prepares stable data, executes native physics, and reports qualified
results. Reduce unnecessary authoring effort without hiding physical decisions.
