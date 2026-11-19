# v18 — Two native thick lenses, finite mirror and finite aperture (draft)

**Status:** unreleased bounded physical engine candidate. No production merge or independent R2 verification is implied by source CI. Depends on held v17 PR #116, v16 #113, v15 #110 and v14 #107. Separately held PR #118 adds detector directional footprint from production main; it is not a v18 dependency.

## Physical scene

Only `schemaVersion:18`, `adapterVersion:18`, `physics.model:"native-two-thick-lens-mirror-aperture-tracing"` admits:

- Exactly **two fully authored nonrotated biconvex `spherical-lens`** objects, with independent positive front/back radii, explicit center thickness, finite aperture height and inside indices; a common explicitly authored exterior index.
- Exactly **one independent finite `plane-mirror`** and **one vertical `finite-aperture`** (`orientationDeg` exactly +90° or −90°), whose two opaque native arms surround an explicitly sized central transparent gap.
- **1–4 explicitly directed native single-ray point sources**, **0–2 passive finite ray detectors**.
- Original `partialReflection` flags on each lens, including native total internal reflection and full-Fresnel branching when explicitly enabled. `false` omits Fresnel partial reflection; this is an approximation.
- `runPolicy:"native-deep-v18"` with exactly 16 maximum native ray interactions, native density 0.2 and processed ray limit 10000 when omitted or explicitly selected. `preview-v1` keeps depth 8 and can truncate returns. The source's exact native fixed pin is unchanged.

No author-supplied ray itinerary, collision order, reflected return, image, PSF, irradiance, watts, source attribution or solver replacement is accepted. Rays may miss any object; a gap is not a guaranteed passage for every sampled ray. A blocker hit terminates the native ray. The detector retains its existing count and signed-relative-power semantics, not continuous power.

## Geometry admission — reusable but intentionally conservative

**Old validators are reused, not reimplemented.** The exact existing v17 whole-system validator (run on a validation-only subset without the aperture) checks both lens shapes/rims, their mutual complete x-envelope separation, shared material exterior, source/rim/tangent restrictions, mirror separation and passive detector exclusion. Original v4 general-optical line/aperture checks (run on a validation-only subset without thick lenses) still check finite arm/mirror intersections and source supporting-line separation; the original detector validator checks finite segments. No optical component is removed from the canonical document or native compilation.

The new v18-only guard also requires:

1. All four actual aperture outer and inner endpoint coordinates to be finite and within ±10000 mm.
2. **At least 0.01 mm x-separation between the entire finite aperture (including its gap) and each whole thick-lens x-envelope.** Transparent empty space cannot justify a partially overlapping glass body.
3. Every point of the mirror and detector segments lies strictly to one side of the aperture supporting x-plane with at least 0.01 mm clearance, even if the segments have nonintersecting y-ranges.
4. Every source starts at least 0.01 mm off that plane. A source's **initial** ray may not pass within 0.01 mm of either opaque-arm endpoint or either opening endpoint, nor be nearly vertical (`|cos(direction)|<=1e-8`). This check does not calculate later ray interactions.

These are **admission margins**, not guarantees of binary64 intersection accuracy or universal ray corner clearance. Near-simultaneous later encounters can still become incomplete or undefined; Opticsim withholds qualified results instead of selecting its own intersection or claiming a deterministic transmitted image. Tilting/rotating the stop, additional stops, extra mirrors/lenses, nested media, animated parts and sources inside glass are outside this candidate and must be evaluated separately.

## Execution and evidence limits

Native PhyDemo `SingleRay`, `SphericalLens`, `Mirror`, `Aperture`, `Detector` objects compute all physics. Existing `observeBlockerSet` wraps each native aperture incident exactly once and counts true reported `isAbsorbed` callbacks, without adjusting rays. The canonical SHA, same-scene revision gate, stop/error/weak-Fresnel truncation, undefined behavior and completion requirements are unchanged. Any incomplete execution suppresses requested values, including legitimately observed but partial absorption counts. Zero qualified hits means zero **sampled** hits, not a continuous darkness or physical image.

Public workflow checks compare an on-axis opening (native return), shifted opening (native absorption before lenses), genuine misses, preview-depth truncation, full-Fresnel incompleteness and invalid glass overlap. Real Chrome checks verify source/lens/stop editing, true native re-tracing, invalid-state hiding, qualified export and reopen, and no external HTTP(S) dependencies. CI pass is **source-native sampling evidence** and does not replace independent optical review.

**Version isolation:** v17 saved scenes reject the aperture; v1–v16 contracts and depth limits are unchanged. A `native-deep-v17` input is refused for v18, and `native-deep-v18` input is refused for v17 or any older model. No implicit scene downgrade or upgrade is performed.

## Review gate

Before release, an independent second-context reviewer must inspect the exact candidate source HEAD and Git tree, recompute representative geometry and corner/clearance cases, independently inspect native/Chrome run evidence and failed attempts, and explicitly distinguish source-CI execution from independently reproduced native optics. **No merge is permitted without separate owner authorization for each prerequisite PR and this candidate.**
