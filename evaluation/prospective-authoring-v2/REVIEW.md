# Prospective original-question study v2 — completed development replay

**Frozen engine:** `954662c4e0a8c189492da91410a020e646ca2cd0`, the merged #30 native/analytical foundation.

**Selection frozen before any selected question image was viewed:** `4f14cd6a85eae29777fa22677a90f40638ef56fb`.

**First interpretations committed before deterministic execution:** `01c17d00346a66717f389a1c08565effdc0c5f56`.

**Recorded run:** [GitHub Actions 43389163822](https://github.com/physicsvigilante/opticsim/actions/runs/43389163822) — successful, no model API, no solution reads, no repairs.

SHA-256 of exact persisted files:
- selection.json: `a405aa2924a9c5a24c5652a180ce08f78a80bb33a94351043927b3519bdd13ab`
- first-attempt.json: `4cb95af1de38c1e60c3828dd3f917b9af65155e7297c25ed6c4d4a3aa4b68984`
- image-manifest.json: `5cc683db1bf2ca30c5e625a1ffd5cfd215844b14454961b247fc4e8b07282b85`

Hashes prove consistency of recorded bytes, not independent authorship, interpretation correctness, or proof of zero exposure outside tracked files. Source PNGs are from **Problems** entries only. No **Solutions** entries or reference answers were read.

## Actual first-attempt coverage

| Case | Original question's requested operation | Outcome at frozen engine |
|---|---|---|
| P01 | Net angular deviation after three plane-mirror reflections | unavailable; forward multi-bounce angular query is unregistered |
| P02 | Shape of image of a quadrilateral in a concave mirror | unavailable; extended-object imaging is unregistered |
| P03 | Symbolic identity for refraction through a glass sphere | unavailable; curved dielectric and proof operation absent |
| P04 | Maximum liquid depth hiding a point source behind an opaque disc under TIR | unavailable; inverse visibility/occlusion operation absent |
| P05 | Emergent-ray deviation through a 30-degree glass prism | unavailable; nonparallel prism model/query absent |
| P06 | Apparent observer-to-table distance through a spherical glass cap | unavailable; curved dielectric imaging absent |
| P07 | Lensmaker focal-length ratio and immersion-dependent lens behavior | both unavailable; material-index lensmaker operations absent |
| P08 | Microscope magnifying power with final image at infinity | unavailable; instrument observable absent |

**8 original questions, 9 requested quantities, 0 registered supported quantities, 0 native runs, 0 model API calls, 0 automatic repairs.** There were no substituted scenes or artificially completed textbook answers.

The dispatcher reported `UNSUPPORTED_QUANTITY` for all nine requests. This does **not** establish that the original questions are ill-posed or mathematically unsolvable. It establishes a boundary in the registered deterministic engine and authoring vocabulary. The first interpretations were authored by this same ChatGPT assistant, not an independent model; therefore **independent-model accuracy, question-interpretation fidelity and numerical-answer accuracy were not scored**.

## Scope caveats and review candidates

- P01's drawing contains a 30-degree mirror inclination and a 50-degree marked angle alongside a horizontal ray; a later reviewer must adjudicate the exact geometrical meaning. Do not silently edit the sealed first attempt.
- The visible schematic is not necessarily drawn to angular scale; requested net deviation is not the registered inverse mirror-incidence query.
- P08 may depend on a conventional microscope tube-length definition. Do not treat its absence as proof the textbook question has no answer.
- The seed-ranked one-per-section sample is not representative, and tracked-path exclusion cannot certify genuinely unseen images.

## Engineering direction revealed by the trial

The next capability should be *reusable*, not a case-specific answer rule. Two cases directly require **curved dielectric refraction** and prior development records found a related spherical-interface gap. **Nonparallel prism geometry** and **lensmaker material properties** recur across earlier and current cases. They are separable physical/model families and merit small, bounded proposals with native/analytical provenance.

Before implementing major optical physics changes, retain the existing positive **fully specified composition controls** to test what an LLM can author when there is enough apparatus information. Otherwise these eight difficult inverse/theoretical questions would give a misleadingly one-sided measurement of general scene-authoring ability.

Recommended next experiments:

1. Repeat a **different** multi-family development sample, but pre-register supported synthetic controls and original-problem interpretation as **separate scored tracks**; never substitute illustrative source/aperture values for an original question.
2. Independently evaluate the existing 10 synthetic authoring prompts with an external model using the **manual, opt-in, one-call runner** once a provider/API key is explicitly configured. No independent inference was performed in this trial.
3. Choose one high-value physical family (curved dielectric or nonparallel prism) for a separately approved, pinned-core integration; add only the specific validated optical component and measurable observables, and reuse playback/qualification/exports.

This PR changes **evaluation code/records only**, not the PhyDemo pin, scene schemas, deterministic calculations, native ray tracing, or public deployment. Temporary push-triggered selection/replay workflows used during evidence collection have been removed from the final candidate to avoid ongoing GitHub Actions duplication.
