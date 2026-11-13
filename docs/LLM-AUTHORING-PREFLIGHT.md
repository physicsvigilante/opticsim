# Minimal LLM-authoring preflight (no native execution)

Opticsim is **not** an LLM-coded ray tracer. The LLM supplies known physical
facts, explicitly requested result kinds, and an optional interpretation
ledger. A deterministic engine validates the model, binds unambiguous
targets, runs the unchanged pinned native simulator only when appropriate,
and records what it *did not* determine.

## New low-burden rule

For registered native observations, `componentId` may be omitted when the
**validated complete authored scene** has exactly one compatible component.
For example, a sole source can be targeted by `source-emissions`, a sole
finite prism by `interface-face-events`, or a sole detector by
`detector-crossings`. The binding is recorded in `targetBindings` with the
rule `sole-compatible-authored-component`; the source request is never
rewritten.

If multiple components match, the request remains `needs-information` with
`AMBIGUOUS_COMPONENT_TARGET` and the candidate IDs. If none match it remains
`unavailable` with `NO_COMPATIBLE_COMPONENT`. No source, mirror, ray path,
material, brightness, angle or missing measurement component is invented.
Explicit `componentId` values are never silently reassigned or corrected. A
missing named ID is `needs-information` (`UNKNOWN_COMPONENT_TARGET`); a named
component of the wrong physical type is `unavailable`
(`INCOMPATIBLE_COMPONENT_TARGET`). Both list compatible candidate IDs and
are excluded from native measurement requests. Other valid requests may still
run; `verifyNative:true` remains an explicit opt-in to verify the scene itself.

This is purely a unique-ID selection, **not** a proof that a ray actually hits
that component, that its first event comes from any particular source, or that
an original problem has been correctly interpreted. All native result
completeness and scene-hash gates remain unchanged.

## Dry-run CLI

With Node.js installed, **without compiling or executing PhyDemo**, run:

```sh
node scripts/preflight-problem.mjs capabilities
node scripts/preflight-problem.mjs my-problem.json
```

This prints a single JSON report to standard output, does not write a file,
makes no network or model API calls, does not touch a native ray, and leaves
the supplied bytes unchanged. It returns a summary of exact authoring
preparation, unsupported/missing input, supported conditional mathematics,
resolved/ambiguous target IDs, and whether a native run can start.

`status=native-ready` means a validated scene plus at least one
unambiguously targeted native observation (or explicit `verifyNative=true`);
it does **not** mean the ray will hit or that the answer is known.
`status=blocked` means a missing/unsupported quantity or ambiguity is still
present even when a different calculation is conditionally available.
`status=no-native-required` is valid for analytical-only requests or
data-only unknown quantities with no native run.

A status of `blocked` or `invalid-input` exits with code 2; a malformed
input report exits 1 and explicitly records `native.calls: 0`, so malformed
first attempts can be scored without aborting the rest of an evaluation. A native-ready or all-conditional analytical report
exits 0. The original input SHA-256 is displayed so the later full command
can be related to this exact submission.

For example, author one `opticsim-problem-v1` input (not a native JSON
object):

```json
{
  "format": "opticsim-problem-v1",
  "physical": {
    "lengthUnit": "cm",
    "components": [
      {"id": "S", "type": "point-source",
       "parameters": {"x": -30, "y": 2, "brightness": 0.08},
       "emission": {"mode": "full-circle"}},
      {"id": "L", "type": "ideal-lens",
       "parameters": {"x": 0, "focalLength": 10,
                      "apertureHeight": 10}}
    ]
  },
  "requests": [{"id": "emissions", "kind": "source-emissions"}]
}
```

The preflight binds `emissions` to **S** because there is exactly one
compatible source. A native run remains necessary to obtain a sampled count.
The original physical values were all explicitly supplied by the author.

Then run the existing immutable evidence workflow:

```sh
node scripts/run-problem.mjs my-problem.json --out test-artifacts/llm-authoring/<fresh>
```

The plan, report and qualified bundle use the resolved request, while the
original input bytes and its SHA-256 remain sealed. Both reports record the
selection rule. Native observations are suppressed on truncated/stale runs,
and original-question fidelity remains `not-assessed-by-engine`.

This milestone adds **no** optical component, new Fresnel/geometry behavior,
inference provider, UI/player, additional permanent CI workflow, or automatic
retry/repair. It makes the *existing* general engine easier to author while
keeping all source, physics, and evidence boundaries intact.
