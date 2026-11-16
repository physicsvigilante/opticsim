# Portable Opticsim exploration notebook v1 — design and evidence boundaries

## Goal

A teacher can save **all of the qualified scene variants from one exploration** in one local file, and reopen any variant later without losing source notes or copying a dozen separate files. The browser still uses **the original pinned PhyDemo engine** to retrace each imported scene before presenting current native readings. No LLM, cloud service or new optical model.

This is a portable **investigation manifest** (qualified physical input packages and author-supplied labels), **not** an archive of native outcomes. Importing a file is *never* evidence of successful execution or physical correctness. The existing `src/exploration.js`, strict proposal validator, native ray engine, canonical scene schemas and qualified bundle format remain unchanged.

## New separate format

```json
{
  "format": "opticsim-exploration-notebook-v1",
  "baselineIntegritySha256": "<hash from first qualified bundle>",
  "entries": [
    {"label": "Baseline", "intent": null, "parentIntegritySha256": null,
     "bundle": {"format": "opticsim-qualified-scene-v1", "...": "verified existing bundle"}},
    {"label": "Longer focal length", "intent": "Author-proposed hypothetical",
     "parentIntegritySha256": "<prior qualified bundle hash or null>",
     "bundle": {"format": "opticsim-qualified-scene-v1", "...": "verified existing bundle"}}
  ],
  "integritySha256": "<canonical hash of fields above>"
}
```

The literal `"..."` illustration is not a valid bundle. Valid notebook fields are exact and strict; no executable code, URLs or native JSON. **All saved entries retain the original verified qualified package unchanged** including source history, scene hash, originally requested observations and edits.

- 1–12 entries, first label `Baseline` and empty first intent/parent; bounded nonempty labels up to 80 characters and authored optional intent up to 1200 characters; same declared `qualification.origin` across entries. Different physical model versions can coexist only if the original qualification origin is unchanged and each individually passes the existing validator.
- Require complete existing `verifyQualifiedBundle` on **every** entry. Require exact fields, correct baseline hash and an additional canonical notebook checksum, at most **4 MiB** serialized. The additional hash detects accidental alteration, not authenticity or correct source interpretation.
- Do **not** add `execution`, `results`, native run-status, derived image values, detector counts, cached observations, comparisons or falsely verified lesson/teacher outcomes to this format. Existing comparison exports remain historical evidence as separate files.
- Export may only take the existing tab's already **saved completed scenarios**. No attempt to turn an incomplete or failed native run into a completed saved scenario. Historical source notes remain author-declared and do not become independently certified.
- Import is non-destructive. Its entries are listed separately as **imported, not retraced**; the existing current tab and saved scenario list stay unchanged. The user explicitly selects and loads a qualified imported variant, which calls the existing `applyBundle` and triggers a **fresh native execution**. No stale detector readings are reused. To reconstruct a comparable session, load the imported baseline, start a new exploration after native completion, and then retrace/save each variant.
- Source provenance remains the original bundled declarations, which a notebook hash does **not** authenticate. The imported label/intent is *teacher-authored text*, not a source-given physical fact. No network or LLM call; the import must respect file-size limits and reject wrong format, tampering and cross-origin mixing atomically.
- Browser and Node APIs do not change the schema or the previous full/focused LLM context downloads. Adding notebook operations is a separate software capability, not a new physics or educational-effectiveness score.

## Verification

New pure Node/browser-compatible notebook module tested with existing known **lens**, **mirror** and **finite glass** qualified scenes, multiple saved variants and source provenance. Tests include strict field/size bounds, one tampered child bundle, one overwritten origin, wrong notebook hash, malformed labels, too many entries, executable-looking strings kept literal and refusal to accept cached native/results keys. Existing project frozen detector-transfer evidence must retain its original SHA; any newly modified previously pinned UI source path is recorded in a **new append-only post-exposure SHA addendum**, not by rewriting old frozen files.

Actual Chrome test uses the existing exploration panel to save baseline + a real teacher hypothetical, downloads the one-file notebook, imports it, verifies the original current saved state was not replaced, retraces an imported variant through the normal native simulation, reopens the baseline and checks unchanged provenance. Real screenshots do not establish teacher/student usefulness.

## Retrace the notebook as a local native experiment

To reconstruct **new** per-scenario evidence for every saved notebook entry without clicking through each in the browser, use the separate [local replay command](REPLAY-EXPLORATION-NOTEBOOK.md). It verifies the original whole-file and per-scene hashes before any native run, preserves source inputs byte-for-byte, records each genuinely completed/failed new native execution and only compares results allowed by the existing evidence guards. Old native results are never trusted or silently restored. This does not change the notebook v1 format.

## Hard boundaries

No pinned PhyDemo patch, new ray tracer, model-family inference, source answer key, numerical error tolerance, native RNG default, Stage-1/Stage-2 measurement withholding, textbook-answer completeness target, auto-qualified saved outputs, or automatic GitHub Pages publishing. No independent LLM or human classroom participation claimed.

Track as an R1 software/provenance change. All eleven standard workflows, a native/browser round trip and no original sealed evidence changes must pass before merge. If a qualification or native execution fails, retain the failure rather than silently promoting imported data.
