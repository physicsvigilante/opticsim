# Opticsim v14–v18 native optics on current JEE v21 main — integration review packet

**State: DRAFT, unmerged, independent review not yet performed on this combined tree.**

## 1. Identity and goal

- Production main **before integration**: `59b485d14ac28ca4ee97acc754a4cd207a7d33f1` (owner-authorized merger PR #170; 11/11 post-merge CI).
- Previously held, separately reviewed **cumulative v18**: [PR #120](https://github.com/physicsvigilante/opticsim/pull/120) head `1c566103842cc6c4841aa97360cc893b0ed710c4`, tree `d811ad8d026eacf8e15a8403bfc415bca41e2208`, on historical main `d3509e82fb65d81aabe336666851f8f2962623f4`.
- The entire 35-file **new-file subset** of this draft is unchanged original v18 cumulative Git blobs, not rewritten models or rewritten evidence. These include the five native physics/admission modules, public examples, native/Chrome tests, existing educational docs and historical postfreeze manifests.
- All 11 previously registered public workflows and newly added v14-v18 actual native/Chrome tests must pass against the **new combined tree** before independent review; an old source-specific pass is NOT a combined-main pass. Exact reviewer HEAD, synthetic-merge HEAD, source tree and artifact hashes belong in PR #171 after the final CI run.
- **Pinned unchanged PhyDemo upstream:** `811f508d2b070898c241a568b0c167dcb8645251`. Native geometric objects still perform every refraction, reflection, TIR, ray-body intersection, stop absorption and detector event. No custom tracer, scripted ray or interpolated textbook answer is added.

## 2. Reusable JEE engine capabilities now staged

| Frozen schema | Explicitly admitted native system | Original independent Chat B review |
|---|---|---|
| v14 | Two separated convex native `Glass` regions, common exterior index, exact `SingleRay` sources, passive detectors | [v14 follow-up](https://github.com/physicsvigilante/review_sandbox/blob/main/projects/opticsim/pr-107/reviews/review-02-chat-b.md) |
| v15 | One/two native finite `SphericalLens` (biconvex) with two positive authored curvature radii, centre thickness, aperture height, glass and exterior indices | [v15 follow-up](https://github.com/physicsvigilante/review_sandbox/blob/main/projects/opticsim/pr-110/reviews/review-02-chat-b.md) |
| v16 | One finite spherical thick lens and one independent finite plane mirror | [v16 review](https://github.com/physicsvigilante/review_sandbox/blob/main/projects/opticsim/pr-113/reviews/review-01-chat-b.md) |
| v17 | Two thick lenses and finite mirror; separate explicit native depth 16 | [v17 review](https://github.com/physicsvigilante/review_sandbox/blob/main/projects/opticsim/pr-116/reviews/review-01-chat-b.md) |
| v18 | Two thick lenses, finite mirror and native centred-gap `Aperture`; separate depth 16 | [v18 review](https://github.com/physicsvigilante/review_sandbox/blob/main/projects/opticsim/pr-120/reviews/review-01-chat-b.md) |

All of those reviews were **cleared only for owner decision on their narrower old source tree**, not for automatic merger into current JEE `main`. This candidate restores their *same existing scopes* without introducing a new generic optical graph.

## 3. Reconciliation boundaries and invariants

1. **Whole-scene model isolation:** v14–v18 each retain their own counts, read-only validation subsets and exact source modes. v19–v21 native `Beam` profiles and v21 semicircular Glass remain unaffected; v20 independently offset ideal-lens `y` stays required only in v20. Cross-family mixed objects and mismatched schema/model/adapter versions refuse without silent fallback.
2. **Finite, explicit geometry:** all glass vertices, thick-lens physical x envelopes (including real spherical rim/arc), sources, external mirrors and native detectors are validated in world mm. Two glass bodies must be separated and non-nested, and multiple thick lenses share an explicitly declared exterior medium. Physical Snell/reflection/misses originate from the actual native calls, not from a validator-predicted ray.
3. **Runtime quotas:** v17 and v18 may explicitly use `native-deep-v17` or `native-deep-v18` (depth 16), respectively. The baseline `preview-v1` for all versions, and every v1–v16 plus v19–v21 canonical document, retains maximum depth 8. `maxRayDepth`, processed budget, truncation, native undefined behaviour and error suppress requested observations when an execution is not qualified.
4. **Native interface metadata:** `SphericalLens` is now observed by stable ID and four finite faces from **actual native incidents**, with actual local normal and indices. Existing polygon/prism/full-circle/semicircle/v19 beam detector-hit and Fresnel semantics remain unchanged. Full Fresnel off is a stated transmitted-only approximation, not suppressed native TIR.
5. **Presentation is not physics:** a new `SphericalLens` fits by its full *physical* bounds; previously independently corrected v20 ideal-lens preview at `p.y ?? 0` remains. Browser parameter panels announce actual schema/geometry and exact native SingleRay mode for v14–v18. They never claim that a ray crossing is an image, continuous irradiance, PSF or original JEE final answer.
6. **Historical source provenance:** all original old postfreeze fixture bytes stay exactly as reviewed. The old v18 `src/app.js` Git blob `cfbea455df3f7ea7a30002d0139730c25b235d32` **cannot** equal a new v21-main browser with merged new functionality. New `test/fixtures/native-v14-v21-app-integration-v1.json` records the *new* integrated app Git blob. The updated test checks both; it does **not** retroactively recertify blind old evidence.
7. **Complete public workflows:** v14-v18 standard tests, the v18 six-case source → native → qualified acceptance, five real-Chrome v14-v18 physical edit/invalid/reopen scripts, v19-v21 three Chrome and native public workflows, old 27-check browser and hosted smoke, and a new v14-v21 cross-version isolation battery. New evidence must be run at the exact combined source tree, not merely reusing original v18 successes.

## 4. Focused adversarial issue — returned/refracted ray near v18 aperture gap joint

Original independent v18 reviewer [N2](https://github.com/physicsvigilante/review_sandbox/blob/main/projects/opticsim/pr-120/reviews/review-01-chat-b.md) notes: **only the initial source ray is screened against four finite aperture endpoints**. An *after-lens refracted* ray might approach a joint closer than 0.01 mm. Native `Aperture` remains responsible for selecting absorption or transmission. An ordinary native `simulationComplete` callback, with zero truncation/undefined behaviour, cannot independently certify a joint classification.

A new **test-only**, separately labelled probe `test/native-v18-secondary-aperture-corner-probe.test.mjs` uses a **real v17 native detector hit** at x=50 mm as an observed downstream refracted sample, then independently authors five v18 apparatuses placing their native centred-gap endpoint at `observedRayY + delta`, for deltas −0.03, −0.005, 0, +0.005, +0.03 mm. It retains the raw v17/v18 native scene documents and complete summary JSON, manifest SHA-256 hashes, **actual L1/L2 face counts, mirror reflections, total processed ray segments, absorber events and native completion status**.

This *does not* construct a replacement path or infer absorption order from a total alone. In a lens–mirror system the ray may cross the gap going forward and be absorbed returning, so an equal **total aperture count** across all deltas would not imply identical optical itineraries. Treat near-joint comparison as **evidence requiring an independent numerical/physics judgment**. No safety policy is weakened; no blanket guarantee for all possible ray histories is claimed. If review identifies a P1 admission or measurement risk in any *completed* near-joint control, fix on a **new exact-source commit**, demonstrate fail-closed behaviour in a genuine native witness and seek focused independent re-review. Do not silently suppress native ray data or substitute your own tracer.

## 5. What one independent combined reviewer should do

Review **only the final frozen PR #171** against current main `59b485d1...`, referencing earlier v14–v18 reviews for unchanged source physics rather than re-reviewing each historical branch. Check: actual frozen source blob identities; correctness of the shared-field reconciliation; native `SphericalLens` y-up/native y-down and front/back radius signs; medium indices, per-face normals, Fresnel/TIR; cross-version schema/authoring deep-budget isolation and detector evidence; the **N2 secondary-aperture corner** raw scenarios; real Chrome readouts, full-body camera fitting and qualified save/reopen; historical frozen hash integrity; exact final Git tree vs tested synthetic merge checkout. Preserve old review verdicts and first failed integration runs in history.

A reviewer can conclude **CLEARED FOR OWNER DECISION** or **CHANGES REQUESTED**; full CI alone is not independent correctness certification. Do **not merge** this draft automatically. Even clearance requires separate explicit owner authorization, and branch-protection issue #123 remains deferred/open. Original research/feature source PRs remain unmerged and do not become independently re-reviewed by virtue of this integration effort.
