# Bounded native detector ray parentage (v1, opt-in)

## What it means

`detector-ray-provenance` records a **real native detector crossing** and identifies its **actual observed JavaScript ray object**, its authored source of emission and any directly observed **native `onRayIncident.newRays` parent**. The pinned PhyDemo engine owns ray propagation, reflection, refraction, detected crossings and physical interaction decisions. No ray route is solved, prescribed, drawn or reconstructed.

This new observable is **not** a full ray-history API, the detector's native power (which is still signed relative units), continuous illumination, geometric image detection, a textbook solution, material-index inference or independent source-image interpretation. A parent edge exists **only** when the native callback returned a distinct real child object. In-place transmission/reflection/TIR gives no additional edge and does **not** mean no physical interaction occurred.

Each `token` is a temporary identity assigned to that actual native object **within a single native execution**. `rayIndex` is deliberately not used as a source ID. Two detector requests in the *same* execution share a token namespace; two separate executions—including A → B → A returning to an identical canonical SHA—**do not share token identities**, even if the displayed strings happen to repeat.

## Physical scope and request

The first release is intentionally strict: **only existing schema-v5 `planar-media-tracing`**, exactly one infinite native planar interface, one or two authored sources with **explicit `single-ray`** emission, and one or two passive finite `ray-detector` components. **No other optical type** is allowed for this observable. Existing PhyDemo scene validation, detector endpoint clearance, material indices, emission, sampling and max depth policies remain unchanged. An invalid physical scene is rejected as before; a physically valid but broader scene is `unavailable` **for this observation only**.

Request it through the existing `opticsim-problem-v1`, `opticsim-observables-v1` or qualified bundle interface, with one entry per selected detector:

```json
{
  "id": "upper-ray-parents",
  "kind": "detector-ray-provenance",
  "componentId": "Upper"
}
```

A clean selected detector result has the form:

```json
{
  "nodes": [
    {
      "token": "r1",
      "origin": "native-emission",
      "sourceId": "S1",
      "parentToken": null,
      "spawnComponentId": null
    },
    {
      "token": "r3",
      "origin": "native-spawn",
      "sourceId": "S1",
      "parentToken": "r1",
      "spawnComponentId": "AirWater"
    }
  ],
  "crossings": [{"rayToken": "r3"}]
}
```

*The example illustrates the schema, not a measured apparatus.* The returned `nodes` are **only the complete observed parent closure of rays that crossed the selected detector**, not every ray in the scene. The `crossings` list is in actual native callback order. A completed, fully observed native miss yields `{"nodes":[],"crossings":[]}`; this is a **sampled miss**, not proof of no possible light or a continuous shadow.

The `method` metadata is `native-observed-object-parentage`; the result carries an explicit limitation about non-observed in-place interactions, missing full paths, image formation and run-local tokens.

## Provenance qualification and refusal

All source and detector/interface observers are installed and checked against their **actual validated native instances** before tracing and checked again at qualification. Every permitted `SingleRay` must invoke its native start exactly once and return **exactly one distinct valid native ray reference** registered to its authored source. Even when no ray hits any other component, silently missing that source start must **not** be accepted as a valid empty result. Every native interface return is observed through the existing one-delegation observer; only actual distinct `newRays` create child tokens. Both selected and nonselected detectors must be instrumented: missing a real detector callback, even if a separate native count or power exists, invalidates provenance.

| Condition | Requested-result state |
|---|---|
| Current exact scene and complete native run; every actual callback accounted for; Fresnel model enabled | `available` |
| Same clean run with explicitly authored `partialReflection:false` transmitted-only simplification | `qualified`, with model-approximation limitation |
| Stale source hash or run revision, pending/failed/stopped/truncated/undefined native tracing | `suppressed`; **no raw graph** in diagnostics or exports |
| Broader scene, missing source/parent/detector observation, duplicate/cyclic reference, detector-count mismatch, native warning or bounds failure | `unavailable`; no partial graph |

Machine-readable `reasonCode` distinguishes refusal categories. Native warnings **never** become a qualified success just because a separately declared transmitted-only approximation exists. Qualified scene history preserves author's source facts/assumptions; raw sandbox/native exports do not inherit them.

The observer is bounded to **64 actual ray object identities per run** and **32 callbacks per selected detector**. Overflow withholds the entire affected graph, never clipping an accepted result. Global identity loss invalidates all selected provenance; an overflow solely in a nonselected detector's event list does not by itself poison a clean requested detector's graph. In the bounded SingleRay scope these high count limits are *defensive guards*, exercised using explicitly labeled injected callback streams, **not ordinary large sampled-fan physics**.

Unrequested runs use the preexisting observation pipeline and output shape; historical detector crossing/count/signed power and optional hit-position results remain separate. No change to the PhyDemo pin, propagator, native physics, tolerances, numerical sampling, saved-scene versions or past original-problem source inputs.

## Verification and evidence boundaries

The implementation is based on the [independently reviewed design v2 at `d814455...`](https://github.com/physicsvigilante/opticsim/blob/d814455cf823907551cbc7914d1f8b3b508efcab/docs/NATIVE-RAY-PROVENANCE-PROPOSAL.md). [Chat B design review-02](https://github.com/physicsvigilante/review_sandbox/blob/main/projects/opticsim/pr-81/reviews/review-02-chat-b.md) gave a **design-only PASS**, not implementation approval; it explicitly required detector-observer failure control A-01.

The tests exercise an actual two-source native Fresnel interface and separate upper/lower detectors, clean zero-hit versus missed-root, missing selected/nonselected detector recording, injected duplicate/cyclic children and caps, incomplete/stopped native runs, unsupported scenes, stale source hash, legacy result preservation and public/Chrome qualified results. The **same-assistant tests and CI** are software evidence, not independent human optics certification, model reliability or teacher/student assessment.

Run (Node 24.19.0 with repo-local pinned native dependencies):

```sh
npm run setup
npm test
node scripts/ray-provenance-acceptance.mjs
npm run build
node scripts/ray-provenance-browser.mjs
```

These write new evidence under ignored `test-artifacts/llm-authoring/native-ray-provenance-v1` and `test-artifacts/browser-ray-provenance`. Existing headless and Chrome regression workflows remain required. Do not reuse previous raw artifact/scene fingerprints as if this changed feature were a new blind source-backed first attempt: historical detector-hit frozen inputs and hash records remain unchanged; a separate `test/fixtures/detector-hit-provenance-integration.json` records later explicitly authorized source changes.

**Release:** retain feature PR draft/unmerged pending exact-head GitHub CI, artifact inspection, genuinely independent R2 **code/evidence** review and separate owner merge approval. The research-only PRs #79/#80 and design-only PR #81 do not become production workflow dependencies.
