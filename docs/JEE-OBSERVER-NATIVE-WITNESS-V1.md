# JEE observer native sampled-arrival witness v1 — held feature candidate

**Draft child of independently reviewed, unmerged [PR #150](https://github.com/physicsvigilante/opticsim/pull/150). DO NOT MERGE without new independent review and a separate owner decision.** The parent remains frozen. This is a user-authored, *opt-in native check* of one specific conditional transmitted ray through one ideal infinite planar interface to one finite, passive detector placed at the declared observer-side coordinate. It is not a real eye, a reconstructed image, general inverse solver, source history, continuous power distribution or ray route controlled by Opticsim.

Unlike the analytical-only parent, this tool can record **an actual pinned PhyDemo detector crossing** in a fully prepared canonical v5 scene. The two distinct results remain separate: an analytical predicted crossing and apparent-axis intercept versus the **real native detector hit and incoming direction**. The native first interface observation does **not** include a recorded plane-hit coordinate.

## Explicit authorable input

See [the complete JSON example](../examples/jee-observer-native-witness-v1.json). The request comprises two closed records:

- `analyticalQuery` is precisely the previously reviewed typed single-plane source/observer geometry: known source point, observer point, oriented infinite boundary, two explicit indices and units. Its result alone is `conditional`, with `native.status:not-run`.
- `physicalVerification` explicitly chooses source brightness (0.01–1), native `partialReflection` boolean (true or false), a named numerical `runPolicy` (`preview-v1` or `dense-v1`), detector alignment `tangent-to-interface`, full detector `lengthMm` (1–200), requested `arrivalToleranceMm` (1e−7–1 mm), and requested `directionTolerance` (1e−9–1e−3 dimensionless). The detector center is exactly the user-stated observer point, not an inferred eye position. The tangent alignment is an explicitly selected witness convention, not an optical law.

The chosen run policy resolves to the existing *versioned* numerical parameters of the canonical authoring contract. The CLI preserves those parameters in the generated scene, not a silent depth or density substitute. `partialReflection:false` is the explicitly chosen native transmitted-only approximation; Fresnel partial reflections are omitted while native TIR still exists. Any native warning and Fresnel-omission label stays attached to the reported event.

An analytical result that is `numerically-unstable` **never** generates a native scene, no matter what verification settings were supplied. A mathematically valid analytical result may still be refused as a physical native scene (for example if the finite detector extends beyond world bounds). Such cases remain distinct.

## What actually runs

Only after both input records validate and the analytical query is `conditional`, the tool prepares one ordinary canonical v5 `planar-media-tracing` scene:

1. One genuine PhyDemo `SingleRay` source at the user-specified physical S, with the **calculated initial heading** explicitly assigned as `directionDeg` and the user-specified brightness.
2. One genuine infinite `PlaneGlass` at the supplied plane point/normal and stated negative/positive indices, with user-selected Fresnel policy.
3. One genuine finite, passive `Detector` centered on the user-specified O, oriented tangent to the interface with its explicitly selected length.

This is a **forward native simulation of one analytically proposed initial heading**. It does not mean PhyDemo discovered an inverse ray, used the predicted crossing as a forced itinerary, or calculated a virtual image. No native source/detector correspondence is invented for arbitrary optical systems; the narrowly admitted fixture contains only one source, one plane and one detector.

The tool requests actual `source-emissions`, `interface-interactions`, `interface-first-event`, `detector-crossings` and opt-in `detector-hit-events`. The normal native methods, complete-run and matching canonical scene SHA gates apply. It requires exactly one native sampled emission, one interface interaction with a transmitted branch of the declared indices, and one complete/count-matched actual detector crossing. The measured incoming unit vector is compared against both the actual first native transmitted branch and the independent conditional direction.

A result is `verified-sampled-arrival` **only when** the native sampled detector coordinate lies within the explicitly requested Euclidean distance tolerance to O, the measured direction and native transmitted-branch direction meet the selected dimensionless unit-vector tolerance, and the native incident and transmitted unsigned angles agree with the analytical values within 1e−5°. The result reports actual native hit coordinates, measured direction, errors, declared tolerances, actual native method and warnings. It is a **per-run sampled observation**, not a general observer-hit accuracy proof or full image.

If actual measured position/direction fails the declared tolerance, the run is `measured-miss`; if native counters, hit events or source hash cannot qualify, `native-evidence-unavailable`; if native tracing stops or truncates, `native-incomplete`; if the actual native run fails, `native-error`; if setup fails, `native-infrastructure-error`. Physically invalid native arrangements are `physical-scene-refused`. All withheld states return **no accepted native hit**; in particular, numerical analysis alone never becomes an achieved detector measurement.

## Run locally

After the standard Node 24 project setup:

```sh
node scripts/jee-observer-native-witness.mjs capabilities
node scripts/jee-observer-native-witness.mjs examples/jee-observer-native-witness-v1.json --out test-artifacts/llm-authoring/my-fresh-observer-native-01
```

The output directory must not exist. It records the original input JSON bytes unchanged (with SHA-256), writes `analytical-result.json` **before** native work, and writes `scene.ray-optics-2d.json` only after the full physical scene passes canonical preparation. The final `report.json` separates analytical result, native result, actual readings, warnings, method and precise outcome. An incomplete or unavailable native check cannot erase the earlier mathematical result. Fresh exclusive writes and hashes are not tamper-proof storage or independent authenticity certificates.

## Test boundaries and deliberately unsupported claims

Regression tests cover the real moderate-angle sample S=(−60,0), O=(100,40), indices 1.5→1; symmetric observer y=−40; retained explicit Fresnel-off warning; typed analysis withheld for the R2 grazing-ingress and y≈9000 coordinate-rounding counterexamples **before** any native work; finite detector outside world coordinates refused; stale/mismatched canonical SHA; deliberately shallow/incomplete native execution; injected infrastructure failure with both earlier evidence outputs preserved; closed physical input and no overwrite. The existing v5 native interface instrumentation remains authoritative. A new physical correctness claim beyond one actual sampled detector crossing needs separate native regression and independent physical review.

**Not implemented:** an eye, retinal sensor, image sharpness, full source provenance, continuous irradiance, Fresnel energy/integral, optical path reconstruction, multi-interface refraction or mirror routes, general source-to-observer search, arbitrary-angle full-field ray tracing, PSF, diffraction, forward-ray numerical error certification, or a universal JEE textbook-answer engine. The reviewer of PR #150 explicitly distinguished conditional analytical geometry from native achieved hit; this child addresses *one* sampled hit with the user's complete physical choices and no broader claim.

All other held v14–v19 branches, the original reviewed #144/#150 code and [issue #123](https://github.com/physicsvigilante/opticsim/issues/123) remain independently held. No production merge or owner release is implied.
