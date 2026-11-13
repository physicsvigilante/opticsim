# Native finite opaque line blockers (general composition)

This increment adds one **fully opaque finite line segment** using the existing unmodified pinned PhyDemo `Blocker`. It expands the existing v4 `general-component-tracing` arrangement, without a new ray tracer, light-source family, observer model, or dedicated scene schema.

## Authoring and geometry

A `line-blocker` needs the **explicit** centre `x,y`, surface tangent `orientationDeg` counterclockwise from +x in y-up coordinates, and positive finite `length`. The LLM may use only stated values and explicit request units (mm/cm/m). The adapter computes real endpoints by the existing mirror/detector geometry function, reverses y for PhyDemo, and compiles one `Blocker` with `filter:false` (no wavelength filter).

A general scene permits **1–4 point sources**, **0–4 coaxial ideal lenses**, **0–4 finite plane mirrors**, **0–2 finite blockers**, and **0–2 passive finite detectors**. Existing source emissions are full-circle or directional, with exact stated brightness and angles. This change does not enable blockers inside prism/circular/polygon/planar glass or curved-mirror/return/legacy image-prediction scene families.

Every finite segment has positive length ≥1 mm and derived endpoints within ±10,000 mm; sources need ≥0.01 mm clearance from blocker supporting lines. Two blockers cannot intersect/overlap each other or a lens/mirror/detector segment. Detectors remain separate passive objects. Unspecified source brightness, detector size, blocker width or optical path are never invented.

## Actual native observation

`blocker-absorptions` records actual native `Blocker.onRayIncident` returns with `isAbsorbed:true`, by stable component ID. The observer delegates exactly once and preserves the native return/ray state. If the native result is not an absorption decision it records an invalid observation and fails the run. A valid zero count is available only after a complete hash-matched native run; stopped, truncated, stale, undefined, invalid and failed runs suppress accepted values.

Existing `source-emissions`, `detector-crossings`, and relative `detector-signed-power` remain native sampled measurements. A zero crossing does **not** prove an entire object or scene invisible. No continuous shadow, inverse opaque-disc radius, ray-source attribution, measured watts, physical irradiance, 3D geometry or detected image is inferred.

## Tested synthetic stop

The bundled `blocker-detector` viewer scene and `examples/blocker-detector.json` specify source `S1` at (-200,0) mm, cone centred 0° with 20° full opening and brightness 0.08, finite vertical blocker `B1` centred (0,0) mm with length 80 mm, and detector `D1` centred (100,0) mm with length 80 mm. At preview density the pinned native engine emitted **6 rays**, recorded **6 real absorptions**, and had **0 detector crossings**. With the *same authored stop* translated to y=100 mm, native absorption became **0** and detector crossings became **4**. These are finite sampled counts, not a theorem of perfect light blockage.

The existing authoring/preflight, qualified scene packages, atomic physical edit history, immutable parameter sweeps, Fit and static viewer are reused. Node tests cover real native object creation, observed ray counts and zeros, source sampling, geometry refusal, backward schema isolation, stale/incomplete suppression and provenance. The CLI acceptance records eight fully synthetic cases and a three-point blocker sweep, including an invalid intersection. The Chrome script verifies physical edits, light rendering, export/reopen, invalid overlap and narrow-screen Fit.

The original JEE source archive, previous sealed evaluations, PhyDemo pin, core optical formulas, model API, and public deployment remain unchanged. Finite circles, apertures with holes and continuous visibility are future separate capabilities.

## Reviewed shared safeguards

The authoring ceiling is derived from these existing family counts: at most
**16** general-scene components, still subject to all individual count and
geometry limits. Both native result channels and published capability metadata
are copied defensively. Async result evaluation binds to one invocation, and
stale UI errors cannot overwrite current readouts. See [review and regression
evidence](BLOCKER-REVIEW.md). No additional optical primitive is implied.
