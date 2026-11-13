# Milestone 25 — generality stress test of existing LLM authoring

**Purpose:** Test whether Opticsim's *existing* LLM-authored scene contract can prepare, validate, execute and qualify substantially different optical component combinations without special-case programming for each question. This milestone adds **no new optical type, numerical ray logic, public deployment, provider, or answer-prediction algorithm**.

## Fixed synthetic input matrix

The committed `cases.json` contains **21 authored synthetic problems**, each with a complete request envelope, exact physical values or an intentional omission, interpretation text explicitly marked unverified, requested observable kinds, and a separately written software-expected outcome. 12 are fully supported native cases covering source-only, passive detectors, opaque line stops, circular stops, finite apertures, a lens inside an aperture gap, a circle inside the gap, combined line/circle stops, two sources with a lens and mirror, and other mixed optics. Centimetre scaling and rigid translation exercise physical invariants, not screenshot similarity.

The remaining 9 cases intentionally test unsupported or incomplete authoring: exceeding the combined two-stop bound; omitting a physical aperture opening; overlapping a lens with opaque arms; a tangent circular blocker; ambiguous target selection for either blockers or sources; an explicitly incompatible result target; an unsupported ideal-image inference in a stop-bearing scene; and an unknown quantity. A requested kind never authorizes removing inconvenient components or inventing a ray route.

## End-to-end checks and hard limits

`test/general-composition.test.mjs` runs the unchanged `planProblem → evaluateDocument → evaluateObservables` pipeline, verifies exact native completion and per-ID observations, refusals, conversions, transformed outcomes and copy-on-plan semantics. `scripts/general-composition-acceptance.mjs` invokes the existing `runProblemEvidence` on **every input byte-for-byte**, preserving SHA-256-bound originals, dispatch status, run evidence and the normal qualified packages (when creatable). It checks no retries, no repairs and no external LLM calls, and includes the evidence status for *all* 21 cases. Synthetic software validation never becomes an estimate of how accurately an external model interprets photographs or text.

One Node CI step in the existing unified-workflow check exercises the matrix; the evidence archive includes its per-case inputs, plans, native results, qualified scenes and summarized acceptance. Existing sealed original-exam first attempts and solutions remain untouched.

## What this does not establish

- A deterministic synthetic fixture is **not** a held-out independent LLM evaluation or an unseen exam answer.
- Passing rays / absorption counts are **not** continuous visibility, throughput, irradiance, or ray-source provenance.
- Authors must still supply physical apparatus properties and select relevant observables; no general inverse-solving or missing-physics recovery is implied.
- The sealed independent model-evaluation workflow remains a *separate* milestone requiring explicitly connected model inference.

**Decision criterion:** A passing 21-case matrix demonstrates software composability and honest rejection. It does not license new universal-physics claims. Prefer refining shared contract/observability defects exposed by this corpus before adding new optical components.
