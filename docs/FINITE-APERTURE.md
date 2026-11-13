# Milestone 24 — native finite aperture with a central transparent gap

## Scope and native mapping

The existing version-4 `general-component-tracing` family admits an explicitly authored `finite-aperture` backed by the **unmodified pinned PhyDemo `Aperture`**. Its five numerical parameters are centre `x,y` (mm), surface tangent `orientationDeg` (degrees CCW in y-up), full outer `length` (mm), and central transparent `openingLength` (mm). A centred opening is a *physical* choice: Opticsim never invents it from the appearance of a problem diagram or treats it as a sampling/camera setting.

The adapter derives the two endpoints of the full line with the existing `mirrorEndpoints` helper. It interpolates symmetric inner endpoints, and maps native `Aperture` `p1,p2,p3,p4` (reversing y); the native object's two opaque arms are `p1-p3` and `p2-p4`. `filter:false` means perfectly opaque arms and an unobstructed gap. Native PhyDemo alone computes each ray intersection/absorption. We do not add a ray tracer, wave optics, diffraction, arbitrary apertures, transmission equations, or a separate scene DSL.

The general composition allows 1–4 sources, 0–4 coaxial ideal lenses, 0–4 finite plane mirrors, 0–2 passive detectors, and at most **two total opaque stops** of type line blocker, circular blocker or finite aperture. The 16-component maximum remains unchanged. Legacy and isolated optical-family schemas remain strict. `openingLength` must be at least 1 mm and leave two solid arms of at least 1 mm each. Derived endpoints must stay within ±10,000 mm; sources must be ≥0.01 mm off the supporting line. Opaque arms may not intersect other finite optical surfaces or detectors, with a 0.01 mm minimum clearance when an aperture arm is involved. A lens, detector, or 2D opaque circle may occupy the transparent opening only when physically disjoint from its opaque arms. The full supporting segment is **not** treated as solid.

## Measurement semantics

The already-existing stable-ID `blocker-absorptions` channel counts actual native `Aperture.onRayIncident` outcomes with `isAbsorbed:true`, via the same per-instance observer as line and circular blockers. No passing-ray count is fabricated from a cone, an assumed route or an analytical transmission formula: actual downstream `ray-detector` readings are measured independently. Native results are available only after complete matching-hash runs; stale, incomplete, invalid, failed, stopped and ill-defined runs suppress accepted readings. A zero detector count does not prove optical darkness; a nonzero count does not measure continuous throughput, irradiance or the 3D optical power.

Authoring, strict unit conversions, bounded validation, physical edits, Fit, immutable parameter sweeps, qualified import/export, native rendering and the existing Chrome viewer are reused. The pinned engine and static demo allowlist are unchanged. There is no automatic public deployment or retroactive change to original JEE question evidence.

## Synthetic acceptance

`examples/finite-aperture-detector.json` specifies source S1 at (-200,0) mm, 20-degree full directional cone, brightness 0.08; aperture B1 at (0,0) mm, vertical, total length 80 mm with a centred 30-mm transparent gap; and detector D1 at (100,0) mm, vertical, length 80 mm. Finite preview sampling emits six rays. Native opaque-arm absorptions and detector crossings (not a continuous-visibility theorem) are compared with narrower/wider gaps and an independently evaluated scene with no aperture. CI checks baseline, shifts, invalid overlap, a lens entirely in the gap, invalid and missing physical inputs, and a four-sample immutable opening-width sweep.

Node regressions check native mapping/serialization, correct y-up conversion, exact gap geometry, disjoint lens/detector overlap policy, circle-aperture compatibility, combined two-stop cardinality, schema isolation, target binding, observer delegation, stale suppression, multi-source counts and qualified Fit/export. Browser acceptance exercises the same physical gap edits and qualified import/reopen pathway already used for line and circular opaque stops.

**Limit:** This is a finite **2D linear aperture**, not a circular pupil, 3D diaphragm, diffraction aperture, wave-optical interference or image-plane detector. Those need separate physics contracts and evidence.
