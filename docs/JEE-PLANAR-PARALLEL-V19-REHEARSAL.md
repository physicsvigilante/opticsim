# Review-only rehearsal — JEE planar core + native parallel beam v19

**DO NOT MERGE. NO RELEASE AUTHORIZATION.** This rehearsal tests combining two already **independently source-reviewed but unmerged** Opticsim JEE capabilities on one production-main-based Git tree. A successful combined test cannot authorize either constituent PR or this new rehearsal for release.

## Frozen source identities

- **[PR #161](https://github.com/physicsvigilante/opticsim/pull/161)**, HEAD `09ad081a34ced0fa969affc1bf54766cabffb04a`, Git tree `1b2caf6186c8eaf678963238d2292001b2fa9667`, [Chat B combined independent review](https://github.com/physicsvigilante/review_sandbox/blob/main/projects/opticsim/pr-161/reviews/review-01-chat-b.md) **CLEARED FOR OWNER DECISION, P0/P1 none**. Its 13 added files include separate one-plane explicit-angle and source-to-observer **analytical** queries plus an opt-in separately physically authored genuine native single-ray detector witness. All reviewed source blobs remain **unchanged** in this rehearsal.
- **[PR #141](https://github.com/physicsvigilante/opticsim/pull/141)**, HEAD `6d6d6b213fedb6f028cd1ffef241aef239d37c62`, Git tree `39884a78ec265a77dc18877a838b937103998160`, [Chat B targeted R3 review](https://github.com/physicsvigilante/review_sandbox/blob/main/projects/opticsim/pr-141/reviews/review-01-chat-b.md) **CLEARED FOR OWNER DECISION, P0/P1 none within corrected v19 topology scope**. Its exact 18 changed paths relative to production main include registered `parallel-beam` JSON authoring on schema v19, native PhyDemo `Beam`, native thin lens / upstream aperture / planar slab controls, and a conservative refusal for downstream aperture relative to a forward ideal lens.
- Source base: production `main` `d3509e82fb65d81aabe336666851f8f2962623f4`. The 13 changed paths of PR #161 and 18 of PR #141 have **zero path collisions**. This rehearsal composes the **unchanged exact Git blob objects** for both source sets, not cherry-pick conflict resolution or a merge of the held PR branches. Added test/document files are rehearsal-only.

## Physical and numerical boundaries

1. **Standalone analytical planar queries** use explicit source, indices, one oriented infinite interface and (respectively) an explicit incident angle or a known observer-side point. Their conditional crossings, refraction angles and virtual-axis intercepts are mathematical predictions; `native.status = 'not-run'`, no detected eye or image, no invented inverse-native ray route.
2. **Opt-in native single-ray witness** requires independently authored brightness, Fresnel mode, numerical run policy, finite detector and arrival/direction tolerances. Actual PhyDemo detector hit/complete-zero readings are qualified separately against the compiled canonical scene, actual native events and hash/completion; no native interface point is invented. Synthetic negative-event mutations are result-classifier tests, **not** native physics observations.
3. **Version-isolated native parallel Beam v19** has a fully authored finite-width parallel input and genuine pinned native beam sampling, finite lens/aperture/planar media and real sampled detector crossings. It **does not** establish continuous irradiance, point-spread function, image formation, or general geometric ray ancestry. A post-lens aperture is conservatively refused where refracted endpoint/corner ambiguity is not qualified.
4. **No new mixed apparatus is claimed** between the v5 SingleRay native witness and v19 Beam family; only both separately supported families are tested on one combined codebase. Do not change v5 physical outcomes when v19 is registered.

## Additional test-only integration stress

The new `test/jee-planar-parallel-v19-integration-rehearsal.test.mjs` checks:
- **30 signed/unit/rotation cross-contract analytical checks**, passing B's inferred *signed* angle into A's explicitly authored finite-angle contract, comparing apparent-axis position/depth and first mathematical plane crossing. Still `native:not-run`; comparison is mathematical, not a native crossing or image.
- A **genuine pinned native** v19 beam + upstream finite aperture + ideal lens + finite detector: 8 native emitted samples, 6 genuinely absorbed, **2 native detector hit events**; analytical source/observer results remain marked `native:not-run`.
- The **post-lens aperture numerical/topological refusal**, even when an unrelated standalone single-plane analytical query remains mathematically conditional.

Every existing v19 and planar test must also pass on the **same combined tree** with Node 24, pinned PhyDemo and real Chrome, plus all 11 standard workflows. Distinguish genuine native evidence from synthetic records and original frozen source identities.

## Release and independent-review requirements

This is a **new integration boundary**, not reviewed by source-only PR #141 or planar-only PR #161 reports. Full combined builder CI and source/checkout Git tree identity are prerequisites to requesting **one targeted cross-feature integration review**. No repeated physics review of byte-identical source blobs unless a reviewer identifies a material interaction.

Production `main` remains **unprotected** and [issue #123](https://github.com/physicsvigilante/opticsim/issues/123) remains open unless independently verified otherwise. Branch protection must be configured by the repository owner (admin UI). **No held PR may be merged without an explicit owner instruction**, even if all GitHub checks and independent reviews pass. Native thick-lens v14–v18 and detector-footprint integration remain distinct later stages because they overlap shared `src/adapter.js`, `src/observables.js`, `src/contract.js`, browser and CI workflows.
