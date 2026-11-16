# Explore one physical model with an LLM

Open the ordinary Opticsim viewer (`npm run setup`, `npm run build`, `npm start`). Load a supported example or your qualified package. Expand **Explore this model with an LLM** below the optical results. This is an interactive workflow, not an evaluation protocol. Independent curators, reviewers and provider credentials are not prerequisites for using it.

## The loop

1. Wait for native tracing to finish, then **Start new exploration**. The viewer keeps a snapshot of the original model and its actual native evidence. A raw scene retains **unknown source provenance**; it is not promoted to source-given physics. When no readouts are loaded, the viewer selects existing native counters by stable ID for comparison. These are passive observations, not dummy answer requests or changes to optics.
2. Describe the investigation in **Your investigation**. Download the model context and share it with the LLM you already use. The file contains the current model, its identities, notes and live supported contracts. **Nothing is uploaded or sent by Opticsim.** Inspect the context before sharing private source notes. The viewer does not contain an LLM, an API key field or a natural-language parser.
3. Paste the returned JSON proposal and choose **Preview proposed changes**. The preview names exact added/removed components or changed fields, in canonical scene units (lengths in mm, angles in degrees). It does not trace rays or change the apparatus. Check that the proposal actually matches your question; schema validation cannot certify that interpretation. Clarify missing facts with the LLM rather than filling them with guesses.
4. Choose **Apply changes and simulate**. Parameter edits reuse `reviseScene`; structural additions/removals reuse `prepareQualifiedStructure`, including retired-ID protection; new result requests reuse the existing observable contract. Each accepted physical arrangement is retraced by pinned native PhyDemo and the same renderer. An old context hash is rejected even if only source metadata/readouts changed. No arbitrary code, full-scene replacement, model-family migration or hidden geometry repair is accepted.
5. After completion, name and **Save completed scenario**. Use **Compare selected with baseline** to inspect the two saved runs, or **Load saved scenario and retrace** to return to the original or another branch. Changes made with the existing physical/sampling controls can also be saved; numerical settings remain separate from physical changes.

The scenario list is local to the tab and limited to twelve entries. **Starting again clears it. Download qualified scenarios before leaving.** Existing qualified export/reimport preserves source history and changed fields, but the tab's scenario labels and free-text intent are not added to the canonical scene schema. Comparison evidence is separately downloadable and explicitly describes saved—not current—runs.

## LLM response format

The context supplies the exact `expectedIntegritySha256`; copy it unchanged. A response is a small orchestration envelope over existing authoring contracts, not a new physical scene language:

```json
{
  "format": "opticsim-exploration-proposal-v1",
  "expectedIntegritySha256": "<the exact hash in the exported context>",
  "intent": "Investigate a 150 mm lens focal length while preserving other values.",
  "action": "revise",
  "patch": {
    "changes": [
      {"id": "lens-1", "section": "parameters", "key": "focalLength", "value": 150, "unit": "mm"}
    ]
  }
}
```

Use `action: "structure"` with the existing `opticsim-component-revision-v1` patch for explicit add/remove operations. Use `action: "observe"` with `additionalObservables` and **no patch** for passive readouts. Observations may also accompany a physical change. Old requests are always retained; removing their target makes them unavailable, never silently retargeted. IDs and active physical inputs must be explicit. A question with ambiguous target or missing value should receive an explanation/clarification, not an invented JSON proposal.

## What comparisons establish

Both saved scenes must have complete, current native execution and consistent qualified result evidence. The viewer checks identities, quantities, units, physical regime, source lineage, assumptions, numerical settings and clipping/warnings through the same guard used in the reusable-model checks. It computes a scalar delta only for eligible matching values. Zero and negative signed relative-power readings remain valid observations.

Changing ray density, source emission/brightness, clipping or a model approximation may withhold an automatic delta. The individual readings remain inspectable. A new detector has no baseline counterpart unless one was actually recorded. Conditional ideal images remain analytical results, not image detections. Sample counts and native relative power are not continuous transmission or watts. These are static scenario comparisons, not simulated time evolution or sensitivity derivatives.

A valid source-only scene can be saved even when no detector was requested. An unavailable optional result does not invalidate otherwise completed tracing. Incomplete/stopped/invalid native states cannot be saved as completed scenario evidence. Changing the scene or proposal while an asynchronous preview/export runs invalidates that operation.

## Scope and testing

This milestone adds the missing viewer handoff and saved-scenario workflow, not new optics, a solver, an embedded chatbot or a provider integration. Source fidelity, physical correctness, numerical qualification and educational usefulness stay separate. Tests cover real pinned native execution; browser tasks cover lens, multiple-source and circular-dielectric examples, preview/apply separation, invalid/stale proposals, restored baselines, qualified export and sampling-aware comparison. These are engineering/development checks—not independent LLM accuracy or teacher/student learning outcomes.

Formal held-out evaluation remains available for later. Issue #60 is deferred and does not block practical Opticsim development.
