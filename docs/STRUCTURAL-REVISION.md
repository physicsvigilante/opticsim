# Bounded physical-component revisions

The teaching-accompaniment goal is reusing one source-backed model for explicit hypothetical arrangements without reauthoring unchanged components. The original qualified baseline survives intact. This extends the existing authoring layer, not the optics laws, canonical scene schema or browser object-placement UI.

## Structural delta, not scene reconstruction

`src/authoring.js` exports the synchronous low-level `reviseComponents(document, patch)`:

```json
{
  "format": "opticsim-component-revision-v1",
  "operations": [{
    "op": "add",
    "lengthUnit": "mm",
    "component": {
      "id": "detector-2",
      "type": "ray-detector",
      "parameters": {"x": 80, "y": 0, "orientationDeg": 90, "length": 160}
    }
  }]
}
```

Removal uses `{"op":"remove","id":"detector-2"}`. One to eight distinct IDs can be changed atomically. Every added ID is explicit and unique; an ID cannot be replaced within the same operation. Existing field edits use `reviseScene` instead. All added active physical values are required. Units mm/cm/m apply only to lengths. Inactive full-circle direction/cone fields and the inactive single-ray cone field may use the same mechanical defaults as `prepareScene`; an active direction or directional opening is never invented.

The whole candidate passes the existing canonical validator after all operations. Family compatibility, geometry, source clearance, component counts and numerical bounds still apply. The model family, numerical policy, camera and surviving components do not change implicitly. A failure leaves the original untouched and starts no native execution.

## Qualified entry point: history and hash checks

Use `prepareQualifiedStructure(bundle, patch)` from `src/qualified-structure.js` for programmatic qualified revisions. Both inputs are snapshotted before asynchronous verification. `patch` contains `expectedSha256` plus the structural delta above. The helper verifies the parent package, checks the exact expected scene, invokes the same structural validator and records the accepted edit. It does not execute native rays or claim new results.

The existing CLI uses this qualified entry point:

```sh
node scripts/qualified-scene.mjs structure baseline.qualified.json change.json \
  --out test-artifacts/llm-authoring/<fresh-name>
```

A scene-only document has no historical identity context. The qualified entry point additionally rejects reuse of an ID retired in its **recorded lineage**, including same-length swaps represented by index-level edit records. This prevents an old observation request from silently binding to a new object carrying a deleted object's name. Use a fresh ID or explicitly branch again from an earlier qualified package. Hashes check consistency, not authenticity; deleted or falsely authored external history cannot be reconstructed or certified.

The source interpretation remains historical source metadata. An accepted edit is a new hypothetical scenario, not a newly discovered source-given fact. The CLI records the parent's integrity hash and added/removed IDs. It separately executes the revised arrangement through pinned PhyDemo; the baseline's previous run never certifies a child.

## Observation and scope boundaries

Existing requests are retained, never reassigned. Removing their detector yields `unavailable` and a null value, while surviving readouts can remain valid. Adding a detector does not automatically create a public result request for it. Native diagnostics may contain its actual readings; explicit observable selection remains a separate operation.

Only currently registered components within the baseline's admitted family are supported. No automatic v4-to-prism/polygon migration, arbitrary coupling graph, model replacement, new inverse solver or simulated dynamics is implied. Counts are finite native samples; signed relative power is not watts or continuous irradiance. Conditional image calculations are not native image detections.

## Verification

Regression tests cover real native detector composition, removal with unavailable old requests, generic mirror/blocker authoring, explicit source emission, unit conversion, rejection of missing or invalid physics, atomic changes, retired IDs across later revisions, tampered history, stale hashes and async caller mutation. The CLI acceptance uses a previously exposed synthetic fixture. Generic authoring tests do not establish native correctness for every possible component combination.

No independent model authoring or teacher/student study is claimed. Production optical laws, upstream pin, old source files and sealed first attempts remain unchanged. Further structural relationships require their own physical and mathematical qualification rather than unvalidated editing shortcuts.
