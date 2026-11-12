# Three supported, revisable experiments

These are **synthetic development demonstrations**, not a blind model benchmark
or a new JEE sample. They deliberately specify all supported physical inputs.
The first prompts, requests, result requests and one-field revisions were sealed
at commit `46bcf57fcbd8a5e2015f6fc3e59458a603584f29` before execution. Git blob
`3f26818e36f440b528d1821245e71feb9eb9b5c6` is checked on every replay. No result
value, intermediate image source or repair was supplied in those first requests.

## Run and open

After the normal setup:

```sh
npm test
npm run build
node scripts/supported-authoring-demos.mjs
node scripts/supported-demo-browser.mjs
npm start
```

Evidence is saved below `test-artifacts/llm-authoring/supported-demos/`. To rerun,
supply a new output directory to both demonstration scripts. Old attempts are
never overwritten. The runner invokes the existing qualified CLI, not a second
execution pipeline. Open any case's `initial/qualified-scene.json` using **Open
scene / qualified package**. The `revised/qualified-scene.json` preserves origin
and records the requested physical change. Raw scene exports omit qualification.

Every case retains its original prompt, revision prompt, unedited request,
observable requests, interpretation notes, actual CLI stdout, initial/revised
native report and package. `report.json` contains portable paths, hashes,
measured field/byte counts and CLI wall times. CLI timing includes rebuilding
native code and is not LLM latency. Browser screenshots are actual native renders.

## Outcomes from unchanged first requests

| Demo | Engine result | One-parameter revision | Recomputed result |
|---|---|---|---|
| D1, one ideal lens | Conditional x=20 cm, magnification=-2/3 | Focal length +12 to +18 cm | Conditional x=45 cm, magnification=-1.5 |
| D2, two lenses | Conditional x=66 2/3 cm, magnification=+1 | Second lens x=40 to x=50 cm | Conditional x=66.25 cm, magnification=+0.375 |
| D3, mirror and detector | 7 emitted rays, 7 mirror interactions, 7 detector crossings; signed relative power 2.1 | Detector x=0 to x=20 cm | 7 emissions, 7 interactions, 0 crossings and power 0 |

Coordinates are global x in the stated frame, not distance from the last lens.
For D2 the last-lens distances are respectively 26 2/3 cm and 16.25 cm.
The conditional image coordinates are the existing analytical model's outputs,
not independently detected points in sampled native rays. Finite apertures,
emission and ray sampling can miss the assumed lens route. D3 counts are native
sampled observations at the pinned preview-v1 policy; power is not watts or a
continuous-throughput estimate. Zero crossings is an available result, not a
missing measurement. All six initial/revised configurations complete without
native warnings in the recorded execution.

Lens regressions use a separate scalar conjugate calculation only AFTER the
engine runs; no oracle is passed to authoring. Mirror regression values were
recorded after the sealed native first run, so they check pinned behavior rather
than constitute an independent physical reference. Existing reflection-law tests
remain in the suite. New tests also check unit/order invariance and history.

## Honest failure cases

Removing the first lens focal length yields `needs-information`, no native run
and no scene/package. Asking the complete supported lens scene for refractive
index yields an executed scene but an `unavailable` quantity with null value.
Neither control is repaired into a different physical problem.

## Authoring workload and next decision

| Demo | Physical values supplied | Of these, numerical | Requested result items | Fields in the requested revision | Corrective request edits |
|---|---:|---:|---:|---:|---:|
| D1 | 7 | 6 | 2 | 1 | 0 |
| D2 | 10 | 9 | 2 | 1 | 0 |
| D3 | 14 | 13 | 4 | 1 | 0 |

Physical values count every parameter and active emission field, including the
emission mode, but not IDs, type labels, titles or run-policy names. The engine
handles unit conversion, canonical metadata, inactive emission fields, camera,
numerical policy, validation, result computation, hashes and revision matching.
Each initial CLI invocation still needs three small files: scene request,
requested results, interpretation. This bookkeeping is distinct from physics.
The script splits the frozen manifest and inserts revision hashes mechanically.
No token usage, model-time saving or general accuracy estimate is claimed.

**Decision: improve result-aware view fitting before expanding physics.** The
current camera is prepared from apparatus alone. The browser check measures
whether requested finite conditional image coordinates lie inside that initial
viewport, both before and after physical revisions. Lens screenshots explicitly
reduce zoom to 0.6 as a presentation action; this is not a hidden physical edit.
The final PR records measured viewport results. A future Fit requested results
control should use supported finite result coordinates and apparatus bounds,
apply only presentation changes, preserve provenance, retain conditional labels,
and handle unavailable/infinite results without inventing coordinates. It must
not introduce a native image-detection claim or analytical ray overlay.

A second candidate is bounded deterministic parameter sweeps through the
existing revision contract: all three cases reused identical result requests
with one field change. This would avoid repeated LLM bookkeeping, not missing
physics. Neither new feature is silently included here. More components or a
new provider are not justified by these fully supported examples; broader
held-aside question evaluation remains a separate need.

## Verification boundaries

Final CI evidence is linked on PR #16. Node and browser tests validate the
software and these fixed demonstrations, not independently verified natural-
language understanding. No external model is called, no problem archive is
transmitted, and no public website is deployed. The pinned native physics and
canonical scene schema are unchanged.
