# Explicit qualified composition upgrade: v10 to v11

The existing structural-revision workflow can now extend a saved one-mirror
finite-dielectric composition to the reviewed v11 two-mirror contract **only
when explicitly requested**. This is not a new optical combination or automatic
migration. The same v11 validator, native components, observers and numerical
limits remain authoritative.

## Minimal change, preserved baseline

The caller supplies only the new physical component and an explicit target
version. The operation snapshots and verifies the entire parent package,
validates the v10 input before constructing a v11 copy, applies the existing
atomic structural operations, checks all final geometry, and records one
physical edit containing both version changes and the component changes.

The unchanged components, stable IDs, units, optical model, upstream pin,
presentation, sampling, interaction budgets, origin, assumptions and prior edit
history are retained. Existing observations are not renamed or reassigned.
The original package is never modified. Previously retired component IDs remain
retired across this transition. Hashes detect mismatch, not truth or authenticity.

This bounded transition must produce **two plane mirrors**; a version-only
upgrade, downgrade, other family, other version or already-v11 input is rejected.
Existing structural add/remove rules still apply. Invalid proposals do not
partially upgrade the baseline, start tracing or publish a new qualified scene.
No existing physical field is rewritten to make the new mirror fit.

## Copy-paste exploration

Download current model context and use the existing `structure` proposal.
The optional field `patch.upgradeToSchemaVersion` must be the number `11`.
The proposal's top-level `expectedIntegritySha256` must match the complete
current package, including source notes, edit history and requested observations.

```json
{
  "format": "opticsim-exploration-proposal-v1",
  "expectedIntegritySha256": "COPY_THE_CURRENT_CONTEXT_HASH",
  "intent": "Explicitly extend the saved v10 composition with the stated M2 mirror.",
  "action": "structure",
  "patch": {
    "format": "opticsim-component-revision-v1",
    "upgradeToSchemaVersion": 11,
    "operations": [
      {
        "op": "add",
        "lengthUnit": "mm",
        "component": {
          "id": "M2",
          "type": "plane-mirror",
          "parameters": {"x": 60, "y": 20, "orientationDeg": 135, "length": 16}
        }
      }
    ]
  },
  "additionalObservables": [
    {"id": "second-mirror", "kind": "mirror-reflections", "componentId": "M2"}
  ]
}
```

The example coordinates are explicit synthetic choices, **not defaults** or a
claim that this mirror fits every baseline. The browser regression starts from
v10 with source (-40,0), glass x=0..20/y=-30..30, M1=(60,0), tangent 45 degrees,
length 16, and D1=(-20,20), tangent 90 degrees, length 20. With partial Fresnel
reflections explicitly omitted, adding the stated M2 produces four glass
encounters, one reflection at each mirror and one return-detector crossing.
These observations come from native tracing, not a route encoded in the patch.

Preview lists `scene.schemaVersion: 10 -> 11`, `scene.adapterVersion: 10 -> 11`
and each physical component change. It does not execute the proposal. Apply
requires the existing explicit approval and revision guards, then starts a fresh
native run. Editing the proposal or changing the current package invalidates the
preview. The source-backed baseline remains available for restoration and retrace.

## Qualified API and command line

`prepareQualifiedStructure(bundle, patch)` accepts the same optional
`upgradeToSchemaVersion:11` alongside existing structural operations. For this
transition **both** `expectedSha256` (scene hash) and `expectedIntegritySha256`
(complete package hash) are required. A metadata-only change is stale even when
the scene hash is unchanged. Existing revisions without an upgrade retain their
original hash requirements; an explicitly supplied package hash is checked.

```sh
node scripts/qualified-scene.mjs structure baseline.qualified.json upgrade.json \
  --out test-artifacts/llm-authoring/explicit-composition-upgrade
```

Use a fresh output directory. The command preserves input and patch bytes,
reports `structuralRevision.contractUpgrade`, saves the original qualification
plus appended changes, and executes the new scene separately. Failed admission
leaves a rejection report with `native.status: not-run`, not an upgraded model.
The lower-level `reviseComponents` function deliberately does **not** accept
upgrade fields; it remains a same-version operation without qualified lineage.

## Verification boundaries

An upgraded package contains no inherited execution results. Its scene hash
changes, so parent execution evidence is stale. Fresnel truncation, insufficient
interaction depth, native failures and ambiguous corners still suppress accepted
measurements. The transition does not increase numerical budgets, alter a
material index, omit a reflection or supply missing geometry.

Tests exercise provenance, immutable inputs, exact native counts, stale scene
and metadata hashes, retired IDs, input mutation during asynchronous hashing,
unsupported transitions, invalid geometry, units and actual CLI output. Existing
real-Chrome exploration tests exercise implicit-upgrade refusal, the version
preview, explicit Apply, native observations, qualified export/reopen and baseline
restoration. These are engineering checks, not independent LLM interpretation
or classroom evidence. No provider connection or public deployment is involved.
