# v26 — Native Beam + planar interface + finite mirror return (frozen feasibility)

This candidate starts from production `main` `34a85e21985d13b4663473c20d7adc1d93fc4953`, after the **independently reviewed J11 PR #193** and its completed 11-workflow post-merge CI. It is a **new reusable engine composition**, not a new JEE answer, an image detector, or a handwritten optical propagation kernel.

## Initial release scope

A deterministic spatially finite native `Beam` reaches a planar dielectric interface; its refracted rays encounter an explicitly authored finite ideal mirror in the second medium, return through the same interface, and can cross an explicitly authored detector on the source side. This is a common **refraction → reflection → refraction** teaching system illuminated by genuine parallel rays, not a single-ray special-case model.

The pre-execution protocol `evaluation/native-parallel-planar-mirror-v26/frozen-protocol.json` was committed at `9c539084a56d5c533b3e8e93916315528222bb39`, **before** any native experiment. It freezes a synthetic 40-mm source and 10 raw experiment cases with an explicit index pair 1/1.5, 30° illumination, x=0 infinite PlaneGlass, x=60 mm finite vertical Mirror, x=−10 mm source-side detector, brightness 0.08, and density 0.2. Every numerical dimension/index is a research choice, *not* an original JEE problem fact.

### Test-only first step

`test/native-parallel-planar-mirror-v26-research.test.mjs` starts from a **genuinely valid public v19** `Beam + PlaneGlass + Detector` document. It clones only the compiled pinned native scene, then adds a native Mirror as a distinctly marked **RAW research** object. No v19 schema is widened or bogus public authoring qualification is asserted. The pinned PhyDemo commit `811f508d2b070898c241a568b0c167dcb8645251` emits every Beam sample, intersects every object, and computes Snell and specular directions itself. Our callbacks observe actual native emitted positions, interface encounters, mirror-reflected directions and detector crossings.

The independent analytical reference is **not** used to steer native light. For a planar interface with indices n0=1/n1=1.5 and initial incident angle 30°, Snell predicts r≈19.4712°, mirror-return *front-surface* displacement `2*60*tan(r)≈42.4264 mm`, and source-side detector inbound/outbound separation `2*60*tan(r)+20*tan(30°)≈53.9734 mm`. The 40-mm, density-.2 native Beam should emit 8 distinct samples, each crossing the interface twice and the mirror once, but these numbers require genuine native proof; a green JavaScript test alone does not certify all branches.

### Frozen negative controls

The experiment includes translation, normal incidence, higher index, denser source, mirror removal, too-short finite mirror, Fresnel-on (raw research only), zero ray-depth and processing stop. A mirror that misses/clips a sample cannot silently report eight successful mirror returns. A fully Fresnel-on run that truncates weak branches is incomplete; a raw observed ray is not an accepted public detector measurement. Any `simulationStop` or `truncation>0` is also incomplete; no fake hit list, image, irradiance or source-to-ray lineage may be synthesized.

## Candidate public v26 safeguards (not yet implemented)

If feasibility is positive, add a **new explicit v26 profile** for one Beam + one vertical PlaneGlass + one finite vertical Mirror in the positive-index medium + 0–2 passive detectors, with no lens, stops or extra media. The Beam must fit fully in the negative-index region, proceed toward the surface, have width 10–100 mm, deterministic samples 1–100 and brightness ≤rayDensity, with no physically assumed exterior index.

The finite mirror must be long enough for the **all-sample first post-entry** Snell encounter positions to clear both endpoints by >0.1 mm. This is a conservative authoring clearance check, not a routed ray. Actual pinned-native post-refraction/reflection rays must still pass completeness, numerical critical/grazing and finite-corner observation checks. Only `partialReflection:false` is eligible for v26 initially; genuine native TIR is not disabled. The public contract must reject Fresnel-on, mirror endpoints, high-to-low near-critical entry, beam beginning inside glass, other optical families, stale source edits and unsupported scenes. Older saved v5 and v19 remain bit-for-bit unchanged.

Do **not** use an author-provided ray/path string to make this work. Reuse native `Beam`, `PlaneGlass`, `Mirror`, ordinary public scene authoring and qualified measurements. Ensure a 32-event detector-hit cap is upheld rather than silently expanding it. The new v26 integration should get **one focused independent review after a final full CI run**, not a separate review of this feasibility-only probe. Keep PR draft and unmerged until cleared.
