# Native two-centre ideal-lens Beam — bounded schema v20

**Research background:** draft PR #165 froze source-backed JEE coverage gaps, including J19; draft PR #166 exercised pinned-native two-lens feasibility. This independent production implementation changes neither frozen evaluation nor original Problems/Solutions. Synthetic numeric scales are authored teaching inputs, not inferred J19 facts.

## Version and admission

A request containing exactly one finite native `parallel-beam` and two `ideal-lens` components selects the isolated `native-parallel-two-lens-tracing` schema/adapter 20. Every lens explicitly requires `x`, `y`, `focalLength`, and `apertureHeight`. Historical centred thin lenses continue to omit `y` in all v1–v19 documents; their compiled native endpoints remain unchanged and no automatic migration is permitted. Unrecognized v20 mixtures fail closed without a schema fallback.

The v20 scene admits one horizontally directed deterministic Beam (direction exactly 0, +180, or -180 degrees), exactly two finite vertical native IdealLens segments ahead of the entire emitter in distinct planes, and 0–2 vertical passive detectors wholly downstream. Emitting width is 10–100 mm, ray density .048–1, up to 100 sampled emissions, and source brightness cannot exceed density. Physical endpoints must fit within 10,000 mm of the world origin.

The geometric validator checks source/lens plane clearance, finite first-lens rim proximity, **post-first-lens second-rim proximity**, bounded outgoing slopes and detector endpoint proximity. The simple sample arrival ordinate here is only a *safety preflight*: it never creates a native ray, chooses an optical route, or reports an image. The pinned unmodified PhyDemo Beam, IdealLens and Detector alone propagate photons/rays and select actual hits. Missing a finite lens remains a genuine native ray bypass, not absorption.

No tilted lenses, material or thick lenses, refractive interfaces, Fresnel splitting, intervening stops, further lenses, arbitrary optical graph, wave behaviour, PSF, continuous irradiance, inferred image reconstruction, or automatic inverse problem are admitted. Existing coaxial reduced-facts lens queries must not silently discard transverse displacement. Stopped, truncated, stale or ambiguous native evidence retains the current suppression rules.

## Evidence and review

The synthetic public request in `examples/jee-parallel-two-lens-v20.json` chooses f = 200 mm, separation 3f, d = 2 mm, finite apertures and downstream detectors. The geometric conditional reference (5f, 2d) is **not** a native image-detection claim. `test/jee-parallel-two-lens-v20.test.mjs` checks signed offsets, translation, reverse travel, genuine finite misses, units, save/revise and refusal boundaries.

`scripts/jee-parallel-two-lens-acceptance.mjs` tests full source-to-strict-authoring-to-pinned-native-to-qualified-package results, including two refusals. `scripts/jee-parallel-two-lens-browser.mjs` tests a real Chrome physical offset edit and native event change, qualified save/reopen, and invalid second-rim edit. Optical CI uploads native and browser evidence.

This is builder-side CI verification, **not independent R2 physics review**. Request a single coherent review of the integrated source, native tests, boundary cases, browser evidence and provenance before considering merge into main. Keep PR #165 and PR #166 held unless independently authorized.
