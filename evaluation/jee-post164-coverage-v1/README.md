# Post-PR164 JEE problem-coverage trial — development audit

Baseline: production merge commit **8b4ffee3c9deb34fcf7d657221f917fab321de4c**, Git tree **f371366765c8aa96029a0b29d6ae3f770e9b0eb2**. PR #164 is merged. This branch does not modify the native engine, adapters, schemas, numerical policies, existing evaluation records or prior independent reports.

## Purpose

Use 20 fixed source problems to decide which missing capabilities matter next for the JEE-first engine, rather than merging more experimental optics on speculation. This is **same-assistant developmental coverage work**, not an independent LLM benchmark, a random sample, a blind/unseen exam trial, or a solved-problem success percentage. Some selected questions overlap the earlier Optical Systems Atlas; that exposure is disclosed rather than concealed.

## Frozen sample and source handling

`policy.json` commits the sample before this trial's image inspection: first/middle/last questions for plane mirrors, curved mirrors, general refraction, TIR and lens formula; first/last for prisms and curved refraction; first for instruments. Total 20 across eight source chapters. Selection must not change in response to failures. The exact original archive SHA-256 is pinned; only `/Problems/` images may be decompressed. Do **not** open `/Solutions/` entries. The archive's full-byte hash can be checked without interpreting any solution contents.

`test/jee-post164-coverage-sources.test.mjs` checks policy integrity and extracts the selected original PNGs into ignored `test-artifacts/llm-authoring/jee-post164-coverage-v1/`. The existing optical CI evidence artifact carries these images and their exact image hashes for direct visual inspection. This source-material test performs **zero native simulations and zero model calls**; its passing status is not evidence of interpretation correctness or a solved JEE question. Original problem PNGs are not added to Git source.

## Evaluation sequence

1. Inspect each exact problem image, not only the old catalogue. Record stated facts, figure labels, requested physical investigation, essential unknowns, assumptions and unsupported aspects. Do not silently infer physical lengths, indices, brightness, detector placement or source emission from arbitrary drawing scale.
2. Freeze the author's initial disposition/JSON before executing it. Missing essential inputs remain missing. A later fully specified teaching illustration is a separate request with explicit additional assumptions, never relabelled as the original question.
3. Execute admitted native scenes on the pinned merged engine and preserve their input bytes, canonical hashes, measured events, warnings and completion/refusal statuses. Analytical-only queries remain `native:not-run`; real detector positions are not apparent image positions. Native partial/stale/contradictory output must be withheld. Unsupported originals stay in the denominator.
4. Report five distinct axes: **interpretation fidelity**, **physical correctness**, **simulation coverage**, **educational usefulness**, and **optional textbook-answer completeness**. The teaching objective does not require reproducing all textbook answers; an explicitly requested unverified quantity must still not be called answered. Author judgments are not independent human or model validation.
5. Rank engine gaps by evidence from the fixed cases. Only after a demonstrated reusable need propose the next native composition/analytical query milestone. Independent review is reserved for material changes to physics/evidence semantics and final integration; this source collection is not another optics review checkpoint.

## Status at creation

Sample frozen; original-image extraction and direct source inspection pending. No final per-case score, real-problem authoring success, new native execution or independent benchmark is claimed. The existing engine is unchanged.
