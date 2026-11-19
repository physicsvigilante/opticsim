# v24 native curved-entry observation — bounded JEE teaching capability

**Status:** Draft PR #180. This is an authorable *native* scene family only after release review and merge. Source/provenance and CI labels distinguish builder tests from independent review; do not score an original JEE question as solved.

## What problem it addresses

The JEE-first audit contains a genuine single-spherical-surface question (J15), and J16 asks about apparent location through a curved sphere. PR #177 already merged an **independent, standalone first-order analytical** calculation of these Gaussian quantities. Its result is deliberately `native.status: not-run`; the separate research witness established Snell consistency but was not a public authoring contract.

v24 makes **one finite curved surface encounter** authorable using an already supported native optical primitive: the exact right semicircle `Glass` from schema v21. A single right-side source enters the **curved arc** from the lower-index exterior. The ray crosses two **passive detectors completely inside** the denser glass, then can be absorbed by a **genuine opaque native `Blocker`** completely inside the glass. The real native `Glass` retains its flat closing diameter; it is never transformed into a magically open standalone surface. The absorber is a **declared physical addition**; it is not a fact given by J15. No second interface is deleted from the model or the archived native path.

The new public version is `schemaVersion=adapterVersion=24`, model `native-curved-entry-observation-tracing`, selected **only** when the authored components include one `semicircular-dielectric` and one `line-blocker`. All historical schemas v1–v23 remain independently versioned and accept exactly their historical apparatuses.

## Authorable physical contract

Run the standard problem authoring input, for example:

```sh
node scripts/author-scene.mjs problem examples/jee-curved-entry-v24.json --out test-artifacts/llm-authoring/v24-user-example-01
```

The source scene must explicitly supply:

- One `point-source` in `single-ray` mode at positive `x` on the right of the arc, traveling horizontally left at `directionDeg=+180` or `-180`; normal saved unused angle and explicitly supplied source brightness.
- One **real native** `semicircular-dielectric` at centre `(x,y)`, right-hand circular radius 50–1000 mm, explicit `insideIndex > outsideIndex` with both in [1,4]. `partialReflection=false` is required and is disclosed as a transmitted-only approximation; native TIR is not overridden.
- Two independent, passive, real native vertical `ray-detector` segments (centred on the glass axis) at 0.55R–0.9R to the right of the retained flat diameter.
- One real fully opaque vertical `line-blocker` segment inside the material at 0.2R–0.5R from the flat diameter, after the two detectors and before the flat surface.
- All finite endpoints inside the real curved boundary and at least 1 mm away from either interface. Both detectors and the blocker must be mutually separated by at least max(1 mm, 0.05R) in axial position; each has an explicitly stated length 0.5R–1.4R, plus the in-region endpoint check.
- Source x at 1.2R–4R from the flat-diameter coordinate, |vertical offset from centre| at most 0.08R, and at least 10 mm from the true entrance arc. Every coordinate must lie inside the canonical physical world bounds.

The narrow near-axis/high-to-low-source placement is **intentional**. A finite physical cross-section for one transmitted ray is all that is supported. No finite Beam fan, full Fresnel branching, nested medium, extra lens, mirror, circular dielectric, multiple source or unsupported crossing geometry may enter this model. The native solver—not the authoring validator—determines actual interface crossing, transmission, detector hits and blocker absorption. Results remain actual **sampled observations**; an empty detector measurement is not a reconstructed shadow or image.

An example experiment with R=100 mm uses the source at (200,+1), `G1` at (0,0), two internal detectors at x=80 and 60 mm (length=100 mm), and the real absorbing screen at x=40 mm (length=100 mm). The complete glass's closing diameter is still at x=0. Exterior 1 and interior 4/3 are explicitly chosen. The nonzero source transverse height is 1 mm; no original JEE source was inferred at that location.

## Actual native qualification and limits

Native execution records the real `Glass` encounter and face ID, interface incidence/refraction first event, sampled detector hit coordinates and actual `Blocker` absorption. In the admitted baseline, the first and only material incident event should be `face-arc`, with `face-flat` interactions zero because the ray is genuinely absorbed in the material.

These are *events*, not an imposed route: the physics code always retains both material interfaces and the ordinary native event callbacks. A geometric extension of two measured detector points to the optical axis is **mathematics only** and not a native detected focal point or ray back-propagation. A single exactly axial ray cannot establish an intercept; nearly axial differences require conservative conditioning. Never claim full 3D visibility, image formation, Fresnel power, diffraction, continuous irradiance or optical correctness outside the bounded experiment.

The analytical J15 `+10/3 D` and `+400 mm` image-side focal distance remain independent, paraxial predictions for **one spherical surface**. Native geometry is a **finite section and a real closed dielectric** with a physically added internal absorber, not a free-standing spherical shell. The native curved-entry research probe shows actual finite-height rays approaching the local `-300 mm` absolute x-axis focal coordinate when traveling left from the arc pole at x=100; this corresponds to a 400 mm signed distance along the actual leftward propagation direction. That correspondence does not turn the scene into an original-question answer.

## Evidence and release gates

- Research feasibility `test/jee-curved-entry-reverse-feasibility.test.mjs` uses true compiled native v21 Glass and raw native SingleRay/Detector/Blocker, wraps original callback once, verifies actual `Glass -> Detector -> Detector -> Blocker` sequence, retained flat closure and low-angle Snell limiting behavior. Removing or moving the absorber lets a real ray meet the flat face; such results fail its single-encounter witness gate.
- Public v24 `test/jee-curved-entry-v24.test.mjs` verifies exact authoring/native components, indexed face event, two measured hit positions, real native blocker absorption, signed transverse changes, scale/translation, invariant old versions, strict missing/invalid-fact refusals and stale/depth-limit suppression. It never invents image detection.
- `scripts/jee-curved-entry-acceptance.mjs` runs the full source-byte-bound public problem workflow, stores each original input hash, exact native results, seven no-native refusals and four real native completed controls with portable **result-free** qualified scenes.
- `scripts/jee-curved-entry-browser.mjs` verifies actual real-Chrome import, native physical revision, rejected overlapping opaque screen, qualified export and re-opened native re-execution. This is browser functionality regression, not human teacher or student effectiveness evidence.
- The untouched public v21 and v23 tests must pass; the additive catalog must preserve all 24 pre-v24 profiles and previous source fingerprints. The pinned PhyDemo SHA remains `811f508d2b070898c241a568b0c167dcb8645251`.
- One **consolidated independent physics/integration review** is needed on the exact fully verified v24 candidate *after* this work, not on individual intermediate branches. No production merge while the physics review is pending. Release claims must distinguish measured native events from manually computed Gaussian predictions.

No use of textbook Solutions, silently guessed numerical material indices, 3D perspective/eye assumptions, image reconstruction or original 20-problem coverage score is authorized by this module.
