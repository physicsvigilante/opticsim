# Research v27 — True finite parallel Beam through a finite planar slab and downstream mirror

**Frozen research portion is TEST-ONLY; the same draft PR now also includes a separate public v27 authoring candidate (described below), which is NOT released.** This study starts on verified independently reviewed production `main` `4f81a1625cc45ce731d3ee0e286ff3173f72f4fe` (v26). The actual pinned native PhyDemo is unchanged at `811f508d2b070898c241a568b0c167dcb8645251`.

The source/geometry/11-case protocol was frozen **before running any new native test** at `e3f18c39bc83cae77d86d8c2e672c2411442627b`. **At the initial feasibility stage**, the only new code was a test-only native observer, with no public-schema or production-code changes. After positive feasibility, additional v27 source, schema, tests and CI were introduced on this **still-unmerged draft** (see the public-candidate section). Historical JEE source interpretations remain unchanged.

## Why it matters

The reviewed v19 admits a real, deterministic finite parallel `Beam` and *two* planar refracting boundaries, but no downstream `Mirror`. The reviewed v26 admits one actual `PlaneGlass` interface and a finite `Mirror`, but not a finite *two-boundary* slab. Their combination is a genuinely reusable optical **composition** gap: a multi-ray Beam refracts into a slab, exits into a third medium, reflects from a mirror, and re-enters/exits the slab on the return trip.

The frozen JEE J08 mirror-backed slab motivates multiple glass contacts, but the source says the plate **rests directly on the mirror**. This study's baseline explicitly chooses a **30-mm gap** between the back face and the finite mirror. That is an additional synthetic teaching apparatus and is *not* the original J08 geometry. The co-planar mirror-on-second-interface control (zero gap), and the 0.005-mm near-contact control, are explicitly **unqualified** even if some native callbacks complete. No result is presented as original J08 solved or source-complete.

## Explicit synthetic geometry and independent necessary relations

Use mm and y-up, Beam centre (−100,0) with width 40 mm and direction +30°, native brightness 0.08, density 0.2; first `PlaneGlass` at x=0 changes index 1→1.5, second at x=60 changes 1.5→1, each with `partialReflection:false`. Place a real finite vertical native Mirror at x=90 mm with length 420 mm, and passive Detector at x=−10 mm.

The independent conditional Snell and specular reference for the **explicit added 30-mm gap** is:

```text
r = asin((n0/n1)*sin(i)) = 19.47122063449069°
entry-to-final-exit front-surface lateral shift
  = 2*slabThickness*tan(r) + 2*mirrorGap*tan(i)
  ≈ 77.06742302257038 mm

inbound/outbound source-side detector hit spacing
  = frontSurfaceShift + 2*detectorDistance*tan(i)
  ≈ 88.6144284063629 mm
```

These are independently evaluated *necessary* geometry witnesses; they are **never used to steer pinned native rays, interpolate a missing native event or infer physical images**. True per-ray ancestry cannot be determined by aggregate counts alone.

## What the test actually runs

The research test first builds and validates an unchanged public **v19 `Beam + PlaneGlass + PlaneGlass + Detector`** document. It clones the compiled native source and, for the research cases only, appends a true pinned `Mirror`. Neither the clone nor the new raw events are presented as qualified v19 or v27 measurements.

Test-only instance-local wrappers delegate to real upstream `Beam.onSimulationStart`, `PlaneGlass.onRayIncident`, `Mirror.onRayIncident`, and `Detector.onRayIncident`. They record actual emissions, interaction locations/directions, relative brightness, native completion/stopping, nonzero truncation, undefined behavior and errors. Evidence is written with per-input and per-report SHA-256 to `test-artifacts/llm-authoring/native-two-plane-mirror-v27-research/`. A finite cap causes an explicit research invalidation rather than silent positive coverage.

The frozen matrix has **eleven** cases: baseline, translation, normal incidence, changed slab material, denser Beam, no mirror, exact co-planar mirror contact, 0.005-mm near-contact, raw first-interface Fresnel-on, zero ray depth and processed-ray limit one. Initial success criteria for the *separated-gap positive controls only* are eight real emissions, 16 first-plane hits, 16 second-plane hits, eight true Mirror reflections, and 16 passive-detector hits (doubling at density 0.4), full native completion and no truncation/undefined. For mirror-absent, a real return path must disappear. For critical/contact/Fresnel/forced-stop cases, a raw completion or observed hits must **never** qualify a future public apparatus.

## Next decision gate

Inspect exact-source CI plus the archived native events, **not just a green test**. If separated-medium geometry is feasible, consider **one separate new versioned public authoring profile**, not an extension of already reviewed v19/v26 saved profiles. It must reuse v26's separately reviewed exact native Beam emitter-sampling/half-integer safety guards, validate first and return crossings at all refracting planes and finite mirror ends, and reject any contact ambiguity, near-critical, Fresnel-on, clipped, nonfinite, stale, stopped or truncated conditions. It needs normal public JSON→native→qualified evidence and real Chrome acceptance, then **one focused independent review of the finished public candidate**, not an extra independent review of this raw research.

This work does not claim wave optics, attenuation, continuous irradiance, a physical image, original J08 solution or 3D eye visibility.

## Public v27 candidate in the same draft PR (after positive raw feasibility)

The synthetic gap-separated system has now been implemented as a **distinct public schema v27**, with no silent change to old v5/v19/v26 files. The profile is `native-parallel-slab-mirror-tracing`; it admits exactly one genuine pinned finite Beam, two correctly ordered vertical `PlaneGlass` boundaries, one independent finite vertical `Mirror` in the third medium, and 0–2 source-side passive detectors.

**Physical limitations are explicit:** the slab must have thickness **at least 1 mm**, and the Mirror must be **at least 1 mm beyond the rear refracting surface**. This is intentionally NOT a mirror directly resting on a glass plate. The two exterior indices must match and be authored explicitly; the slab index must be at least that exterior index. `partialReflection:false` is required at both interfaces. Reverse/tilted illumination, extra optical objects and arbitrary third media remain unsupported.

**Safety:** every emitted sample comes from v26's corrected native-compiled Beam midpoint enumeration (using exact native compiled endpoints and `Math.sqrt`, with a `1e-10` half-integer withholding band). The independent necessary Snell calculation guards each sample's outbound finite Mirror encounter, return geometry and detector endpoint proximity; it does not steer, infer or create native rays. Mirror rim safety is strict **>0.1 mm**. Direct or near-contact coincident interface+mirror geometry is refused before native execution, because the frozen raw control at exact contact reported **zero real second-interface callbacks**, despite a completed native terminal. Numerical incompleteness, stale results and Fresnel-on weak branches remain unqualified.

The [public authored example](../../examples/native-parallel-two-plane-mirror-v27.json) and `test/native-parallel-two-plane-mirror-v27.test.mjs` verify actual pinned native emissions, both interfaces, Mirror and detector, real/imageless measured counts, all-sample admission and rejection of unsafe/mismatched cases. `scripts/native-two-plane-mirror-v27-acceptance.mjs` sends the same JSON through the ordinary public evidence runner and save/reopen qualification. `scripts/native-two-plane-mirror-v27-browser.mjs` uses a real Chrome session to edit Beam width and BOTH slab material indices, refuse contact and clipped Mirror, then reload a qualified saved package. Evidence goes to the existing optical CI artifacts; no new ray propagation kernel, power calculation or JEE answer routine is introduced.

**Release gate:** this is now a **public candidate**, but still DRAFT and UNMERGED until full final exact-source CI, evidence and one focused independent physics/integration review. This single final review covers the frozen raw study and the authoring integration together. Do not duplicate review of the previously accepted v19/v26 native laws.
