# JEE Optical Systems Atlas v1 — objects and compositions, not answer scoring

**Purpose:** use authentic JEE ray-optics *Problems* as a discovery tool for general, reusable **2D simulation systems** that Opticsim does not yet expose. This is not a claim to answer, grade or solve any original question.

The Atlas was reviewed against main `52accb717b10b75792a484b8a8c6b285c5770e59`, using the **unchanged pinned PhyDemo** `811f508d2b070898c241a568b0c167dcb8645251`.

## Sources, selection and scope

- Source: `08_Ray_Optics_Explanations.zip`, public repository `physicsvigilante/opticsim`, historical source commit `d33b45226348d9b0c701f2a3e8b86dd1285de2d0`, SHA-256 `03fa29dc8a09f157692ea389354bc7393a96e49f792b60329164c03e56bc5939`.
- The **114** numbered `/Problems/*.png` members across eight chapters were inventoried by path metadata. The review opened **40** selected images and leaves **74 not visually reviewed**. No Solutions entries were extracted or opened.
- Before opening the selected images, the rule and explicit selections were committed to this feature branch at **`dc307fa00687b3007797e559bc7186db6e87ea1d`**. Within each chapter, sort filenames and take five indices `floor(k*(N−1)/4)` for `k=0..4`. Selection is deterministic, but it is **not** a statistical random sample or evidence of never seeing a case before.
- The full original archive's SHA was independently checked in a temporary read-only GitHub job. A filtered, Problems-only copy was transferred for offline visual inspection. Each reviewed image is pinned by its individual SHA-256 in `review.json`. No original question text or PNG is stored on main by this PR.
- All categories are **same-assistant engineering judgments** requiring future review; no independent model, original-answer verification or new native scene run occurred.

| Chapter | Indexed Problems | Visually reviewed |
|---|---:|---:|
| 1. Reflection at Plane Surfaces | 15 | 5 |
| 2. Reflection at Curved Surfaces | 13 | 5 |
| 3. General Refraction | 12 | 5 |
| 4. Total Internal Reflection TIR | 10 | 5 |
| 5. Prism | 15 | 5 |
| 6. Refraction at Curved Surfaces | 13 | 5 |
| 7. Lens Formula | 27 | 5 |
| 8. Aberrations Human Eye Optical Instruments | 9 | 5 |
| **Total** | **114** | **40** |

## What the sample says (do not interpret as a solved-problem score)

| Apparatus-family exposure | Sample cases |
|---|---:|
| A related system is currently composable under some validated scope | 7 |
| A subset of the components or composition is currently available | 15 |
| Needed physical geometry or composition is not exposed | 18 |

The observation registry is more restricted: **4 cases** have related registered *conditional* analysis and **36 cases** require an unregistered observation, inverse relation or question interpretation. **None of these 40 cases was executed or awarded a numeric answer.** One system may be simulatable from fully specified authoring facts even though the original question does not give brightness, finite aperture, exact geometry or a source position. Opticsim must never fill those gaps silently.

## Common missing capabilities (non-exclusive tags)

The counts below mean a capability was tagged in a reviewed question. **One question can appear under multiple gaps**, so these counts must not be summed or extrapolated to 114 questions.

| Gap in the 40 reviewed problems | Tagged cases |
|---|---:|
| Observer / apparent-depth and conditional image geometry | 10 |
| Parallel and directional ray bundles through dielectrics | 9 |
| Bounded polygons, curved caps and nontriangular glass | 7 |
| Bounded source-to-face/branch ray provenance | 7 |
| Reusable inverse reflection/refraction constraints | 5 |
| Reusable prism angular/deviation/minimum-deviation queries | 5 |
| Microscope, telescope and eye instrument models | 5 |
| Extended object and shape-aware point sampling | 3 |
| Connected mirrors and reusable mirror enclosures | 2 |

The audit deliberately separates: **physical object**, **configuration/composition**, **native incident-event observation**, **conditional analytical observable**, and **actual question answer**. Finite tracing is not a certified image, power measurement, continuous visibility test or unique ray path.

## Where to start

Read [the per-question catalogue](CASES.md), [the simulation-first roadmap](ROADMAP.md), and the structured [review](review.json), [roadmap](roadmap.json), [inventory](inventory.json), [selection](selection.json) and [policy](policy.json). Every review row is attached to a pinned `Problems` path and file digest, not a copied Solutions or inferred correct answer.

**Recommended first separate implementation:** a bounded convex polygon dielectric (initially a four-vertex glass block) using native PhyDemo `Glass`, with strict region geometry and per-face measurements. That can evolve the isolated prism/circle family toward a general finite-region composition model. The first acceptance should be **fully declared synthetic geometry** inspired by A17; since the original JEE question does not give all simulator parameters, it must not be falsely labelled solved. A second, smaller candidate is an opaque line/circular stop using native `Blocker`/`CircleBlocker`, which prepares for A18's visibility system but alone cannot answer the disc-radius question.

The owner previously deferred multi-ray prism illumination. We record the native `Beam` opportunity, but do not implement it or silently enable it in this Atlas PR.

## Reproducing verification

After checkout:

```sh
node evaluation/optical-systems-atlas-v1/check.mjs
npm run setup
npm test
```

For exact image-digest verification *with a local copy of the public, pinned original source*:

```sh
node evaluation/optical-systems-atlas-v1/check.mjs --archive 08_Ray_Optics_Explanations.zip
```

For the GitHub Actions **Problems-only** transport ZIP (not an independent verification of the original archive hash):

```sh
node evaluation/optical-systems-atlas-v1/check.mjs --problems-only problems-only.zip
```

The checker reads only selected `/Problems/` entries; it cannot open any Solutions member by its API. Metadata-only verification performs no ZIP, image, native or model call.

The one-off transport workflow used to obtain the public archive and verify its original SHA is **absent from the final PR tree**. The atlas introduces no new permanent workflow, physics object, ray tracer, GUI/player, private evaluation artifact or Pages deployment. Previous sealed first-attempt studies remain untouched.
