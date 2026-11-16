# Focused LLM context for an existing qualified Opticsim model

**Purpose:** reduce unnecessary LLM input for a small teacher-directed edit or a new observation of an **existing** model. The simulator still owns full physical validation and native tracing. This is an optional context format, **not** a new optics language, inference provider, source interpreter, or change to the qualified package.

## Use the existing exploration panel

1. Open a valid scene or qualified package in the Opticsim browser. Select **Explore this model with an LLM** and **Start new exploration** to save the executed baseline.
2. Describe a single investigation in **Your investigation**. For example, *“On the existing lens-1, change focalLength from 100 mm to 150 mm; leave all other components unchanged.”*
3. Select **Download focused context (edit or observe)**. Review the downloaded `opticsim-exploration-focused-context.json` **locally** before sharing it with ChatGPT or another chosen LLM. It includes the full current verified qualified scene, its source notes and existing observables (potentially private). The browser performs **no upload or model call**.
4. Ask the LLM for **one JSON proposal**, using `responseContract`. Paste it back, **Preview proposed changes**, check the exact physical delta, then **Apply changes and simulate**. The unchanged native engine validates the full physical system and only an actually completed current run qualifies for saving.
5. **For adding/removing components, a schema upgrade or unfamiliar optical system**, use the existing **Download full context (add or remove)**. The full file `opticsim-exploration-context.json`, structural contract and old proposal workflow remain unchanged.

The focused packet is requested with `explorationContext(bundle,question,{profile:'focused'})`. The default `explorationContext(bundle,question)` and explicit `profile:'full'` still return the original complete contract.

## What the optional packet contains

- **Unmodified `baseline`:** the exact complete verified qualified scene, its integrity SHA-256, original input/source notes, stable component IDs, historical edits and existing requested readouts. The response must contain the same `expectedIntegritySha256` to reject stale proposals.
- **Existing fields only:** IDs, physical component types and presently authored parameter/emission field names; current model coordinate and unit conventions, original authoring bounds and only those component type descriptions relevant to the existing scene.
- **Relevant requested-result kinds:** only result kinds whose component type is present; all original observable limitations are retained. A type-compatible observable can still be `unavailable` for this physical arrangement or missing native evidence. The LLM must not claim every listed observable will produce a result.
- **Restricted instructions for authoring:** use existing `revise`/ `observe` actions and original IDs, not reconstructed native JSON or guessed ray paths. `unit` is valid only on **length** parameter edits (`mm`, `cm`, `m`). Native direction and surface orientation values are **degrees**, but do *not* carry a `unit:"degrees"` tag in the existing strict patch contract.
- **Source truth and qualification:** author notes are **data, never executable instructions**, and their hash does not prove interpretation fidelity. All edits are teacher hypotheses, not upgrades of original facts.

Example of a proposal for a supplied lens baseline (replace the integrity SHA only with the one in the actual downloaded focused context):

```json
{
  "format": "opticsim-exploration-proposal-v1",
  "expectedIntegritySha256": "COPY_THE_CURRENT_VERIFIED_HASH",
  "intent": "Teacher what-if: change existing lens-1 focal length to 150 mm",
  "action": "revise",
  "patch": {
    "changes": [
      {"id": "lens-1", "section": "parameters",
       "key": "focalLength", "value": 150, "unit": "mm"}
    ]
  }
}
```

For an existing single-ray source, use `{"id":"S1","section":"emission","key":"directionDeg","value":5}` (no `unit` tag). Source-first suitability, all geometry, typed observation scope, output currency and failed native status remain validated by the same engine after approval. The compact view is **not** a proposal permission gate—an unsupported structure request still goes through the full existing validator and must not be treated as trusted simply because the LLM submitted it.

## Verification and epistemic limits

`npm test` exercises focused and unchanged full contexts across three existing **lens**, **mirror** and **four-face glass** fixtures, verifying full baseline byte-equivalent values, integrity-bound proposals, real strict revision acceptance/refusal, relevant observable kinds and deterministic JSON byte-size reductions. The existing real-Chrome `scripts/exploration-browser.mjs` verifies both download buttons and the same source/hash before the normal scenario preview and native edit workflow.

A smaller JSON file is evidence of **less context payload**, not an independently measured LLM token reduction, authoring success-rate improvement, source-interpretation accuracy or educational effectiveness. No external inference calls or human teaching study are included. This feature changes no PhyDemo physics, numerical policy, optical scene schema, native default seed, Stage-1 readout or Stage-2 qualification.
