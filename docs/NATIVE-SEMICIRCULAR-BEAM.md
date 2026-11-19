# Native semicircular Beam — bounded schema v21

## Purpose and provenance

A reusable, **authorable** 2D curved-refraction composition motivated by the frozen JEE J12 coverage gap in draft PR #165 and research-only pinned-native feasibility in draft PR #168. **Do not confuse these with independent physics certification or a solved original J12 problem.** The original source specifies a half-cylinder, 45-degree parallel incidence and glass index sqrt(2), but not a numerical radius, surrounding index, Beam width, source geometry, detector or simulator policy. This feature's synthetic example **explicitly declares** all additional choices (radius=100 mm, surrounding index=1, the finite Beam and passive detector). No source Solutions used.

## Strict physical contract

One native deterministic finite PhyDemo `Beam`, one stationary right-facing `semicircular-dielectric`, and **zero to two** downstream passive vertical native `Detector` segments. Versioned schema/adapter/model: `21/21/native-parallel-semicircular-tracing`. v20 remains reserved for unmerged PR #167. No migration of older saves or fallback to loose general tracing.

Required medium fields (all explicit): `x`, `y` (centre of flat diameter); `radius >= 5 mm`; `insideIndex`, `outsideIndex` between 1 and 4 with inside > outside; and `partialReflection=false`. Only one unrotated right semicircle with its flat face at x and curved half extending toward x+radius. Physical vertices must be within +/-10,000 mm.

The native `Glass` geometry is exactly:
```
[{x, y: -(cy+r), arc:false},
 {x:x+r, y:-cy, arc:true},
 {x, y:-(cy-r), arc:false}]
```
The middle `arc:true` denotes a genuine circular arc of the pinned solver, **not** a polygonal approximation, ideal thin lens or `CircleGlass`.

One horizontal-family finite Beam with `directionDeg` from -60° through +60°, width 10–100 mm, density .048–1, source brightness no greater than density and at most 100 emitted samples. Every initial (un-refracted) sample must hit the **flat finite face** safely more than 0.1 mm from either flat/arc joint; sources outside/behind/tangent to the diameter are refused, rather than treated as native curved-entry or general ray routing. Detectors lie entirely beyond the half-circle's +x extent and on distinct planes, with segment endpoints in world bounds.

Native PhyDemo alone chooses all later refractions, multiple curved hits, TIR and actual detector crossings. An explicit Fresnel-off approximation **omits partial reflection but never turns off native TIR**. There is no ray scripting or custom optical tracer. The first native callback on `Glass` is a real interaction, not a prescribed route or image.

## Conservative runtime qualification

Every real native `Glass.onRayIncident` callback is classified using **its actual native hit point** into `face-flat` or `face-arc`; corresponding outward normal and medium order are derived only at the callback. A native hit closer than or equal to **0.1 mm** to either seam, a near-grazing hit or an unclassified/non-finite hit increments an observer error and causes all native measurements to be withheld. This guard delegates exactly once to the original native method: it neither changes the hit nor suppresses native propagation. A native completion callback alone is insufficient: native undefined behaviour, truncation, failed geometry observers, stops or stale hashes suppress measurements. Detector events over the existing 32-hit limit are unavailable, not truncated into a fake full list.

Authorable results: finite sampled Beam emissions, total native interface interactions, real face-specific event counts + first-event angles/directions, native TIR counts, sampled detector crossings and (up to the existing 32-event limit) exact passive positions/directions. Relative brightness is **not radiometric irradiance**, a finite zero detector count is not universal shadow, a 2D cross-section is not a complete 3D half-cylinder, and no observed image, PSF, inverse solve or original J12 textbook result is claimed.

## Verification and release gate

`test/jee-semicircular-beam-v21.test.mjs` checks actual pinned-native flat/arc Snell events, signed 45° illumination, material variation, translation, TIR, seam guards, old-model isolation, stable edits, save/reopen, low-budget/stale suppression, event overflow and refused essential inputs. `scripts/jee-semicircular-beam-acceptance.mjs` exercises a fixed public-source-to-native-qualified protocol; `scripts/jee-semicircular-beam-browser.mjs` exercises real Chrome physical edits, native retracing, qualified export/reopen and invalid-scene/stale suppression. CI stores raw executed evidence.

Research PR #168 stays unmerged. **Draft PR #169 must pass all current CI and one coherent independent physics/integration review of the final exact source tree before merging.** PR #167 keeps its separate unreviewed hold; neither draft is merged automatically. New tests do not amend frozen J12 original assessments or source material.
