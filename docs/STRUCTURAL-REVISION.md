# Bounded physical-component revisions (draft contract)

The teaching-accompaniment goal is **reusing one source-backed physical model** while exploring hypothetical arrangements without reauthoring unchanged components. The baseline must survive intact. This change extends the existing *minimal authoring* layer; it does not create new optical laws, a graph solver, a new canonical scene schema, or a browser object-placement interface.

## One new typed operation

`src/authoring.js` exports `reviseComponents(document, patch)`. It accepts an already validated canonical scene plus a bounded patch:

```json
{
  "format": "opticsim-component-revision-v1",
  "operations": [
    {
      "op": "add",
      "lengthUnit": "mm",
      "component": {
        "id": "detector-2",
        "type": "ray-detector",
        "parameters": {"x": 80, "y": 0, "orientationDeg": 90, "length": 160}
      }
    }
  ]
}
```

To remove an existing component, use `{"op":"remove","id":"detector-2"}`. Up to eight distinct component identities may be added or removed *atomically* in a single patch. New IDs are always explicit, unique and never reused in the same revision, even if an older component was removed first. Existing components cannot be renamed or replaced by a structural patch. For parameter edits use the existing `reviseScene`.

New components use the **existing component registry and physical field vocabulary**. All active numerical properties are required, including source brightness, applicable indices, exact geometry, and active ray emission. Only the mechanically inactive angles of a new full-circle source use the same dormant defaults already present in `prepareScene`. An add operation declares its `lengthUnit` (mm/cm/m); angles, indices and relative brightness are not length-converted.

The full candidate is revalidated by the canonical `validate` function after all operations. This enforces current family compatibility, source constraints, component count, geometry clearance, overlap and numerical bounds. A structurally valid object in isolation is not permission to insert it into any optical family. Rejected proposals return field-path issues without mutating the source or running native physics.

## Qualified and hash-guarded execution

The existing CLI now accepts:

```sh
node scripts/qualified-scene.mjs structure baseline.qualified.json change.json \
  --out test-artifacts/llm-authoring/<fresh-name>
```

The change file includes the exact original `expectedSha256` and the typed patch above. Only a qualified, hash-verified parent package is accepted. A stale hash blocks before native execution. The unchanged source interpretation and assumption provenance accompany the child's qualified package; the physical structure edit is recorded in the same edit history as other revisions. The prior file stays untouched.

**Importantly, existing requested quantities are never reassigned.** If a detector is removed, a request for that ID remains recorded and returns `unavailable`, while valid measurements of surviving components can still be observed. Adding a new detector does not automatically create new public result requests or claim detector-image detection.

Native PhyDemo executes the **newly validated** arrangement. Earlier native evidence does not certify it. Physical, numerical and presentation state remain distinct, and sample counts/relative power are not continuous irradiance or watts.

## What is and is not supported

The operation supports adding or removing *existing registered component types* within their current qualified family and numerical budgets. The entire scene cannot silently migrate from v4 general tracing to v8 prism or v9 polygon optics; these remain separate supported models requiring independent authoring and qualification. This feature does not expose arbitrary relational topology, connection graphs, replacement semantics, inferred rays, geometry from a textbook image, new physics, dynamic light propagation or general inverse solves.

The source model and resulting hypothetical scenario are distinct qualified objects. Source statements must not be relabeled as adopted classroom hypotheses. Hashes prevent accidental package mismatches; they **do not certify** that the LLM correctly interpreted an original question or that a student learned from the simulation.

## Verification and limitations

The direct Node tests exercise real pinned native detector additions, original-detector removal, source and lens/mirror/blocker additions, unit conversion, stable IDs, missing parameters, invalid geometry, duplicate IDs, unsupported operations and cross-family refusals. A standalone CLI acceptance replays the *previously exposed* teaching fixture through successful add/remove and rejected overlap/stale-hash proposals, retaining fresh source-linked qualified evidence.

The original source, historical trial attempts, pinned upstream, solver and canonical scene format remain unchanged. This is a **software capability**, not a prospective independent LLM authoring evaluation. Teacher/student participants: zero. Educational effectiveness: not assessed.

If future investigations reveal the need for physical couplings or typed structural relationships beyond what the native component compiler already admits, treat them as a distinct physics/assembly qualification milestone rather than encoding them as loosely validated edits.
