# Replay a portable Opticsim investigation notebook through native physics

This is a local-only, source-preserving **notebook re-evaluation tool**. A notebook imported from another browser contains verified qualified *inputs*, **not trustworthy previous optical results**. This command verifies the entire input notebook, then retraces each scene through the same pinned native PhyDemo engine used by Opticsim. It records each actual native status and reuses the existing qualified-scenario comparison guard. It is **not** a new ray solver, LLM interpreter, automated lesson scorer, native RNG policy, or educational-effectiveness measurement.

## Running a replay

First create an input-only portable notebook in the normal browser: **Explore this model with an LLM → Download notebook (all saved scenes)**. From the repository root, after the regular pinned native setup:

```sh
npm run setup
node scripts/replay-exploration-notebook.mjs \
  /path/to/opticsim-exploration-notebook.json \
  --out test-artifacts/llm-authoring/notebook-replay-01
```

The `--out` directory **must be fresh and under this repository's ignored `test-artifacts/llm-authoring/`**. Reusing a directory or a symlink through it is refused. The original notebook is read-only and copied **byte for byte** to `input.json`. The tool builds the existing pinned `dist/test-core.cjs` once, runs one native simulation per notebook entry, and outputs:

- `input.json`: original notebook bytes unchanged, including original bundle/source hashes, author-declared assumptions, labels and requested observations.
- `trial-01.json`, `trial-02.json`, etc.: individually recorded native result or explicit native failure (including warnings/error codes), output SHA/scene/bundle identity and only actually current qualified requested results. A thrown infrastructure error is **not** counted as a native-reported failure and stops further replay; earlier trial files remain intact.
- `comparison-02.json`, etc.: existing comparison of the **freshly executed** baseline and each replayed scenario. No numeric delta is asserted for missing/incompatible/incomplete/warning-qualified observations; native hit event lists are not a source-attributed ray history.
- `report.json`: original input SHA, overall status, all per-entry states, comparison eligibility and explicit counts. A failed or partial native run produces a **nonzero CLI exit code**, even though its negative evidence remains saved.

**All entries are hash-/schema-checked before the first native execution.** Invalid or tampered nested qualified bundles, changed origin, unexpected cached results, or forged outer notebook hashes never trigger native runs. A valid checksum is *not* source truth, provenance authentication or a promise that a particular optical answer is correct.

## What is and is not comparable

The existing `compareExplorationSnapshots` guard decides whether a new result can be compared with the replayed baseline. It checks both actual native executions, canonical scene hashes, method/target/unit identity, original source/assumption scope, numerical sampling, warnings and native clipping. Only comparable native samples or conditional analytical quantities may generate a supported difference; signed power is relative, not watts, and finite-ray counts are not continuous illumination.

A complete native run can still have an optional **numerical advisory**, which remains noncertifying. A result is never upgraded to an independent physical proof just because its simulator run completed. If the baseline or a variant has native failure, its comparison is explicitly withheld and no stale value is copied from the notebook. If replay throws infrastructure errors, further runs are halted and recorded evidence is kept.

The local command uses the **already exported observations**; it never adds detectors, changes ray sampling, guesses missing indices, alters source positions, retunes near-critical angles or calls an LLM. An old notebook created against a schema the current Opticsim cannot verify fails before native simulation.

## Software verification and limits

The dedicated `test/exploration-notebook-replay.test.mjs` uses actual pinned native executions of exposed lens, mirror and glass source/what-if fixtures. It also injects native failure and infrastructure/stale/hash faults to prove they stay unqualified. This is developmental software evidence, **not** independent LLM source interpretation, a statistical accuracy benchmark, real teaching assessment, or a solution to an original optical textbook problem.

This milestone makes saved investigations reproducible across sessions using the engine, **without touching the existing notebook file format or browser UI**. There is no cloud upload, alternate ray engine, PhyDemo patch, numerical tolerance, native randomSeed default, Stage-1 canonical measurement change, or mandatory Stage-2 withholding.
