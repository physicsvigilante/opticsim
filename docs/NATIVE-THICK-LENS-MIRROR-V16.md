# Native finite thick-lens + plane-mirror composition (prospective v16)

**Status: unreleased R2 physical extension in draft.** The prerequisite v14 two-glass feature (PR #107), v15 biconvex thick-lens feature (PR #110) and this v16 proposal remain separate, unmerged release decisions. Passing tests do not certify all optical regimes.

## Explicit physical apparatus

An author can specify exactly **one stationary nonrotated finite biconvex `spherical-lens`**, exactly **one independent finite `plane-mirror`**, **1–4 native `single-ray` sources** and **0–2 passive finite detectors**. Each scene has schema and adapter version **16**, model **`native-thick-lens-mirror-tracing`**. Any absence of the mirror continues to select v15 for *new authoring*, but no v15 saved scene is migrated or silently upgraded. V16 scenes cannot silently remove the mirror through a structural edit.

The thick lens requires every v15 physical parameter: `x,y,apertureHeight,centerThickness,frontRadius,backRadius,insideIndex,outsideIndex,partialReflection`. The mirror requires exact `x,y,orientationDeg,length` and remains a native **finite** reflective segment. The mirror may be beside the source, downstream, tilted, or completely missed: **no optical encounter order or return path is prescribed**. In particular, reflected light is not asserted to arrive back at the source or at a detector.

## Reused strict geometry

The v16 validator first applies the *full unchanged v15 thick-lens validator* to a **validation-only view** of lens, sources, and detectors. No canonical or native object is removed or rewritten. This preserves all v15 radius, finite aperture, sag, at-least-1-mm rim, near-corner/tangency, explicit material-index, native single-ray, x-coordinate and external-detector guards.

The mirror is then required to remain entirely to the **left or right of the thick lens's complete horizontal x envelope** with at least **0.01 mm** x clearance, including both *finite segment endpoints*. It must fit inside ±10000 mm. This conservative certificate can reject physically disjoint off-axis or oblique mirrors that lack an entire x-separation. Shared v4 geometry validators additionally reject mirror/source supporting-line conflicts and mirror/detector near-intersections; detector validation is retained. The margin is an admission guard, **not** a general precision guarantee about finite native rays.

No second thick lens, blocker, ideal lens, refractive prism, overlapping medium, nested glass, source cone, time dependence, dispersion, 3D optical system, or arbitrary mixed-optics network is admitted by this version.

## Genuine pinned physics and measurements

Opticsim emits native `SingleRay`, `SphericalLens`, `Mirror` and `Detector` objects under the existing pinned PhyDemo checkout `811f508d2b070898c241a568b0c167dcb8645251`. The pinned native engine computes *all* intersections and reflected/refracted paths. Opticsim never fixes a `lens→mirror→lens` itinerary.

The existing read-only observers collect true per-lens first curved-face event, sampled interactions and face events; per-mirror reflection counts; and detector crossings. Initial rays may miss one or both optical bodies. A passive detector may register outbound and returning crossings, or neither. These counts and relative power are **not** a detected image, continuous irradiance, watts or complete ray ancestry.

`partialReflection:false` remains the explicitly selected approximation that drops ordinary Fresnel partial reflections but retains native total internal reflection. `partialReflection:true` can produce weak reflected branches and numerical/depth truncation. The existing native-completion, scene-SHA, event/geometry ambiguity and qualification guards must **withhold** requested values from incomplete or stale runs. Return paths and complete Fresnel-tree energy conservation are never inferred.

## Synthetic example and verification

`examples/native-thick-lens-mirror-v16.json` explicitly authors a 100 mm-aperture, 30 mm-centre-thickness biconvex thick lens of ±100 mm native radius, n=1.5 in n=1 exterior, a finite plane mirror at (130,0) mm, and a passive finite detector at (−100,0) mm. S1 emits a single rightward ray from (−200,10) mm. This synthetic apparatus is solely a physics software regression, not a textbook solution.

Native research-only PR #112 (test-only) previously observed the actual `D1→L1→L1→M1→L1→L1→D1` sequence and a mirror miss. The proposed v16 **public** contract must separately pass canonical authoring, validation refusals, real native simulation and real-Chrome edits/qualification with those physical values. An authored mirror move that misses the beam must give zero mirror interactions without a fabricated return.

Run from a supported Node 24 checkout:

```sh
npm run setup
npm test
node scripts/run-problem.mjs examples/native-thick-lens-mirror-v16.json --out test-artifacts/llm-authoring/thick-mirror-manual-01
npm run build
node scripts/native-thick-lens-mirror-browser.mjs
```

All output paths must be fresh. Node and Chrome CI establish software execution evidence, **not** full independent physical correctness. Production admission requires a separate adversarial **R2 optics review** of the *exact tested source commit* and the project owner's explicit authorization after its prerequisite v14/v15 release decisions.
