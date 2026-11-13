# Simulation-first systems roadmap from the JEE Optical Systems Atlas

This is an engineering ranking proposed by the same assistant who inspected the forty fixed `Problems` PNGs, **not** statistically inferred coverage, textbook solution scoring or independent expert adjudication. Multiple needs overlap within a question; sample counts do **not** add.

## Priority candidates

| Proposed order | Capability family | Tagged in reviewed cases | Status | Exact upstream native opportunity |
|---:|---|---:|---|---|
| 1 | General finite 2D dielectric polygons | 7 | design-next | Glass polygonal boundary; reuse native v8 prism path/first-event observer |
| 2 | Opaque stops, finite apertures and passive screens | 2 | design-next | Blocker; CircleBlocker; Aperture; existing Detector |
| 3 | Bounded source/branch event lineage | 7 | research | Native source start and incident callbacks |
| 4 | Observer and qualified apparent-image geometry | 10 | research | Existing Scene observer rendering and native detectors as distinct ideas |
| 5 | Directional fans and true parallel beams in refractive scenes | 9 | deferred-by-owner | Beam; AngleSource; PointSource |
| 6 | Decentered and subsequently tilted thin lens trains | 1 | later | IdealLens finite endpoints support nonzero y center |
| 7 | Extended objects as bounded groups of physical points | 3 | later | PointSource; multi-source support |
| 8 | Microscope, telescope and simplified eye models | 5 | later | IdealLens lens trains and Detector |
| 9 | Shared-corner finite mirror sets | 2 | later | Mirror |
| 10 | General time functions for moving sources | 2 | later | Reuse immutable quasi-static MotionPlayer |
| 11 | Material-index, thick lenses and immersed lenses | 1 | later | SphericalLens and Glass |
| 12 | Reduced prism deviation and index inverse observables | 5 | secondary-analysis | Existing native triangular Glass for optional forward verification |
| 13 | Safe restricted graded-index material families | 1 | high-risk-later | GrinGlass; CurveGrinGlass |

All native opportunities are source-level classes in the **pinned PhyDemo commit** `811f508d2b070898c241a568b0c167dcb8645251`. Having a class upstream **does not establish** safe Opticsim authorability, numerical completeness, observer/image truth or validation of combined media.

## First physical system pilot: bounded finite glass polygon

**Target:** a general *2D finite uniform dielectric polygon* with an initial safe scope of **one non-self-intersecting convex quadrilateral**, **1–4 explicit native single rays** and **0–2 external detectors**. This is an **implementation proposal**, not part of this Atlas PR.

Why this first? Seven of the forty reviewed examples use a nontriangular finite or curved glass region. Current canonical glass families expose one triangle or one complete circle, so a validated polygon begins to remove an artificial limitation without replacing native PhyDemo.

Use the **existing native `Glass`** polygon renderer/intersector, not a synthetic stack of crossing `PlaneGlass` half-planes. Generalize and reuse strict triangular-prism radius/edge/corner guards, orientation-independent local normals, validated indices, exactly-once native observers, ID binding, qualification and camera Fit. Require the author to give every vertex and both refractive indices; no dimensions inferred from schematics or inverse results.

**Acceptance direction (A17):** create a *fully declared synthetic square glass block* illuminated by one exact single ray. Verify actual native entrance, internal propagation, possible TIR and exit face(s), observer delegation and analytical Snell invariants. Tests must reject bow-tie/self-intersecting shapes, corner/grazing ambiguity, nested/overlapping regions, invalid indices, intersecting detectors, incomplete Fresnel paths and stale hashes. Show the **same** validation, edit, sweep and export round-trip in the existing viewer. The original A17 text does not supply arbitrary block dimensions or a full source specification, so its numerical question remains **ungraded**.

**Architectural constraint:** avoid proliferating prism-v9/block-v10 isolated controllers. Introduce a reusable convex-region validator/finite-surface observer shared with existing prism logic while preserving prior v4–v8 scene meanings. Do not loosen unrelated families or reinterpret historical attempts.

## Second pilot: blockers, aperture and screen observability

Pinned PhyDemo already provides `Blocker`, `CircleBlocker`, `Aperture` and `Detector`. Start with explicit finite absorber geometry and measured **sampled** ray crossings (with and without obstruction). Preserve source/optical separations and real native absorbed rays; there is no newly coded "stop" law.

The water-and-disc A18 system additionally needs point-source **angular coverage** in refractive media, native escape/critical-angle validation and a justified observer visibility definition. A single absorbed ray or empty detector is **not proof that an observer sees nothing**. Do not call A18 solved until those pieces and numerical sampling uncertainty are supported.

## Dependencies and holdbacks

- **Parallel/fan beams (9 tagged cases)**: native `Beam` and `AngleSource` exist, but implementation is **deferred by the owner**. Do not make it a hidden prerequisite of the glass-block acceptance.
- **Curved caps and silvered glass (A14/A20/A26–A28)**: require actual arc-plus-line surface geometry, correctly modelled 2D regions, mixed refraction/reflection and calibrated observer evidence. A full 2D circle is not a 3D glass hemisphere.
- **Observer/apparent-image (10 tagged cases)**: needs bounded, conditional ray-convergence/paraxial or validated image observations rather than treating native screen pixels as a detected image.
- **Bounded ray lineage (7 tagged cases)**: should derive from real incident events, distinguish split Fresnel branches and multiple sources, and never infer that the three independently recorded first face events form a prescribed path.
- **Instruments (5 tagged cases)**: reuse lens trains, but angular magnification and accommodation require explicit eye/near-point/tube-length conventions, and should remain unavailable when unspecified.
- **Graded-index (A15)**: native `GrinGlass` exists; mathematical expression parsing and numerical integration need strict named profiles and independent tests—not arbitrary model-generated executable expressions.
- **Mirror enclosures and extended objects**: require shared endpoints, surface-hit handling, emitter identity and/or shape-aware image mapping; raw reflection counts are not image counts.
- **Inverse prism/mirror calculations** are useful **secondary analytical observables**. Add only reusable relations with explicit physical facts, not one code path per JEE exercise.
- **3D glass pipe/eye/sphere phenomena** cannot be silently replaced with exact conclusions from their 2D cross-sections.

## Acceptance gate for any selected pilot

Before merging a *separate* physical-capability PR: demonstrate fresh pinned-native source provenance, independent geometry/reflection/refraction invariants, missing/invalid-input refusal, complete-vs-truncated result suppression, qualified round-trip, immutable sweep, real-Chrome visuals and zero edits to sealed attempts. Keep the one-off evidence workflow out of the final branch. Explicit owner merge approval is required.

The [machine-readable roadmap](roadmap.json) lists each candidate's cases, exact pinned native class, dependencies, risk and next synthetic acceptance. This atlas changes **no engine physics**.
